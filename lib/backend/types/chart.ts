/**
 * Chart Data Types
 * 
 * Type definitions for TradingView chart integration
 */

// ============================================================================
// OHLC Bar Data
// ============================================================================

/**
 * OHLC bar data point (TradingView format)
 * Time is in milliseconds since Unix epoch
 */
export interface OHLCBar {
  time: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * TradingView resolution string
 * Examples: "1", "5", "15", "30", "60", "1D", "1W", "1M"
 */
export type ResolutionString = string;

// ============================================================================
// Chart Data Request Parameters
// ============================================================================

/**
 * Parameters for fetching historical OHLC data
 */
export interface ChartDataParams {
  baseToken: string; // Token address
  quoteToken: string; // Token address (or native)
  chainId: number;
  resolution: ResolutionString; // "1", "5", "15", "30", "60", "1D", "1W", "1M"
  from: number; // Unix timestamp in seconds
  to: number; // Unix timestamp in seconds
  countback?: number; // Optional: number of bars to fetch
}

/**
 * Parameters for fetching pair OHLC data
 */
export interface PairOHLCParams {
  baseToken: string;
  quoteToken: string;
  chainId: number;
  resolution: ResolutionString;
  from: number; // Unix timestamp in seconds
  to: number; // Unix timestamp in seconds
}

/**
 * Parameters for fetching single token OHLC data
 */
export interface TokenOHLCParams {
  token: string; // Token address
  chainId: number;
  resolution: ResolutionString;
  from: number; // Unix timestamp in seconds
  to: number; // Unix timestamp in seconds
}

// ============================================================================
// Symbol Information
// ============================================================================

/**
 * Symbol information for TradingView
 */
export interface SymbolInfo {
  name: string; // Display name (e.g., "TWC/BNB")
  ticker: string; // Symbol identifier
  description?: string;
  type: string; // "crypto"
  session: string; // "24x7"
  timezone: string; // "Etc/UTC"
  exchange: string; // Chain name (e.g., "BSC")
  listed_exchange: string;
  minmov: number; // Minimum movement
  pricescale: number; // Price scale (e.g., 1000000000 for 9 decimals)
  has_intraday: boolean;
  has_daily: boolean;
  has_weekly_and_monthly: boolean;
  supported_resolutions: ResolutionString[];
  intraday_multipliers: string[];
  volume_precision: number;
  data_status: 'streaming' | 'endofday' | 'pulsed' | 'delayed_streaming';
}

// ============================================================================
// Chart Configuration
// ============================================================================

/**
 * Chart configuration for TradingView
 */
export interface ChartConfiguration {
  supported_resolutions: ResolutionString[];
  supports_marks?: boolean;
  supports_time?: boolean;
  supports_timescale_marks?: boolean;
  exchanges?: Array<{ value: string; name: string; desc: string }>;
}

// ============================================================================
// Provider Response Types
// ============================================================================

/**
 * Base response from chart data providers
 */
export interface ChartProviderResponse {
  bars: OHLCBar[];
  hasMore?: boolean; // Whether more data is available
}

/**
 * Error response from chart data providers
 */
export interface ChartProviderError {
  message: string;
  code?: string;
  statusCode?: number;
}

