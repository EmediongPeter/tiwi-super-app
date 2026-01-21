"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMarketPairs } from "@/lib/frontend/api/tokens";
import { TOP_COINGECKO_NETWORKS } from "@/lib/shared/constants/coingecko-networks";

/**
 * Hook to prefetch market data for top networks to improve perceived performance.
 * Prefetches 'hot' and 'new' categories for networks like BSC, Solana, and Eth.
 */
export function usePrefetchMarkets() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Prefetch for each top network
    TOP_COINGECKO_NETWORKS.forEach((network) => {
      // Prefetch 'hot' pairs
      queryClient.prefetchQuery({
        queryKey: ["market-pairs", { category: "hot", network, limit: 20, page: 1 }],
        queryFn: () => fetchMarketPairs({ category: "hot", network, limit: 20, page: 1 }),
        staleTime: 1000 * 60 * 5, // 5 minutes
      });

      // Prefetch 'new' pairs (common for degens to check)
      queryClient.prefetchQuery({
        queryKey: ["market-pairs", { category: "new", network, limit: 20, page: 1 }],
        queryFn: () => fetchMarketPairs({ category: "new", network, limit: 20, page: 1 }),
        staleTime: 1000 * 60 * 5,
      });
    });
  }, [queryClient]);
}
