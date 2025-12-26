/**
 * Chain Resolver
 * 
 * Dynamically resolves chain IDs to canonical chains.
 * Supports both static registry chains and dynamic resolution from providers.
 * 
 * Key Features:
 * - Checks static registry first (fast path)
 * - Falls back to dynamic resolution from LiFi for priority chains
 * - Caches resolved chains to avoid repeated API calls
 * - Future-ready for additional providers
 */

import { getCanonicalChain, getCanonicalChainByProviderId } from './chains';
import { LiFiProvider } from '@/lib/backend/providers/lifi';
import type { CanonicalChain } from '@/lib/backend/types/backend-tokens';

// ============================================================================
// Priority Chain IDs (from LiFi provider)
// ============================================================================

/**
 * Priority EVM chain IDs that LiFi supports
 * These chains are dynamically resolvable even if not in static registry
 */
export const PRIORITY_EVM_CHAINS = new Set([
  1, 42161, 8453, 792703809, 2741, 888888888, 69000, 33139, 466, 42170,
  7897, 43114, 8333, 80094, 8253038, 81457, 56, 60808, 288, 42220,
  21000000, 25, 7560, 666666666, 9286185, 5064014, 747, 984122, 33979,
  100, 1625, 43419, 43111, 999, 1337, 57073, 747474, 59144, 1135, 169,
  5000, 1088, 34443, 143, 2818, 42018, 10, 1424, 9745, 98866, 137, 1101,
  7869, 1380012617, 690, 2020, 1996, 534352, 1329, 360, 5031, 1868, 146,
  9286186, 988, 1514, 55244, 5330, 1923, 510003, 167000, 728126428, 130,
  480, 660279, 543210, 48900, 324, 7777777
]);

// ============================================================================
// Chain Resolution Cache
// ============================================================================

/**
 * Cache for dynamically resolved chains
 * Key: chainId (number)
 * Value: CanonicalChain
 */
const chainCache = new Map<number, CanonicalChain>();

/**
 * Cache for failed resolutions (to avoid repeated API calls for unsupported chains)
 * Key: chainId (number)
 * Value: true (failed to resolve)
 */
const failedResolutions = new Set<number>();

// ============================================================================
// Chain Resolution Functions
// ============================================================================

/**
 * Resolve a chain ID to a canonical chain
 * 
 * Resolution order:
 * 1. Check static registry (fast path)
 * 2. Check cache (previously resolved chains)
 * 3. Check if chain is in priority list
 * 4. Try dynamic resolution from LiFi
 * 5. Cache result (success or failure)
 * 
 * @param chainId - Chain ID to resolve (can be canonical or provider-specific)
 * @returns CanonicalChain or null if not found/unsupported
 */
export async function resolveChain(chainId: number): Promise<CanonicalChain | null> {
  // Fast path: Check static registry first
  const staticChain = getCanonicalChain(chainId);
  if (staticChain) {
    return staticChain;
  }

  // Check cache (previously resolved chains)
  const cachedChain = chainCache.get(chainId);
  if (cachedChain) {
    return cachedChain;
  }

  // Check if this chain was previously determined to be unsupported
  if (failedResolutions.has(chainId)) {
    return null;
  }

  // Check if chain is in priority list (LiFi-supported)
  // If not, we can skip dynamic resolution
  if (!PRIORITY_EVM_CHAINS.has(chainId)) {
    // Not in priority list, mark as failed and return null
    failedResolutions.add(chainId);
    return null;
  }

  // Try dynamic resolution from LiFi
  try {
    const resolvedChain = await resolveChainFromLiFi(chainId);
    if (resolvedChain) {
      // Cache successful resolution
      chainCache.set(chainId, resolvedChain);
      return resolvedChain;
    } else {
      // Mark as failed
      failedResolutions.add(chainId);
      return null;
    }
  } catch (error) {
    console.warn(`[ChainResolver] Error resolving chain ${chainId} from LiFi:`, error);
    // Don't mark as failed on transient errors (network issues, etc.)
    // Allow retry on next request
    return null;
  }
}

/**
 * Resolve chain from LiFi provider
 * 
 * @param chainId - LiFi chain ID
 * @returns CanonicalChain or null
 */
async function resolveChainFromLiFi(chainId: number): Promise<CanonicalChain | null> {
  try {
    const lifiProvider = new LiFiProvider();
    
    // Fetch chains from LiFi
    const providerChains = await lifiProvider.fetchChains();
    
    // Find the chain with matching ID
    const matchingChain = providerChains.find(
      chain => chain.id === chainId || String(chain.id) === String(chainId)
    );
    
    if (!matchingChain) {
      return null;
    }
    
    // Normalize to canonical format
    const canonicalChain = lifiProvider.normalizeChain(matchingChain);
    return canonicalChain;
  } catch (error) {
    console.error(`[ChainResolver] Error fetching chain ${chainId} from LiFi:`, error);
    return null;
  }
}

/**
 * Resolve multiple chain IDs in parallel
 * 
 * @param chainIds - Array of chain IDs to resolve
 * @returns Map of chainId -> CanonicalChain (only successful resolutions)
 */
export async function resolveChains(chainIds: number[]): Promise<Map<number, CanonicalChain>> {
  const results = new Map<number, CanonicalChain>();
  
  // Resolve all chains in parallel
  const resolutions = await Promise.allSettled(
    chainIds.map(async (chainId) => {
      const chain = await resolveChain(chainId);
      return { chainId, chain };
    })
  );
  
  // Collect successful resolutions
  for (const result of resolutions) {
    if (result.status === 'fulfilled' && result.value.chain) {
      results.set(result.value.chainId, result.value.chain);
    }
  }
  
  return results;
}

/**
 * Check if a chain ID is supported (in priority list or static registry)
 * 
 * @param chainId - Chain ID to check
 * @returns true if chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  // Check static registry
  if (getCanonicalChain(chainId)) {
    return true;
  }
  
  // Check priority list
  return PRIORITY_EVM_CHAINS.has(chainId);
}

/**
 * Clear the chain resolution cache
 * Useful for testing or when chains are updated
 */
export function clearChainCache(): void {
  chainCache.clear();
  failedResolutions.clear();
}

