/**
 * Token Decimals Fetcher
 * 
 * Fetches token decimals directly from blockchain contracts using viem.
 * This is the most reliable source of truth for token decimals.
 * 
 * Strategy:
 * 1. Only fetches for EVM chains (not Solana, Cosmos, etc.)
 * 2. Caches results to avoid repeated contract calls
 * 3. Falls back gracefully if contract call fails
 */

import { createPublicClient, http, type Address, getAddress } from 'viem';
import { 
  bsc, 
  mainnet, 
  arbitrum, 
  optimism, 
  polygon, 
  base,
  avalanche,
  fantom,
  gnosis,
  polygonZkEvm,
  zkSync,
  mantle,
  linea,
  scroll,
} from 'viem/chains';
import { getCache } from './cache';
import { getRpcUrl, RPC_TRANSPORT_OPTIONS } from './rpc-config';

// ============================================================================
// Chain Configuration
// ============================================================================

const CHAIN_CONFIGS: Record<number, any> = {
  1: mainnet,
  56: bsc,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  8453: base,
  43114: avalanche,
  250: fantom,
  100: gnosis,
  1101: polygonZkEvm,
  324: zkSync,
  5000: mantle,
  59144: linea,
  534352: scroll,
};

// ============================================================================
// ERC-20 Decimals ABI
// ============================================================================

const ERC20_DECIMALS_ABI = [
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ============================================================================
// Known Decimals (for common tokens, as fallback)
// ============================================================================

const KNOWN_DECIMALS: Record<string, number> = {
  // USDT addresses
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 6, // Ethereum USDT
  '0x55d398326f99059ff775485246999027b3197955': 18, // BSC USDT
  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 6, // Polygon USDT
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 6, // Arbitrum USDT
  '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58': 6, // Optimism USDT
  // USDC addresses
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6, // Ethereum USDC
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 18, // BSC USDC
  // Native tokens (for reference, but we don't fetch these)
  '0x0000000000000000000000000000000000000000': 18, // Native token placeholder
  '0x0000000000000000000000000000000000001010': 18, // Polygon native
};

// Cache TTL: 24 hours (decimals don't change)
const DECIMALS_CACHE_TTL = 24 * 60 * 60 * 1000;

// ============================================================================
// Token Decimals Fetcher
// ============================================================================

export class TokenDecimalsFetcher {
  private cache = getCache();

  /**
   * Get token decimals from blockchain contract
   * 
   * Flow:
   * 1. Check cache first
   * 2. Check known decimals map
   * 3. Query blockchain contract (for EVM chains only)
   * 4. Cache result
   * 5. Fallback to 18 if all fails
   * 
   * @param address - Token contract address
   * @param chainId - Chain ID
   * @returns Token decimals (default: 18 if not found)
   */
  async getTokenDecimals(address: string, chainId: number): Promise<number> {
    // Skip native tokens (they're handled separately)
    if (!address || 
        address === '0x0000000000000000000000000000000000000000' ||
        address === '0x0000000000000000000000000000000000001010') {
      return 18; // Native tokens are always 18 decimals
    }

    const addressLower = address.toLowerCase();
    
    // 1. Check cache
    const cacheKey = `token-decimals:${chainId}:${addressLower}`;
    const cached = this.cache.get<number>(cacheKey);
    if (cached !== undefined) {
      return cached!;
    }

    // 2. Check known decimals map
    if (KNOWN_DECIMALS[addressLower]) {
      const decimals = KNOWN_DECIMALS[addressLower];
      this.cache.set(cacheKey, decimals, DECIMALS_CACHE_TTL);
      return decimals;
    }

    // 3. Query blockchain (only for EVM chains)
    const chainConfig = CHAIN_CONFIGS[chainId];
    if (!chainConfig) {
      // Not an EVM chain or chain not supported
      console.warn(`[TokenDecimalsFetcher] Chain ${chainId} not supported for decimals fetch, defaulting to 18`);
      const defaultDecimals = 18;
      this.cache.set(cacheKey, defaultDecimals, DECIMALS_CACHE_TTL);
      return defaultDecimals;
    }

    try {
      // Use custom RPC URL if available, otherwise use default
      const customRpcUrl = getRpcUrl(chainId);
      const transport = customRpcUrl 
        ? http(customRpcUrl, RPC_TRANSPORT_OPTIONS)
        : http();
      
      const publicClient = createPublicClient({
        chain: chainConfig,
        transport,
      });

      // Validate address format
      let tokenAddress: Address;
      try {
        tokenAddress = getAddress(address);
      } catch (error) {
        console.warn(`[TokenDecimalsFetcher] Invalid address format: ${address}, defaulting to 18`);
        const defaultDecimals = 18;
        this.cache.set(cacheKey, defaultDecimals, DECIMALS_CACHE_TTL);
        return defaultDecimals;
      }

      // Call decimals() function on contract
      const decimals = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_DECIMALS_ABI,
        functionName: 'decimals',
      });

      const decimalsNumber = Number(decimals);
      
      // Validate decimals (should be 0-18)
      if (isNaN(decimalsNumber) || decimalsNumber < 0 || decimalsNumber > 18) {
        console.warn(`[TokenDecimalsFetcher] Invalid decimals value ${decimalsNumber} for ${address}, defaulting to 18`);
        const defaultDecimals = 18;
        this.cache.set(cacheKey, defaultDecimals, DECIMALS_CACHE_TTL);
        return defaultDecimals;
      }

      // Cache result
      this.cache.set(cacheKey, decimalsNumber, DECIMALS_CACHE_TTL);
      
      
      return decimalsNumber;
    } catch (error: any) {
      // Contract call failed - could be invalid address, contract doesn't exist, etc.
      console.warn(`[TokenDecimalsFetcher] Failed to fetch decimals for ${address} on chain ${chainId}:`, error?.message || error);
      
      // Fallback to 18 (most common for EVM tokens)
      const defaultDecimals = 18;
      this.cache.set(cacheKey, defaultDecimals, DECIMALS_CACHE_TTL);
      return defaultDecimals;
    }
  }

  /**
   * Batch fetch decimals for multiple tokens (parallel)
   * 
   * @param tokens - Array of { address, chainId }
   * @returns Map of address:chainId -> decimals
   */
  async getTokenDecimalsBatch(
    tokens: Array<{ address: string; chainId: number }>
  ): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    
    // Fetch all in parallel
    const promises = tokens.map(async ({ address, chainId }) => {
      const key = `${chainId}:${address.toLowerCase()}`;
      const decimals = await this.getTokenDecimals(address, chainId);
      return { key, decimals };
    });
    
    const settled = await Promise.allSettled(promises);
    
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.set(result.value.key, result.value.decimals);
      }
    }
    
    return results;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let decimalsFetcherInstance: TokenDecimalsFetcher | null = null;

/**
 * Get singleton TokenDecimalsFetcher instance
 */
export function getTokenDecimalsFetcher(): TokenDecimalsFetcher {
  if (!decimalsFetcherInstance) {
    decimalsFetcherInstance = new TokenDecimalsFetcher();
  }
  return decimalsFetcherInstance;
}
