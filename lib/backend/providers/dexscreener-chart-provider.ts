/**
 * DexScreener Chart Provider (Fallback)
 * 
 * Fetches OHLC historical data from DexScreener REST API.
 * Used as fallback when Bitquery fails or is unavailable.
 * Note: DexScreener has limited historical data compared to Bitquery.
 */

import type {
  OHLCBar,
  PairOHLCParams,
  TokenOHLCParams,
  ChartProviderResponse,
  ResolutionString,
} from '@/lib/backend/types/chart';

// ============================================================================
// DexScreener Configuration
// ============================================================================

const DEXSCREENER_API_BASE = 'https://api.dexscreener.com/latest/dex';

/**
 * Map chain ID to DexScreener chain slug
 */
const CHAIN_TO_DEXSCREENER_SLUG: Record<number, string> = {
  1: 'ethereum',
  56: 'bsc',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base',
  43114: 'avalanche',
  250: 'fantom',
  100: 'gnosis',
  1101: 'polygonzkevm',
  324: 'zksync',
  5000: 'mantle',
  59144: 'linea',
  534352: 'scroll',
};

/**
 * Map TradingView resolution to approximate time range
 * DexScreener doesn't support custom intervals, so we approximate
 */
function resolutionToTimeRange(resolution: ResolutionString): { hours: number } {
  switch (resolution) {
    case '1':
      return { hours: 24 }; // Last 24 hours for 1-minute bars
    case '5':
      return { hours: 24 };
    case '15':
      return { hours: 72 }; // Last 3 days
    case '30':
      return { hours: 168 }; // Last week
    case '60':
      return { hours: 720 }; // Last month
    case '1D':
      return { hours: 2160 }; // Last 3 months
    case '1W':
      return { hours: 8760 }; // Last year
    case '1M':
      return { hours: 26280 }; // Last 3 years
    default:
      return { hours: 24 };
  }
}

// ============================================================================
// DexScreener Chart Provider
// ============================================================================

export class DexScreenerChartProvider {
  /**
   * Fetch pair OHLC data
   * DexScreener doesn't provide historical OHLC directly, so we use current pair data
   * and approximate historical data from price history if available
   */
  async fetchPairOHLC(params: PairOHLCParams): Promise<ChartProviderResponse> {
    const chainSlug = CHAIN_TO_DEXSCREENER_SLUG[params.chainId];
    if (!chainSlug) {
      throw new Error(`[DexScreenerChartProvider] Unsupported chain ID: ${params.chainId}`);
    }

    try {
      // DexScreener doesn't have a direct historical OHLC endpoint
      // We'll fetch the pair data and use price history if available
      // For now, return empty array as DexScreener is primarily a fallback
      // and doesn't provide granular historical OHLC data
      
      // TODO: If DexScreener adds historical OHLC endpoint, implement it here
      // For now, this is a placeholder that returns empty data
      // The service layer will handle fallback logic
      
      console.warn('[DexScreenerChartProvider] Historical OHLC not available from DexScreener. Returning empty data.');
      return { bars: [] };
    } catch (error: any) {
      console.error('[DexScreenerChartProvider] Error fetching pair OHLC:', error);
      throw error;
    }
  }

  /**
   * Fetch single token OHLC data
   * Similar to pair OHLC, DexScreener doesn't provide historical OHLC for single tokens
   */
  async fetchTokenOHLC(params: TokenOHLCParams): Promise<ChartProviderResponse> {
    const chainSlug = CHAIN_TO_DEXSCREENER_SLUG[params.chainId];
    if (!chainSlug) {
      throw new Error(`[DexScreenerChartProvider] Unsupported chain ID: ${params.chainId}`);
    }

    try {
      // Fetch token pairs from DexScreener
      const url = `${DEXSCREENER_API_BASE}/tokens/${params.token}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.pairs || !Array.isArray(data.pairs) || data.pairs.length === 0) {
        return { bars: [] };
      }

      // Filter pairs by chain
      const chainPairs = data.pairs.filter((pair: any) =>
        pair.chainId?.toLowerCase() === chainSlug.toLowerCase()
      );

      if (chainPairs.length === 0) {
        return { bars: [] };
      }

      // Get pair with highest liquidity
      const topPair = chainPairs.reduce((best: any, pair: any) => {
        const bestLiquidity = best.liquidity?.usd || 0;
        const pairLiquidity = pair.liquidity?.usd || 0;
        return pairLiquidity > bestLiquidity ? pair : best;
      }, chainPairs[0]);

      // DexScreener doesn't provide historical OHLC, so we can only return current price
      // This is a limitation - we'll return a single bar with current price
      const now = Date.now();
      const currentPrice = parseFloat(topPair.priceUsd || '0');

      if (currentPrice <= 0) {
        return { bars: [] };
      }

      // Return a single bar representing current price
      // This is not ideal but works as a fallback when Bitquery fails
      const bars: OHLCBar[] = [{
        time: now,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        volume: topPair.volume?.h24 || 0,
      }];

      return { bars };
    } catch (error: any) {
      console.error('[DexScreenerChartProvider] Error fetching token OHLC:', error);
      throw error;
    }
  }

  /**
   * Get supported resolutions
   * Note: DexScreener has limited support, so we return minimal resolutions
   */
  getSupportedResolutions(): ResolutionString[] {
    return ['1', '5', '15', '30', '60', '1D'];
  }
}

