// DexScreener API integration for token discovery
// API Documentation: https://docs.dexscreener.com/

export interface DexScreenerToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  chainId: string;
}

// Token interface matching LI.FI SDK Token type
export interface DexScreenerTokenData {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  priceUSD?: string;
}

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
}

// Map LI.FI chain IDs to DexScreener chain IDs
const chainIdToDexScreener: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  56: 'bsc',
  137: 'polygon',
  42161: 'arbitrum',
  43114: 'avalanche',
  8453: 'base',
  250: 'fantom',
  100: 'gnosis',
  1101: 'polygon-zkevm',
  324: 'zksync',
  5000: 'mantle',
  59144: 'linea',
  534352: 'scroll',
};

export const getDexScreenerChainId = (chainId: number): string | null => {
  return chainIdToDexScreener[chainId] || null;
};

// Search for tokens on a specific chain
export const searchTokensOnChain = async (
  chainId: number,
  query?: string
): Promise<DexScreenerPair[]> => {
  try {
    const dexChainId = getDexScreenerChainId(chainId);
    if (!dexChainId) {
      console.warn(`Chain ${chainId} not supported by DexScreener`);
      return [];
    }

    let url = `https://api.dexscreener.com/latest/dex/tokens/`;
    
    // If query provided, search by token address
    if (query && query.startsWith('0x')) {
      url = `https://api.dexscreener.com/latest/dex/tokens/${query}`;
    } else {
      // Get popular pairs for the chain
      url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query || '')}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.pairs) {
      // Filter by chain if searching by token address
      if (query && query.startsWith('0x')) {
        return data.pairs.filter((pair: DexScreenerPair) => 
          pair.chainId === dexChainId
        );
      }
      // For search queries, return all pairs (they're already filtered by DexScreener)
      return data.pairs || [];
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching tokens from DexScreener:', error);
    return [];
  }
};

// Get token pairs for a specific token address
export const getTokenPairs = async (
  tokenAddress: string,
  chainId?: number
): Promise<DexScreenerPair[]> => {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.pairs) {
      let pairs = data.pairs;
      
      // Filter by chain if specified
      if (chainId) {
        const dexChainId = getDexScreenerChainId(chainId);
        if (dexChainId) {
          pairs = pairs.filter((pair: DexScreenerPair) => 
            pair.chainId === dexChainId
          );
        }
      }
      
      // Sort by liquidity (highest first)
      return pairs.sort((a: DexScreenerPair, b: DexScreenerPair) => {
        const liquidityA = a.liquidity?.usd || 0;
        const liquidityB = b.liquidity?.usd || 0;
        return liquidityB - liquidityA;
      });
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching token pairs from DexScreener:', error);
    return [];
  }
};

// Get all tokens on a chain from DexScreener
export const getAllTokensOnChain = async (
  chainId: number,
  limit: number = 1000
): Promise<DexScreenerTokenData[]> => {
  try {
    const dexChainId = getDexScreenerChainId(chainId);
    if (!dexChainId) {
      return [];
    }

    // Fetch pairs for the chain - DexScreener doesn't have a direct "all tokens" endpoint
    // So we'll fetch popular pairs and extract unique tokens
    const url = `https://api.dexscreener.com/latest/dex/search?q=${dexChainId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.statusText}`);
    }

    const data = await response.json();
    const tokensMap = new Map<string, DexScreenerTokenData>();
    
    if (data.pairs && Array.isArray(data.pairs)) {
      // Filter by chain and extract unique tokens
      const pairs = data.pairs.filter((pair: DexScreenerPair) => 
        pair.chainId === dexChainId
      );
      
      for (const pair of pairs) {
        // Add base token
        if (pair.baseToken && !tokensMap.has(pair.baseToken.address.toLowerCase())) {
          tokensMap.set(pair.baseToken.address.toLowerCase(), {
            chainId: chainId,
            address: pair.baseToken.address,
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name,
            decimals: 18, // Default, will try to fetch from contract if needed
            logoURI: '',
            priceUSD: pair.priceUsd || '0',
          } as DexScreenerTokenData);
        }
        
        // Add quote token
        if (pair.quoteToken && !tokensMap.has(pair.quoteToken.address.toLowerCase())) {
          tokensMap.set(pair.quoteToken.address.toLowerCase(), {
            chainId: chainId,
            address: pair.quoteToken.address,
            symbol: pair.quoteToken.symbol,
            name: pair.quoteToken.name,
            decimals: 18, // Default
            logoURI: '',
            priceUSD: pair.priceUsd || '0',
          } as DexScreenerTokenData);
        }
        
        // Stop if we've reached the limit
        if (tokensMap.size >= limit) break;
      }
    }
    
    return Array.from(tokensMap.values());
  } catch (error) {
    console.error('Error fetching tokens from DexScreener:', error);
    return [];
  }
};

// Get popular tokens on a chain (by volume) - kept for backward compatibility
export const getPopularTokens = async (
  chainId: number,
  limit: number = 50
): Promise<DexScreenerPair[]> => {
  try {
    const dexChainId = getDexScreenerChainId(chainId);
    if (!dexChainId) {
      return [];
    }

    const url = `https://api.dexscreener.com/latest/dex/search?q=${dexChainId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.pairs) {
      const pairs = data.pairs
        .filter((pair: DexScreenerPair) => pair.chainId === dexChainId)
        .sort((a: DexScreenerPair, b: DexScreenerPair) => {
          const volumeA = a.volume?.h24 || 0;
          const volumeB = b.volume?.h24 || 0;
          return volumeB - volumeA;
        })
        .slice(0, limit);
      
      return pairs;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching popular tokens from DexScreener:', error);
    return [];
  }
};

// Search tokens by symbol or name
export const searchTokens = async (
  chainId: number,
  query: string
): Promise<DexScreenerTokenData[]> => {
  try {
    const dexChainId = getDexScreenerChainId(chainId);
    if (!dexChainId) {
      return [];
    }

    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.statusText}`);
    }

    const data = await response.json();
    const tokensMap = new Map<string, DexScreenerTokenData>();
    
    if (data.pairs && Array.isArray(data.pairs)) {
      for (const pair of data.pairs) {
        // Filter by chain
        if (pair.chainId !== dexChainId) continue;
        
        // Check if base token matches query
        if (pair.baseToken && 
            (pair.baseToken.symbol.toLowerCase().includes(query.toLowerCase()) ||
             pair.baseToken.name.toLowerCase().includes(query.toLowerCase()))) {
          if (!tokensMap.has(pair.baseToken.address.toLowerCase())) {
            tokensMap.set(pair.baseToken.address.toLowerCase(), {
              chainId: chainId,
              address: pair.baseToken.address,
              symbol: pair.baseToken.symbol,
              name: pair.baseToken.name,
              decimals: 18,
              logoURI: '',
              priceUSD: pair.priceUsd || '0',
            } as DexScreenerTokenData);
          }
        }
        
        // Check if quote token matches query
        if (pair.quoteToken && 
            (pair.quoteToken.symbol.toLowerCase().includes(query.toLowerCase()) ||
             pair.quoteToken.name.toLowerCase().includes(query.toLowerCase()))) {
          if (!tokensMap.has(pair.quoteToken.address.toLowerCase())) {
            tokensMap.set(pair.quoteToken.address.toLowerCase(), {
              chainId: chainId,
              address: pair.quoteToken.address,
              symbol: pair.quoteToken.symbol,
              name: pair.quoteToken.name,
              decimals: 18,
              logoURI: '',
              priceUSD: pair.priceUsd || '0',
            } as DexScreenerTokenData);
          }
        }
      }
    }
    
    return Array.from(tokensMap.values());
  } catch (error) {
    console.error('Error searching tokens from DexScreener:', error);
    return [];
  }
};

