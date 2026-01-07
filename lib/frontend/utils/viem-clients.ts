/**
 * Viem Client Utilities
 * 
 * Industry-standard client caching for public and wallet clients.
 * Uses singleton pattern to cache clients per chain, avoiding repeated creation.
 * 
 * Based on industry best practices (similar to Uniswap, 1inch, etc.)
 */

import { createPublicClient, createWalletClient, http, custom, type PublicClient, type WalletClient, type Chain } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, bsc } from 'viem/chains';
import { getRpcUrl, RPC_TRANSPORT_OPTIONS } from '@/lib/backend/utils/rpc-config';

// ============================================================================
// CHAIN CONFIGURATION
// ============================================================================

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  8453: base,
  56: bsc,
};

/**
 * Get chain configuration for a chain ID
 */
function getChainConfig(chainId: number): Chain | null {
  return CHAIN_MAP[chainId] || null;
}

// ============================================================================
// PUBLIC CLIENT CACHING (Singleton Pattern)
// ============================================================================

const publicClientCache = new Map<number, PublicClient>();

/**
 * Get cached public client instance for a chain (singleton pattern)
 * 
 * Industry standard: Cache clients to avoid repeated creation and connection overhead.
 * Each chain gets one public client instance that's reused across the app.
 * 
 * Uses custom RPC URLs from rpc-config.ts (Alchemy) for reliable connections.
 * Falls back to default chain RPC if custom RPC not configured.
 * 
 * @param chainId - Chain ID
 * @returns Cached PublicClient instance
 */
export function getCachedPublicClient(chainId: number): PublicClient {
  if (!publicClientCache.has(chainId)) {
    const chain = getChainConfig(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not supported`);
    }
    
    // Get custom RPC URL if available (from rpc-config.ts)
    // This ensures we use reliable Alchemy RPCs instead of default thirdweb RPCs
    const customRpcUrl = getRpcUrl(chainId);
    
    // Use custom RPC with proper transport options, or fallback to default with same options
    publicClientCache.set(chainId, createPublicClient({
      chain,
      transport: customRpcUrl 
        ? http(customRpcUrl, RPC_TRANSPORT_OPTIONS) // ✅ Custom RPC (Alchemy) with proper settings
        : http(undefined, RPC_TRANSPORT_OPTIONS),    // Fallback to default RPC with proper settings
    }));
  }
  
  return publicClientCache.get(chainId)!;
}

// ============================================================================
// WALLET CLIENT CREATION (Not cached - depends on provider)
// ============================================================================

/**
 * Create wallet client for a chain
 * 
 * Note: Wallet clients are NOT cached because they depend on the connected wallet provider.
 * Each call creates a new client bound to the current wallet state.
 * 
 * @param chainId - Chain ID
 * @param account - Optional account address (if not provided, will use connected account)
 * @returns WalletClient instance
 */
export function createWalletClientForChain(chainId: number, account?: `0x${string}`): WalletClient {
  const chain = getChainConfig(chainId);
  if (!chain) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  // Get provider from window (MetaMask, WalletConnect, etc.)
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('No Ethereum wallet found. Please install MetaMask or another wallet.');
  }

  const provider = (window as any).ethereum;

  return createWalletClient({
    chain,
    transport: custom(provider),
    account: account as `0x${string}` | undefined,
  });
}

/**
 * Get wallet client for a chain (with account from connected wallet)
 * 
 * This function gets the account from the connected wallet and creates a wallet client.
 * Uses the specific provider for the connected wallet to ensure proper isolation.
 * 
 * @param chainId - Chain ID
 * @param providerId - Optional provider ID (e.g., 'metamask', 'rabby'). If not provided, uses window.ethereum directly (fallback)
 * @returns WalletClient instance with connected account
 */
export async function getWalletClientForChain(chainId: number, providerId?: string): Promise<WalletClient> {
  const chain = getChainConfig(chainId);
  if (!chain) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  let provider: any;
  let account: `0x${string}`;

  // If providerId is provided, use getWalletForChain to get the specific provider
  // This ensures we use the exact wallet that was connected (Rabby, MetaMask, etc.)
  // CRITICAL: Never fall back to window.ethereum when providerId is provided, as it can be intercepted by other wallets
  if (providerId) {
    // Import getWalletForChain dynamically to avoid circular dependencies
    const { getWalletForChain } = await import('@/lib/wallet/connection/connector');
    
    // Get the specific provider for this wallet
    // This uses the Rabby-first detection logic to ensure correct provider selection
    provider = await getWalletForChain(providerId, 'ethereum');
    
    if (!provider) {
      throw new Error(`Wallet provider "${providerId}" not found. Please ensure the wallet is installed and connected.`);
    }

    // Request account access from the specific provider
    // This ensures we're using the correct wallet, not window.ethereum which can be intercepted
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error(`No accounts found in ${providerId}. Please connect your wallet.`);
    }

    account = accounts[0] as `0x${string}`;
  } else {
    // Fallback: Use window.ethereum directly (for backwards compatibility)
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error('No Ethereum wallet found. Please install MetaMask or another wallet.');
    }

    provider = (window as any).ethereum;

    // Request account access
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please connect your wallet.');
    }

    account = accounts[0] as `0x${string}`;
  }

  return createWalletClient({
    chain,
    transport: custom(provider),
    account,
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clear public client cache (useful for testing or reconnection scenarios)
 */
export function clearPublicClientCache(): void {
  publicClientCache.clear();
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return getChainConfig(chainId) !== null;
}

