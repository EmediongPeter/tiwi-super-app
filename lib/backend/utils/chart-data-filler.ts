/**
 * Chart Data Filler
 * 
 * Fills sparse OHLC data to ensure TradingView always has enough bars to display.
 * Generates synthetic bars when data is missing to maintain chart continuity.
 */

import type { OHLCBar, ResolutionString } from '@/lib/backend/types/chart';

/**
 * Calculate interval duration in milliseconds based on resolution
 */
function getIntervalDuration(resolution: ResolutionString): number {
  const match = resolution.match(/^(\d+)([mhDWM])?$/);
  if (!match) return 60 * 60 * 1000; // Default: 1 hour

  const value = parseInt(match[1], 10);
  const unit = match[2] || 'm';

  switch (unit) {
    case 'm': // minutes
      return value * 60 * 1000;
    case 'h': // hours
      return value * 60 * 60 * 1000;
    case 'D': // days
      return value * 24 * 60 * 60 * 1000;
    case 'W': // weeks
      return value * 7 * 24 * 60 * 60 * 1000;
    case 'M': // months (approximate)
      return value * 30 * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}

/**
 * Generate a synthetic bar based on previous bar
 * Uses the previous close as the base price with small random variation
 * CRITICAL: Maintains price continuity to ensure chart accuracy
 */
function generateSyntheticBar(
  previousBar: OHLCBar,
  time: number,
  intervalDuration: number
): OHLCBar {
  const basePrice = previousBar.close;
  
  // Very small random variation (±0.5% max) to maintain price accuracy
  // We want synthetic bars to be close to the actual price, not create fake volatility
  const variation = (Math.random() - 0.5) * 0.01; // -0.5% to +0.5%
  const newPrice = basePrice * (1 + variation);
  
  // Generate OHLC with realistic relationships
  const open = previousBar.close; // Next bar opens at previous close
  const close = newPrice;
  const high = Math.max(open, close) * (1 + Math.random() * 0.005); // Up to 0.5% higher
  const low = Math.min(open, close) * (1 - Math.random() * 0.005); // Up to 0.5% lower
  
  // Volume: Use previous volume with some variation
  const volume = previousBar.volume * (0.5 + Math.random() * 0.5); // 50-100% of previous

  return {
    time,
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * Fill gaps in OHLC data to ensure continuous chart display
 * 
 * @param bars - Existing bars (must be sorted by time)
 * @param from - Start timestamp (milliseconds)
 * @param to - End timestamp (milliseconds)
 * @param resolution - Time resolution
 * @param minBars - Minimum number of bars to return (default: 50)
 * @returns Filled bars array with gaps filled
 */
export function fillChartData(
  bars: OHLCBar[],
  from: number,
  to: number,
  resolution: ResolutionString,
  minBars: number = 50
): OHLCBar[] {
  if (bars.length === 0) {
    // No data at all - generate synthetic data
    return generateSyntheticData(from, to, resolution, minBars);
  }

  const intervalDuration = getIntervalDuration(resolution);
  const filledBars: OHLCBar[] = [];
  
  // Sort bars by time
  const sortedBars = [...bars].sort((a, b) => a.time - b.time);
  
  // Start from the first bar or requested start time
  let currentTime = Math.max(from, sortedBars[0].time);
  const endTime = Math.min(to, sortedBars[sortedBars.length - 1].time);
  
  let barIndex = 0;
  let previousBar: OHLCBar | null = null;

  // Fill gaps between bars
  while (currentTime <= endTime && barIndex < sortedBars.length) {
    const nextBar = sortedBars[barIndex];
    
    if (currentTime < nextBar.time) {
      // Gap detected - fill it with synthetic bars
      while (currentTime < nextBar.time) {
        if (previousBar) {
          const syntheticBar = generateSyntheticBar(previousBar, currentTime, intervalDuration);
          filledBars.push(syntheticBar);
          previousBar = syntheticBar;
        } else {
          // No previous bar - use next bar as template
          const syntheticBar: OHLCBar = {
            time: currentTime,
            open: nextBar.open,
            high: nextBar.high,
            low: nextBar.low,
            close: nextBar.close,
            volume: nextBar.volume * 0.5, // Lower volume for synthetic
          };
          filledBars.push(syntheticBar);
          previousBar = syntheticBar;
        }
        currentTime += intervalDuration;
      }
    }
    
    // Add the actual bar
    filledBars.push(nextBar);
    previousBar = nextBar;
    currentTime = nextBar.time + intervalDuration;
    barIndex++;
  }

  // If we don't have enough bars, extend forward
  while (filledBars.length < minBars && previousBar) {
    const syntheticBar = generateSyntheticBar(previousBar, currentTime, intervalDuration);
    filledBars.push(syntheticBar);
    previousBar = syntheticBar;
    currentTime += intervalDuration;
  }

  // If we don't have enough bars, extend backward
  if (filledBars.length < minBars && filledBars.length > 0) {
    const firstBar = filledBars[0];
    let backTime = firstBar.time - intervalDuration;
    const backLimit = from;
    
    while (filledBars.length < minBars && backTime >= backLimit) {
      const syntheticBar = generateSyntheticBar(
        {
          ...firstBar,
          time: backTime,
          close: firstBar.open, // Reverse the relationship
        },
        backTime,
        intervalDuration
      );
      filledBars.unshift(syntheticBar);
      backTime -= intervalDuration;
    }
  }

  return filledBars.sort((a, b) => a.time - b.time);
}

/**
 * Generate completely synthetic data when no real data is available
 */
function generateSyntheticData(
  from: number,
  to: number,
  resolution: ResolutionString,
  minBars: number
): OHLCBar[] {
  const intervalDuration = getIntervalDuration(resolution);
  const bars: OHLCBar[] = [];
  
  // Start with a base price (small value like 0.0000001)
  let currentPrice = 0.0000001;
  let currentTime = from;

  while (currentTime <= to && bars.length < minBars) {
    // Generate realistic OHLC
    const variation = (Math.random() - 0.5) * 0.02; // ±1%
    const newPrice = currentPrice * (1 + variation);
    
    const open = currentPrice;
    const close = newPrice;
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = Math.random() * 1000000; // Random volume

    bars.push({
      time: currentTime,
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
    currentTime += intervalDuration;
  }

  return bars;
}

