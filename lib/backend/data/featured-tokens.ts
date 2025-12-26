/**
 * Featured Tokens
 * 
 * Tokens that should appear prominently in token lists.
 * These are injected into popular token results for their respective chains.
 */

import type { NormalizedToken } from '@/lib/backend/types/backend-tokens';

/**
 * Featured tokens by chain ID
 * Key: canonical chain ID
 * Value: array of featured tokens (will appear first in results)
 */
export const FEATURED_TOKENS: Record<number, NormalizedToken[]> = {
  // BNB Chain (56) - TWC Token
  56: [
    {
      chainId: 56,
      address: '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596',
      symbol: 'TWC',
      name: 'TIWI CAT',
      decimals: 18,
      // Use DexScreener image + price so token row has correct logo & price
      logoURI: 'https://cdn.dexscreener.com/cms/images/c135d9cc87d8db4c1e74788c546ed3c7c4498a5da693cbefdc30e749cbea4843?width=800&height=800&quality=90',
      priceUSD: '0.0000000004160',
      providers: ['featured'],
      verified: false,
      vmType: 'evm',
      chainBadge: 'bsc',
      chainName: 'BNB Chain',
    },
  ],
};

/**
 * Get featured tokens for a specific chain
 */
export function getFeaturedTokens(chainId: number): NormalizedToken[] {
  return FEATURED_TOKENS[chainId] || [];
}

/**
 * Get featured tokens for multiple chains
 */
export function getFeaturedTokensForChains(chainIds: number[]): NormalizedToken[] {
  const featured: NormalizedToken[] = [];
  for (const chainId of chainIds) {
    featured.push(...getFeaturedTokens(chainId));
  }
  return featured;
}

