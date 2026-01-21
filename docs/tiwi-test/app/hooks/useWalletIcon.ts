'use client';

import { useState, useEffect } from 'react';
import { getWalletIconUrl, getCachedWalletIconUrl } from '../utils/wallet-icons';

/**
 * Hook to get wallet icon URL with fallback to emoji
 * @param walletId - The wallet ID
 * @param emojiFallback - Emoji to use as fallback if icon is not found
 * @param size - Icon size (sm, md, lg)
 * @param imageId - Optional WalletConnect image ID (preferred for direct lookup)
 * @returns Object with iconUrl (string | null) and isLoading (boolean)
 */
export function useWalletIcon(
  walletId: string,
  emojiFallback: string,
  size: 'sm' | 'md' | 'lg' = 'md',
  imageId?: string
) {
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchIcon() {
      // Check cache first
      const cacheKey = imageId ? `${imageId}-${size}` : `${walletId}-${size}`;
      const cached = getCachedWalletIconUrl(walletId, size);
      if (cached) {
        if (!cancelled) {
          setIconUrl(cached);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const url = await getWalletIconUrl(walletId, imageId, size);
        if (!cancelled) {
          setIconUrl(url);
          setIsLoading(false);
        }
      } catch (error) {
        console.error(`Error loading icon for ${walletId}:`, error);
        if (!cancelled) {
          setIconUrl(null);
          setIsLoading(false);
        }
      }
    }

    fetchIcon();

    return () => {
      cancelled = true;
    };
  }, [walletId, size, imageId]);

  return {
    iconUrl,
    isLoading,
    displayIcon: iconUrl || emojiFallback,
    isImage: !!iconUrl,
  };
}

/**
 * Hook to preload wallet icons for multiple wallets
 */
export function usePreloadWalletIcons(walletIds: string[]) {
  useEffect(() => {
    // Preload icons in the background
    walletIds.forEach((walletId) => {
      getWalletIconUrl(walletId, 'md').catch(() => {
        // Silently fail - icons will load on demand
      });
    });
  }, [walletIds]);
}

