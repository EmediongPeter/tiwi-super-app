/**
 * Main Wallet Hook
 * 
 * Provides access to wallet state and actions
 */

import { useWalletStore } from '../state/store';
import { useEffect, useRef } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { getAccount } from '@wagmi/core';
import { useConfig } from 'wagmi';
import { mapProviderIdToWalletId } from '../utils/wallet-id-mapper';
import type { WalletAccount } from '../connection/types';

/**
 * Main wallet hook
 * Syncs with Wagmi state (read-only)
 */
export function useWallet() {
  const store = useWalletStore();
  const wagmiConfig = useConfig();
  const { address: wagmiAddress, isConnected: wagmiConnected, connector } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const lastWagmiAddressRef = useRef<string | undefined>(undefined);

  // Track wagmi account changes and sync with store
  useEffect(() => {
    if (!wagmiConnected || !wagmiAddress) {
      lastWagmiAddressRef.current = undefined;
      return;
    }

    // Check if address changed
    if (lastWagmiAddressRef.current === wagmiAddress) {
      return; // No change
    }

    const previousAddress = lastWagmiAddressRef.current;
    lastWagmiAddressRef.current = wagmiAddress;

    // If this is the first time we see this address, or it changed, sync with store
    if (!previousAddress || previousAddress !== wagmiAddress) {
      // Determine which provider this is from (check connector)
      let providerId = 'metamask'; // Default fallback
      
      if (connector) {
        const connectorId = (connector.id || '').toLowerCase();
        const connectorName = (connector.name || '').toLowerCase();
        
        // Map connector to provider ID
        if (connectorId.includes('metamask') || connectorName.includes('metamask')) {
          providerId = 'metamask';
        } else if (connectorId.includes('coinbase') || connectorName.includes('coinbase')) {
          providerId = 'coinbase';
        } else if (connectorId.includes('walletconnect')) {
          providerId = 'walletconnect';
        }
        // Add more mappings as needed
      }

      // Map provider ID back to wallet ID
      const walletId = mapProviderIdToWalletId(providerId);

      // Check if we already have a wallet with this provider+chain
      const existingWallet = store.connectedWallets.find(
        (w) => w.provider === walletId && w.chain === 'ethereum'
      );

      // If address changed for an existing wallet, update it (account switch)
      if (existingWallet && existingWallet.address.toLowerCase() !== wagmiAddress.toLowerCase()) {
        const updatedAccount: WalletAccount = {
          address: wagmiAddress,
          chain: 'ethereum',
          provider: walletId,
        };
        
        try {
          // Use setAccount which handles account switching logic
          store.setAccount(updatedAccount);
        } catch (error) {
          console.warn('[useWallet] Error syncing account change:', error);
        }
      } else if (!existingWallet) {
        // New wallet connection from wagmi (shouldn't happen often, but handle it)
        const newAccount: WalletAccount = {
          address: wagmiAddress,
          chain: 'ethereum',
          provider: walletId,
        };
        
        try {
          store.setAccount(newAccount);
        } catch (error) {
          console.warn('[useWallet] Error adding new account from wagmi:', error);
        }
      } else {
        // Same address, just ensure it's in sync (no action needed if already correct)
        // The wallet is already connected with this address
      }
    }
  }, [wagmiConnected, wagmiAddress, connector, store]);

  // Get active wallet (for backward compatibility, falls back to primaryWallet)
  const activeWallet = store.getActiveWallet() || store.primaryWallet;

  return {
    // Legacy state (for backward compatibility)
    primaryWallet: store.primaryWallet,
    secondaryWallet: store.secondaryWallet,
    secondaryAddress: store.secondaryAddress,
    
    // New multi-wallet state
    connectedWallets: store.connectedWallets,
    activeWallet: activeWallet,
    activeWalletId: store.activeWalletId,
    
    // Common state
    isConnecting: store.isConnecting,
    error: store.error,
    
    // Computed (backward compatible)
    isConnected: store.connectedWallets.length > 0 || !!store.primaryWallet,
    address: activeWallet?.address || null,
    
    // Legacy actions (for backward compatibility)
    connect: store.connect,
    disconnect: async () => {
      // Disconnect from both our store and Wagmi
      await store.disconnect();
      if (wagmiConnected) {
        wagmiDisconnect();
      }
    },
    setSecondaryWallet: store.setSecondaryWallet,
    setSecondaryAddress: store.setSecondaryAddress,
    
    // New multi-wallet actions
    addWallet: store.addWallet,
    removeWallet: store.removeWallet,
    setActiveWallet: store.setActiveWallet,
    getActiveWallet: store.getActiveWallet,
    isProviderConnected: store.isProviderConnected,
    getWalletByAddress: store.getWalletByAddress,
    connectAdditionalWallet: store.connectAdditionalWallet,
    
    // Utility actions
    clearError: store.clearError,
  };
}

