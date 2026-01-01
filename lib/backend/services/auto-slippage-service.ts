/**
 * Auto Slippage Service
 * 
 * Orchestrates multi-attempt route fetching with increasing slippage.
 * Selects the best route from successful attempts based on output amount.
 * 
 * Strategy:
 * 1. Get liquidity for token pair
 * 2. Calculate initial slippage from liquidity
 * 3. Try route with initial slippage
 * 4. If fails, retry with 2x slippage (max 3 attempts)
 * 5. Select best route (highest output amount) from successful attempts
 */

import { getLiquidityService, MAX_AUTO_SLIPPAGE } from './liquidity-service';
import { getRouteService } from './route-service';
import type { RouteRequest, RouteResponse, RouterRoute } from '@/lib/backend/routers/types';

// ============================================================================
// Types
// ============================================================================

export interface SlippageAttempt {
  slippage: number;
  route: RouterRoute | null;
  error: Error | null;
  outputAmount: number; // For comparison (toToken.amount as number)
}

export interface AutoSlippageResult {
  route: RouterRoute;
  appliedSlippage: number;
  attempts: SlippageAttempt[];
  liquidityUSD?: number;
}

// ============================================================================
// Auto Slippage Service
// ============================================================================

export class AutoSlippageService {
  private liquidityService = getLiquidityService();
  private routeService = getRouteService();

  /**
   * Get optimal route with auto slippage
   * 
   * This method:
   * 1. Fetches liquidity for the token pair
   * 2. Calculates initial slippage based on liquidity
   * 3. Attempts to fetch routes with increasing slippage (max 3 attempts)
   * 4. Selects the best route (highest output amount) from successful attempts
   * 
   * IMPORTANT: For each slippage attempt, we still query ALL routers
   * (LiFi, Uniswap, PancakeSwap) and select the best route from them.
   * Then we compare the best routes from all slippage attempts.
   * 
   * @param request - Route request (slippageMode should be 'auto')
   * @returns Best route with applied slippage
   */
  async getRouteWithAutoSlippage(
    request: RouteRequest
  ): Promise<AutoSlippageResult> {
    // 1. Get liquidity for token pair
    // Priority: Use liquidity from request (frontend) > Fetch from API (fallback)
    let liquidityUSD: number | null = null;
    
    if (request.liquidityUSD !== undefined && request.liquidityUSD > 0) {
      // Use liquidity provided by frontend (from token data)
      liquidityUSD = request.liquidityUSD;
      console.log('[AutoSlippageService] Using liquidity from frontend:', liquidityUSD);
    } else {
      // Fallback: Fetch liquidity from DexScreener (for edge cases like direct API calls)
      console.log('[AutoSlippageService] Liquidity not provided, fetching from API...');
      const liquidity = await this.liquidityService.getPairLiquidity(
        {
          address: request.fromToken.address,
          chainId: request.fromToken.chainId,
        },
        {
          address: request.toToken.address,
          chainId: request.toToken.chainId,
        }
      );
      liquidityUSD = liquidity?.liquidityUSD || null;
    }

    // 2. Calculate initial slippage
    const initialSlippage = liquidityUSD !== null
      ? this.liquidityService.calculateInitialSlippage(liquidityUSD)
      : 0.5; // Default if liquidity unknown

    console.log('[AutoSlippageService] Starting auto slippage:', {
      liquidityUSD: liquidityUSD || 'unknown',
      initialSlippage,
      fromToken: request.fromToken.symbol,
      toToken: request.toToken.symbol,
    });

    // 3. Try multiple slippage values (max 3 attempts)
    const attempts: SlippageAttempt[] = [];
    let currentSlippage = initialSlippage;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[AutoSlippageService] Attempt ${attempt} with slippage ${currentSlippage}%`);

        // Fetch route with current slippage
        // NOTE: This still queries ALL routers and selects best route from them
        const routeResponse: RouteResponse = await this.routeService.getRoute({
          ...request,
          slippage: currentSlippage,
          slippageMode: 'fixed', // Force fixed mode for this attempt
        });

        if (routeResponse.route) {
          const outputAmount = parseFloat(routeResponse.route.toToken.amount) || 0;

          attempts.push({
            slippage: currentSlippage,
            route: routeResponse.route,
            error: null,
            outputAmount,
          });

          console.log(`[AutoSlippageService] Attempt ${attempt} succeeded:`, {
            slippage: currentSlippage,
            outputAmount,
            router: routeResponse.route.router,
          });

          // If we're already at max slippage and got a route, we can stop early
          // But we'll continue to check if lower slippage gives better price
          if (currentSlippage >= MAX_AUTO_SLIPPAGE) {
            console.log('[AutoSlippageService] Reached max slippage, stopping attempts');
            break;
          }
        } else {
          // Route service returned null (no route found)
          attempts.push({
            slippage: currentSlippage,
            route: null,
            error: new Error('No route found'),
            outputAmount: 0,
          });

          console.log(`[AutoSlippageService] Attempt ${attempt} failed: No route found`);
        }
      } catch (error: any) {
        attempts.push({
          slippage: currentSlippage,
          route: null,
          error: error instanceof Error ? error : new Error(String(error)),
          outputAmount: 0,
        });

        console.log(`[AutoSlippageService] Attempt ${attempt} failed:`, error.message);
      }

      // Calculate next slippage (if not last attempt and not at max)
      if (attempt < 3 && currentSlippage < MAX_AUTO_SLIPPAGE) {
        currentSlippage = this.liquidityService.calculateNextSlippage(
          currentSlippage,
          attempt
        );
      }
    }

    // 4. Select best route from successful attempts
    const successfulAttempts = attempts.filter(a => a.route !== null && a.outputAmount > 0);

    if (successfulAttempts.length === 0) {
      const lastError = attempts[attempts.length - 1]?.error;
      throw new Error(
        `No route found after 3 attempts with auto slippage. ` +
        `Tried slippage: ${attempts.map(a => `${a.slippage}%`).join(', ')}. ` +
        `Last error: ${lastError?.message || 'Unknown error'}. ` +
        `Consider using fixed slippage mode with higher tolerance.`
      );
    }

    // Select route with highest output amount (best price for user)
    const bestAttempt = this.selectBestRoute(successfulAttempts);

    console.log('[AutoSlippageService] Best route selected:', {
      slippage: bestAttempt.slippage,
      outputAmount: bestAttempt.outputAmount,
      router: bestAttempt.route?.router,
      totalAttempts: attempts.length,
      successfulAttempts: successfulAttempts.length,
    });

    return {
      route: bestAttempt.route!,
      appliedSlippage: bestAttempt.slippage,
      attempts: attempts,
      liquidityUSD: liquidityUSD || undefined,
    };
  }

  /**
   * Select best route from successful attempts
   * 
   * Criteria (priority order):
   * 1. Highest output amount (best price for user)
   * 2. Lower slippage (if output amounts are very similar)
   * 3. Lower gas fees (if outputs and slippage are similar)
   * 
   * @param attempts - Successful slippage attempts
   * @returns Best attempt
   */
  private selectBestRoute(attempts: SlippageAttempt[]): SlippageAttempt {
    if (attempts.length === 1) {
      return attempts[0];
    }

    // Sort by output amount (descending), then by slippage (ascending)
    const sorted = [...attempts].sort((a, b) => {
      const outputDiff = Math.abs(a.outputAmount - b.outputAmount);
      const outputDiffPercent = outputDiff / Math.max(a.outputAmount, b.outputAmount);

      // If output amounts are very similar (< 0.1% difference), prefer lower slippage
      if (outputDiffPercent < 0.001) {
        return a.slippage - b.slippage; // Lower slippage is better
      }

      // Otherwise, prefer higher output amount
      return b.outputAmount - a.outputAmount;
    });

    return sorted[0];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let autoSlippageServiceInstance: AutoSlippageService | null = null;

/**
 * Get singleton AutoSlippageService instance
 */
export function getAutoSlippageService(): AutoSlippageService {
  if (!autoSlippageServiceInstance) {
    autoSlippageServiceInstance = new AutoSlippageService();
  }
  return autoSlippageServiceInstance;
}

