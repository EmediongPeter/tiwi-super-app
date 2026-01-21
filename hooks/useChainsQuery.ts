"use client";

import { useQuery } from "@tanstack/react-query";
import type { ChainsAPIResponse } from "@/lib/shared/types/api";

/**
 * Hook for fetching supported chains from the backend
 */
export function useChainsQuery() {
  return useQuery({
    queryKey: ["chains"],
    queryFn: async () => {
      const response = await fetch("/api/v1/chains");
      if (!response.ok) {
        throw new Error("Failed to fetch chains");
      }
      const data: ChainsAPIResponse = await response.json();
      return data.chains;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
