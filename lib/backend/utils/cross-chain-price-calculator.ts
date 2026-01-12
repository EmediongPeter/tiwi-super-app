/**
 * Cross-Chain Price Calculator
 * 
 * Calculates cross-chain pair prices by:
 * 1. Fetching OHLCV data for base token (in USD) from its chain
 * 2. Fetching OHLCV data for quote token (in USD) from its chain
 * 3. Calculating pair price as: basePriceUSD / quotePriceUSD
 * 4. Generating OHLCV bars from calculated prices
 */

import type { OHLCBar, ResolutionString } from '@/lib/backend/types/chart';
import { BitqueryChartProvider } from '@/lib/backend/providers/bitquery-chart-provider';
import { convertPairToWrapped } from '@/lib/backend/utils/token-address-helper';

// ============================================================================
// Cross-Chain Price Calculator
// ============================================================================

export interface CrossChainPairParams {
  baseToken: string;
  baseChainId: number;
  quoteToken: string;
  quoteChainId: number;
  resolution: ResolutionString;
  from: number; // Unix timestamp in seconds
  to: number; // Unix timestamp in seconds
}

export class CrossChainPriceCalculator {
  private bitqueryProvider: BitqueryChartProvider;

  constructor() {
    this.bitqueryProvider = new BitqueryChartProvider();
  }

  /**
   * Calculate cross-chain pair OHLCV bars
   * 
   * Strategy:
   * 1. Fetch base token OHLCV in USD from its chain
   * 2. Fetch quote token OHLCV in USD from its chain
   * 3. Align timestamps (merge by time)
   * 4. Calculate pair price: basePriceUSD / quotePriceUSD
   * 5. Generate OHLCV bars
   */
  async calculateCrossChainBars(params: CrossChainPairParams): Promise<OHLCBar[]> {
    console.log(`[CrossChainPriceCalculator] Calculating cross-chain pair: ${params.baseToken} (chain ${params.baseChainId}) / ${params.quoteToken} (chain ${params.quoteChainId})`);

    // Convert native tokens to wrapped
    const { baseToken } = convertPairToWrapped(
      params.baseToken,
      '0x0000000000000000000000000000000000000000', // Dummy quote for base token
      params.baseChainId
    );
    
    const { baseToken: quoteToken } = convertPairToWrapped(
      params.quoteToken,
      '0x0000000000000000000000000000000000000000', // Dummy quote for quote token
      params.quoteChainId
    );

    // Fetch both tokens' OHLCV data in parallel
    const [baseBarsResponse, quoteBarsResponse] = await Promise.all([
      this.fetchTokenOHLCInUSD(baseToken, params.baseChainId, params.resolution, params.from, params.to),
      this.fetchTokenOHLCInUSD(quoteToken, params.quoteChainId, params.resolution, params.from, params.to),
    ]);

    const baseBars = baseBarsResponse.bars || [];
    const quoteBars = quoteBarsResponse.bars || [];

    if (baseBars.length === 0 && quoteBars.length === 0) {
      console.warn('[CrossChainPriceCalculator] No data available for either token');
      return [];
    }

    // If one token has no data, use the other token's price as reference
    if (baseBars.length === 0) {
      console.warn('[CrossChainPriceCalculator] No base token data, using quote token price only');
      // Return quote token bars (will be displayed as inverse)
      return quoteBars;
    }

    if (quoteBars.length === 0) {
      console.warn('[CrossChainPriceCalculator] No quote token data, using base token price only');
      // Return base token bars
      return baseBars;
    }

    // Merge bars by timestamp and calculate pair price
    const pairBars = this.mergeAndCalculatePairBars(baseBars, quoteBars);

    console.log(`[CrossChainPriceCalculator] Generated ${pairBars.length} cross-chain pair bars from ${baseBars.length} base bars and ${quoteBars.length} quote bars`);

    return pairBars;
  }

  /**
   * Fetch token OHLCV data in USD
   * Uses Bitquery's token OHLC query which returns prices in USD
   */
  private async fetchTokenOHLCInUSD(
    token: string,
    chainId: number,
    resolution: ResolutionString,
    from: number,
    to: number
  ): Promise<{ bars: OHLCBar[] }> {
    try {
      const response = await this.bitqueryProvider.fetchTokenOHLC({
        token,
        chainId,
        resolution,
        from,
        to,
      });

      return response;
    } catch (error: any) {
      console.warn(`[CrossChainPriceCalculator] Failed to fetch token OHLC for ${token} on chain ${chainId}: ${error.message}`);
      return { bars: [] };
    }
  }

  /**
   * Merge two OHLC bar arrays by timestamp and calculate pair price
   * Pair price = basePriceUSD / quotePriceUSD
   */
  private mergeAndCalculatePairBars(
    baseBars: OHLCBar[],
    quoteBars: OHLCBar[]
  ): OHLCBar[] {
    // Create maps for quick lookup
    const baseMap = new Map<number, OHLCBar>();
    const quoteMap = new Map<number, OHLCBar>();

    // Index bars by time (rounded to nearest minute for alignment)
    baseBars.forEach(bar => {
      const timeKey = Math.floor(bar.time / 60000) * 60000; // Round to minute
      if (!baseMap.has(timeKey) || baseMap.get(timeKey)!.time < bar.time) {
        baseMap.set(timeKey, bar);
      }
    });

    quoteBars.forEach(bar => {
      const timeKey = Math.floor(bar.time / 60000) * 60000; // Round to minute
      if (!quoteMap.has(timeKey) || quoteMap.get(timeKey)!.time < bar.time) {
        quoteMap.set(timeKey, bar);
      }
    });

    // Get all unique timestamps
    const allTimestamps = new Set<number>([
      ...Array.from(baseMap.keys()),
      ...Array.from(quoteMap.keys()),
    ]);

    const pairBars: OHLCBar[] = [];

    // For each timestamp, calculate pair OHLC
    for (const timeKey of Array.from(allTimestamps).sort((a, b) => a - b)) {
      const baseBar = baseMap.get(timeKey);
      const quoteBar = quoteMap.get(timeKey);

      // If we have both bars, calculate pair price
      if (baseBar && quoteBar) {
        const pairBar = this.calculatePairBar(baseBar, quoteBar, timeKey);
        if (pairBar) {
          pairBars.push(pairBar);
        }
      } else if (baseBar) {
        // Only base bar - use base price (quote = 1)
        const pairBar: OHLCBar = {
          time: timeKey,
          open: baseBar.open,
          high: baseBar.high,
          low: baseBar.low,
          close: baseBar.close,
          volume: baseBar.volume || 0,
        };
        pairBars.push(pairBar);
      } else if (quoteBar) {
        // Only quote bar - use inverse (base = 1)
        const pairBar: OHLCBar = {
          time: timeKey,
          open: 1 / quoteBar.close,
          high: 1 / quoteBar.low,
          low: 1 / quoteBar.high,
          close: 1 / quoteBar.open,
          volume: quoteBar.volume || 0,
        };
        pairBars.push(pairBar);
      }
    }

    return pairBars.sort((a, b) => a.time - b.time);
  }

  /**
   * Calculate pair OHLC bar from base and quote bars
   * Pair price = basePriceUSD / quotePriceUSD
   */
  private calculatePairBar(
    baseBar: OHLCBar,
    quoteBar: OHLCBar,
    time: number
  ): OHLCBar | null {
    // Calculate pair prices
    // Open: baseOpen / quoteOpen
    // Close: baseClose / quoteClose
    // High: max(baseHigh/quoteLow, baseLow/quoteHigh) - highest possible pair price
    // Low: min(baseLow/quoteHigh, baseHigh/quoteLow) - lowest possible pair price

    const baseOpen = baseBar.open;
    const baseHigh = baseBar.high;
    const baseLow = baseBar.low;
    const baseClose = baseBar.close;

    const quoteOpen = quoteBar.open;
    const quoteHigh = quoteBar.high;
    const quoteLow = quoteBar.low;
    const quoteClose = quoteBar.close;

    // Validate prices
    if (baseOpen <= 0 || baseHigh <= 0 || baseLow <= 0 || baseClose <= 0 ||
        quoteOpen <= 0 || quoteHigh <= 0 || quoteLow <= 0 || quoteClose <= 0) {
      return null;
    }

    // Calculate pair OHLC
    const open = baseOpen / quoteOpen;
    const close = baseClose / quoteClose;

    // High: maximum possible pair price during the period
    // This occurs when base is at its high and quote is at its low
    const high = Math.max(
      baseHigh / quoteLow,
      baseLow / quoteHigh,
      open,
      close
    );

    // Low: minimum possible pair price during the period
    // This occurs when base is at its low and quote is at its high
    const low = Math.min(
      baseLow / quoteHigh,
      baseHigh / quoteLow,
      open,
      close
    );

    // Volume: use average of both volumes (or base volume if quote has none)
    const volume = (baseBar.volume || 0) + (quoteBar.volume || 0) / 2;

    return {
      time,
      open,
      high,
      low,
      close,
      volume,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let calculatorInstance: CrossChainPriceCalculator | null = null;

export function getCrossChainPriceCalculator(): CrossChainPriceCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new CrossChainPriceCalculator();
  }
  return calculatorInstance;
}

