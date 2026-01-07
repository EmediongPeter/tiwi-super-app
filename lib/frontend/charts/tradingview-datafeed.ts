/**
 * TradingView Custom Datafeed
 * 
 * Implements TradingView's IExternalDatafeed interface.
 * Connects to backend API routes for chart data.
 */

// @ts-ignore - TradingView library types
import type {
  IExternalDatafeed,
  IDatafeedChartApi,
  LibrarySymbolInfo,
  OnReadyCallback,
  ResolveCallback,
  DatafeedErrorCallback,
  HistoryCallback,
  PeriodParams,
  ResolutionString,
  SubscribeBarsCallback,
  SymbolResolveExtension,
  DatafeedConfiguration,
  SearchSymbolsCallback
} from '@/public/charts/charting_library/datafeed-api';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE = '/api/v1/charts';

// ============================================================================
// Custom Datafeed Implementation
// ============================================================================

export class TradingViewDatafeed implements IExternalDatafeed, IDatafeedChartApi {
  /**
   * Called when chart is ready
   * Returns chart configuration
   */
  onReady(callback: OnReadyCallback): void {
    fetch(`${API_BASE}/config`)
      .then((response) => response.json())
      .then((config) => {
        callback(config);
      })
      .catch((error) => {
        console.error('[TradingViewDatafeed] Error fetching config:', error);
        // Return default config on error
        callback({
          supported_resolutions: ['1', '5', '15', '30', '60', '1D', '1W', '1M'] as ResolutionString[],
          supports_marks: false,
          supports_time: true,
          supports_timescale_marks: false,
        });
      });
  }

  /**
   * Search symbols
   */
  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: SearchSymbolsCallback
  ): void {
    console.log("[searchSymbols]: Method call");
    // Return empty array for now - you can implement symbol search later
    onResult([]);
  }


  /**
   * Resolve symbol information
   */
  resolveSymbol(
    symbolName: string,
    onResolve: ResolveCallback,
    onError: DatafeedErrorCallback,
    extension?: SymbolResolveExtension
  ): void {
    const params = new URLSearchParams({ symbol: symbolName });
    console.log("🚀 ~ TradingViewDatafeed ~ resolveSymbol ~ params:", params)
    
    if (extension?.currencyCode) {
      params.append('currencyCode', extension.currencyCode);
    }
    
    if (extension?.unitId) {
      params.append('unitId', extension.unitId);
    }

    fetch(`${API_BASE}/symbols?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        console.log("[resolveSymbol] Data fetched:", data);
        if (data.s === 'error') {
          onError('unknown_symbol');
          return;
        }
        
        // Transform to LibrarySymbolInfo format
        const symbolInfo: LibrarySymbolInfo = {
          ...data,
          name: data.name || symbolName,
          ticker: data.ticker || symbolName,
          description: data.description || symbolName,
          type: data.type || 'crypto',
          session: data.session || '24x7',
          timezone: data.timezone || 'Etc/UTC',
          exchange: data.exchange || '',
          listed_exchange: data.listed_exchange || data.exchange || '',
          minmov: data.minmov || 1,
          pricescale: data.pricescale || 1000000000,
          has_intraday: data.has_intraday ?? true,
          has_daily: data.has_daily ?? true,
          has_weekly_and_monthly: data.has_weekly_and_monthly ?? false,
          supported_resolutions: data.supported_resolutions || ['1', '5', '15', '30', '60', '1D', '1W', '1M'],
          intraday_multipliers: data.intraday_multipliers || ['1', '5', '15', '30', '60'],
          volume_precision: data.volume_precision || 2,
          data_status: data.data_status || 'endofday', // Use 'endofday' for historical data to prevent continuous fetching
        };

        onResolve(symbolInfo);
      })
      .catch((error) => {
        console.error('[TradingViewDatafeed] Error resolving symbol:', error);
        onError('unknown_symbol');
      });
  }

  /**
   * Get historical bars
   */
  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: PeriodParams,
    onResult: HistoryCallback,
    onError: DatafeedErrorCallback
  ): void {
    const params = new URLSearchParams({
      symbol: symbolInfo.ticker || symbolInfo.name,
      resolution,
      from: periodParams.from.toString(),
      to: periodParams.to.toString(),
    });
    console.log("🚀 ~ TradingViewDatafeed ~ getBars ~ params:", params)

    if (periodParams.countBack !== undefined) {
      params.append('countback', periodParams.countBack.toString());
    }

    fetch(`${API_BASE}/history?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        console.log("🚀 ~ TradingViewDatafeed ~ getBars ~ data:", data)
        if (data.s === 'error') {
          onError(data.errmsg || 'Failed to fetch historical data');
          return;
        }

        if (data.s === 'no_data') {
          onResult([], { noData: true });
          return;
        }

        // Validate response structure
        if (!data.t || !Array.isArray(data.t) || data.t.length === 0) {
          console.warn('[TradingViewDatafeed] Empty or invalid time array');
          onResult([], { noData: true });
          return;
        }

        // Transform UDF format to TradingView bars with validation
        const bars = data.t
          .map((time: number, index: number) => {
            // Validate time (should be in seconds from API)
            if (typeof time !== 'number' || isNaN(time) || time <= 0) {
              return null;
            }

            // Get OHLC values
            const open = data.o?.[index];
            const high = data.h?.[index];
            const low = data.l?.[index];
            const close = data.c?.[index];
            const volume = data.v?.[index] || 0;
            
            // Validate OHLC values (must be valid numbers, can be very small scientific notation)
            if (
              typeof open !== 'number' || isNaN(open) ||
              typeof high !== 'number' || isNaN(high) ||
              typeof low !== 'number' || isNaN(low) ||
              typeof close !== 'number' || isNaN(close)
            ) {
              return null;
            }

            // Normalize values (handle scientific notation and ensure they're positive)
            let normalizedOpen = Math.abs(open);
            let normalizedHigh = Math.abs(high);
            let normalizedLow = Math.abs(low);
            let normalizedClose = Math.abs(close);

            // Validate basic price logic:
            // - high must be >= low
            // - high must be >= max(open, close)
            // - low must be <= min(open, close)
            const maxPrice = Math.max(normalizedOpen, normalizedClose);
            const minPrice = Math.min(normalizedOpen, normalizedClose);
            
            if (normalizedHigh < normalizedLow) {
              // Invalid: high < low, swap them
              const temp = normalizedHigh;
              normalizedHigh = normalizedLow;
              normalizedLow = temp;
            }
            
            if (normalizedHigh < maxPrice) {
              // Adjust high to be at least max(open, close)
              normalizedHigh = maxPrice;
            }
            
            if (normalizedLow > minPrice) {
              // Adjust low to be at most min(open, close)
              normalizedLow = minPrice;
            }

            return {
              time: time * 1000, // Convert seconds to milliseconds
              open: normalizedOpen,
              high: normalizedHigh,
              low: normalizedLow,
              close: normalizedClose,
              volume: typeof volume === 'number' && !isNaN(volume) ? Math.abs(volume) : 0,
            };
          })
          .filter((bar: any): bar is { time: number; open: number; high: number; low: number; close: number; volume: number } => bar !== null);

        // If no valid bars, return no data
        if (bars.length === 0) {
          console.warn('[TradingViewDatafeed] No valid bars after filtering');
          onResult([], { noData: true });
          return;
        }

        // Sort bars by time (ascending) - TradingView requires sorted data
        bars.sort((a: { time: number }, b: { time: number }) => a.time - b.time);

        // Calculate nextTime to prevent continuous fetching
        // BEST PRACTICE: According to TradingView docs, if nextTime < requested 'to', TradingView will keep fetching
        // SOLUTION: For first data request, return all available data. For subsequent requests, signal no more data.
        const lastBarTimeSeconds = Math.floor(bars[bars.length - 1].time / 1000);
        const firstBarTimeSeconds = Math.floor(bars[0].time / 1000);
        const requestedToTime = periodParams.to;
        const requestedFromTime = periodParams.from;
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Determine if we have more data available
        // If this is the first request and we have data, we might have more
        // If this is a subsequent request, we've likely exhausted available data
        const isFirstRequest = periodParams.firstDataRequest === true;
        const hasMoreData = lastBarTimeSeconds < requestedToTime && lastBarTimeSeconds < currentTime;
        
        // Calculate nextTime based on best practices:
        // 1. If first request and we have data up to requested time, set nextTime = requested 'to' (signal fulfilled)
        // 2. If first request but data doesn't reach requested time, set nextTime = last bar time (might have more)
        // 3. If subsequent request, always set nextTime >= requested 'to' (signal no more data)
        let nextTime: number | undefined;
        
        if (isFirstRequest) {
          // First request: Return all available data
          // Set nextTime to requested 'to' to signal we've fulfilled the initial request
          // This prevents TradingView from immediately requesting more data
          nextTime = Math.min(requestedToTime, currentTime);
        } else {
          // Subsequent request: Signal no more data by setting nextTime >= requested 'to'
          // This tells TradingView: "We've given you all we have, stop fetching"
          nextTime = Math.min(
            Math.max(requestedToTime, lastBarTimeSeconds),
            currentTime
          );
        }

        console.log(`[TradingViewDatafeed] Returning ${bars.length} valid bars`, {
          firstBarTime: firstBarTimeSeconds,
          lastBarTime: lastBarTimeSeconds,
          requestedFrom: requestedFromTime,
          requestedTo: requestedToTime,
          requestedRange: requestedToTime - requestedFromTime,
          actualRange: lastBarTimeSeconds - firstBarTimeSeconds,
          currentTime,
          nextTime,
          isFirstRequest,
          hasMoreData,
          countBack: periodParams.countBack,
        });

        // Return bars with nextTime to prevent continuous fetching
        // BEST PRACTICE: nextTime must be >= requested 'to' for subsequent requests to stop fetching
        const result: any = { 
          noData: false,
        };
        
        // Only set nextTime if we have a value (TradingView will stop if nextTime is undefined and no more data)
        if (nextTime !== undefined) {
          result.nextTime = nextTime;
        }
        
        onResult(bars, result);
      })
      .catch((error) => {
        console.error('[TradingViewDatafeed] Error fetching bars:', error);
        onError('Failed to fetch historical data');
      });
  }

  /**
   * Subscribe to real-time bars
   * 
   * DISABLED: Real-time updates are disabled to reduce API calls.
   * TradingView will use getBars() for historical data only.
   * 
   * TODO: Implement WebSocket or SSE for real-time updates in Phase 4
   */
  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void
  ): void {
    // Real-time updates disabled to prevent excessive API calls
    // TradingView will refresh data via getBars() when needed
    console.log('[TradingViewDatafeed] Real-time subscription requested but disabled (to reduce API calls)');
    
    // Store subscriber info (but don't start polling)
    (this as any).subscribers = (this as any).subscribers || {};
    (this as any).subscribers[subscriberUID] = null;
  }

  /**
   * Unsubscribe from real-time bars
   */
  unsubscribeBars(subscriberUID: string): void {
    const subscribers = (this as any).subscribers || {};
    const interval = subscribers[subscriberUID];
    
    if (interval) {
      clearInterval(interval);
      delete subscribers[subscriberUID];
    }
  }
}

