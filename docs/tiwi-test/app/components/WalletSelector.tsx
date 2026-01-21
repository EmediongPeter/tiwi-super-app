'use client';

import { useState, useEffect } from 'react';
import { 
  detectWalletProviders, 
  connectWallet, 
  disconnectWallet, 
  getWalletForChain, 
  detectCurrentWallet,
  detectWalletFromProvider,
  type WalletProvider, 
  type WalletChain, 
  type WalletAccount 
} from '../utils/wallet-detector';
import { SUPPORTED_WALLETS, getWalletById } from '../utils/supported-wallets';
import { convertToWalletProvider, isWalletInstalled } from '../utils/wallet-detection-helpers';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { getAccount } from '@wagmi/core';
import { wagmiConfig } from '../providers';
import { SOLANA_CHAIN_ID } from '../utils/jupiter';
import WalletIcon from './WalletIcon';
import { mapWalletIdToProviderId } from '../utils/wallet-id-mapper';

interface WalletSelectorProps {
  onWalletConnected?: (account: WalletAccount) => void;
  onWalletDisconnected?: (provider: string, chain: WalletChain) => void;
  requiredChain?: WalletChain;
}

// Map WalletChain to chain display names
const chainLabels: Record<WalletChain, string> = {
  ethereum: 'Ethereum',
  solana: 'Solana',
};

// Map WalletChain to chain IDs
const chainIdMap: Record<WalletChain, number> = {
  ethereum: 1,
  solana: SOLANA_CHAIN_ID,
};


declare global {
  interface Window {
    ethereum?: any
    solana?: any
    solflare?: any
  }
}

export default function WalletSelector({ onWalletConnected, onWalletDisconnected, requiredChain }: WalletSelectorProps) {
  const [providers, setProviders] = useState<WalletProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<WalletProvider | null>(null);
  const [selectedChain, setSelectedChain] = useState<WalletChain | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');
  const [connectedAccounts, setConnectedAccounts] = useState<Map<string, WalletAccount>>(new Map());
  const [showChainModal, setShowChainModal] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<WalletProvider | null>(null);
  const [detectedWallet, setDetectedWallet] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { connect: wagmiConnect, connectors: wagmiConnectors } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  // Helper function to merge providers and their supported chains
  // wallet-detector already handles deduplication, but we merge chains when same wallet is detected multiple times
  // Also match wallets by name (case-insensitive) to catch duplicates with different IDs (e.g., EIP-6963 UUIDs vs standard IDs)
  const mergeProviders = (existing: WalletProvider[], newProviders: WalletProvider[]): WalletProvider[] => {
    const merged = [...existing];
    newProviders.forEach(newProvider => {
      // First try to match by ID (exact match)
      let existingProvider = merged.find(p => p.id.toLowerCase() === newProvider.id.toLowerCase());
      
      // If no ID match, try to match by name (case-insensitive) to catch duplicates
      // This handles cases where EIP-6963 creates UUID IDs but wallet-detector creates standard IDs
      if (!existingProvider && newProvider.name) {
        existingProvider = merged.find(p => 
          p.name.toLowerCase() === newProvider.name.toLowerCase()
        );
      }
      
      if (existingProvider) {
        // Merge supported chains
        const mergedChains = [...new Set([...existingProvider.supportedChains, ...newProvider.supportedChains])];
        // Keep the better provider (one with standard ID and icon, not UUID)
        const keepExisting = existingProvider.id.length < newProvider.id.length || 
                            !newProvider.id.includes('-') || // Standard IDs don't have hyphens
                            existingProvider.icon !== '🔗'; // Prefer providers with proper icons
        
        if (keepExisting) {
          existingProvider.supportedChains = mergedChains as WalletChain[];
        } else {
          // Replace with new provider (has better ID/icon), update chains
          const index = merged.indexOf(existingProvider);
          merged[index] = {
            ...newProvider,
            supportedChains: mergedChains as WalletChain[],
          };
        }
      } else {
        merged.push(newProvider);
      }
    });
    return merged;
  };

  useEffect(() => {
    // ABSOLUTELY NO AUTO-CONNECTION - start with empty state
    setConnectedAccounts(new Map());
    
    // CRITICAL: Do NOT clear localStorage/sessionStorage on load
    // This breaks wallet extension initialization
    // Wallets need their stored session keys to inject properly
    // Only clear storage on explicit disconnect, not on component mount
    
    // Show all supported wallets, marking which are installed
    const updateAllWallets = () => {
      // Check each wallet individually for better accuracy
      // This ensures we catch wallets that might not be in detectWalletProviders()
      const allProviders: WalletProvider[] = SUPPORTED_WALLETS.map(wallet => {
        // Use isWalletInstalled directly for each wallet for more accurate detection
        const installed = isWalletInstalled(wallet);
        return convertToWalletProvider(wallet, installed);
      });
      
      setProviders(allProviders);
      
      // Log detection results for debugging
      const installedCount = allProviders.filter(p => p.installed).length;
      console.log('[WalletSelector] Wallet detection complete:', {
        total: allProviders.length,
        installed: installedCount,
        installedWallets: allProviders.filter(p => p.installed).map(p => p.name)
      });
    };
    
    // Initial detection
    updateAllWallets();
    
    // Delayed detection - many wallets inject AFTER DOM loads
    const delayedTimer = setTimeout(() => {
      updateAllWallets();
    }, 500);
    
    // Additional detection after longer delay for very slow injectors
    const longDelayedTimer = setTimeout(() => {
      updateAllWallets();
    }, 1000);
    
    // Even longer delay for wallets that inject very slowly
    const veryLongDelayedTimer = setTimeout(() => {
      updateAllWallets();
    }, 2000);
    
    // Listen for wallet injection events (EIP-6963)
    const handleEIP6963AnnounceProvider = (event: Event) => {
      // Wallet announced itself, re-detect
      setTimeout(() => {
        updateAllWallets();
      }, 100);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('eip6963:announceProvider', handleEIP6963AnnounceProvider);
    }
    
    return () => {
      clearTimeout(delayedTimer);
      clearTimeout(longDelayedTimer);
      clearTimeout(veryLongDelayedTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('eip6963:announceProvider', handleEIP6963AnnounceProvider);
      }
    };
  }, []);

  // Manual refresh function to re-detect wallets
  const refreshWalletDetection = () => {
    // Check each wallet individually for better accuracy
    const allProviders: WalletProvider[] = SUPPORTED_WALLETS.map(wallet => {
      const installed = isWalletInstalled(wallet);
      return convertToWalletProvider(wallet, installed);
    });
    
    setProviders(allProviders);
    
    // Log detection results for debugging
    const installedCount = allProviders.filter(p => p.installed).length;
    console.log('[WalletSelector] Wallet detection refreshed:', {
      total: allProviders.length,
      installed: installedCount,
      installedWallets: allProviders.filter(p => p.installed).map(p => p.name)
    });
  };

  // Detect wallet when accounts change (similar to WalletProvider)
  useEffect(() => {
    const win = window as any;
    if (typeof window !== "undefined" && win.ethereum && connectedAccounts.size > 0) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // Account disconnected
          setDetectedWallet(null);
        } else {
          // Account changed - re-detect wallet
          const detected = detectCurrentWallet();
          setDetectedWallet(detected);
        }
      }

      const handleChainChanged = () => {
        // Chain changed - re-detect wallet
        const detected = detectCurrentWallet();
        setDetectedWallet(detected);
      }

      win.ethereum.on("accountsChanged", handleAccountsChanged);
      win.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        win.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        win.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    }
  }, [connectedAccounts.size]);

  // Re-detect wallets when window becomes active (some wallets inject when tab becomes active)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible - re-detect wallets
        setTimeout(() => {
          refreshWalletDetection();
        }, 300);
      }
    };

    const handleFocus = () => {
      // Window gained focus - re-detect wallets
      setTimeout(() => {
        refreshWalletDetection();
      }, 300);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Note: We no longer sync Wagmi connections automatically
  // All wallet connections now go through direct connection to specific providers
  // This prevents Phantom from overriding other wallet connections

  // ABSOLUTELY NO AUTO-CONNECTION FUNCTIONALITY
  // Users MUST explicitly click "Connect" to establish ANY connection
  // We never check for or restore existing connections

  const handleProviderSelect = (provider: WalletProvider) => {
    setConnectionError('');
    
    // Only support ERC20 (ethereum) and SOL (solana) tokens
    // If provider supports multiple chains (ethereum and solana), show chain selection modal
    if (provider.supportedChains.length > 1) {
      setPendingProvider(provider);
      setShowChainModal(true);
      setSelectedChain(null);
    } else {
      // Single chain - auto-select and connect
      setSelectedProvider(provider);
      setSelectedChain(provider.supportedChains[0]);
      handleConnectWithProvider(provider, provider.supportedChains[0]);
    }
  };

  const handleChainSelectInModal = (chain: WalletChain) => {
    if (pendingProvider) {
      setSelectedProvider(pendingProvider);
      setSelectedChain(chain);
      setShowChainModal(false);
      handleConnectWithProvider(pendingProvider, chain);
      setPendingProvider(null);
    }
  };


  const handleChainSelect = (chain: WalletChain) => {
    setSelectedChain(chain);
    setConnectionError('');
  };

  const handleConnectWithProvider = async (provider: WalletProvider, chain: WalletChain) => {
    setIsConnecting(true);
    setConnectionError('');

    try {
      // Always disconnect any existing wallets first (only one wallet at a time)
      // This ensures a fresh connection prompt every time
      const currentConnected = Array.from(connectedAccounts.values());
      for (const existingAccount of currentConnected) {
        try {
          // Map wallet ID to provider ID for disconnection
          const mappedProviderId = mapWalletIdToProviderId(existingAccount.provider);
          await disconnectWallet(mappedProviderId, existingAccount.chain);
          
          // Also disconnect from Wagmi if it was an EVM wallet
          if (existingAccount.chain === 'ethereum') {
            try {
              wagmiDisconnect();
            } catch (wagmiError) {
              // Ignore Wagmi disconnect errors
            }
          }
          
          // Notify parent component of disconnection
          if (onWalletDisconnected) {
            onWalletDisconnected(existingAccount.provider, existingAccount.chain);
          }
        } catch (error) {
          console.warn('Error disconnecting previous wallet:', error);
        }
      }
      
      // Clear only our internal state - DO NOT clear localStorage/sessionStorage
      // Clearing storage breaks wallet initialization and prevents proper detection
      // Only clear storage on explicit disconnect, not before connecting
      setConnectedAccounts(new Map());
      
      // DO NOT revoke permissions or disconnect before connecting
      // This breaks wallet initialization and prevents proper detection
      // Let connectWallet() handle the connection flow naturally
      // It will prompt for approval if needed, or use existing connection if already approved

      // Map wallet ID to provider ID expected by wallet-detector
      const providerId = mapWalletIdToProviderId(provider.id);
      
      // For MetaMask on Ethereum, use Wagmi's MetaMask connector specifically
      // This ensures we use MetaMask's own provider and avoid OKX/Rabby conflicts
      let account;
      let connectedProviderId = provider.id;
      let usedWagmiMetaMaskConnector = false; // Track if we used Wagmi MetaMask connector
      
      if (chain === 'ethereum' && providerId === 'metamask') {
        try {
          // Find Wagmi's MetaMask connector
          const metamaskConnector = wagmiConnectors.find((c: any) => {
            const id = (c.id || '').toLowerCase();
            const name = (c.name || '').toLowerCase();
            const type = (c.type || '').toLowerCase();
            return id.includes('metamask') || 
                   name.includes('metamask') ||
                   type === 'metamask' ||
                   c.id === 'metaMask' ||
                   c.id === 'metaMaskSDK';
          });
          
          if (metamaskConnector) {
            console.log('[WalletSelector] Using Wagmi MetaMask connector for MetaMask connection');
            
            // Connect using Wagmi's MetaMask connector
            await wagmiConnect({ connector: metamaskConnector });
            
            // Get the connected account directly from Wagmi core (synchronous after connection)
            // This is more reliable than waiting for React hooks to update
            const wagmiAccount = getAccount(wagmiConfig);
            let address: string;
            
            if (!wagmiAccount.address) {
              // If address not immediately available, wait a bit and try again
              await new Promise(resolve => setTimeout(resolve, 300));
              const retryAccount = getAccount(wagmiConfig);
              if (!retryAccount.address) {
                throw new Error('Failed to get account address from MetaMask connector. Please try again.');
              }
              address = retryAccount.address;
            } else {
              address = wagmiAccount.address;
            }
            
            account = {
              address: address,
              chain: 'ethereum',
              provider: providerId,
            };
            connectedProviderId = provider.id;
            usedWagmiMetaMaskConnector = true; // Mark that we used Wagmi MetaMask connector
            
            console.log('[WalletSelector] MetaMask connected via Wagmi connector:', account);
          } else {
            // Fallback to custom connection if connector not found
            console.warn('[WalletSelector] Wagmi MetaMask connector not found, using custom connection');
            account = await connectWallet(providerId, chain);
            connectedProviderId = provider.id;
          }
        } catch (wagmiError: any) {
          console.error('[WalletSelector] Wagmi MetaMask connection failed, trying custom connection:', wagmiError);
          // Fallback to custom connection
          try {
            account = await connectWallet(providerId, chain);
            connectedProviderId = provider.id;
          } catch (error: any) {
            throw new Error(
              error.message?.includes('not found') 
                ? `MetaMask is not installed. Please install MetaMask to continue.`
                : error.message || `Failed to connect to MetaMask`
            );
          }
        }
      } else {
        // For other wallets (non-MetaMask or Solana), use the custom connection logic
        try {
          account = await connectWallet(providerId, chain);
          connectedProviderId = provider.id;
        } catch (error: any) {
          // Log the error with both IDs for debugging
          console.error(`[WalletSelector] Failed to connect wallet "${provider.name}" (ID: ${provider.id}, Provider ID: ${providerId}):`, error);
          
          throw new Error(
            error.message?.includes('not found') 
              ? `Wallet "${provider.name}" is not installed. Please install it to continue.`
              : error.message || `Failed to connect to ${provider.name}`
          );
        }
      }
      
      // ALWAYS detect wallet from the actual connected provider (never trust provider.id parameter)
      // This ensures we show the correct wallet even if Rabby intercepts MetaMask requests
      let detectedWalletName: string | null = null;
      
      // For MetaMask connected via Wagmi, we trust it's MetaMask (Wagmi handles it correctly)
      if (usedWagmiMetaMaskConnector) {
        detectedWalletName = connectedProviderId; // Trust Wagmi's MetaMask connector
      } else if (chain === 'ethereum') {
        // For other EVM wallets, detect from the actual provider using wallet-detector
        try {
          // Use the mapped provider ID for detection
          const mappedProviderId = mapWalletIdToProviderId(connectedProviderId);
          const wallet = await getWalletForChain(mappedProviderId, chain);
          detectedWalletName = await detectWalletFromProvider(mappedProviderId, chain, wallet);
          // Map back to wallet ID if needed
          if (detectedWalletName === mappedProviderId && mappedProviderId !== connectedProviderId) {
            detectedWalletName = connectedProviderId;
          }
        } catch (error) {
          // Fallback to connectedProviderId if detection fails
          detectedWalletName = connectedProviderId;
        }
      } else {
        // For other chains (Solana, etc.), use provider ID
        detectedWalletName = connectedProviderId;
      }
      
      setDetectedWallet(detectedWalletName);
      
      // Set only this account (replace any existing)
      const key = `${connectedProviderId}-${chain}`;
      const newAccount = { ...account, provider: connectedProviderId };
      setConnectedAccounts(new Map([[key, newAccount]]));
      
      console.log('[WalletSelector] Wallet connected:', {
        providerId: provider.id,
        connectedProviderId,
        chain,
        account: newAccount,
        key
      });
      
      if (onWalletConnected) {
        onWalletConnected(newAccount);
      }
      
      // Reset selection and close modals
      setSelectedProvider(null);
      setSelectedChain(null);
      setShowChainModal(false);
      setPendingProvider(null);
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      setConnectionError(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedProvider || !selectedChain) {
      setConnectionError('Please select both wallet and chain');
      return;
    }
    await handleConnectWithProvider(selectedProvider, selectedChain);
  };

  const handleDisconnect = async () => {
    try {
      // Disconnect all connected wallets (only one should exist anyway)
      const currentConnected = Array.from(connectedAccounts.values());
      for (const account of currentConnected) {
        try {
          // Map wallet ID to provider ID for disconnection
          const providerId = mapWalletIdToProviderId(account.provider);
          await disconnectWallet(providerId, account.chain);
          
          // Also disconnect from Wagmi if it was an EVM wallet
          if (account.chain === 'ethereum') {
            try {
              wagmiDisconnect();
            } catch (wagmiError) {
              // Ignore Wagmi disconnect errors
            }
          }
          
          // Notify parent component
          if (onWalletDisconnected) {
            onWalletDisconnected(account.provider, account.chain);
          }
        } catch (error) {
          console.error('Error disconnecting wallet:', error);
        }
      }
      
      // Clear all connected accounts and detected wallet
      setConnectedAccounts(new Map());
      setDetectedWallet(null);
      
      // Only clear storage on explicit disconnect - this is safe because user initiated it
      // But be selective - only clear connection-related keys, not wallet initialization keys
      try {
        if (typeof window !== 'undefined') {
          // Only clear connection/session keys, NOT wallet initialization keys
          // This preserves wallet extension state while clearing our app's connection state
          const connectionKeys = [
            'wagmi', 'wagmi.wallet', 'wagmi.store',
            'walletconnect', 'wc-', 'WCM_',
            'eth_accounts', 'eth_requestAccounts'
          ];
          
          // Clear localStorage - only connection keys
          Object.keys(localStorage).forEach(key => {
            const lowerKey = key.toLowerCase();
            if (connectionKeys.some(connKey => lowerKey.includes(connKey.toLowerCase()))) {
              try {
                localStorage.removeItem(key);
              } catch (e) {
                // Ignore errors
              }
            }
          });
          
          // Clear sessionStorage - only connection keys
          Object.keys(sessionStorage).forEach(key => {
            const lowerKey = key.toLowerCase();
            if (connectionKeys.some(connKey => lowerKey.includes(connKey.toLowerCase()))) {
              try {
                sessionStorage.removeItem(key);
              } catch (e) {
                // Ignore errors
              }
            }
          });
        }
      } catch (error) {
        // Ignore storage errors
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  // Helper to check if a provider is currently connected (from our state only)
  // This does NOT check wallet extensions - only our internal state
  // Also matches by name in case provider IDs differ (e.g., Rabby fallback)
  const isProviderConnected = (providerId: string): boolean => {
    return Array.from(connectedAccounts.values()).some(
      account => {
        // Exact ID match
        if (account.provider === providerId) return true;
        
        // Also check if provider name matches (handle cases where IDs differ but it's the same wallet)
        const provider = providers.find(p => p.id === providerId);
        const connectedProvider = providers.find(p => p.id === account.provider);
        if (provider && connectedProvider && provider.name === connectedProvider.name) {
          return true;
        }
        
        return false;
      }
    );
  };

  // Helper to get connected account for a specific provider
  // Also matches by name in case provider IDs differ
  const getConnectedAccountForProvider = (providerId: string): WalletAccount | null => {
    // First try exact ID match
    let account = Array.from(connectedAccounts.values()).find(
      account => account.provider === providerId
    );
    
    if (account) return account;
    
    // Try matching by name
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      account = Array.from(connectedAccounts.values()).find(
        connectedAccount => {
          const connectedProvider = providers.find(p => p.id === connectedAccount.provider);
          return connectedProvider && connectedProvider.name === provider.name;
        }
      );
    }
    
    return account || null;
  };

  // Disconnect a specific provider
  const handleDisconnectProvider = async (providerId: string) => {
    const account = getConnectedAccountForProvider(providerId);
    if (!account) return;

    try {
      // Map wallet ID to provider ID for disconnection
      const mappedProviderId = mapWalletIdToProviderId(account.provider);
      await disconnectWallet(mappedProviderId, account.chain);
      
      // Also disconnect from Wagmi if it was an EVM wallet
      if (account.chain === 'ethereum') {
        try {
          wagmiDisconnect();
        } catch (wagmiError) {
          // Ignore Wagmi disconnect errors
        }
      }
      
      // Remove from connected accounts
      const key = `${account.provider}-${account.chain}`;
      const newConnectedAccounts = new Map(connectedAccounts);
      newConnectedAccounts.delete(key);
      setConnectedAccounts(newConnectedAccounts);
      
      // Clear detected wallet if this was the only connected wallet
      if (newConnectedAccounts.size === 0) {
        setDetectedWallet(null);
      }
      
      // Notify parent component
      if (onWalletDisconnected) {
        onWalletDisconnected(account.provider, account.chain);
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  // Chain icons mapping
  const chainIcons: Record<WalletChain, string> = {
    ethereum: '⟠',
    solana: '◎',
  };

  return (
    <div className="space-y-4">
      {/* Chain Selection Modal (similar to Phantom's UI) */}
      {showChainModal && pendingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowChainModal(false);
                  setPendingProvider(null);
                  setSelectedChain(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Select Chain</h2>
              <button
                onClick={() => {
                  setShowChainModal(false);
                  setPendingProvider(null);
                  setSelectedChain(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Illustration */}
            <div className="flex justify-center py-6">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-200 to-purple-300 dark:from-purple-600 dark:to-purple-700 rounded-full flex items-center justify-center">
                <WalletIcon
                  walletId={pendingProvider.id}
                  emojiFallback={pendingProvider.icon || '👻'}
                  size="lg"
                  width={64}
                  height={64}
                  imageId={pendingProvider.imageId}
                />
              </div>
            </div>

            {/* Description */}
            <div className="px-6 pb-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This wallet supports multiple chains. Select which chain you'd like to connect to
              </p>
            </div>

            {/* Chain Options */}
            <div className="px-4 pb-4 space-y-2 max-h-96 overflow-y-auto">
              {pendingProvider.supportedChains.map((chain) => {
                // NEVER check for existing connections - always require fresh click
                return (
                  <button
                    key={chain}
                    onClick={() => handleChainSelectInModal(chain)}
                    disabled={isConnecting}
                    className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 flex items-center justify-center text-xl">
                        {chainIcons[chain]}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-gray-900 dark:text-white">{chainLabels[chain]}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}


      {/* Show connected wallet banner (summary) */}
      {connectedAccounts.size > 0 && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-green-800 dark:text-green-200">
              Connected Wallet{connectedAccounts.size > 1 ? 's' : ''}
            </h3>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              disabled={isConnecting}
            >
              Disconnect All
            </button>
          </div>
          <div className="space-y-2">
            {Array.from(connectedAccounts.values()).map((account, index) => {
              const provider = providers.find(p => p.id === account.provider);
              return (
                <div key={index} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg">
                  <WalletIcon
                    walletId={account.provider}
                    emojiFallback={provider?.icon || '🔗'}
                    size="md"
                    width={24}
                    height={24}
                    className="text-xl"
                    imageId={provider?.imageId}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900 dark:text-white">
                      {provider?.name || account.provider}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {chainLabels[account.chain]} • {account.address.slice(0, 6)}...{account.address.slice(-4)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 mt-2">
            💡 Click on another wallet below to switch, or use the disconnect button to disconnect
          </p>
        </div>
      )}

      {/* Wallet selection */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <h3 className="font-semibold text-lg mb-1">Select Wallet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {providers.filter(p => p.installed).length} of {providers.length} supported wallets detected
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search wallets by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 pr-10 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                title="Clear search"
              >
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {providers.filter(p => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase())
              ).length} wallet{providers.filter(p => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase())
              ).length !== 1 ? 's' : ''} found
            </p>
          )}
        </div>
        
        {/* Provider selection */}
        <div className="mb-4">
          {providers.length > 0 ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                <label className="block text-sm font-medium">Wallets</label>
                  <button
                    onClick={refreshWalletDetection}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Refresh wallet detection"
                  >
                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {providers.filter(p => p.installed).length} available
                </span>
              </div>
              <div className="space-y-2">
                {[...providers]
                  .filter(provider => {
                    // Filter by search query if provided
                    if (searchQuery) {
                      return provider.name.toLowerCase().includes(searchQuery.toLowerCase());
                    }
                    return true;
                  })
                  .sort((a, b) => {
                    // Installed wallets first, then uninstalled
                    if (a.installed && !b.installed) return -1;
                    if (!a.installed && b.installed) return 1;
                    // If both have same installation status, maintain original order
                    return 0;
                  })
                  .map((provider) => {
                  // Only check our internal state - NEVER check wallet extension state
                  const isThisProviderConnected = isProviderConnected(provider.id);
                  const connectedAccount = getConnectedAccountForProvider(provider.id);
                  
                  // Debug: log connection status for troubleshooting
                  if (connectedAccounts.size > 0 && (isThisProviderConnected || provider.id.includes('meta') || provider.id.includes('rabby'))) {
                    console.log('[WalletSelector] Provider status:', {
                      providerId: provider.id,
                      providerName: provider.name,
                      isConnected: isThisProviderConnected,
                      hasConnectedAccount: !!connectedAccount,
                      connectedAccountProvider: connectedAccount?.provider,
                      allConnected: Array.from(connectedAccounts.values()).map(a => ({ provider: a.provider, chain: a.chain }))
                    });
                  }
                  
                  return (
                    <div
                      key={provider.id}
                      className={`w-full p-4 rounded-xl border-2 transition-all ${
                        isThisProviderConnected
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-gray-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="shrink-0">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            isThisProviderConnected 
                              ? 'bg-green-100 dark:bg-green-900/40' 
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}>
                            <WalletIcon
                              walletId={provider.id}
                              emojiFallback={provider.icon || '🔗'}
                              size="md"
                              width={48}
                              height={48}
                              imageId={provider.imageId}
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-semibold text-base text-gray-900 dark:text-white">
                              {provider.name}
                            </div>
                            {isThisProviderConnected && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-green-500 text-white rounded-full flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                Connected
                              </span>
                            )}
                            {!provider.installed && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-gray-400 text-white rounded-full">
                                Not Installed
                              </span>
                            )}
                            {provider.installed && !isThisProviderConnected && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
                                Available
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Supports {provider.supportedChains.map(c => chainLabels[c]).join(', ')}
                          </div>
                          {isThisProviderConnected && connectedAccount && (
                            <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="px-2 py-0.5 bg-white dark:bg-gray-800 rounded font-medium text-gray-700 dark:text-gray-300">
                                  {chainLabels[connectedAccount.chain]}
                                </span>
                                <span className="font-mono text-gray-600 dark:text-gray-400">
                                  {connectedAccount.address.slice(0, 6)}...{connectedAccount.address.slice(-4)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {!isThisProviderConnected && provider.installed && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleProviderSelect(provider);
                              }}
                              disabled={isConnecting}
                              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                              title={`Connect ${provider.name}`}
                            >
                              Connect
                            </button>
                          )}
                          {!provider.installed && (
                            <a
                              href={getWalletById(provider.id)?.installUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                              title={`Install ${provider.name}`}
                            >
                              Install
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })}
              </div>
              {searchQuery && providers.filter(p => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    No wallets found
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No wallets match "{searchQuery}". Try a different search term.
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-3 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Clear Search
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">👛</div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                No wallets detected
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Please install a wallet extension to continue
              </p>
            </div>
          )}
        </div>

        {/* Chain selection (only show if provider has multiple chains and modal is not shown) */}
        {selectedProvider && selectedProvider.supportedChains.length > 1 && !showChainModal && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Chain</label>
            <div className="grid grid-cols-2 gap-2">
              {selectedProvider.supportedChains.map((chain) => (
                <button
                  key={chain}
                  onClick={() => handleChainSelect(chain)}
                  className={`p-2 rounded-lg border-2 transition-colors ${
                    selectedChain === chain
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="text-sm font-medium">{chainLabels[chain]}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Connect button (only show if chain was manually selected, not via modal) */}
        {selectedProvider && selectedChain && !showChainModal && (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isConnecting ? 'Connecting...' : `Connect ${selectedProvider.name} - ${chainLabels[selectedChain]}`}
          </button>
        )}

        {/* Error message */}
        {connectionError && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
            {connectionError}
          </div>
        )}
      </div>
    </div>
  );
}

