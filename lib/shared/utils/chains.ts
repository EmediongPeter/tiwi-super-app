/**
 * Chain Utilities
 * 
 * Shared utilities for chain sorting and manipulation.
 * Used in both web and mobile.
 */

import type { Chain } from '@/lib/frontend/types/tokens';

/**
 * Sort chains: Ethereum first, then BNB Chain, then others maintain registry order
 * 
 * @param chains - Array of chains to sort
 * @returns Sorted array with Ethereum first, then BNB Chain, then others
 */
export function sortChains(chains: Chain[]): Chain[] {
  const ethereumChainId = '1'; // Ethereum canonical ID
  const bnbChainId = '56'; // BNB Chain canonical ID
  
  const ethereumChain = chains.find(chain => chain.id === ethereumChainId);
  const bnbChain = chains.find(chain => chain.id === bnbChainId);
  const otherChains = chains.filter(
    chain => chain.id !== ethereumChainId && chain.id !== bnbChainId
  );
  
  // Return: Ethereum first, then BNB Chain, then others
  const sorted: Chain[] = [];
  if (ethereumChain) sorted.push(ethereumChain);
  if (bnbChain) sorted.push(bnbChain);
  sorted.push(...otherChains);
  
  return sorted;
}

