"use client";

import { create } from "zustand";

interface NetworkFilterState {
  /** Selected LiFi Chain ID. null means "All Networks" */
  selectedChainId: number | null;
  /** Selected CoinGecko Network Slug (e.g. 'eth', 'bsc') */
  selectedNetworkSlug: string | null;
  
  /** Actions */
  setNetwork: (chainId: number | null, slug: string | null) => void;
  reset: () => void;
}

/**
 * Store for managing the network filter across the home page (Selector -> Table)
 */
export const useNetworkFilterStore = create<NetworkFilterState>((set) => ({
  selectedChainId: null,
  selectedNetworkSlug: null,

  setNetwork: (chainId, slug) => set({ 
    selectedChainId: chainId, 
    selectedNetworkSlug: slug 
  }),

  reset: () => set({ 
    selectedChainId: null, 
    selectedNetworkSlug: null 
  }),
}));
