/**
 * Wallet Balance Service
 * 
 * Orchestrates wallet balance fetching across multiple chains.
 * Handles caching, price fetching, and aggregation.
 */

import { getWalletTokens, SOLANA_CHAIN_ID } from '@/lib/backend/providers/moralis';
import { getWalletNetWorth, getAddressType } from '@/lib/backend/providers/moralis-rest-client';
import { getTokenPrices } from '@/lib/backend/providers/price-provider';
import { getCache, CACHE_TTL } from '@/lib/backend/utils/cache';
import type { WalletToken, WalletBalanceResponse } from '@/lib/backend/types/wallet';

// ============================================================================
// Wallet Balance Service Class
// ============================================================================

export class WalletBalanceService {
  private cache = getCache();

  /**
   * Get wallet balances across multiple chains
   * 
   * @param address - Wallet address
   * @param chainIds - Array of chain IDs to fetch (defaults to major chains)
   * @returns Wallet balance response with USD values
   */
  async getWalletBalances(
    address: string,
    chainIds?: number[]
  ): Promise<WalletBalanceResponse> {
    // Default to major chains if not specified
    const chainsToFetch = chainIds || [
      1,      // Ethereum
      56,     // BSC
      137,    // Polygon
      42161,  // Arbitrum
      43114,  // Avalanche
      8453,   // Base
      SOLANA_CHAIN_ID, // Solana
    ];

    // Check cache
    const cacheKey = `wallet:${address.toLowerCase()}:${chainsToFetch.sort().join(',')}`;
    const cached = this.cache.get<WalletBalanceResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch tokens from all chains in parallel with error handling
    let tokens: WalletToken[] = [];
    try {
      tokens = await getWalletTokens(address, chainsToFetch);
    } catch (error) {
      console.error('[WalletBalanceService] Error fetching tokens:', error);
      // Return empty response on error (graceful degradation)
      return {
        address,
        balances: [],
        totalUSD: '0.00',
        chains: chainsToFetch,
        timestamp: Date.now(),
      };
    }

    // Fetch prices for all tokens in parallel with error handling
    let priceMap = new Map<string, any>();
    try {
      priceMap = await getTokenPrices(
        tokens.map(t => ({
          address: t.address,
          chainId: t.chainId,
          symbol: t.symbol,
        }))
      );
    } catch (error) {
      console.error('[WalletBalanceService] Error fetching prices:', error);
      // Continue without prices (graceful degradation)
    }

    // Enrich tokens with prices and USD values
    const enrichedTokens: WalletToken[] = tokens
      .map(token => {
        const priceKey = `${token.chainId}:${token.address.toLowerCase()}`;
        const price = priceMap.get(priceKey);

        let usdValue: string | undefined;
        let priceUSD: string | undefined;

        if (price) {
          priceUSD = price.priceUSD;
          // Calculate USD value: balanceFormatted * priceUSD
          try {
            const balanceNum = parseFloat(token.balanceFormatted);
            const priceNum = parseFloat(price.priceUSD);
            if (!isNaN(balanceNum) && !isNaN(priceNum)) {
              usdValue = (balanceNum * priceNum).toFixed(2);
            }
          } catch (error) {
            console.warn(`[WalletBalanceService] Error calculating USD value for ${token.symbol}:`, error);
          }
        }

        return {
          ...token,
          priceUSD,
          usdValue,
        };
      })
      // Filter out tokens with zero balance (safety check)
      .filter(token => {
        // Check raw balance
        const balanceBigInt = BigInt(token.balance || '0');
        if (balanceBigInt === BigInt(0)) {
          return false;
        }
        
        // Check formatted balance (handle edge cases where balance might be "0.00" or "0")
        const balanceFormatted = parseFloat(token.balanceFormatted || '0');
        if (isNaN(balanceFormatted) || balanceFormatted === 0) {
          return false;
        }
        
        return true;
      });

    // Try to get total balance from net-worth endpoint (more accurate)
    // Note: Only works for EVM addresses, skip for Solana addresses
    let totalUSD = '0.00';
    try {
      // Check if address is Solana - skip net-worth endpoint for Solana addresses
      const addressType = getAddressType(address);
      
      // Filter out Solana chain ID for net-worth (only EVM chains supported)
      // Also skip if the address itself is a Solana address
      const evmChainIds = chainsToFetch.filter(id => id !== SOLANA_CHAIN_ID);
      if (evmChainIds.length > 0 && addressType === 'evm') {
        const netWorthData = await getWalletNetWorth(address, evmChainIds);
        if (netWorthData?.total_networth_usd) {
          totalUSD = parseFloat(netWorthData.total_networth_usd).toFixed(2);
        }
      }
    } catch (error) {
      console.warn('[WalletBalanceService] Net-worth endpoint failed, calculating from tokens:', error);
    }

    // Fallback: Calculate total USD value from tokens if net-worth fails
    if (totalUSD === '0.00') {
      totalUSD = enrichedTokens.reduce((sum, token) => {
        if (token.usdValue) {
          const usdValue = parseFloat(token.usdValue);
          if (!isNaN(usdValue) && usdValue > 0) {
            return sum + usdValue;
          }
        }
        return sum;
      }, 0).toFixed(2);
    }

    // Calculate daily percentage change (weighted average based on USD values)
    const dailyChange = this.calculateDailyChange(enrichedTokens, parseFloat(totalUSD));

    // Calculate daily USD change
    const dailyChangeUSD = dailyChange !== undefined && dailyChange !== 0
      ? (parseFloat(totalUSD) * (dailyChange / 100)).toFixed(2)
      : undefined;

    // Build response
    const response: WalletBalanceResponse = {
      address,
      balances: enrichedTokens,
      totalUSD,
      dailyChange,
      dailyChangeUSD,
      chains: chainsToFetch,
      timestamp: Date.now(),
    };

    // Cache response
    // this.cache.set(cacheKey, response, CACHE_TTL.BALANCE);

    return response;
  }

  /**
   * Calculate daily percentage change from token price changes
   * Uses weighted average based on USD values
   */
  private calculateDailyChange(tokens: WalletToken[], totalUSD: number): number | undefined {
    if (totalUSD === 0 || tokens.length === 0) {
      return undefined;
    }

    let totalWeightedChange = 0;
    let totalWeight = 0;

    for (const token of tokens) {
      // Skip tokens without price change data or USD value
      if (!token.priceChange24h || !token.usdValue) {
        continue;
      }

      const priceChange = parseFloat(token.priceChange24h);
      const usdValue = parseFloat(token.usdValue);

      if (isNaN(priceChange) || isNaN(usdValue) || usdValue <= 0) {
        continue;
      }

      // Weight the change by USD value
      totalWeightedChange += priceChange * usdValue;
      totalWeight += usdValue;
    }

    if (totalWeight === 0) {
      return undefined;
    }

    // Calculate weighted average
    const dailyChange = totalWeightedChange / totalWeight;
    return parseFloat(dailyChange.toFixed(2));
  }

  /**
   * Get wallet balance for a single chain
   */
  async getWalletBalanceForChain(
    address: string,
    chainId: number
  ): Promise<WalletToken[]> {
    const fullResponse = await this.getWalletBalances(address, [chainId]);
    return fullResponse.balances;
  }

  /**
   * Clear cache for a specific address
   */
  clearCache(address: string): void {
    // Clear all cache entries for this address
    // Note: This is a simple implementation - in production, you might want to track keys
    const cache = getCache();
    // For now, we'll rely on TTL expiration
    // A more sophisticated implementation would track keys per address
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let walletBalanceServiceInstance: WalletBalanceService | null = null;

/**
 * Get singleton WalletBalanceService instance
 */
export function getWalletBalanceService(): WalletBalanceService {
  if (!walletBalanceServiceInstance) {
    walletBalanceServiceInstance = new WalletBalanceService();
  }
  return walletBalanceServiceInstance;
}

