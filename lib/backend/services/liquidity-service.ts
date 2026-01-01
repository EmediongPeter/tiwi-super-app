      /**
 * Liquidity Service
 * 
 * Fetches liquidity data for token pairs and calculates optimal slippage.
 * Uses DexScreener API for liquidity data (already integrated).
 * 
 * Based on industry standards (Uniswap, 1inch, Paraswap):
 * - Low liquidity pools need higher slippage
 * - High liquidity pools can use lower slippage
 */

import { getCanonicalChain } from '@/lib/backend/registry/chains';
import { getCache } from '@/lib/backend/utils/cache';

// ============================================================================
// Types
// ============================================================================

export interface LiquidityData {
  liquidityUSD: number;
  volume24h: number;
  pairCount: number;
  topPair: {
    address: string;
    liquidityUSD: number;
    dexName: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Liquidity thresholds for initial slippage calculation
 * Based on industry research (Uniswap, Paraswap, 1inch patterns)
 */
const LIQUIDITY_THRESHOLDS = [
  { max: 10000, slippage: 10.0 },      // Very low: < $10k → 10%
  { max: 50000, slippage: 5.0 },       // Low: $10k-$50k → 5%
  { max: 100000, slippage: 3.0 },      // Medium-low: $50k-$100k → 3%
  { max: 500000, slippage: 1.5 },      // Medium: $100k-$500k → 1.5%
  { max: 1000000, slippage: 1.0 },     // Medium-high: $500k-$1M → 1%
  { max: Infinity, slippage: 0.5 },    // High: > $1M → 0.5%
] as const;

/**
 * Maximum slippage for auto mode
 */
export const MAX_AUTO_SLIPPAGE = 30.5;

/**
 * Default slippage when liquidity is unknown
 */
const DEFAULT_SLIPPAGE = 0.5;

/**
 * Cache TTL for liquidity data (5 minutes)
 */
const LIQUIDITY_CACHE_TTL = 5 * 60 * 1000;

// ============================================================================
// DexScreener Chain Mapping
// ============================================================================

const DEXSCREENER_CHAIN_MAP: Record<number, string> = {
  1: 'ethereum',
  56: 'bsc',
  137: 'polygon',
  42161: 'arbitrum',
  43114: 'avalanche',
  8453: 'base',
  10: 'optimism',
  250: 'fantom',
  100: 'gnosis',
  1101: 'polygonzkevm',
  324: 'zksync',
  5000: 'mantle',
  59144: 'linea',
  534352: 'scroll',
};

// ============================================================================
// Liquidity Service
// ============================================================================

export class LiquidityService {
  private cache = getCache();

  /**
   * Get liquidity data for a token pair
   * 
   * Strategy:
   * 1. Fetch pairs for fromToken from DexScreener
   * 2. Find pair that includes toToken (direct pair)
   * 3. If no direct pair, use minimum of both token liquidities
   * 
   * @param fromToken - Source token
   * @param toToken - Destination token
   * @returns Liquidity data or null if unavailable
   */
  async getPairLiquidity(
    fromToken: { address: string; chainId: number },
    toToken: { address: string; chainId: number }
  ): Promise<LiquidityData | null> {
    try {
      // Check cache first
      const cacheKey = `liquidity:${fromToken.chainId}:${fromToken.address.toLowerCase()}:${toToken.address.toLowerCase()}`;
      const cached = this.cache.get<LiquidityData>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get DexScreener chain slug
      const chainSlug = DEXSCREENER_CHAIN_MAP[fromToken.chainId];
      if (!chainSlug) {
        console.warn(`[LiquidityService] Chain ${fromToken.chainId} not supported by DexScreener`);
        return null;
      }

      // Fetch pairs for fromToken
      const url = `https://api.dexscreener.com/latest/dex/tokens/${fromToken.address}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.warn(`[LiquidityService] DexScreener API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (!data.pairs || !Array.isArray(data.pairs) || data.pairs.length === 0) {
        return null;
      }

      // Filter pairs by chain
      const chainPairs = data.pairs.filter((pair: any) =>
        pair.chainId?.toLowerCase() === chainSlug.toLowerCase()
      );

      if (chainPairs.length === 0) {
        return null;
      }

      // Find direct pair (fromToken ↔ toToken)
      const directPair = chainPairs.find((pair: any) => {
        const baseAddress = pair.baseToken?.address?.toLowerCase();
        const quoteAddress = pair.quoteToken?.address?.toLowerCase();
        const fromAddress = fromToken.address.toLowerCase();
        const toAddress = toToken.address.toLowerCase();
        
        return (
          (baseAddress === fromAddress && quoteAddress === toAddress) ||
          (baseAddress === toAddress && quoteAddress === fromAddress)
        );
      });

      // If direct pair found, use it
      if (directPair) {
        const liquidityUSD = parseFloat(directPair.liquidity?.usd || '0');
        const volume24h = parseFloat(directPair.volume?.h24 || '0');
        
        const liquidityData: LiquidityData = {
          liquidityUSD,
          volume24h,
          pairCount: chainPairs.length,
          topPair: {
            address: directPair.pairAddress,
            liquidityUSD,
            dexName: directPair.dexId || 'Unknown',
          },
        };

        // Cache result
        this.cache.set(cacheKey, liquidityData, LIQUIDITY_CACHE_TTL);
        return liquidityData;
      }

      // No direct pair: use highest liquidity pair for fromToken
      // This gives us an estimate of the token's overall liquidity
      const topPair = chainPairs.reduce((best: any, pair: any) => {
        const bestLiquidity = best.liquidity?.usd || 0;
        const pairLiquidity = pair.liquidity?.usd || 0;
        return pairLiquidity > bestLiquidity ? pair : best;
      }, chainPairs[0]);

      const liquidityUSD = parseFloat(topPair.liquidity?.usd || '0');
      const volume24h = parseFloat(topPair.volume?.h24 || '0');

      const liquidityData: LiquidityData = {
        liquidityUSD,
        volume24h,
        pairCount: chainPairs.length,
        topPair: {
          address: topPair.pairAddress,
          liquidityUSD,
          dexName: topPair.dexId || 'Unknown',
        },
      };

      // Cache result
      this.cache.set(cacheKey, liquidityData, LIQUIDITY_CACHE_TTL);
      return liquidityData;
    } catch (error) {
      console.error('[LiquidityService] Error fetching liquidity:', error);
      return null;
    }
  }

  /**
   * Calculate initial slippage based on liquidity
   * 
   * Uses tiered thresholds based on industry standards:
   * - < $10k: 10% (very low liquidity)
   * - $10k-$50k: 5% (low liquidity)
   * - $50k-$100k: 3% (medium-low)
   * - $100k-$500k: 1.5% (medium)
   * - $500k-$1M: 1% (medium-high)
   * - > $1M: 0.5% (high liquidity)
   * 
   * @param liquidityUSD - Liquidity in USD
   * @returns Initial slippage percentage (0.5 to 10)
   */
  calculateInitialSlippage(liquidityUSD: number): number {
    if (liquidityUSD <= 0) {
      return DEFAULT_SLIPPAGE;
    }

    // Find appropriate threshold
    for (const threshold of LIQUIDITY_THRESHOLDS) {
      if (liquidityUSD <= threshold.max) {
        return threshold.slippage;
      }
    }

    // Fallback to default (shouldn't happen)
    return DEFAULT_SLIPPAGE;
  }

  /**
   * Calculate next slippage attempt
   * 
   * Multiplies current slippage by 2, capped at MAX_AUTO_SLIPPAGE (30.5%)
   * 
   * @param currentSlippage - Current slippage percentage
   * @param attempt - Attempt number (1, 2, or 3)
   * @returns Next slippage percentage
   */
  calculateNextSlippage(currentSlippage: number, attempt: number): number {
    // On final attempt (3), use max slippage
    if (attempt >= 3) {
      return MAX_AUTO_SLIPPAGE;
    }

    // Multiply by 2, capped at max
    const nextSlippage = currentSlippage * 2;
    return Math.min(MAX_AUTO_SLIPPAGE, nextSlippage);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let liquidityServiceInstance: LiquidityService | null = null;

/**
 * Get singleton LiquidityService instance
 */
export function getLiquidityService(): LiquidityService {
  if (!liquidityServiceInstance) {
    liquidityServiceInstance = new LiquidityService();
  }
  return liquidityServiceInstance;
}

