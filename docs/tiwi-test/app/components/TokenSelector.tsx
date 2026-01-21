'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { getTokens, getToken, type Token } from '@lifi/sdk';
import { ChainId, GetWalletBalanceParams } from '@lifi/sdk';
import { getAllTokensOnChain, getTokenPairs, searchTokens, type DexScreenerPair } from '../utils/dexscreener';
import { getWalletTokensForChain, getSolanaTokenBalances, type WalletToken } from '../utils/moralis';
import { getJupiterTokens, searchJupiterToken, SOLANA_CHAIN_ID, type JupiterToken } from '../utils/jupiter';
import { useWallet } from '../contexts/WalletContext';

interface TokenSelectorProps {
  selectedToken: Token | null;
  onTokenSelect: (token: Token) => void;
  chainId: number;
  label: string;
  walletAddress?: string; // Optional: if provided, use this wallet address instead of connectedWallet
  walletChain?: 'ethereum' | 'solana'; // Optional: wallet chain type
}

interface TokenWithBalance extends Token {
  balance?: string;
  balanceFormatted?: string;
}

export default function TokenSelector({
  selectedToken,
  onTokenSelect,
  chainId,
  label,
  walletAddress,
  walletChain,
}: TokenSelectorProps) {
  const { address, isConnected } = useAccount();
  const { connectedWallet } = useWallet();
  
  // Use provided walletAddress if available, otherwise fall back to connectedWallet or wagmi address
  const effectiveWalletAddress = walletAddress || (connectedWallet && !walletAddress ? connectedWallet.address : null) || address;
  const effectiveWalletChain = walletChain || (connectedWallet && !walletChain ? connectedWallet.chain : null);
  const [tokens, setTokens] = useState<TokenWithBalance[]>([]);
  const [walletTokens, setWalletTokens] = useState<TokenWithBalance[]>([]);
  const [isLoadingWalletTokens, setIsLoadingWalletTokens] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCustomToken, setShowCustomToken] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [isLoadingCustomToken, setIsLoadingCustomToken] = useState(false);
  const [customTokenError, setCustomTokenError] = useState<string>('');

  // Load wallet tokens when wallet is connected
  useEffect(() => {
    const loadWalletTokens = async () => {
      // Check if this is Solana chain
      if (chainId === SOLANA_CHAIN_ID) {
        // For Solana, check if we have a Solana wallet address
        if (!effectiveWalletAddress || effectiveWalletChain !== 'solana') {
          setWalletTokens([]);
          return;
        }
        
        setIsLoadingWalletTokens(true);
        try {
          // Use Moralis for Solana tokens (more reliable than direct RPC)
          const walletTokenData = await getSolanaTokenBalances(effectiveWalletAddress);
          
          // Convert WalletToken to TokenWithBalance
          const walletTokensList: TokenWithBalance[] = walletTokenData.map(wt => ({
            chainId: wt.chainId,
            address: wt.address,
            symbol: wt.symbol,
            name: wt.name,
            decimals: wt.decimals,
            logoURI: wt.logoURI || '',
            priceUSD: '0',
            balance: wt.balance,
            balanceFormatted: wt.balanceFormatted,
          }));
          
          setWalletTokens(walletTokensList);
        } catch (error) {
          console.error('Error loading Solana wallet tokens:', error);
          setWalletTokens([]);
        } finally {
          setIsLoadingWalletTokens(false);
        }
      } else {
        // For EVM chains, use effectiveWalletAddress if it's an EVM wallet
        if (!effectiveWalletAddress || effectiveWalletChain !== 'ethereum') {
          setWalletTokens([]);
          return;
        }
        
        setIsLoadingWalletTokens(true);
        try {
          // Use Moralis for EVM chains
          const walletTokenData = await getWalletTokensForChain(effectiveWalletAddress, chainId);
          
          // Convert WalletToken to TokenWithBalance
          const walletTokensList: TokenWithBalance[] = walletTokenData.map(wt => ({
            chainId: wt.chainId,
            address: wt.address,
            symbol: wt.symbol,
            name: wt.name,
            decimals: wt.decimals,
            logoURI: wt.logoURI || '',
            priceUSD: '0',
            balance: wt.balance,
            balanceFormatted: wt.balanceFormatted,
          }));
          
          setWalletTokens(walletTokensList);
        } catch (error) {
          console.error('Error loading EVM wallet tokens:', error);
          setWalletTokens([]);
        } finally {
          setIsLoadingWalletTokens(false);
        }
      }
    };
    loadWalletTokens();
  }, [effectiveWalletAddress, chainId, effectiveWalletChain, isConnected, connectedWallet]);

  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    const loadTokens = async () => {
      setIsLoading(true);
      try {
        // Check if this is Solana
        if (chainId === SOLANA_CHAIN_ID) {
          // Load tokens from Jupiter API (primary source)
          const jupiterTokens = await getJupiterTokens(5000);
          
          // Convert Jupiter tokens to LI.FI Token format
          const tokenMap = new Map<string, TokenWithBalance>();
          jupiterTokens.forEach(jt => {
            const lifiToken: TokenWithBalance = {
              chainId: jt.chainId,
              address: jt.address,
              symbol: jt.symbol,
              name: jt.name,
              decimals: jt.decimals,
              logoURI: jt.logoURI || '',
              priceUSD: jt.priceUSD || '0',
            };
            tokenMap.set(jt.address.toLowerCase(), lifiToken);
          });
          
          setTokens(Array.from(tokenMap.values()));
          return;
        }
        
        // For EVM chains, use DexScreener first, then LI.FI
        const tokenMap = new Map<string, TokenWithBalance>();
        
        // Try DexScreener first (primary source for EVM chains)
        try {
          const dexTokens = await getAllTokensOnChain(chainId, 1000);
          // Add DexScreener tokens (primary source for EVM chains)
          dexTokens.forEach(token => {
            // Convert to LI.FI Token format
            const lifiToken: TokenWithBalance = {
              chainId: token.chainId,
              address: token.address,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              logoURI: token.logoURI || '',
              priceUSD: token.priceUSD || '0',
            };
            tokenMap.set(token.address.toLowerCase(), lifiToken);
          });
          console.log(`[TokenSelector] Loaded ${dexTokens.length} tokens from DexScreener for EVM chain ${chainId}`);
        } catch (dexError) {
          // DexScreener doesn't support this chain (e.g., Sui, etc.)
          console.log(`[TokenSelector] DexScreener doesn't support chain ${chainId}, trying LI.FI...`);
        }
        
        // Add LI.FI tokens that aren't already present (secondary source for EVM chains)
        try {
          const tokensResponse = await getTokens({ chains: [chainId] });
          const chainTokens = tokensResponse.tokens[chainId] || [];
          let lifiTokensAdded = 0;
          chainTokens.forEach(token => {
            if (!tokenMap.has(token.address.toLowerCase())) {
              tokenMap.set(token.address.toLowerCase(), token as TokenWithBalance);
              lifiTokensAdded++;
            }
          });
          if (lifiTokensAdded > 0) {
            console.log(`[TokenSelector] Added ${lifiTokensAdded} tokens from LI.FI for EVM chain ${chainId}`);
          }
        } catch (lifiError) {
          // LI.FI might not support this chain either
          console.log(`[TokenSelector] LI.FI doesn't support chain ${chainId}`);
        }
        
        
        if (tokenMap.size === 0) {
          console.warn(`[TokenSelector] No tokens found for EVM chain ${chainId} from DexScreener or LI.FI`);
        }
        
        setTokens(Array.from(tokenMap.values()));
      } catch (error) {
        console.error('Error loading tokens:', error);
        setTokens([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadTokens();
  }, [chainId]);

  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Token[]>([]);

  // Check if search term looks like a contract address
  const isContractAddress = chainId === SOLANA_CHAIN_ID
    ? (searchTerm.length >= 32 && searchTerm.length <= 44) // Solana addresses
    : (searchTerm.startsWith('0x') && searchTerm.length >= 42); // EVM addresses

  // Filter local tokens
  const filteredLocalTokens = tokens.filter((token) =>
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Search tokens when user types
  useEffect(() => {
    // If it's a contract address, don't search - let custom token handler deal with it
    if (isContractAddress) {
      setSearchResults([]);
      return;
    }
    
    if (searchTerm && searchTerm.length >= 2) {
      const debounceTimer = setTimeout(async () => {
        setIsSearching(true);
        try {
          if (chainId === SOLANA_CHAIN_ID) {
            // Search Jupiter tokens using the search function
            const { searchJupiterTokens } = await import('../utils/jupiter');
            const results = await searchJupiterTokens(searchTerm, 100);
            
            // Convert to LI.FI Token format
            const lifiTokens: Token[] = results.map(token => ({
              chainId: token.chainId,
              address: token.address,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              logoURI: token.logoURI || '',
              priceUSD: token.priceUSD || '0',
            }));
            setSearchResults(lifiTokens);
          } else {
            // For EVM chains, search DexScreener first, then LI.FI
              try {
                // Try DexScreener first (primary source for EVM)
                const dexResults = await searchTokens(chainId, searchTerm);
                const lifiTokens: Token[] = dexResults.map(token => ({
                  chainId: token.chainId,
                  address: token.address,
                  symbol: token.symbol,
                  name: token.name,
                  decimals: token.decimals,
                  logoURI: token.logoURI || '',
                  priceUSD: token.priceUSD || '0',
                }));
                setSearchResults(lifiTokens);
                
                // Also try LI.FI as fallback if DexScreener returns few results
                if (lifiTokens.length < 10) {
                  try {
                    const tokensResponse = await getTokens({ chains: [chainId] });
                    const chainTokens = tokensResponse.tokens[chainId] || [];
                    const filtered = chainTokens.filter(token =>
                      token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      token.address.toLowerCase().includes(searchTerm.toLowerCase())
                    );
                    
                    // Merge with existing results, avoiding duplicates
                    const existingAddrs = new Set(lifiTokens.map(t => t.address.toLowerCase()));
                    filtered.forEach(token => {
                      if (!existingAddrs.has(token.address.toLowerCase())) {
                        lifiTokens.push(token);
                      }
                    });
                    setSearchResults(lifiTokens);
                  } catch (lifiError) {
                    // LI.FI search failed, keep DexScreener results
                    console.log('LI.FI search failed, using DexScreener results only');
                  }
                }
              } catch (dexError) {
                // DexScreener failed, try LI.FI as fallback
                console.log('DexScreener search failed, trying LI.FI...');
                try {
                  const tokensResponse = await getTokens({ chains: [chainId] });
                  const chainTokens = tokensResponse.tokens[chainId] || [];
                  const filtered = chainTokens.filter(token =>
                    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    token.address.toLowerCase().includes(searchTerm.toLowerCase())
                  );
                  
                  const lifiTokens: Token[] = filtered.map(token => ({
                    chainId: token.chainId,
                    address: token.address,
                    symbol: token.symbol,
                    name: token.name,
                    decimals: token.decimals,
                    logoURI: token.logoURI || '',
                    priceUSD: token.priceUSD || '0',
                  }));
                  setSearchResults(lifiTokens);
                } catch (lifiError) {
                  console.error('Error searching tokens:', lifiError);
                  setSearchResults([]);
                }
              }
            }
        } catch (error) {
          console.error('Error searching tokens:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
      
      return () => clearTimeout(debounceTimer);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, chainId, isContractAddress]);

  // Check if wallet is connected for the current chain
  const isWalletConnected = useMemo(() => {
    if (chainId === SOLANA_CHAIN_ID) {
      return effectiveWalletAddress && effectiveWalletChain === 'solana';
    } else {
      return effectiveWalletAddress && effectiveWalletChain === 'ethereum';
    }
  }, [chainId, effectiveWalletAddress, effectiveWalletChain]);

  // Filter wallet tokens by search term
  const filteredWalletTokens = useMemo(() => {
    if (!searchTerm) return walletTokens;
    return walletTokens.filter((token) =>
      token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [walletTokens, searchTerm]);

  // Combine local and search results, removing duplicates and wallet tokens
  const allFilteredTokens = useMemo(() => {
    const tokenMap = new Map<string, TokenWithBalance>();
    const walletTokenAddresses = new Set(walletTokens.map(t => t.address.toLowerCase()));
    
    // Add filtered local tokens (excluding wallet tokens)
    filteredLocalTokens.forEach(token => {
      if (!walletTokenAddresses.has(token.address.toLowerCase())) {
        tokenMap.set(token.address.toLowerCase(), token as TokenWithBalance);
      }
    });
    
    // Add search results that aren't already in local tokens or wallet tokens
    searchResults.forEach(token => {
      const addr = token.address.toLowerCase();
      if (!tokenMap.has(addr) && !walletTokenAddresses.has(addr)) {
        tokenMap.set(addr, token as TokenWithBalance);
      }
    });
    
    return Array.from(tokenMap.values());
  }, [filteredLocalTokens, searchResults, walletTokens]);

  const handleLoadCustomToken = async () => {
    // Validate address format based on chain
    let isValidAddress = false;
    
    if (chainId === SOLANA_CHAIN_ID) {
      // Solana addresses are base58 encoded, typically 32-44 characters
      isValidAddress = customTokenAddress.length >= 32 && customTokenAddress.length <= 44;
    } else {
      // EVM addresses are 0x followed by 40 hex characters
      isValidAddress = customTokenAddress.startsWith('0x') && customTokenAddress.length === 42;
    }
    
    if (!customTokenAddress || !isValidAddress) {
      if (chainId === SOLANA_CHAIN_ID) {
        setCustomTokenError('Please enter a valid Solana mint address (32-44 characters)');
      } else {
        setCustomTokenError('Please enter a valid contract address (0x... with 42 characters)');
      }
      return;
    }

    setIsLoadingCustomToken(true);
    setCustomTokenError('');

    try {
      let token: Token;
      
      if (chainId === SOLANA_CHAIN_ID) {
        // Search Jupiter tokens for Solana - use getJupiterTokenByAddress to check if token is supported
        const { getJupiterTokenByAddress } = await import('../utils/jupiter');
        const found = await getJupiterTokenByAddress(customTokenAddress);
        if (!found) {
          throw new Error('Token not found or not supported by Jupiter. Make sure the token has liquidity on a Jupiter-integrated DEX.');
        }
        token = {
          chainId: found.chainId,
          address: found.address,
          symbol: found.symbol,
          name: found.name,
          decimals: found.decimals,
          logoURI: found.logoURI || '',
          priceUSD: found.priceUSD || '0',
        };
      } else {
        // EVM chains: First try DexScreener (primary), then LI.FI (fallback)
        try {
          // Try DexScreener first
          const pairs = await getTokenPairs(customTokenAddress, chainId);
          
          if (pairs.length > 0) {
            const pair = pairs[0];
            const tokenInfo = pair.baseToken.address.toLowerCase() === customTokenAddress.toLowerCase() 
              ? pair.baseToken 
              : pair.quoteToken;
            
            token = {
              chainId: chainId,
              address: customTokenAddress,
              symbol: tokenInfo.symbol,
              name: tokenInfo.name,
              decimals: 18, // Default, might need to fetch from contract
              logoURI: '',
              priceUSD: pair.priceUsd || '0',
            };
          } else {
            // Fallback to LI.FI
            token = await getToken(chainId, customTokenAddress);
          }
        } catch (dexError) {
          // If DexScreener fails, try LI.FI
          console.warn('Token not found in DexScreener, trying LI.FI:', dexError);
          try {
            token = await getToken(chainId, customTokenAddress);
          } catch (lifiError) {
            throw new Error('Token not found in DexScreener or LI.FI. Please check the address and chain.');
          }
        }
      }
      
      onTokenSelect(token);
      setIsOpen(false);
      setSearchTerm('');
      setCustomTokenAddress('');
      setShowCustomToken(false);
      
      // Add to tokens list if not already present
      if (!tokens.find(t => t.address.toLowerCase() === token.address.toLowerCase())) {
        setTokens([...tokens, token]);
      }
    } catch (error) {
      console.error('Error loading custom token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Token not found. Please check the address and chain. The token may not have sufficient liquidity for swapping.';
      setCustomTokenError(errorMessage);
    } finally {
      setIsLoadingCustomToken(false);
    }
  };

  // Auto-populate custom token address if valid contract address is pasted
  useEffect(() => {
    const checkAndSetCustomToken = async () => {
      let isValidContractAddress = false;
      if (chainId === SOLANA_CHAIN_ID) {
        isValidContractAddress = searchTerm.length >= 32 && searchTerm.length <= 44;
      } else {
        isValidContractAddress = searchTerm.startsWith('0x') && searchTerm.length === 42;
      }
      
      if (isValidContractAddress) {
        setCustomTokenAddress(searchTerm);
        // Auto-open custom token section if address is detected
        if (!showCustomToken) {
          setShowCustomToken(true);
        }
      }
    };
    
    checkAndSetCustomToken();
  }, [searchTerm, chainId, showCustomToken]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-left flex items-center justify-between hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          {selectedToken ? (
            <>
              <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold">
                {selectedToken.symbol.charAt(0)}
              </div>
              <span className="font-medium">{selectedToken.symbol}</span>
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">Select {label}</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-hidden">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={chainId === SOLANA_CHAIN_ID ? "Search tokens or paste mint address" : "Search tokens or paste contract address (0x...)"}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCustomTokenError('');
                  }}
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    setShowCustomToken(!showCustomToken);
                    if (!showCustomToken) {
                      setCustomTokenAddress('');
                      setCustomTokenError('');
                    }
                  }}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  {showCustomToken ? 'Cancel' : 'Custom'}
                </button>
              </div>
              {isContractAddress && !showCustomToken && (
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  Contract address detected. Click "Custom" to add this token.
                </p>
              )}
            </div>
            
            {/* Custom Token Input */}
            {showCustomToken && (
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Add Custom Token
                  </div>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={customTokenAddress}
                    onChange={(e) => {
                      setCustomTokenAddress(e.target.value);
                      setCustomTokenError('');
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  {customTokenError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{customTokenError}</p>
                  )}
                  <button
                    onClick={handleLoadCustomToken}
                    disabled={isLoadingCustomToken || !customTokenAddress}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {isLoadingCustomToken ? 'Loading...' : 'Add Token'}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-y-auto max-h-80">
              {isSearching && (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  <p>Searching DexScreener...</p>
                </div>
              )}
              
              {/* Wallet Tokens Section */}
              {isWalletConnected && filteredWalletTokens.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                      Your Wallet
                    </p>
                  </div>
                  {filteredWalletTokens.map((token) => (
                    <button
                      key={`wallet-${token.chainId}-${token.address}`}
                      onClick={() => {
                        onTokenSelect(token);
                        setIsOpen(false);
                        setSearchTerm('');
                        setShowCustomToken(false);
                      }}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                          {token.logoURI ? (
                            <img
                              src={token.logoURI}
                              alt={token.symbol}
                              className="w-8 h-8 rounded-full"
                              onError={(e) => {
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
                        <div className="flex-1 text-left">
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{token.name}</div>
                        </div>
                      </div>
                      {token.balanceFormatted && (
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {parseFloat(token.balanceFormatted).toLocaleString(undefined, {
                              maximumFractionDigits: 6,
                            })}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {token.symbol}
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                  {allFilteredTokens.length > 0 && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Other Tokens
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Other Tokens */}
              {allFilteredTokens.length === 0 && filteredWalletTokens.length === 0 && !showCustomToken && !isSearching ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  <p className="mb-2">No tokens found</p>
                  <p className="text-xs">Try searching by symbol, name, or paste a contract address (0x...)</p>
                </div>
              ) : (
                allFilteredTokens.map((token) => (
                  <button
                    key={`${token.chainId}-${token.address}`}
                    onClick={() => {
                      onTokenSelect(token);
                      setIsOpen(false);
                      setSearchTerm('');
                      setShowCustomToken(false);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold">
                      {token.symbol.charAt(0)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{token.name}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        {token.address.slice(0, 6)}...{token.address.slice(-4)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

