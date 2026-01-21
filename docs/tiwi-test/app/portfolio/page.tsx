'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getWalletTokens, getSolanaTokenBalances, type WalletToken } from '../utils/moralis';
import { ChainId } from '@lifi/sdk';
import { SOLANA_CHAIN_ID } from '../utils/jupiter';
import Link from 'next/link';
import { useWallet } from '../contexts/WalletContext';

// Chain name mapping (using numeric chain IDs)
const chainNames: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BSC',
  137: 'Polygon',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  8453: 'Base',
  250: 'Fantom',
  100: 'Gnosis',
  1101: 'Polygon zkEVM',
  324: 'zkSync Era',
  5000: 'Mantle',
  59144: 'Linea',
  534352: 'Scroll',
  [SOLANA_CHAIN_ID]: 'Solana',
};

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { connectedWallet } = useWallet();
  const [tokens, setTokens] = useState<WalletToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [connectedWallets, setConnectedWallets] = useState<Map<string, { address: string; chain: string }>>(new Map());

  // Supported chains (EVM)
  const supportedChains = [
    ChainId.ETH,
    ChainId.ARB,
    ChainId.BAS,
    ChainId.OPT,
    ChainId.POL,
    ChainId.BSC,
    ChainId.AVA,
  ];

  // Check connected wallets from WalletContext and wallet extensions
  useEffect(() => {
    const loadConnectedWallets = async () => {
      try {
        const wallets = new Map<string, { address: string; chain: string }>();
        
        // Check Solana wallets first (prioritize WalletContext, then window.solana)
        if (typeof window !== 'undefined') {
          try {
            let solanaAddress: string | null = null;
            
            // Check WalletContext first
            if (connectedWallet && connectedWallet.chain === 'solana') {
              solanaAddress = connectedWallet.address;
              if (solanaAddress) {
                wallets.set('solana', { address: solanaAddress, chain: 'solana' });
              }
            }
            
            // Also check window.solana for current connection status
            const solana = (window as any).solana;
            if (solana) {
              if (solana.publicKey) {
                const windowAddress = solana.publicKey.toString();
                // Use window address if it's different or if we don't have context wallet
                if (!solanaAddress || solanaAddress !== windowAddress) {
                  solanaAddress = windowAddress;
                  if (solanaAddress) {
                    if (solanaAddress) {
                wallets.set('solana', { address: solanaAddress, chain: 'solana' });
              }
                  }
                }
              } else if (solana.isConnected && !solanaAddress) {
                // If wallet is connected, get the publicKey directly without prompting
                // This is read-only and won't trigger a connection prompt
                if (solana.publicKey) {
                  solanaAddress = solana.publicKey.toString();
                  if (solanaAddress) {
                    wallets.set('solana', { address: solanaAddress, chain: 'solana' });
                  }
                }
              }
            }
            
            // Fallback: check Phantom specifically via window.phantom.solana
            if (!solanaAddress && (window as any).phantom?.solana) {
              const phantomSolana = (window as any).phantom.solana;
              if (phantomSolana.publicKey) {
                solanaAddress = phantomSolana.publicKey.toString();
                if (solanaAddress) {
                  if (solanaAddress) {
                wallets.set('solana', { address: solanaAddress, chain: 'solana' });
              }
                }
              }
            }
            
            // Fallback: check Solflare
            if (!solanaAddress && (window as any).solflare?.publicKey) {
              solanaAddress = (window as any).solflare.publicKey.toString();
              if (solanaAddress) {
                wallets.set('solana', { address: solanaAddress, chain: 'solana' });
              }
            }
          } catch (err) {
            console.error('Error checking Solana wallets:', err);
          }
        }
        
        // Check EVM wallets
        if (connectedWallet && (connectedWallet.chain === 'ethereum' || connectedWallet.chain === 'polygon' || connectedWallet.chain === 'avalanche')) {
          wallets.set('evm', { address: connectedWallet.address, chain: 'ethereum' });
        }
        
        // Also check Wagmi for EVM wallets (fallback)
        if (address && isConnected) {
          wallets.set('evm', { address, chain: 'ethereum' });
        }
        
        console.log('[Portfolio] Connected wallets:', Array.from(wallets.entries()));
        setConnectedWallets(wallets);
      } catch (err) {
        console.error('Error loading connected wallets:', err);
      }
    };
    
    loadConnectedWallets();
  }, [address, isConnected, connectedWallet]);

  useEffect(() => {
    if (connectedWallets.size > 0) {
      fetchAllTokens();
    } else {
      setTokens([]);
    }
  }, [connectedWallets, address, isConnected]);

  const fetchAllTokens = async () => {
    setIsLoading(true);
    setError('');

    try {
      const allTokens: WalletToken[] = [];

      // Fetch EVM tokens for all EVM wallets
      for (const [key, wallet] of connectedWallets.entries()) {
        if (wallet.chain === 'ethereum' || wallet.chain === 'evm') {
          try {
            const walletTokens = await getWalletTokens(wallet.address, supportedChains);
            allTokens.push(...walletTokens);
          } catch (err) {
            console.error(`Error fetching EVM tokens for ${wallet.address}:`, err);
          }
        }
      }

      // Fetch Solana tokens for all Solana wallets
      for (const [key, wallet] of connectedWallets.entries()) {
        if (wallet.chain === 'solana') {
          try {
            console.log(`[Portfolio] Fetching Solana tokens for wallet: ${wallet.address}`);
            
            // Use Moralis API for Solana token balances (no RPC issues!)
            const solanaTokens = await getSolanaTokenBalances(wallet.address);
            console.log(`[Portfolio] Found ${solanaTokens.length} Solana tokens:`, solanaTokens);
            
            // Moralis already returns WalletToken[], no conversion needed
            const convertedTokens: WalletToken[] = solanaTokens;
            allTokens.push(...convertedTokens);
          } catch (err) {
            console.error(`Error fetching Solana tokens for ${wallet.address}:`, err);
            setError(err instanceof Error ? `Error fetching Solana tokens: ${err.message}` : 'Failed to fetch Solana tokens');
          }
        }
      }

      // Sort by chain, then by balance (descending)
      allTokens.sort((a, b) => {
        if (a.chainId !== b.chainId) {
          return a.chainId - b.chainId;
        }
        const balanceA = parseFloat(a.balanceFormatted) || 0;
        const balanceB = parseFloat(b.balanceFormatted) || 0;
        return balanceB - balanceA;
      });
      
      setTokens(allTokens);
    } catch (err) {
      console.error('Error fetching wallet tokens:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tokens');
    } finally {
      setIsLoading(false);
    }
  };

  // Group tokens by chain
  const tokensByChain = tokens.reduce((acc, token) => {
    if (!acc[token.chainId]) {
      acc[token.chainId] = [];
    }
    acc[token.chainId].push(token);
    return acc;
  }, {} as Record<number, WalletToken[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <main className="container mx-auto px-4 py-8">
        <div className="w-full max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Portfolio
              </h1>
              {connectedWallet && (
                <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                  {connectedWallet.address.slice(0, 6)}...{connectedWallet.address.slice(-4)}
                </p>
              )}
              {!connectedWallet && isConnected && address && (
                <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              )}
            </div>
            <Link
              href="/"
              prefetch={false}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Swap
            </Link>
          </div>

          {/* Not Connected Message */}
          {connectedWallets.size === 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
              <p className="text-yellow-800 dark:text-yellow-200">
                Please connect your wallet to view your portfolio.
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && connectedWallets.size > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">Loading tokens...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Tokens List */}
          {!isLoading && connectedWallets.size > 0 && tokens.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                No tokens found in your connected wallets.
              </p>
            </div>
          )}

          {!isLoading && connectedWallets.size > 0 && tokens.length > 0 && (
            <div className="space-y-6">
              {Object.entries(tokensByChain).map(([chainId, chainTokens]) => (
                <div
                  key={chainId}
                  className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                >
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {chainNames[Number(chainId)] || `Chain ${chainId}`}
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {chainTokens.map((token, index) => (
                      <div
                        key={`${token.chainId}-${token.address}-${index}`}
                        className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                              {token.logoURI ? (
                                <img
                                  src={token.logoURI}
                                  alt={token.symbol}
                                  className="w-10 h-10 rounded-full"
                                  onError={(e) => {
                                    // Fallback to initial if image fails to load
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                      parent.textContent = token.symbol.charAt(0);
                                    }
                                  }}
                                />
                              ) : (
                                token.symbol.charAt(0)
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {token.symbol}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                  {token.address.slice(0, 6)}...{token.address.slice(-4)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {token.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {parseFloat(token.balanceFormatted).toLocaleString(undefined, {
                                maximumFractionDigits: 6,
                              })}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {token.symbol}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

