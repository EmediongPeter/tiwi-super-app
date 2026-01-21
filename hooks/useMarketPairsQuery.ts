/**
 * useMarketPairsQuery Hook
 * 
 * TanStack Query hook for fetching market pairs from the API.
 * Provides caching, deduplication, and automatic refetching.
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { fetchMarketPairs, type FetchMarketPairsParams } from '@/lib/frontend/api/tokens';
import type { MarketTokenPair } from '@/lib/backend/types/backend-tokens';
import type { MarketPairsAPIResponse } from '@/lib/shared/types/api';

/**
 * Get query key for market pairs query
 * Used for cache invalidation and manual refetching
 */
export function getMarketPairsQueryKey(
  params: FetchMarketPairsParams
): readonly unknown[] {
  return ['market-pairs', params.category, params.limit, params.network, params.page] as const;
}

export interface UseMarketPairsQueryOptions
  extends Omit<UseQueryOptions<MarketPairsAPIResponse, Error>, 'queryKey' | 'queryFn'> {
  params: FetchMarketPairsParams;
}

/**
 * Hook to fetch market pairs by category
 * 
 * @param options - Query options including params
 * @returns Query result with pairs, loading state, and error
 */
export function useMarketPairsQuery(
  options: UseMarketPairsQueryOptions
) {
  const { params, ...queryOptions } = options;

  return useQuery<MarketPairsAPIResponse, Error>({
    queryKey: getMarketPairsQueryKey(params),
    queryFn: () => fetchMarketPairs(params),
    staleTime: 60_000, // 1 minute - market data changes frequently
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...queryOptions,
  });
}

