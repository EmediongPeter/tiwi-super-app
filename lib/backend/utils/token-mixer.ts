/**
 * Token Mixing Utility
 * 
 * Mixes tokens from different chains in round-robin fashion.
 * This ensures tokens are interleaved rather than grouped by chain.
 * 
 * Platform-agnostic utility that can be used by any provider.
 */

import type { ProviderToken, NormalizedToken } from '@/lib/backend/types/backend-tokens';

/**
 * Mix tokens from different chains in round-robin fashion
 * 
 * Groups tokens by chain ID, then interleaves them so tokens from
 * different chains are evenly distributed in the result.
 * 
 * @param tokens - Array of tokens from multiple chains
 * @param limit - Maximum number of tokens to return
 * @returns Mixed array of tokens with interleaved chains
 */
export function mixTokensByChain(tokens: ProviderToken[], limit: number): ProviderToken[] {
  if (tokens.length === 0) return [];
  
  // Group tokens by chain ID
  const tokensByChain = new Map<number, ProviderToken[]>();
  for (const token of tokens) {
    const chainId = typeof token.chainId === 'number' ? token.chainId : parseInt(String(token.chainId), 10);
    if (!tokensByChain.has(chainId)) {
      tokensByChain.set(chainId, []);
    }
    tokensByChain.get(chainId)!.push(token);
  }
  
  // Round-robin mixing
  const mixed: ProviderToken[] = [];
  const chainIds = Array.from(tokensByChain.keys());
  const chainQueues = chainIds.map(id => tokensByChain.get(id)!);
  
  // Track current index for each chain
  const indices = new Array(chainIds.length).fill(0);
  
  // Mix tokens until we reach the limit or run out of tokens
  while (mixed.length < limit) {
    let addedAny = false;
    
    // Try to add one token from each chain in round-robin order
    for (let i = 0; i < chainQueues.length; i++) {
      if (mixed.length >= limit) break;
      
      const queue = chainQueues[i];
      const index = indices[i];
      
      if (index < queue.length) {
        mixed.push(queue[index]);
        indices[i]++;
        addedAny = true;
      }
    }
    
    // If we couldn't add any tokens, break
    if (!addedAny) break;
  }
  
  return mixed.slice(0, limit);
}

/**
 * Mix normalized tokens with balanced distribution and priority chain support
 * 
 * This function ensures:
 * 1. Balanced distribution: max 2-3 tokens per chain (5-6 for priority chain)
 * 2. Priority chain appears first (e.g., BNB Chain)
 * 3. Even distribution across all chains
 * 
 * @param tokens - Array of normalized tokens from multiple chains
 * @param limit - Maximum number of tokens to return
 * @param priorityChainId - Chain ID to prioritize (default: 56 for BNB Chain)
 * @param maxTokensPerChain - Maximum tokens per chain (default: 3)
 * @param maxTokensForPriority - Maximum tokens for priority chain (default: 6)
 * @returns Balanced and prioritized array of tokens
 */
export function mixTokensWithPriority(
  tokens: NormalizedToken[],
  limit: number = 30,
  priorityChainId: number = 56, // BNB Chain
  maxTokensPerChain: number = 3,
  maxTokensForPriority: number = 6
): NormalizedToken[] {
  if (tokens.length === 0) return [];
  
  // Group tokens by chain ID
  const tokensByChain = new Map<number, NormalizedToken[]>();
  for (const token of tokens) {
    const chainId = token.chainId;
    if (!tokensByChain.has(chainId)) {
      tokensByChain.set(chainId, []);
    }
    tokensByChain.get(chainId)!.push(token);
  }
  
  // Limit tokens per chain (priority chain gets more)
  const limitedByChain = new Map<number, NormalizedToken[]>();
  for (const [chainId, chainTokens] of tokensByChain.entries()) {
    const maxTokens = chainId === priorityChainId ? maxTokensForPriority : maxTokensPerChain;
    limitedByChain.set(chainId, chainTokens.slice(0, maxTokens));
  }
  
  // Separate priority chain from others
  const priorityTokens = limitedByChain.get(priorityChainId) || [];
  const otherChains = Array.from(limitedByChain.entries())
    .filter(([chainId]) => chainId !== priorityChainId)
    .map(([, tokens]) => tokens);
  
  // Build result: priority chain first, then round-robin others
  const result: NormalizedToken[] = [];
  
  // Add priority chain tokens first (up to limit/3 to ensure diversity)
  const priorityLimit = Math.min(priorityTokens.length, Math.floor(limit * 0.3));
  result.push(...priorityTokens.slice(0, priorityLimit));
  
  // Round-robin remaining chains
  const remainingLimit = limit - result.length;
  if (remainingLimit > 0 && otherChains.length > 0) {
    const chainQueues = otherChains;
    const indices = new Array(chainQueues.length).fill(0);
    
    while (result.length < limit) {
      let addedAny = false;
      
      for (let i = 0; i < chainQueues.length; i++) {
        if (result.length >= limit) break;
        
        const queue = chainQueues[i];
        const index = indices[i];
        
        if (index < queue.length) {
          result.push(queue[index]);
          indices[i]++;
          addedAny = true;
        }
      }
      
      if (!addedAny) break;
    }
  }
  
  return result.slice(0, limit);
}

