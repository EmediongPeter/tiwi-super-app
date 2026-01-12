/**
 * Chart Price Updater
 * 
 * Updates the last candle in chart data with the current price
 * to ensure the chart displays the most accurate current price.
 */

import type { OHLCBar } from '@/lib/backend/types/chart';
import { getTokenPrice } from '@/lib/backend/providers/price-provider';

/**
 * Get resolution in milliseconds for price update logic
 * Used to determine if we should update existing bar or create new one
 */
function getResolutionInMsForUpdate(ageMs: number): number {
  // Estimate resolution based on bar age
  // For 15-minute bars, typical age would be 0-15 minutes
  // For 1-hour bars, typical age would be 0-60 minutes
  // Default to 15 minutes (900000 ms)
  if (ageMs < 60 * 60 * 1000) {
    return 15 * 60 * 1000; // 15 minutes
  } else if (ageMs < 24 * 60 * 60 * 1000) {
    return 60 * 60 * 1000; // 1 hour
  } else {
    return 24 * 60 * 60 * 1000; // 1 day
  }
}

/**
 * Update the last candle with current price
 * This ensures the chart shows the most recent/accurate price
 * CRITICAL: This uses the same calculation as the header (fromToken.price / toToken.price)
 */
export async function updateLastCandleWithCurrentPrice(
  bars: OHLCBar[],
  baseToken: string,
  quoteToken: string,
  baseChainId: number,
  quoteChainId: number
): Promise<OHLCBar[]> {
  if (bars.length === 0) {
    console.warn('[ChartPriceUpdater] No bars to update');
    return bars;
  }

  try {
    // Fetch current prices for both tokens (same source as header)
    const [basePrice, quotePrice] = await Promise.all([
      getTokenPrice(baseToken, baseChainId),
      getTokenPrice(quoteToken, quoteChainId),
    ]);

    if (!basePrice || !quotePrice) {
      console.error('[ChartPriceUpdater] Could not fetch current prices', {
        baseToken,
        quoteToken,
        baseChainId,
        quoteChainId,
        basePrice: !!basePrice,
        quotePrice: !!quotePrice,
      });
      return bars;
    }

    const basePriceUSD = parseFloat(basePrice.priceUSD);
    const quotePriceUSD = parseFloat(quotePrice.priceUSD);

    if (isNaN(basePriceUSD) || isNaN(quotePriceUSD) || basePriceUSD <= 0 || quotePriceUSD <= 0) {
      console.error('[ChartPriceUpdater] Invalid prices', {
        basePriceUSD,
        quotePriceUSD,
        baseToken,
        quoteToken,
      });
      return bars;
    }

    // Calculate current pair price: basePriceUSD / quotePriceUSD
    // This is the SAME calculation used in the header (fromToken.price / toToken.price)
    const currentPairPrice = basePriceUSD / quotePriceUSD;

    // Get the last bar
    const lastBar = bars[bars.length - 1];
    const oldClose = lastBar.close;
    const now = Date.now();

    // CRITICAL: Always update the last bar with the calculated current price
    // This ensures the chart price matches the header price exactly
    // The header uses: fromToken.price / toToken.price = basePriceUSD / quotePriceUSD
    lastBar.close = currentPairPrice;
    
    // Update high/low to include current price (but don't break historical data)
    lastBar.high = Math.max(lastBar.high, currentPairPrice);
    lastBar.low = Math.min(lastBar.low, currentPairPrice);
    
    // If the old close was significantly different, log a warning and potentially fix it
    const priceDiff = Math.abs(currentPairPrice - oldClose);
    const avgPrice = (oldClose + currentPairPrice) / 2;
    const priceDiffPercent = avgPrice > 0 ? (priceDiff / avgPrice) * 100 : 0;
    
    if (priceDiffPercent > 10) {
      // If the difference is more than 10%, the historical data might be wrong
      // But we'll still use the correct current price for the last candle
      console.error(`[ChartPriceUpdater] MAJOR price discrepancy detected:`, {
        oldClose,
        currentPairPrice,
        difference: priceDiff,
        percentDiff: priceDiffPercent.toFixed(2) + '%',
        basePriceUSD,
        quotePriceUSD,
        note: 'Using calculated current price (matches header)',
      });
    } else if (priceDiffPercent > 5) {
      console.warn(`[ChartPriceUpdater] Significant price difference detected:`, {
        oldClose,
        currentPairPrice,
        difference: priceDiff,
        percentDiff: priceDiffPercent.toFixed(2) + '%',
        basePriceUSD,
        quotePriceUSD,
      });
    }

    console.log(`[ChartPriceUpdater] ✅ Updated last candle:`, {
      oldClose,
      newClose: currentPairPrice,
      basePriceUSD: `$${basePriceUSD}`,
      quotePriceUSD: `$${quotePriceUSD}`,
      pairPrice: currentPairPrice,
      priceDiff: priceDiffPercent.toFixed(2) + '%',
      status: 'SUCCESS - Chart price now matches header calculation',
    });

    return bars;
  } catch (error: any) {
    console.error('[ChartPriceUpdater] Error updating last candle:', error);
    // Return original bars if update fails (but log the error)
    return bars;
  }
}

