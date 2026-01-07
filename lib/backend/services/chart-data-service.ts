/**
 * Chart Data Service
 * 
 * Main orchestration service for fetching chart data.
 * Implements fallback strategy: Pair → Base Token → Quote Token
 * Falls back to DexScreener if Bitquery fails.
 */

import { BitqueryChartProvider } from '@/lib/backend/providers/bitquery-chart-provider';
import { DexScreenerChartProvider } from '@/lib/backend/providers/dexscreener-chart-provider';
import { convertPairToWrapped } from '@/lib/backend/utils/token-address-helper';
import type {
  ChartDataParams,
  OHLCBar,
  ChartProviderResponse,
  SymbolInfo,
  ChartConfiguration,
  ResolutionString,
} from '@/lib/backend/types/chart';
import { getCanonicalChain } from '@/lib/backend/registry/chains';

// ============================================================================
// Chart Data Service
// ============================================================================

export class ChartDataService {
  private bitqueryProvider: BitqueryChartProvider;
  private dexscreenerProvider: DexScreenerChartProvider;

  constructor() {
    this.bitqueryProvider = new BitqueryChartProvider();
    this.dexscreenerProvider = new DexScreenerChartProvider();
  }

  /**
   * Get historical OHLC bars with fallback strategy
   * Strategy: Pair → Base Token → Quote Token → DexScreener
   */
  async getHistoricalBars(params: ChartDataParams): Promise<OHLCBar[]> {
    // Convert native tokens to wrapped versions
    const { baseToken, quoteToken } = convertPairToWrapped(
      params.baseToken,
      params.quoteToken,
      params.chainId
    );

    // Strategy 1: Try to fetch pair OHLC data
    try {
      const pairResponse = await this.bitqueryProvider.fetchPairOHLC({
        baseToken,
        quoteToken,
        chainId: params.chainId,
        resolution: params.resolution,
        from: params.from,
        to: params.to,
      });

      if (pairResponse.bars && pairResponse.bars.length > 0) {
        return pairResponse.bars;
      }
    } catch (error: any) {
      // Check if it's a points limit error - if so, don't try fallbacks (all keys exhausted)
      const errorMessage = (error?.message || '').toLowerCase();
      if (errorMessage.includes('points limit') || errorMessage.includes('all api keys')) {
        console.error(`[ChartDataService] Points limit exceeded for all API keys: ${error.message}`);
        throw error; // Re-throw to surface the error
      }
      console.warn(`[ChartDataService] Pair OHLC fetch failed: ${error.message}`);
    }

    // Strategy 2: Try to fetch base token OHLC data
    // try {
    //   const baseResponse = await this.bitqueryProvider.fetchTokenOHLC({
    //     token: baseToken,
    //     chainId: params.chainId,
    //     resolution: params.resolution,
    //     from: params.from,
    //     to: params.to,
    //   });

    //   if (baseResponse.bars && baseResponse.bars.length > 0) {
    //     console.log(`[ChartDataService] Successfully fetched base token OHLC data: ${baseResponse.bars.length} bars`);
    //     return baseResponse.bars;
    //   }
    // } catch (error: any) {
    //   console.warn(`[ChartDataService] Base token OHLC fetch failed: ${error.message}`);
    // }

    // // Strategy 3: Try to fetch quote token OHLC data
    // try {
    //   const quoteResponse = await this.bitqueryProvider.fetchTokenOHLC({
    //     token: quoteToken,
    //     chainId: params.chainId,
    //     resolution: params.resolution,
    //     from: params.from,
    //     to: params.to,
    //   });

    //   if (quoteResponse.bars && quoteResponse.bars.length > 0) {
    //     console.log(`[ChartDataService] Successfully fetched quote token OHLC data: ${quoteResponse.bars.length} bars`);
    //     return quoteResponse.bars;
    //   }
    // } catch (error: any) {
    //   console.warn(`[ChartDataService] Quote token OHLC fetch failed: ${error.message}`);
    // }

    // // Strategy 4: Fallback to DexScreener
    // try {
    //   const dexResponse = await this.dexscreenerProvider.fetchPairOHLC({
    //     baseToken,
    //     quoteToken,
    //     chainId: params.chainId,
    //     resolution: params.resolution,
    //     from: params.from,
    //     to: params.to,
    //   });

    //   if (dexResponse.bars && dexResponse.bars.length > 0) {
    //     console.log(`[ChartDataService] Successfully fetched DexScreener data: ${dexResponse.bars.length} bars`);
    //     return dexResponse.bars;
    //   }
    // } catch (error: any) {
    //   console.warn(`[ChartDataService] DexScreener fetch failed: ${error.message}`);
    // }

    // All strategies failed - return empty array
    console.warn(`[ChartDataService] All data fetching strategies failed for ${baseToken}/${quoteToken} on chain ${params.chainId}`);
    return [];
  }

  /**
   * Resolve symbol information for TradingView
   * Symbol format: {baseAddress}-{quoteAddress}-{chainId}
   */
  async resolveSymbol(symbolName: string): Promise<SymbolInfo> {
    // Parse symbol format: baseAddress-quoteAddress-chainId
    const parts = symbolName.split('-');
    if (parts.length !== 3) {
      throw new Error(`[ChartDataService] Invalid symbol format: ${symbolName}. Expected: baseAddress-quoteAddress-chainId`);
    }

    const [baseAddress, quoteAddress, chainIdStr] = parts;
    const chainId = parseInt(chainIdStr, 10);

    if (isNaN(chainId)) {
      throw new Error(`[ChartDataService] Invalid chain ID: ${chainIdStr}`);
    }

    // Get chain information
    const chain = getCanonicalChain(chainId);
    if (!chain) {
      throw new Error(`[ChartDataService] Unsupported chain ID: ${chainId}`);
    }

    // Convert native tokens to wrapped
    const { baseToken, quoteToken } = convertPairToWrapped(baseAddress, quoteAddress, chainId);

    // For now, use addresses as symbol names
    // TODO: Fetch token metadata (symbol, name) from token service
    const baseSymbol = baseToken.slice(0, 6) + '...' + baseToken.slice(-4);
    const quoteSymbol = quoteToken.slice(0, 6) + '...' + quoteToken.slice(-4);

    // Determine price scale based on typical token prices
    // For very small prices (scientific notation like 5e-13), we need high precision
    // pricescale = 10^n where n is the number of decimal places
    // Using 10^18 to handle very small prices (up to 18 decimal places)
    const pricescale = 1000000000000000000; // 18 decimals - handles very small prices

    return {
      name: `${baseSymbol}/${quoteSymbol}`,
      ticker: symbolName,
      description: `${baseSymbol}/${quoteSymbol} on ${chain.name}`,
      type: 'crypto',
      session: '24x7',
      timezone: 'Etc/UTC',
      exchange: chain.name,
      listed_exchange: chain.name,
      minmov: 1,
      pricescale,
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: true,
      supported_resolutions: this.bitqueryProvider.getSupportedResolutions(),
      intraday_multipliers: ['1', '5', '15', '30', '60'],
      volume_precision: 2,
      data_status: 'endofday', // Use 'endofday' for historical data to prevent TradingView from continuously fetching
    };
  }

  /**
   * Get chart configuration
   */
  getConfiguration(): ChartConfiguration {
    return {
      supported_resolutions: this.bitqueryProvider.getSupportedResolutions(),
      
      exchanges: [
        { value: 'BSC', name: 'BNB Chain', desc: 'BNB Chain' },
        { value: 'ETH', name: 'Ethereum', desc: 'Ethereum' },
        { value: 'POLYGON', name: 'Polygon', desc: 'Polygon' },
        { value: 'ARBITRUM', name: 'Arbitrum', desc: 'Arbitrum' },
        { value: 'OPTIMISM', name: 'Optimism', desc: 'Optimism' },
        { value: 'BASE', name: 'Base', desc: 'Base' },
      ],
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let chartDataServiceInstance: ChartDataService | null = null;

/**
 * Get the singleton ChartDataService instance
 */
export function getChartDataService(): ChartDataService {
  if (!chartDataServiceInstance) {
    chartDataServiceInstance = new ChartDataService();
  }
  return chartDataServiceInstance;
}

