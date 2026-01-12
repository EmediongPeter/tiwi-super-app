/**
 * Jupiter Router Adapter
 * 
 * Implements SwapRouter interface for Jupiter Ultra Swap API.
 * Uses Jupiter Ultra API for Solana same-chain swaps with best executed prices.
 * 
 * Features:
 * - Real-Time Slippage Estimator (RTSE) for auto mode
 * - MEV protection
 * - Sub-second transaction landing
 * - Fee collection via referral accounts
 * Implements SwapRouter interface for Jupiter Aggregator (Solana).
 * Uses Jupiter API for route fetching and quote generation.
 */

import { BaseRouter } from '../base';
import { toHumanReadable } from '../transformers/amount-transformer';
import { QUOTE_EXPIRATION_SECONDS } from '../constants';
import { SOLANA_CHAIN_ID } from '@/lib/backend/providers/moralis';
import { getJupiterReferralService } from '@/lib/backend/services/jupiter-referral-service';
import { getJupiterFeeInfoService } from '@/lib/backend/services/jupiter-fee-info-service';
import type { RouterParams, RouterRoute, RouteStep } from '../types';

// Jupiter API endpoints
const JUPITER_ULTRA_API_BASE = 'https://api.jup.ag/ultra/v1';
const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';
const LIFI_SOL_ADDRESS = '11111111111111111111111111111111'; // LiFi's native SOL address format

/**
 * Normalize Solana token address to Jupiter format
 * Converts LiFi's native SOL address to Jupiter's wrapped SOL mint address
 */
function normalizeSolanaAddress(address: string): string {
  // LiFi uses: 11111111111111111111111111111111 (32 ones)
  // Jupiter uses: So11111111111111111111111111111111111111112 (wrapped SOL mint)
  if (address === LIFI_SOL_ADDRESS) {
    return NATIVE_SOL_MINT;
  }
  return address;
}

// Jupiter API Key (REQUIRED for Ultra API)
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || process.env.NEXT_PUBLIC_JUPITER_API_KEY || '';

// Tiwi protocol fee: 31 bps = 0.25% net after Jupiter's 20% cut
// 31 bps × 0.8 = 24.8 bps ≈ 0.25% net
const TIWI_REFERRAL_FEE_BPS = '50';

/**
 * Jupiter Ultra Order Response
 */
interface JupiterOrderResponse {
  mode: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan?: any[];
  feeBps: number;
  feeMint: string;
  platformFee?: {
    feeBps: number;
    amount: string;
  };
  signatureFeeLamports: number;
  prioritizationFeeLamports: number;
  rentFeeLamports: number;
  swapType: string;
  router: string;
  transaction?: string; // Base64 encoded transaction (if taker provided)
  gasless: boolean;
  requestId: string;
  totalTime: number;
  taker: string;
  inUsdValue?: number;
  outUsdValue?: number;
  priceImpact?: number;
  swapUsdValue?: number;
  referralAccount?: string;
  quoteId?: string;
  expireAt?: string;
  errorCode?: number;
  errorMessage?: string;
}

/**
 * Jupiter Router Adapter
 * 
 * Handles route fetching from Jupiter Lite API.
 * Only supports same-chain Solana swaps.
 */
export class JupiterAdapter extends BaseRouter {
  name = 'jupiter';
  displayName = 'Jupiter';
  
  /**
   * Get router priority (lower = higher priority)
   * Jupiter has priority 3 for Solana swaps (higher than Uniswap/PancakeSwap)
   */
  getPriority(): number {
    return 3;
  }
  
  /**
   * Get supported chains
   * Jupiter only supports Solana
   */
  async getSupportedChains(): Promise<number[]> {
    return [SOLANA_CHAIN_ID];
  }
  
  /**
   * Check if Jupiter supports a specific chain
   * Only supports Solana (7565164)
   */
  async supportsChain(chainId: number): Promise<boolean> {
    return chainId === SOLANA_CHAIN_ID;
  }
  
  /**
   * Jupiter does NOT support cross-chain swaps
   * Only same-chain Solana swaps
   */
  supportsCrossChain(): boolean {
    return false;
  }
  
  /**
   * Get maximum supported slippage (50% = 5000 bps)
   */
  getMaxSlippage(): number {
    return 50; // 50%
  }
  
  /**
   * Get minimum supported slippage (0.1% = 10 bps)
   */
  getMinSlippage(): number {
    return 0.1; // 0.1%
  }
  
  /**
   * Get route from Jupiter Ultra API
   */
  async getRoute(params: RouterParams): Promise<RouterRoute | null> {
    try {
      // Validate parameters
      if (!params.fromChainId || !params.toChainId || !params.fromToken || !params.toToken || !params.fromAmount) {
        throw new Error('Missing required parameters');
      }
      
      // Ensure same chain (Jupiter doesn't support cross-chain)
      const fromChainId = typeof params.fromChainId === 'number' 
        ? params.fromChainId 
        : parseInt(String(params.fromChainId), 10);
      const toChainId = typeof params.toChainId === 'number'
        ? params.toChainId
        : parseInt(String(params.toChainId), 10);
      
      if (fromChainId !== toChainId) {
        return null; // Cross-chain not supported
      }
      
      if (fromChainId !== SOLANA_CHAIN_ID) {
        return null; // Only Solana supported
      }
      
      // Validate amount
      if (!params.fromAmount || params.fromAmount === '0') {
        throw new Error('Invalid swap amount');
      }
      
      // Validate API key (required for Ultra API)
      if (!JUPITER_API_KEY) {
        console.warn('[JupiterAdapter] JUPITER_API_KEY not configured. Ultra API requires API key.');
        return null;
      }
      
      // Get referral account for fee collection
      const referralService = getJupiterReferralService();
      const referralAccount = await referralService.getReferralAccount();
      
      // Normalize token addresses to Jupiter format
      // LiFi uses different address format for native SOL (1111...1111)
      // Jupiter requires wrapped SOL mint address (So111...11112)
      const normalizedFromToken = normalizeSolanaAddress(params.fromToken);
      const normalizedToToken = normalizeSolanaAddress(params.toToken);
      
      // Get order from Jupiter Ultra API
      // Note: Ultra API doesn't accept slippage parameter - RTSE handles it automatically
      // Only pass taker if recipient is provided (don't send empty string to avoid "Invalid taker" error)
      const order = await this.getJupiterOrder(
        normalizedFromToken,
        normalizedToToken,
        params.fromAmount,
        params.recipient, // taker (user's wallet address) - undefined if not provided
        referralAccount?.toBase58(),
        params.slippageMode || 'fixed'
      );
      
      if (!order) {
        return null; // No route found
      }
      
      // Validate order has valid output
      if (!order.outAmount || order.outAmount === '0') {
        return null; // Invalid order
      }
      
      // Validate slippage for fixed mode
      if (params.slippageMode === 'fixed' && params.slippage !== undefined) {
        const expectedSlippageBps = Math.round(params.slippage * 100);
        const actualSlippageBps = order.slippageBps;
        
        // Warn if slippage differs significantly (more than 10% difference)
        const slippageDiff = Math.abs(actualSlippageBps - expectedSlippageBps);
        if (slippageDiff > expectedSlippageBps * 0.1) {
          console.warn(`[JupiterAdapter] RTSE used different slippage: expected ${expectedSlippageBps} bps, got ${actualSlippageBps} bps`);
        }
      }
      
      // Normalize Jupiter order to RouterRoute format
      return this.normalizeRoute(order, params);
    } catch (error: any) {
      console.error('[JupiterAdapter] Error fetching route:', error);
      throw error;
    }
  }
  
  /**
   * Get order from Jupiter Ultra API
   * 
   * Note: Ultra API doesn't accept slippage parameter - RTSE automatically determines optimal slippage
   * For fixed mode, we validate the response's slippageBps matches user's expectation
   */
  private async getJupiterOrder(
    inputMint: string,
    outputMint: string,
    amount: string,
    taker: string | undefined, // User's wallet address (optional - only include if provided)
    referralAccount?: string, // Referral account for fee collection
    slippageMode: 'fixed' | 'auto' = 'fixed'
  ): Promise<JupiterOrderResponse | null> {
    try {
      // Build params - only include taker if it's provided and not empty
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
      });
      
      // Only add taker if it's provided and not empty (Jupiter API rejects empty taker)
      if (taker && taker.trim() !== '') {
        params.set('taker', taker);
      }
      
      // Add referral account and fee if available
      if (referralAccount && referralAccount.trim() !== '') {
        params.set('referralAccount', referralAccount);
        params.set('referralFee', TIWI_REFERRAL_FEE_BPS); // 31 bps = 0.25% net
      }
      
      const url = `${JUPITER_ULTRA_API_BASE}/order?${params.toString()}`;
      console.log("🚀 ~ JupiterAdapter ~ getJupiterOrder ~ url:", url)
      
      console.log('[JupiterAdapter] Fetching order from Ultra API:', {
        inputMint,
        outputMint,
        amount,
        taker: taker ? `${taker.substring(0, 8)}...` : 'not provided',
        referralAccount: referralAccount ? `${referralAccount.substring(0, 8)}...` : 'not configured',
        slippageMode,
      });
      
      // Add timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'x-api-key': JUPITER_API_KEY, // REQUIRED for Ultra API
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        const data: JupiterOrderResponse = await response.json();
        console.log("🚀 ~ JupiterAdapter ~ getJupiterOrder ~ data:", data)
        if (!response.ok) {
          if (response.status === 404) {
            console.warn('[JupiterAdapter] No route found (404)');
            return null;
          }
          
          const errorText = await response.text().catch(() => response.statusText);
          
          // Try to parse error as JSON, but handle parse errors gracefully
          let errorData: any = null;
          if (errorText) {
            try {
              errorData = JSON.parse(errorText);
            } catch (parseError) {
              // Not JSON, use as plain text
              errorData = null;
            }
          }
          
          if (errorData?.errorMessage) {
            throw new Error(`Jupiter API error: ${errorData.errorMessage}`);
          }
          
          throw new Error(`Jupiter API error: ${errorText || response.statusText}`);
        }
        
        // const data: JupiterOrderResponse = await response.json();
        
        // Check for error in response
        if (data.errorCode || data.errorMessage) {
          console.warn('[JupiterAdapter] Order response contains error:', {
            errorCode: data.errorCode,
            errorMessage: data.errorMessage,
          });
          return null;
        }
        
        // Validate response
        if (!data || (!data.outAmount && data.outAmount !== '0')) {
          console.warn('[JupiterAdapter] Invalid order response format');
          return null;
        }
        
        // Validate order has valid output amount
        if (data.outAmount === '0' || BigInt(data.outAmount) === BigInt(0)) {
          console.warn('[JupiterAdapter] Order returned zero output amount');
          return null;
        }
        
        // Validate fee collection (if referral account provided)
        if (referralAccount && data.feeBps) {
          const expectedFeeBps = parseInt(TIWI_REFERRAL_FEE_BPS);
          if (data.feeBps !== expectedFeeBps) {
            console.warn(`[JupiterAdapter] Fee mismatch: expected ${expectedFeeBps} bps, got ${data.feeBps} bps. Fee account may not be initialized for feeMint: ${data.feeMint}`);
          }
        }
        
        console.log('[JupiterAdapter] Order successful:', {
          inAmount: data.inAmount,
          outAmount: data.outAmount,
          slippageBps: data.slippageBps,
          priceImpact: data.priceImpactPct || data.priceImpact,
          feeBps: data.feeBps,
          feeMint: data.feeMint,
          hasTransaction: !!data.transaction,
        });
        
        return data;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Jupiter API request timeout');
        }
        
        throw fetchError;
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      console.error('[JupiterAdapter] Error fetching order:', errorMessage);
      throw new Error(`Jupiter order error: ${errorMessage}`);
    }
  }
  
  /**
   * Normalize Jupiter Ultra order to RouterRoute format
   */
  private normalizeRoute(
    order: JupiterOrderResponse,
    params: RouterParams
  ): RouterRoute {
    // Calculate exchange rate
    const fromAmountBigInt = BigInt(order.inAmount);
    const toAmountBigInt = BigInt(order.outAmount);
    const exchangeRate = toAmountBigInt > BigInt(0)
      ? (Number(toAmountBigInt) / Number(fromAmountBigInt)).toFixed(6)
      : '0';
    
    // Parse price impact (can be string or number)
    const priceImpact = order.priceImpactPct || order.priceImpact?.toString() || '0';
    const priceImpactNum = typeof priceImpact === 'string' ? parseFloat(priceImpact) : (priceImpact as number);
    
    // Convert amounts to human-readable format
    const fromAmountHuman = toHumanReadable(order.inAmount, params.fromDecimals);
    const toAmountHuman = toHumanReadable(order.outAmount, params.toDecimals);
    
    // Calculate expiration timestamp (use expireAt from order if available, otherwise default)
    const expiresAt = order.expireAt 
      ? new Date(order.expireAt).getTime()
      : Date.now() + (QUOTE_EXPIRATION_SECONDS * 1000);
    
    // Calculate gas fees (signature + prioritization + rent)
    const totalLamports = order.signatureFeeLamports + order.prioritizationFeeLamports + order.rentFeeLamports;
    const gasEstimate = (totalLamports / 1e9).toFixed(9); // Convert lamports to SOL
    
    // Create route step
    const step: RouteStep = {
      type: 'swap',
      chainId: SOLANA_CHAIN_ID,
      fromToken: {
        address: params.fromToken,
        amount: fromAmountHuman,
        symbol: undefined, // Will be enriched by route service
      },
      toToken: {
        address: params.toToken,
        amount: toAmountHuman,
        symbol: undefined, // Will be enriched by route service
      },
      protocol: order.router === 'iris' ? 'Jupiter (Iris)' : 'Jupiter',
      description: `Swap on Jupiter via ${order.router}`,
    };
    
    // Build RouterRoute
    const route: RouterRoute = {
      router: this.name,
      routeId: order.requestId || `jupiter-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      
      fromToken: {
        chainId: SOLANA_CHAIN_ID,
        address: params.fromToken,
        symbol: '', // Will be enriched by route service
        amount: fromAmountHuman,
        amountUSD: order.inUsdValue?.toFixed(2), // Use USD value from order if available
        decimals: params.fromDecimals,
      },
      toToken: {
        chainId: SOLANA_CHAIN_ID,
        address: params.toToken,
        symbol: '', // Will be enriched by route service
        amount: toAmountHuman,
        amountUSD: order.outUsdValue?.toFixed(2), // Use USD value from order if available
        decimals: params.toDecimals,
      },
      
      exchangeRate,
      priceImpact: Math.abs(priceImpactNum).toFixed(2), // Use absolute value
      slippage: (order.slippageBps / 100).toFixed(2), // Convert bps to percentage
      
      fees: {
        protocol: order.platformFee?.amount ? toHumanReadable(order.platformFee.amount, params.fromDecimals) : '0',
        gas: gasEstimate,
        gasUSD: '0.00', // Will be calculated by route service
        total: '0.00', // Will be calculated by route service
      },
      
      steps: [step],
      
      estimatedTime: order.totalTime ? Math.ceil(order.totalTime / 1000) : 2, // Convert ms to seconds, default 2s
      expiresAt,
      
      // Store transaction data for execution (if available)
      transactionData: order.transaction,
      
      // Store raw order response for debugging and execution
      raw: {
        ...order,
        // Store additional metadata for execution
        requestId: order.requestId,
        feeMint: order.feeMint,
        feeBps: order.feeBps,
      },
    };
    
    return route;
  }
}

