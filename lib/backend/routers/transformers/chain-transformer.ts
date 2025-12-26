/**
 * Chain ID Transformer
 * 
 * Transforms canonical chain IDs to router-specific chain identifiers.
 */

import { getCanonicalChain } from '@/lib/backend/registry/chains';

/**
 * Transform canonical chain ID to router-specific chain identifier
 */
export class ChainTransformer {
  /**
   * Transform to LiFi chain ID
   * Returns numeric LiFi chain ID or null if not supported
   */
  static toLiFi(canonicalChainId: number): number | null {
    const chain = getCanonicalChain(canonicalChainId);
    if (!chain) return null;
    
    const lifiId = chain.providerIds.lifi;
    if (lifiId === null || lifiId === undefined) return null;
    
    // LiFi uses numeric chain IDs
    return typeof lifiId === 'number' ? lifiId : parseInt(String(lifiId), 10);
  }
  
  /**
   * Transform to Squid chain identifier
   * Squid accepts numeric chain IDs for EVM chains (1, 56, etc.)
   * but string identifiers for non-EVM chains (e.g., "osmosis-1", "solana-mainnet-beta")
   */
  static toSquid(canonicalChainId: number): string | null {
    const chain = getCanonicalChain(canonicalChainId);
    if (!chain) return null;
    
    // Try providerIds.squid first
    if (chain.providerIds.squid) {
      return String(chain.providerIds.squid);
    }
    
    // Map common chains to Squid identifiers
    // EVM chains: use numeric string
    // Non-EVM chains: use chain-specific identifiers
    const squidMap: Record<number, string> = {
      // EVM chains (numeric string)
      1: '1',                          // Ethereum
      56: '56',                        // BSC
      137: '137',                      // Polygon
      42161: '42161',                  // Arbitrum
      10: '10',                        // Optimism
      8453: '8453',                    // Base
      43114: '43114',                  // Avalanche
      
      // Solana
      7565164: 'solana-mainnet-beta',  // Solana
      
      // Cosmos chains (would need to be added to registry first)
      // Example: osmosis-1, cosmoshub-4, etc.
    };
    
    return squidMap[canonicalChainId] || null;
  }
  
  /**
   * Transform to Jupiter (only Solana)
   * Returns true if chain is Solana, false otherwise
   */
  static toJupiter(canonicalChainId: number): boolean {
    return canonicalChainId === 7565164; // Solana canonical ID
  }
  
  /**
   * Transform to Uniswap/PancakeSwap chain ID
   * These routers use the same chain IDs as canonical (numeric)
   */
  static toUniswap(canonicalChainId: number): number | null {
    // Uniswap supports: Ethereum (1), Arbitrum (42161), Optimism (10), Polygon (137), Base (8453)
    const supportedChains = [1, 42161, 10, 137, 8453];
    return supportedChains.includes(canonicalChainId) ? canonicalChainId : null;
  }
  
  static toPancakeSwap(canonicalChainId: number): number | null {
    // PancakeSwap primarily supports BNB Chain (56), but also has fallback support for other chains
    const supportedChains = [56, 1, 42161, 10, 137, 8453];
    return supportedChains.includes(canonicalChainId) ? canonicalChainId : null;
  }
  
  /**
   * Generic transformer - returns router-specific chain ID based on router name
   */
  static transform(canonicalChainId: number, routerName: string): number | string | null {
    switch (routerName) {
      case 'lifi':
        return this.toLiFi(canonicalChainId);
      case 'squid':
        return this.toSquid(canonicalChainId);
      case 'jupiter':
        return this.toJupiter(canonicalChainId) ? canonicalChainId : null;
      case 'uniswap':
        return this.toUniswap(canonicalChainId);
      case 'pancakeswap':
        return this.toPancakeSwap(canonicalChainId);
      default:
        // Default: try to use canonical chain ID
        // Most routers that support EVM chains use numeric IDs
        return canonicalChainId;
    }
  }
}

