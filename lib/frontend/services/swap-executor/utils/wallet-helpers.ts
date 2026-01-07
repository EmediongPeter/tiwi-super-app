/**
 * Wallet Helper Utilities
 * 
 * Utilities for getting wallet clients and connections for different chains.
 * Uses cached public clients and creates wallet clients from connected providers.
 */

import { type WalletClient, type PublicClient } from 'viem';
import { Connection } from '@solana/web3.js';
import { isEVMChain, isSolanaChain } from './chain-helpers';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { getCachedPublicClient, getWalletClientForChain } from '@/lib/frontend/utils/viem-clients';

/**
 * Get EVM wallet client for a chain
 * 
 * Creates a wallet client from the connected wallet provider.
 * Uses the specific provider for the connected wallet to ensure proper isolation.
 * Handles chain switching if needed.
 */
export async function getEVMWalletClient(chainId: number): Promise<WalletClient> {
  if (!isEVMChain(chainId)) {
    throw new SwapExecutionError(
      `Chain ${chainId} is not an EVM chain`,
      SwapErrorCode.UNSUPPORTED_ROUTER
    );
  }

  try {
    // Get connected wallet from wallet store to get the provider ID
    let providerId: string | undefined;
    
    try {
      // Import wallet store and mapper dynamically to avoid circular dependencies
      const walletStoreModule = await import('@/lib/wallet/state/store');
      const walletMapperModule = await import('@/lib/wallet/utils/wallet-id-mapper');
      
      // Get the store state synchronously (Zustand supports getState())
      const storeState = walletStoreModule.useWalletStore.getState();
      const connectedWallet = storeState.primaryWallet;
      
      if (connectedWallet && connectedWallet.chain === 'ethereum') {
        // Map wallet ID to provider ID (e.g., 'metamask' -> 'metamask', 'rabby' -> 'rabby')
        providerId = walletMapperModule.mapWalletIdToProviderId(connectedWallet.provider);
      }
    } catch (error) {
      // If we can't get the wallet store, continue without providerId (fallback to window.ethereum)
      console.warn('Could not get connected wallet provider, using fallback:', error);
    }

    // Get wallet client from connected provider (with specific provider ID if available)
    const walletClient = await getWalletClientForChain(chainId, providerId);
    
    // Check if wallet is on the correct chain
    const currentChainId = await walletClient.getChainId();
    
    if (currentChainId !== chainId) {
      // Get the provider from the wallet client to request chain switch
      // CRITICAL: Use the provider from the wallet client's transport, not window.ethereum
      // This ensures we use the correct wallet (Rabby, MetaMask, etc.) for chain switching
      let provider: any;
      
      // Try to get provider from wallet client transport
      const transport = walletClient.transport as any;
      if (transport?.value) {
        provider = transport.value;
      } else if (transport?.request) {
        // Some transports expose the provider via request method
        provider = transport;
      } else {
        // If we can't get provider from transport, get it directly using providerId
        if (providerId) {
          const { getWalletForChain } = await import('@/lib/wallet/connection/connector');
          provider = await getWalletForChain(providerId, 'ethereum');
        } else {
          // Last resort: use window.ethereum (should not happen if providerId was provided)
          console.warn('Could not get provider from wallet client, using window.ethereum as fallback');
          provider = (window as any).ethereum;
        }
      }
      
      if (!provider || !provider.request) {
        throw new SwapExecutionError(
          `Failed to get wallet provider for chain switching. Please ensure ${providerId || 'your wallet'} is connected.`,
          SwapErrorCode.WALLET_NOT_CONNECTED
        );
      }
      
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
      
      // Wait a bit for chain switch to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get new wallet client after switch (with same provider ID)
      return await getWalletClientForChain(chainId, providerId);
    }
    
    return walletClient;
  } catch (error: any) {
    // Handle chain not added error
    if (error?.code === 4902 || error?.message?.includes('Unrecognized chain')) {
      throw new SwapExecutionError(
        `Chain ${chainId} is not added to your wallet. Please add it manually.`,
        SwapErrorCode.WALLET_NOT_CONNECTED
      );
    }
    
    if (error?.code === 4001 || error?.message?.includes('rejected')) {
      throw new SwapExecutionError(
        'Chain switch was rejected. Please approve the chain switch.',
        SwapErrorCode.WALLET_NOT_CONNECTED
      );
    }
    
    throw new SwapExecutionError(
      `Failed to get wallet client: ${error?.message || 'Unknown error'}`,
      SwapErrorCode.WALLET_NOT_CONNECTED
    );
  }
}

/**
 * Get EVM public client for a chain
 * 
 * Uses cached public client (singleton pattern) for performance.
 */
export function getEVMPublicClient(chainId: number): PublicClient {
  if (!isEVMChain(chainId)) {
    throw new SwapExecutionError(
      `Chain ${chainId} is not an EVM chain`,
      SwapErrorCode.UNSUPPORTED_ROUTER
    );
  }

  try {
    return getCachedPublicClient(chainId);
  } catch (error: any) {
    throw new SwapExecutionError(
      `Failed to get public client for chain ${chainId}: ${error?.message || 'Unknown error'}`,
      SwapErrorCode.NETWORK_ERROR
    );
  }
}

/**
 * Get Solana connection
 */
export async function getSolanaConnection(): Promise<Connection> {
  if (typeof window === 'undefined') {
    throw new SwapExecutionError(
      'Solana connection requires browser environment',
      SwapErrorCode.NETWORK_ERROR
    );
  }

  // Get RPC URL from environment or use default
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Test connection
    await connection.getVersion();
    
    return connection;
  } catch (error) {
    throw new SwapExecutionError(
      `Failed to connect to Solana RPC: ${error instanceof Error ? error.message : 'Unknown error'}`,
      SwapErrorCode.NETWORK_ERROR
    );
  }
}

/**
 * Get Solana wallet adapter
 */
export async function getSolanaWallet(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new SwapExecutionError(
      'Solana wallet requires browser environment',
      SwapErrorCode.WALLET_NOT_CONNECTED
    );
  }

  const win = window as any;

  // Check for Phantom first (most common)
  if (win.phantom?.solana?.isConnected) {
    return win.phantom.solana;
  }

  // Check for Solflare
  if (win.solflare?.isConnected) {
    return win.solflare;
  }

  // Check for generic Solana provider
  if (win.solana?.isConnected) {
    return win.solana;
  }

  throw new SwapExecutionError(
    'No Solana wallet connected. Please connect your Solana wallet (Phantom, Solflare, etc.)',
    SwapErrorCode.WALLET_NOT_CONNECTED
  );
}

/**
 * Ensure wallet is on the correct chain (EVM only)
 * 
 * Checks current chain and switches if needed.
 */
export async function ensureCorrectChain(chainId: number): Promise<void> {
  if (!isEVMChain(chainId)) {
    return; // Not applicable for non-EVM chains
  }

  try {
    // Get current chain from provider
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new SwapExecutionError(
        'No Ethereum wallet found',
        SwapErrorCode.WALLET_NOT_CONNECTED
      );
    }

    const provider = (window as any).ethereum;
    const currentChainId = await provider.request({ method: 'eth_chainId' });
    const currentChainIdNumber = parseInt(currentChainId, 16);

    if (currentChainIdNumber === chainId) {
      return; // Already on correct chain
    }

    // Try to switch chain
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });

      // Wait for chain switch to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (switchError: any) {
      // Handle chain not added error
      if (switchError?.code === 4902) {
        throw new SwapExecutionError(
          `Chain ${chainId} is not added to your wallet. Please add it manually.`,
          SwapErrorCode.WALLET_NOT_CONNECTED
        );
      }
      
      if (switchError?.code === 4001) {
        throw new SwapExecutionError(
          'Chain switch was rejected. Please approve the chain switch.',
          SwapErrorCode.WALLET_NOT_CONNECTED
        );
      }

      throw switchError;
    }
  } catch (error) {
    if (error instanceof SwapExecutionError) {
      throw error;
    }

    throw new SwapExecutionError(
      `Failed to ensure correct chain: ${error instanceof Error ? error.message : 'Unknown error'}`,
      SwapErrorCode.WALLET_NOT_CONNECTED
    );
  }
}

