"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchChains } from "@/lib/frontend/api/chains";
import type { Chain } from "@/lib/frontend/types/tokens";

/**
 * Hook to get chain logo URI by chain name
 * Fetches chains from /api/v1/chains and maps by name
 */
export function useChainLogo(chainName: string | undefined): string | undefined {
  const { data: chains } = useQuery<Chain[]>({
    queryKey: ['chains'],
    queryFn: () => fetchChains(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  if (!chainName || !chains) {
    return undefined;
  }

  // Find chain by name (case-insensitive)
  const chain = chains.find(
    (c) => c.name.toLowerCase() === chainName.toLowerCase()
  );

  return chain?.logo;
}



