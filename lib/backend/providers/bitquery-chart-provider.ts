/**
 * Bitquery Chart Provider
 * 
 * Fetches OHLC historical data from Bitquery GraphQL API.
 * Supports both pair OHLC (base + quote token) and single token OHLC.
 */

import {
  getCurrentApiKey,
  rotateToNextKey,
  markKeyAsExhausted,
  getCurrentKeyIndex,
  isRateLimitError,
} from '@/lib/backend/utils/bitquery-key-manager';
import type {
  OHLCBar,
  PairOHLCParams,
  TokenOHLCParams,
  ChartProviderResponse,
  ResolutionString,
} from '@/lib/backend/types/chart';

// ============================================================================
// Bitquery Configuration
// ============================================================================

const BITQUERY_ENDPOINT = 'https://streaming.bitquery.io/graphql';

/**
 * Map chain ID to Bitquery network name
 */
const CHAIN_TO_BITQUERY_NETWORK: Record<number, string> = {
  1: 'eth',
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
 * Map TradingView resolution to Bitquery interval
 */
function resolutionToInterval(resolution: ResolutionString): { count: number; unit: 'minutes' | 'hours' | 'days' } {
  switch (resolution) {
    case '1':
      return { count: 1, unit: 'minutes' };
    case '5':
      return { count: 5, unit: 'minutes' };
    case '15':
      return { count: 15, unit: 'minutes' };
    case '30':
      return { count: 30, unit: 'minutes' };
    case '60':
      return { count: 60, unit: 'minutes' };
    case '1D':
      return { count: 1, unit: 'days' };
    case '1W':
      return { count: 7, unit: 'days' };
    case '1M':
      return { count: 30, unit: 'days' };
    default:
      // Default to 1 minute
      return { count: 1, unit: 'minutes' };
  }
}

// ============================================================================
// GraphQL Queries
// ============================================================================

/**
 * Build GraphQL query for pair OHLC data (EVM)
 * Note: Bitquery requires interval unit as a literal string, not a variable
 */
function buildPairOHLCQuery(intervalUnit: 'minutes' | 'hours' | 'days', baseToken: string, quoteToken: string): string {
  return `
    query PairOHLC(
      $network: evm_network!
    ) {
      EVM(network: $network, dataset: realtime) {
        DEXTradeByTokens(
          orderBy: { ascendingByField: "Block_Time" }
          where: {
            Trade: {
              Currency: { SmartContract: { is: "${baseToken}" } }
              Side: { Currency: { SmartContract: { is: "${quoteToken}" } } }
              PriceAsymmetry: { lt: 0.1 }
            }
          }
          limit: { count: 10000 }
        ) {
          Block {
            Time(interval: { in: hours, count: 1 })
          }
          Trade {
            open: Price(minimum: Block_Number)
            close: Price(maximum: Block_Number)
            high: Price(maximum: Trade_Price)
            low: Price(minimum: Trade_Price)
          }
          volume: sum(of: Trade_Amount)
          count
        }
      }
    }
  `;
}

/**
 * Build GraphQL query for single token OHLC data (EVM)
 * Note: Bitquery requires interval unit as a literal string, not a variable
 */
function buildTokenOHLCQuery(intervalUnit: 'minutes' | 'hours' | 'days'): string {
  return `
    query TokenOHLC(
      $network: evm_network!
      $token: String!
      $from: DateTime!
      $to: DateTime!
      $intervalCount: Int!
    ) {
      EVM(network: $network) {
        DEXTradeByTokens(
          orderBy: { ascendingByField: "Block_Time" }
          where: {
            Trade: {
              Currency: { SmartContract: { is: $token } }
              PriceAsymmetry: { lt: 0.1 }
            }
            Block: { Date: { gte: $from, lte: $to } }
          }
        ) {
          Block {
            Time(interval: { count: $intervalCount, in: ${intervalUnit} })
          }
          Trade {
            open: PriceInUSD(minimum: Block_Number)
            close: PriceInUSD(maximum: Block_Number)
            high: PriceInUSD(maximum: Trade_PriceInUSD)
            low: PriceInUSD(minimum: Trade_PriceInUSD)
          }
          volume: sum(of: Trade_Side_AmountInUSD, selectWhere: { gt: "0" })
        }
      }
    }
  `;
}

// ============================================================================
// Bitquery Chart Provider
// ============================================================================

export class BitqueryChartProvider {
  /**
   * Fetch pair OHLC data (base token + quote token)
   */
  async fetchPairOHLC(params: PairOHLCParams): Promise<ChartProviderResponse> {
    const network = CHAIN_TO_BITQUERY_NETWORK[params.chainId];
    if (!network) {
      throw new Error(`[BitqueryChartProvider] Unsupported chain ID: ${params.chainId}`);
    }

    const interval = resolutionToInterval(params.resolution);
    
    // Convert timestamps to ISO8601 format (Bitquery expects DateTime type)
    const fromISO = new Date(params.from * 1000).toISOString();
    const toISO = new Date(params.to * 1000).toISOString();

    // Build query with interval unit as literal string
    const query = buildPairOHLCQuery(interval.unit, params.baseToken, params.quoteToken);

    const variables = {
      network,
    };

    return this.executeQuery<PairOHLCResponse>(query, variables, (data) => {
      return this.transformPairResponse(data, params.resolution);
    });
  }

  /**
   * Fetch single token OHLC data
   */
  async fetchTokenOHLC(params: TokenOHLCParams): Promise<ChartProviderResponse> {
    const network = CHAIN_TO_BITQUERY_NETWORK[params.chainId];
    if (!network) {
      throw new Error(`[BitqueryChartProvider] Unsupported chain ID: ${params.chainId}`);
    }

    const interval = resolutionToInterval(params.resolution);
    
    // Convert timestamps to ISO8601 format (Bitquery expects DateTime type)
    const fromISO = new Date(params.from * 1000).toISOString();
    const toISO = new Date(params.to * 1000).toISOString();

    // Build query with interval unit as literal string
    const query = buildTokenOHLCQuery(interval.unit);

    const variables = {
      network,
      token: params.token,
      from: fromISO,
      to: toISO,
      intervalCount: interval.count,
    };

    return this.executeQuery<TokenOHLCResponse>(query, variables, (data) => {
      return this.transformTokenResponse(data, params.resolution);
    });
  }

  /**
   * Execute GraphQL query with retry and key rotation
   */
  private async executeQuery<TResponse>(
    query: string,
    variables: Record<string, any>,
    transformer: (data: TResponse) => OHLCBar[]
  ): Promise<ChartProviderResponse> {
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const apiKey = getCurrentApiKey();
        
        const response = await fetch(BITQUERY_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query,
            variables,
          }),
        });
        
        // Check content type before parsing JSON
        const contentType = response.headers.get('content-type') || '';
        let responseData: any;
        let responseText: string = '';

        try {
          // Try to get response as text first (in case it's not JSON)
          responseText = await response.text();
          
          // Try to parse as JSON
          if (contentType.includes('application/json') || responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
            responseData = JSON.parse(responseText);
          } else {
            // Not JSON - likely an error message
            throw new Error(`Non-JSON response: ${responseText.substring(0, 200)}`);
          }
        } catch (parseError: any) {
          // If JSON parsing fails, check if it's a points limit error
          const errorText = responseText.toLowerCase();
          if (errorText.includes('points limit') || errorText.includes('points lim')) {
            console.warn(`[BitqueryChartProvider] Points limit exceeded for key ${getCurrentKeyIndex() + 1}`);
            markKeyAsExhausted(getCurrentKeyIndex());
            const rotated = rotateToNextKey();
            
            if (rotated && attempt < maxRetries - 1) {
              console.log(`[BitqueryChartProvider] Rotated to next API key, retrying...`);
              await new Promise(resolve => setTimeout(resolve, 200));
              continue;
            } else {
              throw new Error('Bitquery points limit exceeded for all API keys');
            }
          }
          
          // Re-throw parse error with context
          throw new Error(`Failed to parse Bitquery response: ${parseError.message}. Response: ${responseText.substring(0, 200)}`);
        }

        // Check for GraphQL errors
        if (responseData.errors && Array.isArray(responseData.errors)) {
          const error = responseData.errors[0];
          const errorMessage = (error.message || '').toLowerCase();
          
          // Check if it's a points limit error in GraphQL errors
          if (errorMessage.includes('points limit') || errorMessage.includes('points lim') || errorMessage.includes('quota exceeded')) {
            console.warn(`[BitqueryChartProvider] Points limit exceeded (GraphQL error) for key ${getCurrentKeyIndex() + 1}`);
            markKeyAsExhausted(getCurrentKeyIndex());
            const rotated = rotateToNextKey();
            
            if (rotated && attempt < maxRetries - 1) {
              console.log(`[BitqueryChartProvider] Rotated to next API key, retrying...`);
              await new Promise(resolve => setTimeout(resolve, 200));
              continue;
            } else {
              throw new Error('Bitquery points limit exceeded for all API keys');
            }
          }
          
          throw new Error(`Bitquery GraphQL error: ${error.message || 'Unknown error'}`);
        }

        // Check for rate limit (HTTP status codes)
        if (!response.ok) {
          const isRateLimit = isRateLimitError({ 
            status: response.status, 
            response: responseData,
            message: responseText 
          });
          
          if (isRateLimit && attempt < maxRetries - 1) {
            console.warn(`[BitqueryChartProvider] Rate limit hit (HTTP ${response.status}) on attempt ${attempt + 1}, rotating to next API key...`);
            markKeyAsExhausted(getCurrentKeyIndex());
            const rotated = rotateToNextKey();
            
            if (rotated) {
              await new Promise(resolve => setTimeout(resolve, 200));
              continue;
            } else {
              throw new Error('Bitquery API rate limit exceeded for all API keys');
            }
          }
          
          // Non-rate-limit HTTP error
          throw new Error(`Bitquery API error: HTTP ${response.status} - ${responseText.substring(0, 200)}`);
        }

        // Check if response data is valid
        if (!responseData || !responseData.data) {
          throw new Error('Invalid response from Bitquery: missing data');
        }

        // Transform and return data
        const bars = transformer(responseData.data);
        return { bars };

      } catch (error: any) {
        lastError = error;

        // Check if it's a points limit or rate limit error
        const isPointsLimit = this.isPointsLimitError(error);
        const isRateLimit = isRateLimitError(error);
        
        if ((isPointsLimit || isRateLimit) && attempt < maxRetries - 1) {
          console.warn(`[BitqueryChartProvider] ${isPointsLimit ? 'Points limit' : 'Rate limit'} error on attempt ${attempt + 1}, rotating to next API key...`);
          markKeyAsExhausted(getCurrentKeyIndex());
          const rotated = rotateToNextKey();
          
          if (rotated) {
            await new Promise(resolve => setTimeout(resolve, 200));
            continue;
          } else {
            throw new Error(`Bitquery ${isPointsLimit ? 'points limit' : 'rate limit'} exceeded for all API keys`);
          }
        }

        // For non-rate-limit errors or final attempt, throw
        if (attempt === maxRetries - 1 || (!isPointsLimit && !isRateLimit)) {
          throw error;
        }
      }
    }

    throw lastError || new Error('Failed to fetch data from Bitquery');
  }

  /**
   * Check if error is a points limit error
   */
  private isPointsLimitError(error: any): boolean {
    const message = (error?.message || '').toLowerCase();
    const errorText = (error?.error?.message || '').toLowerCase();
    const responseText = (error?.responseText || '').toLowerCase();
    
    return (
      message.includes('points limit') ||
      message.includes('points lim') ||
      message.includes('quota exceeded') ||
      errorText.includes('points limit') ||
      errorText.includes('points lim') ||
      errorText.includes('quota exceeded') ||
      responseText.includes('points limit') ||
      responseText.includes('points lim') ||
      responseText.includes('quota exceeded')
    );
  }

  /**
   * Transform pair OHLC response to TradingView format
   */
  private transformPairResponse(data: PairOHLCResponse, resolution: ResolutionString): OHLCBar[] {
    console.log("🚀 ~ BitqueryChartProvider ~ transformPairResponse ~ data:", data)
    if (!data?.EVM?.DEXTradeByTokens || !Array.isArray(data.EVM.DEXTradeByTokens)) {
      return [];
    }

    const bars: OHLCBar[] = data.EVM.DEXTradeByTokens
      .map((item) => {
        const blockTime = item.Block?.Time;
        if (!blockTime) return null;

        // Parse time from ISO 8601 string (e.g., '2026-01-06T12:00:00Z')
        const time = new Date(blockTime).getTime(); // Convert to milliseconds
        
        // Validate time
        if (isNaN(time) || time <= 0) {
          console.warn(`[BitqueryChartProvider] Invalid time: ${blockTime}`);
          return null;
        }

        // Get OHLC values (may be in scientific notation, which is valid)
        const open = item.Trade?.open;
        const high = item.Trade?.high;
        const low = item.Trade?.low;
        const close = item.Trade?.close;
        const volume = parseFloat(item.volume || '0');

        // Validate OHLC values (must be valid numbers > 0)
        if (
          typeof open !== 'number' || isNaN(open) || open <= 0 ||
          typeof high !== 'number' || isNaN(high) || high <= 0 ||
          typeof low !== 'number' || isNaN(low) || low <= 0 ||
          typeof close !== 'number' || isNaN(close) || close <= 0
        ) {
          console.warn(`[BitqueryChartProvider] Invalid OHLC values:`, { open, high, low, close });
          return null;
        }

        // Validate price logic (high >= low, high >= open, high >= close, low <= open, low <= close)
        if (high < low || high < open || high < close || low > open || low > close) {
          console.warn(`[BitqueryChartProvider] Invalid price logic:`, { open, high, low, close });
          return null;
        }

        return {
          time,
          open,
          high,
          low,
          close,
          volume: isNaN(volume) ? 0 : volume,
        } as OHLCBar;
      })
      .filter((bar): bar is OHLCBar => bar !== null);

    // Sort by time (ascending) - TradingView requires sorted data
    bars.sort((a, b) => a.time - b.time);

    console.log(`[BitqueryChartProvider] Transformed ${bars.length} valid bars from ${data.EVM.DEXTradeByTokens.length} items`);

    return bars;
  }

  /**
   * Transform token OHLC response to TradingView format
   */
  private transformTokenResponse(data: TokenOHLCResponse, resolution: ResolutionString): OHLCBar[] {
    if (!data?.EVM?.DEXTradeByTokens || !Array.isArray(data.EVM.DEXTradeByTokens)) {
      return [];
    }

    const bars: OHLCBar[] = data.EVM.DEXTradeByTokens
      .map((item) => {
        const blockTime = item.Block?.Time;
        if (!blockTime) return null;

        // Parse time from ISO 8601 string (e.g., '2026-01-06T12:00:00Z')
        const time = new Date(blockTime).getTime(); // Convert to milliseconds
        
        // Validate time
        if (isNaN(time) || time <= 0) {
          console.warn(`[BitqueryChartProvider] Invalid time: ${blockTime}`);
          return null;
        }

        // Get OHLC values (may be in scientific notation, which is valid)
        const open = item.Trade?.open;
        const high = item.Trade?.high;
        const low = item.Trade?.low;
        const close = item.Trade?.close;
        const volume = parseFloat(item.volume || '0');

        // Validate OHLC values (must be valid numbers > 0)
        if (
          typeof open !== 'number' || isNaN(open) || open <= 0 ||
          typeof high !== 'number' || isNaN(high) || high <= 0 ||
          typeof low !== 'number' || isNaN(low) || low <= 0 ||
          typeof close !== 'number' || isNaN(close) || close <= 0
        ) {
          console.warn(`[BitqueryChartProvider] Invalid OHLC values:`, { open, high, low, close });
          return null;
        }

        // Validate price logic (high >= low, high >= open, high >= close, low <= open, low <= close)
        if (high < low || high < open || high < close || low > open || low > close) {
          console.warn(`[BitqueryChartProvider] Invalid price logic:`, { open, high, low, close });
          return null;
        }

        return {
          time,
          open,
          high,
          low,
          close,
          volume: isNaN(volume) ? 0 : volume,
        } as OHLCBar;
      })
      .filter((bar): bar is OHLCBar => bar !== null);

    // Sort by time (ascending) - TradingView requires sorted data
    bars.sort((a, b) => a.time - b.time);

    console.log(`[BitqueryChartProvider] Transformed ${bars.length} valid bars from ${data.EVM.DEXTradeByTokens.length} items`);

    return bars;
  }

  /**
   * Get supported resolutions
   */
  getSupportedResolutions(): ResolutionString[] {
    return ['1', '5', '15', '30', '60', '1D', '1W', '1M']; 
  }
}

// ============================================================================
// Response Types
// ============================================================================

interface PairOHLCResponse {
  EVM: {
    DEXTradeByTokens: Array<{
      Block: {
        Time: string;
      };
      Trade: {
        open: number;
        close: number;
        high: number;
        low: number;
      };
      volume: string;
    }>;
  };
}

interface TokenOHLCResponse {
  EVM: {
    DEXTradeByTokens: Array<{
      Block: {
        Time: string;
      };
      Trade: {
        open: number;
        close: number;
        high: number;
        low: number;
      };
      volume: string;
    }>;
  };
}

