'use client';

/**
 * LiFi SDK Provider
 * 
 * Configures LiFi SDK with ecosystem providers (EVM, Solana, etc.)
 * This is required for executing routes/quotes through the LiFi SDK.
 * 
 * Based on LiFi SDK best practices:
 * - Uses Wagmi for EVM wallet client integration
 * - Supports dynamic chain switching
 * - Configures providers only when wallet is connected
 */

import { useEffect, type ReactNode } from 'react';
import { createConfig, EVM, config, getChains, ChainType } from '@lifi/sdk';
import { useAccount, useChainId, useConfig } from 'wagmi';
import { getWalletClient, switchChain } from '@wagmi/core';
import type { Config as WagmiConfig } from 'wagmi';

// Initialize LiFi SDK config (only once, on module load)
// We'll add providers dynamically when wallet connects
let isLiFiConfigInitialized = false;

if (!isLiFiConfigInitialized) {
  createConfig({
    integrator: 'TIWI Protocol',
    // Don't preload chains - we'll load them dynamically
    preloadChains: false,
  });
  isLiFiConfigInitialized = true;
}

// Global reference to wagmi config for executor access
let globalWagmiConfig: any = null;

export function setWagmiConfigForLiFi(wagmiConfig: any) {
  globalWagmiConfig = wagmiConfig;
}

export function getWagmiConfigForLiFi() {
  return globalWagmiConfig;
}

/**
 * LiFi SDK Provider Component
 * 
 * Configures LiFi SDK providers based on connected wallet.
 * Must be used inside WagmiProvider.
 */
export function LiFiSDKProvider({ children }: { children: ReactNode }) {
  const wagmiConfig = useConfig();
  const { isConnected, address } = useAccount();
  const chainId = useChainId();

  // Store wagmi config globally for executor access
  useEffect(() => {
    setWagmiConfigForLiFi(wagmiConfig);
  }, [wagmiConfig]);

  useEffect(() => {
    // Only configure providers if wallet is connected
    if (!isConnected || !address) {
      console.log('[LiFiSDKProvider] Wallet not connected, skipping provider configuration');
      return;
    }

    console.log('[LiFiSDKProvider] Configuring LiFi SDK providers...', {
      address,
      chainId,
    });

    // Capture current chainId for use in async functions
    const currentChainId = chainId;

    // Configure EVM provider using Wagmi
    const evmProvider = EVM({
      getWalletClient: async (requestedChainId?: number) => {
        try {
          // If chainId is provided and different from current chain, switch first
          if (requestedChainId && requestedChainId !== currentChainId) {
            console.log(`[LiFiSDKProvider] Switching chain from ${currentChainId} to ${requestedChainId}...`);
            await switchChain(wagmiConfig, { chainId: requestedChainId });
          }

          // Get wallet client from Wagmi
          const walletClient = await getWalletClient(wagmiConfig, requestedChainId ? { chainId: requestedChainId } : undefined);
          
          if (!walletClient) {
            throw new Error('Failed to get wallet client from Wagmi');
          }

          console.log('[LiFiSDKProvider] Wallet client obtained:', {
            chainId: walletClient.chain?.id,
            account: walletClient.account?.address,
          });

          return walletClient;
        } catch (error) {
          console.error('[LiFiSDKProvider] Error getting wallet client:', error);
          throw error;
        }
      },
      switchChain: async (targetChainId: number) => {
        try {
          console.log(`[LiFiSDKProvider] Switching chain to ${targetChainId}...`);
          const chain = await switchChain(wagmiConfig, { chainId: targetChainId });
          const walletClient = await getWalletClient(wagmiConfig, { chainId: chain.id });
          
          if (!walletClient) {
            throw new Error(`Failed to get wallet client for chain ${targetChainId}`);
          }

          return walletClient;
        } catch (error) {
          console.error(`[LiFiSDKProvider] Error switching chain to ${targetChainId}:`, error);
          throw error;
        }
      },
    });

    // Set providers in LiFi SDK config
    config.setProviders([evmProvider]);

    // Optionally load and set chains from LiFi API
    // This ensures we have the latest chain configurations
    loadLiFiChains().catch((error) => {
      console.warn('[LiFiSDKProvider] Failed to load chains from LiFi API:', error);
      // This is not critical - SDK will work with default chains
    });

    console.log('[LiFiSDKProvider] LiFi SDK providers configured successfully');

    // Cleanup: Remove providers when wallet disconnects or component unmounts
    return () => {
      console.log('[LiFiSDKProvider] Cleaning up providers');
      config.setProviders([]);
    };
  }, [isConnected, address, chainId, wagmiConfig]);

  return <>{children}</>;
}

/**
 * Load chains from LiFi API and update SDK configuration
 * This ensures we have the latest chain configurations
 */
async function loadLiFiChains(): Promise<void> {
  try {
    const chains = await getChains({
      chainTypes: [ChainType.EVM],
    });

    // Update SDK chain configuration
    config.setChains(chains);

    console.log(`[LiFiSDKProvider] Loaded ${chains.length} EVM chains from LiFi API`);
  } catch (error) {
    console.error('[LiFiSDKProvider] Error loading chains:', error);
    throw error;
  }
}

