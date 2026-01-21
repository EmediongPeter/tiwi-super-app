'use client';

import { createConfig, EVM, Solana, config, getChains, ChainType } from '@lifi/sdk';
import { LIFI_SOLANA_CHAIN_ID } from './utils/bridge-mappers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getWalletClient, switchChain, getAccount } from '@wagmi/core';
import { type FC, type PropsWithChildren, useEffect } from 'react';
import { createClient, http } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, bsc } from 'viem/chains';
import type { Config, CreateConnectorFn } from 'wagmi';
import { WagmiProvider, createConfig as createWagmiConfig } from 'wagmi';
import { injected, walletConnect, metaMask } from 'wagmi/connectors';
import { getRpcUrl, RPC_TRANSPORT_OPTIONS } from './lib/rpc-config';
import { WalletProvider } from './contexts/WalletContext';
import { SecondaryWalletProvider } from './hooks/use-secondary-wallet';
import { getSolanaWalletAdapterForLiFi } from './utils/solana-wallet-adapter';
import { getWalletForChain, type WalletAccount } from './utils/wallet-detector';
import { getAddress } from 'viem';
import { createWalletClient, custom } from 'viem';

// Create query client
const queryClient = new QueryClient();

// WalletConnect Project ID
const WALLETCONNECT_PROJECT_ID = '8e998cd112127e42dce5e2bf74122539';

// List of Wagmi connectors
// Order matters: native providers first, then WalletConnect for mobile wallets
// Each wallet uses its own provider directly:
// - metaMask() uses MetaMask SDK/provider directly
// - injected() uses browser extension wallets directly (Coinbase, Brave, etc.)
// - walletConnect() only for mobile wallets via WalletConnect protocol
const connectors: CreateConnectorFn[] = [
  metaMask(), // MetaMask uses its own provider via MetaMask SDK
  injected(), // Other browser extension wallets use their own providers directly
  walletConnect({ 
    projectId: WALLETCONNECT_PROJECT_ID,
    showQrModal: true, // Show QR code modal for mobile wallet connections
  }),
];

// Create Wagmi config with all supported chains
export const wagmiConfig: Config = createWagmiConfig({
  chains: [mainnet, arbitrum, optimism, polygon, base, bsc],
  connectors,
  client({ chain }) {
    // Check if we have a custom RPC URL configured for this chain
    const customRpcUrl = getRpcUrl(chain.id);
    
    if (customRpcUrl) {
      // Use custom Alchemy RPC with timeout and retry settings
      return createClient({ 
        chain, 
        transport: http(customRpcUrl, RPC_TRANSPORT_OPTIONS)
      });
    }
    
    // Fallback to default RPC for chains without custom configuration
    return createClient({ chain, transport: http() });
  },
});

// Helper to get wallet client from custom wallet detector (localStorage)
const getCustomWalletClient = async (chainId?: number): Promise<any | null> => {
  if (typeof window === 'undefined') {
    console.log('[getCustomWalletClient] Window not available');
    return null;
  }
  
  try {
    // Check localStorage for connected wallet
    const stored = localStorage.getItem('lifi_connected_wallet');
    if (!stored) {
      console.log('[getCustomWalletClient] No wallet in localStorage');
      return null;
    }
    
    const connectedWallet: WalletAccount = JSON.parse(stored);
    console.log('[getCustomWalletClient] Found wallet in localStorage:', {
      address: connectedWallet.address,
      provider: connectedWallet.provider,
      chain: connectedWallet.chain,
    });
    
    // Validate address exists and is valid
    if (!connectedWallet.address || typeof connectedWallet.address !== 'string') {
      console.error('[getCustomWalletClient] Invalid or missing address:', connectedWallet.address);
      return null;
    }
    
    // Only handle EVM wallets
    if (connectedWallet.chain !== 'ethereum') {
      console.log('[getCustomWalletClient] Wallet is not EVM, chain:', connectedWallet.chain);
      return null;
    }
    
    // Get the actual provider object from the wallet
    const provider = await getWalletForChain(connectedWallet.provider, 'ethereum');
    if (!provider) {
      console.error('[getCustomWalletClient] Failed to get provider for:', connectedWallet.provider);
      return null;
    }
    
    // Determine target chain
    const chainMap: Record<number, any> = {
      1: mainnet,
      42161: arbitrum,
      10: optimism,
      137: polygon,
      8453: base,
      56: bsc,
    };
    
    const targetChain = chainId ? chainMap[chainId] : chainMap[1] || mainnet;
    if (!targetChain) {
      console.error('[getCustomWalletClient] Chain not supported:', chainId);
      return null;
    }
    
    // Validate and format address
    let validAddress: `0x${string}`;
    try {
      validAddress = getAddress(connectedWallet.address) as `0x${string}`;
    } catch (error) {
      console.error('[getCustomWalletClient] Invalid address format:', connectedWallet.address, error);
      return null;
    }
    
    // Create wallet client from the provider
    const walletClient = createWalletClient({
      chain: targetChain,
      transport: custom(provider),
      account: validAddress,
    });
    
    console.log('[getCustomWalletClient] Successfully created wallet client for chain:', chainId || 1);
    return walletClient;
  } catch (error) {
    console.error('[getCustomWalletClient] Error getting custom wallet client:', error);
    return null;
  }
};

// Create SDK config using Wagmi actions and configuration
createConfig({
  integrator: 'LIFISwapApp',
  providers: [
    EVM({
      getWalletClient: async (chainId?: number) => {
        // First, check if custom wallet is connected (localStorage)
        // This is prioritized because it's more reliable when wagmi isn't connected
        try {
          const customWalletClient = await getCustomWalletClient(chainId);
          if (customWalletClient) {
            console.log('[LI.FI] Using custom wallet detector client');
            return customWalletClient;
          }
        } catch (error) {
          console.log('[LI.FI] Custom wallet detector not available:', error);
        }
        
        // Then try wagmi if available
        try {
          const account = getAccount(wagmiConfig);
          
          if (account?.connector && account?.address) {
            // Wagmi is connected, use it
            const targetChainId = chainId || account.chainId;
            if (targetChainId) {
              try {
                const walletClient = await getWalletClient(wagmiConfig, { chainId: targetChainId });
                if (walletClient) {
                  console.log('[LI.FI] Using wagmi client with chainId:', targetChainId);
                  return walletClient;
                }
              } catch (error) {
                console.log('[LI.FI] Failed to get wagmi client with chainId, trying without...');
              }
            }
            
            // Fallback: get wallet client without specifying chain
            try {
              const walletClient = await getWalletClient(wagmiConfig);
              if (walletClient) {
                console.log('[LI.FI] Using wagmi client (no chainId)');
                return walletClient;
              }
            } catch (error) {
              console.log('[LI.FI] Failed to get wagmi client');
            }
          }
        } catch (error) {
          // Wagmi not connected or error accessing it
          console.log('[LI.FI] Wagmi not available, error:', error);
        }
        
        // Final attempt: try custom wallet detector again (in case chainId was needed)
        if (chainId) {
          try {
            const customWalletClient = await getCustomWalletClient(chainId);
            if (customWalletClient) {
              console.log('[LI.FI] Using custom wallet detector client with chainId:', chainId);
              return customWalletClient;
            }
          } catch (error) {
            console.error('[LI.FI] Error getting custom wallet client with chainId:', error);
          }
        }
        
        // If all else fails, throw a clear error
        throw new Error('No wallet connected. Please connect your wallet first.');
      },
      switchChain: async (chainId) => {
        // First try custom wallet detector
        try {
          const stored = localStorage.getItem('lifi_connected_wallet');
          if (stored) {
            const connectedWallet: WalletAccount = JSON.parse(stored);
            if (connectedWallet.chain === 'ethereum') {
              const provider = await getWalletForChain(connectedWallet.provider, 'ethereum');
              if (provider && provider.request) {
                const chainIdHex = `0x${chainId.toString(16)}`;
                await provider.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: chainIdHex }],
                });
                // Wait a bit for chain switch
                await new Promise(resolve => setTimeout(resolve, 1000));
                const customWalletClient = await getCustomWalletClient(chainId);
                if (customWalletClient) {
                  console.log('[LI.FI] Switched chain using custom wallet detector');
                  return customWalletClient;
                }
              }
            }
          }
        } catch (error) {
          console.log('[LI.FI] Custom wallet detector switchChain failed, trying wagmi...', error);
        }
        
        // Fallback to wagmi
        try {
          const account = getAccount(wagmiConfig);
          if (account?.connector && account?.address) {
            const chain = await switchChain(wagmiConfig, { chainId });
            return getWalletClient(wagmiConfig, { chainId: chain.id });
          }
        } catch (error) {
          console.error('[LI.FI] Wagmi switchChain failed:', error);
        }
        
        // Final attempt: get custom wallet client with the new chainId
        const customWalletClient = await getCustomWalletClient(chainId);
        if (customWalletClient) {
          return customWalletClient;
        }
        
        throw new Error(`Failed to switch to chain ${chainId}`);
      },
    }),
    Solana({
      getWalletAdapter: async () => {
        try {
          return await getSolanaWalletAdapterForLiFi();
        } catch (error) {
          console.error('Error getting Solana wallet adapter:', error);
          throw error;
        }
      },
    }),
  ],
  preloadChains: false,
});

const ChainSync: FC = () => {
  useEffect(() => {
    const syncChains = async () => {
      try {
        // Load EVM chains
        const evmChains = await getChains({
          chainTypes: [ChainType.EVM],
        });
        
        // Try to get all chains (including Solana if available)
        let allChains = [...evmChains];
        try {
          const allChainsDirect = await getChains();
          // Check if Solana chain is already included
          const hasSolana = allChainsDirect.some(chain => chain.id === LIFI_SOLANA_CHAIN_ID);
          if (!hasSolana) {
            // Manually add Solana chain to the config
            // This is needed because executeRoute validates chain IDs against configured chains
            const solanaChain = {
              id: LIFI_SOLANA_CHAIN_ID,
              key: 'sol',
              name: 'Solana',
              chainType: ChainType.SOLANA,
              coin: 'SOL',
              nativeToken: {
                address: '11111111111111111111111111111111',
                symbol: 'SOL',
                decimals: 9,
                name: 'Solana',
              },
              // Add minimal required properties
              rpcUrls: ['https://api.mainnet-beta.solana.com'],
              blockExplorerUrls: ['https://solscan.io'],
              logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/sol.svg',
            };
            allChains.push(solanaChain as any);
            console.log('[ChainSync] Added Solana chain to LI.FI config:', LIFI_SOLANA_CHAIN_ID);
          } else {
            // Solana chain already in the list, use it
            const solanaChain = allChainsDirect.find(chain => chain.id === LIFI_SOLANA_CHAIN_ID);
            if (solanaChain && !allChains.some(c => c.id === LIFI_SOLANA_CHAIN_ID)) {
              allChains.push(solanaChain);
            }
          }
        } catch (error) {
          console.warn('[ChainSync] Could not load all chains, manually adding Solana:', error);
          // Fallback: manually add Solana chain
          const solanaChain = {
            id: LIFI_SOLANA_CHAIN_ID,
            key: 'sol',
            name: 'Solana',
            chainType: ChainType.SOLANA,
            coin: 'SOL',
            nativeToken: {
              address: '11111111111111111111111111111111',
              symbol: 'SOL',
              decimals: 9,
              name: 'Solana',
            },
            rpcUrls: ['https://api.mainnet-beta.solana.com'],
            blockExplorerUrls: ['https://solscan.io'],
            logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/sol.svg',
          };
          allChains.push(solanaChain as any);
          console.log('[ChainSync] Manually added Solana chain to LI.FI config');
        }
        
        // Set all chains including Solana
        config.setChains(allChains);
        console.log('[ChainSync] Configured', allChains.length, 'chains in LI.FI SDK (including Solana)');
      } catch (error) {
        console.error('Error loading chains:', error);
      }
    };
    
    syncChains();
  }, []);

  return null;
};

export const Providers: FC<PropsWithChildren> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
        <WalletProvider>
          <SecondaryWalletProvider>
            <ChainSync />
            {children}
          </SecondaryWalletProvider>
        </WalletProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
};

