// Jupiter API integration utilities for Solana swaps
// Using Jupiter Ultra Swap API: https://api.jup.ag/ultra/v1
import {
  getAccount,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID, // Standard SPL Token program
  TOKEN_2022_PROGRAM_ID, // For Token-2022 tokens
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionExpiredBlockheightExceededError,
} from "@solana/web3.js";
import {WalletContextState } from "@solana/wallet-adapter-react"

export interface JupiterToken {
  address: string;
  chainId: number; // Solana chain ID
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  priceUSD?: string;
  balance?: string;
  balanceFormatted?: string;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan?: any[];
}

export interface JupiterOrderResponse {
  transaction: string; // Base64 encoded transaction
  requestId: string;
  swapType: string;
  slippageBps: number;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
}

export interface JupiterExecuteResponse {
  txid: string;
  status: string;
}

const JUPITER_API_BASE = 'https://api.jup.ag';
const JUPITER_LITE_API_BASE = 'https://lite-api.jup.ag';
const JUPITER_QUOTE_API_BASE = 'https://quote-api.jup.ag';
const JUPITER_ULTRA_API_BASE = `${JUPITER_API_BASE}/ultra/v1`;

// Solana RPC endpoints (with fallbacks for reliability)
// Try to use environment variable first, then fallback to reliable public endpoints
// Note: Many public RPCs require API keys. The official endpoint is free but rate-limited.
export const SOLANA_RPC_ENDPOINT = 'https://mainnet.helius-rpc.com/?api-key=3921c971-0628-4e75-aaa0-cd37bb038928'

// Fallback endpoints if primary fails (public endpoints that don't require API keys)
const SOLANA_RPC_FALLBACKS = [
  'https://solana.drpc.org', // dRPC public endpoint (free tier available)
  'https://solana.extrnode.com', // Extrnode public endpoint
  'https://solana-api.projectserum.com', // Project Serum public endpoint
  'https://rpc.ankr.com/solana', // Ankr (may require API key, but try anyway)
];

/**
 * Create a Solana connection with reliable RPC endpoint
 * Uses official Solana endpoint by default (free, no API key required)
 * Can be overridden with NEXT_PUBLIC_SOLANA_RPC_URL environment variable
 * 
 * Note: If you have rate limiting issues, consider using a paid RPC provider
 * like QuickNode, Alchemy, or Helius and set NEXT_PUBLIC_SOLANA_RPC_URL
 */
export const createSolanaConnection = async (): Promise<any> => {
  const { Connection } = await import('@solana/web3.js');
  
  // Try primary endpoint first
  try {
    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
    console.log("🚀 ~ createSolanaConnection ~ SOLANA_RPC_ENDPOINT:", SOLANA_RPC_ENDPOINT)
    // Quick test to see if endpoint is accessible
    await Promise.race([
      connection.getVersion(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    return connection;
  } catch (error: any) {
    console.warn(`[Solana] Primary RPC endpoint failed (${SOLANA_RPC_ENDPOINT}), trying fallbacks...`, error?.message || error);
    
    // Try fallback endpoints
    for (const endpoint of SOLANA_RPC_FALLBACKS) {
      try {
        const connection = new Connection(endpoint, 'confirmed');
        await Promise.race([
          connection.getVersion(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        console.log(`[Solana] Using fallback RPC endpoint: ${endpoint}`);
        return connection;
      } catch (fallbackError: any) {
        console.warn(`[Solana] Fallback endpoint failed: ${endpoint}`, fallbackError?.message || fallbackError);
        continue;
      }
    }
    
    // If all fail, throw a helpful error with instructions
    const errorMessage = `
[Solana RPC Error] All public RPC endpoints failed. 

To fix this:
1. Set up a free RPC endpoint from one of these providers:
   - dRPC: https://drpc.org (free tier available)
   - QuickNode: https://quicknode.com (free tier available)
   - Alchemy: https://alchemy.com (free tier available)
   - Helius: https://helius.dev (free tier available)

2. Add your RPC URL to .env.local:
   NEXT_PUBLIC_SOLANA_RPC_URL=https://your-rpc-endpoint.com

3. Restart your development server

Current endpoints tried:
- ${SOLANA_RPC_ENDPOINT}
${SOLANA_RPC_FALLBACKS.map(e => `- ${e}`).join('\n')}
`;
    console.error(errorMessage);
    throw new Error('All Solana RPC endpoints failed. Please set up your own RPC endpoint. See console for details.');
  }
};

// Jupiter API Key (required - set via environment variable)
// Get your API key from https://portal.jup.ag
// Note: NEXT_PUBLIC_ prefix makes it available on the client side
// Make sure to restart the dev server after adding this to .env.local
const JUPITER_API_KEY = process.env.NEXT_PUBLIC_JUPITER_API_KEY || '';

// Solana chain ID used in LI.FI SDK
export const SOLANA_CHAIN_ID = 7565164;

// Native SOL mint address
export const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Get all tokens from Solana Token List (official source)
 * Similar to getAllTokensOnChain for EVM chains
 */
export const getJupiterTokens = async (limit: number = 1000): Promise<JupiterToken[]> => {
  try {
    // Use the official Solana Token List from GitHub (archived but still has many tokens)
    const response = await fetch('https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token list: ${response.statusText}`);
    }
    
    const data = await response.json();
    const tokens: JupiterToken[] = [];
    const tokenMap = new Map<string, JupiterToken>();
    
    if (data && data.tokens && Array.isArray(data.tokens)) {
      // First, add all tokens from the list
      for (const token of data.tokens) {
        if (token.chainId === 101 || token.chainId === 7565164) {
          const tokenKey = (token.address || '').toLowerCase();
          const isNativeSOL = tokenKey === NATIVE_SOL_MINT.toLowerCase();
          
          // Skip if already exists (avoid duplicates)
          if (tokenMap.has(tokenKey)) {
            // For native SOL, ensure we use the best metadata (prioritize "SOL" over "Wrapped SOL")
            if (isNativeSOL) {
              const existing = tokenMap.get(tokenKey);
              // Prefer "SOL" over "Wrapped SOL" or "Wrapped"
              const currentSymbol = (token.symbol || '').toUpperCase();
              const existingSymbol = (existing?.symbol || '').toUpperCase();
              
              if (currentSymbol === 'SOL' && existingSymbol !== 'SOL') {
                // Replace with better SOL entry
                tokenMap.set(tokenKey, {
                  address: NATIVE_SOL_MINT,
                  chainId: SOLANA_CHAIN_ID,
                  symbol: 'SOL',
                  name: 'Solana',
                  decimals: token.decimals || 9,
                  logoURI: token.logoURI || existing?.logoURI || '',
                });
              }
            }
            continue;
          }
          
          // For native SOL, always use "SOL" and "Solana" as name (not "Wrapped SOL")
          if (isNativeSOL) {
            tokenMap.set(tokenKey, {
              address: NATIVE_SOL_MINT,
              chainId: SOLANA_CHAIN_ID,
              symbol: 'SOL',
              name: 'Solana',
              decimals: 9,
              logoURI: token.logoURI || '',
            });
          } else {
            tokenMap.set(tokenKey, {
              address: token.address,
              chainId: SOLANA_CHAIN_ID,
              symbol: token.symbol || 'UNKNOWN',
              name: token.name || 'Unknown Token',
              decimals: token.decimals || 9,
              logoURI: token.logoURI || '',
            });
          }
        }
      }
    }
    
    // Ensure native SOL is always present and correctly named
    const solKey = NATIVE_SOL_MINT.toLowerCase();
    if (!tokenMap.has(solKey)) {
      tokenMap.set(solKey, {
        address: NATIVE_SOL_MINT,
        chainId: SOLANA_CHAIN_ID,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        logoURI: '',
      });
    } else {
      // Ensure SOL is always named correctly (not "Wrapped SOL")
      const existingSOL = tokenMap.get(solKey);
      if (existingSOL && (existingSOL.symbol !== 'SOL' || existingSOL.name !== 'Solana')) {
        tokenMap.set(solKey, {
          ...existingSOL,
          symbol: 'SOL',
          name: 'Solana',
        });
      }
    }
    
    // Manually add important tokens that might be missing (like JUP)
    const importantTokens = [
      {
        address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        symbol: 'JUP',
        name: 'Jupiter',
        decimals: 6,
        logoURI: 'https://static.jup.ag/jup/icon.png',
      },
      {
        address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
        symbol: 'WIF',
        name: 'dogwifhat',
        decimals: 6,
        logoURI: '',
      },
    ];
    
    for (const token of importantTokens) {
      const tokenKey = token.address.toLowerCase();
      if (!tokenMap.has(tokenKey)) {
        tokenMap.set(tokenKey, {
          address: token.address,
          chainId: SOLANA_CHAIN_ID,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI,
        });
      }
    }
    
    // Convert map to array for sorting
    const allTokens = Array.from(tokenMap.values());
    
    if (allTokens.length > 0) {
      // Most popular Solana tokens (ordered by popularity/volume)
      const popularTokenAddresses = [
        'So11111111111111111111111111111111111111112', // SOL (Native)
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
        'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP (Jupiter)
        'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
        '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH (Wormhole)
        'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM', // USDCet (Wormhole)
        '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', // ORCA
        'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt', // SRM
        '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
        'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
        'A6tZxXmSZKRWEKBP2V3P3vnBhgGpudxU3RVDJVNH5ZGh', // RAY-USDC LP
        '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT', // UXD Stablecoin
        '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', // SAMO
      ].map(addr => addr.toLowerCase());
      
      // Sort tokens: prioritize popular tokens, then verified/tagged tokens, then tokens with logos
      allTokens.sort((a: any, b: any) => {
        const aAddress = (a.address || '').toLowerCase();
        const bAddress = (b.address || '').toLowerCase();
        
        // First priority: Popular tokens (exact match)
        const aIsPopular = popularTokenAddresses.includes(aAddress);
        const bIsPopular = popularTokenAddresses.includes(bAddress);
        if (aIsPopular !== bIsPopular) {
          return aIsPopular ? -1 : 1;
        }
        
        // If both are popular, sort by popularity order
        if (aIsPopular && bIsPopular) {
          const aIndex = popularTokenAddresses.indexOf(aAddress);
          const bIndex = popularTokenAddresses.indexOf(bAddress);
          return aIndex - bIndex;
        }
        
        // Second priority: Stablecoins (check by symbol/address)
        const stableAddresses = [
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
        ].map(addr => addr.toLowerCase());
        const aIsStable = stableAddresses.includes(aAddress);
        const bIsStable = stableAddresses.includes(bAddress);
        if (aIsStable !== bIsStable) {
          return aIsStable ? -1 : 1;
        }
        
        // Third priority: Tokens with logos
        if (!!a.logoURI !== !!b.logoURI) {
          return a.logoURI ? -1 : 1;
        }
        
        // Finally sort by symbol alphabetically
        return (a.symbol || '').localeCompare(b.symbol || '');
      });
      
      // Limit to requested number
      const limitedTokens = allTokens.slice(0, limit);
      
      // Return the sorted and limited tokens
      return limitedTokens;
    }
    
    return tokens;
  } catch (error) {
    console.error('Error fetching Solana tokens:', error);
    return [];
  }
};

/**
 * Parse Jupiter token data format (primary source)
 */
function parseJupiterTokenData(data: any, limit: number): JupiterToken[] {
  const tokens: JupiterToken[] = [];
  
  if (data && typeof data === 'object') {
    // Most popular Solana tokens (ordered by popularity/volume)
    const popularTokenAddresses = [
      'So11111111111111111111111111111111111111112', // SOL (Native)
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP (Jupiter)
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
      '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH (Wormhole)
      'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM', // USDCet (Wormhole)
      '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', // ORCA
      'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt', // SRM
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
      'A6tZxXmSZKRWEKBP2V3P3vnBhgGpudxU3RVDJVNH5ZGh', // RAY-USDC LP
      '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT', // UXD Stablecoin
      '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', // SAMO
    ].map(addr => addr.toLowerCase());
    
    // Convert object to array for easier sorting and limiting
    const tokenEntries: Array<[string, any]> = Object.entries(data);
    
    // Sort tokens: prioritize popular tokens first, then verified tokens, then tokens with logos
    tokenEntries.sort((a, b) => {
      const tokenA = a[1];
      const tokenB = b[1];
      const aAddress = (a[0] || '').toLowerCase();
      const bAddress = (b[0] || '').toLowerCase();
      
      // First priority: Popular tokens
      const aIsPopular = popularTokenAddresses.includes(aAddress);
      const bIsPopular = popularTokenAddresses.includes(bAddress);
      if (aIsPopular !== bIsPopular) {
        return aIsPopular ? -1 : 1;
      }
      
      // If both are popular, sort by popularity order
      if (aIsPopular && bIsPopular) {
        const aIndex = popularTokenAddresses.indexOf(aAddress);
        const bIndex = popularTokenAddresses.indexOf(bAddress);
        return aIndex - bIndex;
      }
      
      // Second priority: Verified tokens
      if (tokenA.verified !== tokenB.verified) {
        return tokenA.verified ? -1 : 1;
      }
      
      // Third priority: Tokens with logos
      if (!!tokenA.logoURI !== !!tokenB.logoURI) {
        return tokenA.logoURI ? -1 : 1;
      }
      
      // Finally sort by symbol alphabetically
      return (tokenA.symbol || '').localeCompare(tokenB.symbol || '');
    });
    
    // Limit to requested number
    const limitedEntries = tokenEntries.slice(0, limit);
    
    for (const [address, tokenData] of limitedEntries) {
      const token = tokenData as any;
      const tokenAddress = address.toLowerCase();
      const isNativeSOL = tokenAddress === NATIVE_SOL_MINT.toLowerCase();
      
      // For native SOL, always use "SOL" and "Solana" (not "Wrapped SOL")
      if (isNativeSOL) {
        tokens.push({
          address: NATIVE_SOL_MINT,
          chainId: SOLANA_CHAIN_ID,
          symbol: 'SOL',
          name: 'Solana',
          decimals: 9,
          logoURI: token.logoURI || '',
        });
      } else {
        tokens.push({
          address: address,
          chainId: SOLANA_CHAIN_ID,
          symbol: token.symbol || 'UNKNOWN',
          name: token.name || 'Unknown Token',
          decimals: token.decimals || 9,
          logoURI: token.logoURI || '',
        });
      }
    }
  }
  
  return tokens;
}

/**
 * Search for tokens by symbol, name, or mint address
 * Returns multiple results for better search experience
 */
export const searchJupiterTokens = async (query: string, limit: number = 50): Promise<JupiterToken[]> => {
  try {
    // First search in cached tokens
    const allTokens = await getJupiterTokens(5000); // Get more tokens for search
    
    const queryLower = query.toLowerCase();
    const results = allTokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(queryLower) ||
        token.name.toLowerCase().includes(queryLower) ||
        token.address.toLowerCase().includes(queryLower)
    ).slice(0, limit);
    
    // If we found results, return them
    if (results.length > 0) {
      return results;
    }
    
    // If no results in cached list, try to search via Jupiter's quote API
    // by attempting to get a quote with popular tokens to discover new tokens
    // Note: Jupiter doesn't have a direct search API, but we can try common patterns
    
    return [];
  } catch (error) {
    console.error('Error searching Jupiter tokens:', error);
    return [];
  }
};

/**
 * Search for a single token by symbol, name, or mint address (backward compatibility)
 */
export const searchJupiterToken = async (query: string): Promise<JupiterToken | null> => {
  const results = await searchJupiterTokens(query, 1);
  return results.length > 0 ? results[0] : null;
};

/**
 * Get token info by address (useful for custom token addresses)
 * This will try to fetch token metadata if not in the list
 */
export const getJupiterTokenByAddress = async (address: string): Promise<JupiterToken | null> => {
  try {
    // First check in cached tokens
    const allTokens = await getJupiterTokens(10000);
    const found = allTokens.find(
      (token) => token.address.toLowerCase() === address.toLowerCase()
    );
    
    if (found) {
      return found;
    }
    
    // If not found, try to get quote to verify token exists on Jupiter
    // This is a way to check if Jupiter supports this token
    try {
      const quote = await getJupiterQuote(
        'So11111111111111111111111111111111111111112', // SOL
        address,
        '1000000000' // 1 SOL
      );
      
      if (quote) {
        // Token exists but we don't have metadata, return minimal info
        return {
          address: address,
          chainId: SOLANA_CHAIN_ID,
          symbol: 'UNKNOWN',
          name: 'Unknown Token',
          decimals: 9, // Default
          logoURI: '',
        };
      }
    } catch (quoteError) {
      // Token might not have liquidity with SOL, try with USDC
      try {
        const quoteUSDC = await getJupiterQuote(
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          address,
          '1000000' // 1 USDC
        );
        
        if (quoteUSDC) {
          return {
            address: address,
            chainId: SOLANA_CHAIN_ID,
            symbol: 'UNKNOWN',
            name: 'Unknown Token',
            decimals: 9, // Default
            logoURI: '',
          };
        }
      } catch (usdcError) {
        // Token not found or not supported
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting Jupiter token by address:', error);
    return null;
  }
};

/**
 * Get a quote from Jupiter Lite API (public, no auth required)
 * Improved version with better error handling, similar to PancakeSwap/Uniswap
 * Uses lite-api.jup.ag/swap/v1/quote endpoint
 */
export const getJupiterQuote = async (
  inputMint: string,
  outputMint: string,
  amount: string, // Amount in native units (before decimals)
  slippageBps: number = 50, // Default 0.5% slippage
  restrictIntermediateTokens: boolean = true // Default to true (free tier requirement)
): Promise<JupiterQuoteResponse | null> => {
  try {
    console.log('[getJupiterQuote] Starting quote request:', {
      inputMint,
      outputMint,
      amount,
      slippageBps,
      restrictIntermediateTokens
    });

    // Validate inputs
    if (!inputMint || !outputMint || !amount || amount === '0') {
      console.warn('[getJupiterQuote] Invalid input parameters');
      return null;
    }

    // Jupiter quote API is public and doesn't require authentication
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };
    
    // Use lite-api.jup.ag for quotes (public endpoint, no auth required)
    // Note: restrictIntermediateTokens=false requires API key, so default to true for free tier
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      platformFeeBps: '15',
      onlyDirectRoutes: 'true',
      slippageBps: slippageBps.toString(),
    });
    
    // Only add restrictIntermediateTokens if we have an API key and want it false
    // Free tier users must use restrictIntermediateTokens=true (default behavior)
    // If we have an API key and want false, include it. Otherwise, always use true for free tier.
    if (JUPITER_API_KEY && !restrictIntermediateTokens) {
      // Only allow false if we have API key
      params.set('restrictIntermediateTokens', 'false');
    } else {
      // Default to true for free tier (required)
      params.set('restrictIntermediateTokens', 'true');
    }
    
    const url = `${JUPITER_LITE_API_BASE}/swap/v1/quote?${params.toString()}`;
    
    // Log request details for debugging
    console.log('[Jupiter] Making quote request:', {
      url,
      inputMint,
      outputMint,
      amount,
    });
    
    // Add timeout to prevent hanging requests (similar to PancakeSwap/Uniswap)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(url, {
      method: 'GET',
      headers,
        signal: controller.signal,
    });
      
      clearTimeout(timeoutId);
    
    console.log('[Jupiter] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      if (response.status === 404) {
          console.warn('[Jupiter] No route found (404)');
        return null; // No route found
      }
        
      const errorText = await response.text().catch(() => response.statusText);
      const errorMessage = errorText || response.statusText;
        console.error(`[Jupiter] API error (${response.status}):`, errorMessage);
        
        // Try to parse error JSON if available
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) {
            throw new Error(`Jupiter API error: ${errorJson.message}`);
          }
        } catch {
          // Not JSON, use text error
        }
        
      throw new Error(`Jupiter API error: ${errorMessage}`);
    }
    
    const data = await response.json();
    
      console.log('[Jupiter] Quote response received:', {
        hasOutAmount: !!data.outAmount,
        hasOutputAmount: !!data.outputAmount,
        hasRoutePlan: !!data.routePlan,
        hasRoutes: !!data.routes,
      });
    
      // Jupiter Lite API response format
      // The API returns the quote with outAmount, routePlan, etc.
      // Note: The response format may be slightly different, so we handle both
    if (data && (data.outAmount || data.outputAmount)) {
        const quote: JupiterQuoteResponse = {
        inputMint: inputMint,
        outputMint: outputMint,
        inAmount: amount,
          outAmount: data.outAmount || data.outputAmount || '0',
          otherAmountThreshold: data.otherAmountThreshold || data.outAmount || data.outputAmount || '0',
        swapMode: data.swapMode || 'ExactIn',
        slippageBps: slippageBps,
        priceImpactPct: data.priceImpactPct || (data.priceImpact && data.priceImpact.toString()) || '0',
          routePlan: data.routePlan || data.routes || data.context?.slot || [],
        };
        
        // Also store the full response for swap execution
        (quote as any).fullResponse = data;
        
        // Validate quote has valid output amount
        if (quote.outAmount === '0' || BigInt(quote.outAmount) === BigInt(0)) {
          console.warn('[Jupiter] Quote returned zero output amount');
          return null;
        }
        
        console.log('[Jupiter] Quote successful:', {
          inAmount: quote.inAmount,
          outAmount: quote.outAmount,
          priceImpact: quote.priceImpactPct,
        });
        
        return quote;
      }
      
      // If response doesn't have expected fields, log and return null
      console.warn('[Jupiter] Unexpected response format:', {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        data: JSON.stringify(data).substring(0, 500), // First 500 chars
      });
    return null;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('[Jupiter] Request timeout after 10 seconds');
        throw new Error('Jupiter API request timeout');
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    console.error('[Jupiter] Error fetching quote:', {
      error: errorMessage,
      inputMint,
      outputMint,
      amount,
    });
    
    // Don't silently fail - throw error so caller can handle it
    // This matches PancakeSwap/Uniswap behavior
    throw new Error(`Jupiter quote error: ${errorMessage}`);
  }
};

/**
 * Get swap quote from Jupiter Lite API
 * Returns the quote response which can be used directly for swap execution
 * This is a wrapper that matches the expected interface
 */
export const getJupiterOrder = async (
  inputMint: string,
  outputMint: string,
  amount: string, // Amount in native units (before decimals)
  taker?: string, // Wallet address (required for transaction)
  slippageBps: number = 50,
  restrictIntermediateTokens: boolean = true // Default to true (free tier requirement)
): Promise<{ quoteResponse: any; transaction?: string } | null> => {
  try {
    if (!taker) {
      throw new Error('Wallet address (taker) is required for swap transaction');
    }
    
    // Fetch quote directly from lite API to get raw response for swap execution
    // Note: restrictIntermediateTokens=false requires API key, so default to true for free tier
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      platformFeeBps: '15',
      onlyDirectRoutes: 'true',
      slippageBps: slippageBps.toString(),
    });
    
    // Only add restrictIntermediateTokens if we have an API key and want it false
    // Free tier users must use restrictIntermediateTokens=true (default behavior)
    if (JUPITER_API_KEY && !restrictIntermediateTokens) {
      // Only allow false if we have API key
      params.set('restrictIntermediateTokens', 'false');
    } else {
      // Default to true for free tier (required)
      params.set('restrictIntermediateTokens', 'true');
    }
    
    const url = `${JUPITER_LITE_API_BASE}/swap/v1/quote?${params.toString()}`;
    
    console.log('[getJupiterOrder] Fetching quote for swap:', {
      url,
      inputMint,
      outputMint,
      amount,
    });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[getJupiterOrder] No route found (404)');
      return null;
        }
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Jupiter API error: ${errorText || response.statusText}`);
      }
      
      const quoteResponse = await response.json();
      
      // Validate response has required fields
      if (!quoteResponse || (!quoteResponse.outAmount && !quoteResponse.outputAmount)) {
        console.warn('[getJupiterOrder] Invalid quote response format');
        return null;
      }
      
      console.log('[getJupiterOrder] Quote received successfully');
      
      // Return raw quote response (transaction will be fetched during execution with fresh blockhash)
      return {
        quoteResponse: quoteResponse,
      };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        throw new Error('Jupiter API request timeout');
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('[getJupiterOrder] Error fetching quote:', error);
    return null;
  }
};

async function ensureFeeAccountExists(
  connection: Connection,
  wallet: WalletContextState, // From wallet adapter
  mint: PublicKey,
  feeAccountOwner: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  console.log({ wallet, w: wallet.signTransaction });
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const feeAccount = await getAssociatedTokenAddress(
    mint,
    feeAccountOwner,
    false,
    tokenProgram
  );
  console.log("🚀 ~ ensureFeeAccountExists ~ feeAccount:getAssociatedTokenAddress", feeAccount)

  try {
    const _accInfo = await getAccount(
      connection,
      feeAccount,
      undefined,
      tokenProgram
    );
    console.log("🚀 ~ ensureFeeAccountExists ~ _accInfo:getAccount", _accInfo)
    return feeAccount;
  } catch (error) {
    const createIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      feeAccount,
      feeAccountOwner,
      mint,
      tokenProgram
    );
    console.log("🚀 ~ ensureFeeAccountExists ~ createIx:", createIx)

    const tx = new Transaction().add(createIx);
    tx.feePayer = wallet.publicKey;
    console.log("🚀 ~ ensureFeeAccountExists ~ tx:Transaction", tx)
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    console.log("🚀 ~ ensureFeeAccountExists ~ blockhash:", blockhash)
    tx.recentBlockhash = blockhash;

    // Sign and send
    const signedTx = await wallet.signTransaction(tx);
    console.log("🚀 ~ ensureFeeAccountExists ~ signedTx:", signedTx)
    const rawTransaction = signedTx.serialize();
    console.log("🚀 ~ ensureFeeAccountExists ~ rawTransaction:", rawTransaction)
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
    });
    console.log("🚀 ~ ensureFeeAccountExists ~ txid:", txid)

    // Confirm
    await connection.confirmTransaction({
      signature: txid,
      blockhash,
      lastValidBlockHeight: (await connection.getBlockHeight()) + 150,
    });
    return feeAccount;
  }
}

/**
 * Helper function to determine retryable errors
 */
function shouldRetryError(error: any): boolean {
  const errorMessage = error?.message || error?.toString() || '';
  return (
    errorMessage.includes('Blockhash not found') ||
    errorMessage.includes('was not confirmed') ||
    errorMessage.includes('TransactionExpiredBlockheightExceeded') ||
    errorMessage.includes('blockheight exceeded')
  );
}

/**
 * Sign and execute Jupiter swap with retry logic, simulation, and fee account handling
 * Uses lite-api.jup.ag/swap/v1/swap endpoint
 */
export const signAndExecuteSwap = async (
  wallet: any,
  quoteResponse: any,
  connection: any, // Connection from @solana/web3.js
  maxRetries: number = 3
): Promise<string> => {
  if (!wallet.connected || !wallet.signTransaction || !wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  let attempt = 0;
  let lastError: Error | unknown | null = null;

  const solanaWeb3 = await import('@solana/web3.js');
  const { PublicKey, VersionedTransaction, TransactionExpiredBlockheightExceededError } = solanaWeb3;
  const outputMint = new PublicKey(quoteResponse.outputMint);
  const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

  // Fee account owner (can be configured)
  const feeAccountOwner = new PublicKey('BgofVtUQk5WfWq2iHS8RHDvWs9BYcNEWrrxxvPBFUft4');

  while (attempt < maxRetries) {
    attempt++;
    try {
      // 1. Get fresh blockhash for each attempt
      // If connection fails with 403, try recreating with a different endpoint
      let currentConnection = connection;
      let latestBlockHash;
      try {
        latestBlockHash = await currentConnection.getLatestBlockhash();
      } catch (blockhashError: any) {
        // If we get a 403 or connection error, try recreating connection with fallback
        if (blockhashError?.message?.includes('403') || blockhashError?.message?.includes('Forbidden') || blockhashError?.message?.includes('API key')) {
          console.warn('[Jupiter] RPC endpoint blocked, recreating connection with fallback...');
          try {
            currentConnection = await createSolanaConnection();
            latestBlockHash = await currentConnection.getLatestBlockhash();
          } catch (reconnectError: any) {
            // If reconnection also fails, throw a helpful error
            throw new Error(
              'Solana RPC endpoint access denied. Please set up your own RPC endpoint:\n' +
              '1. Get a free RPC from https://drpc.org or https://quicknode.com\n' +
              '2. Add NEXT_PUBLIC_SOLANA_RPC_URL=https://your-endpoint.com to .env.local\n' +
              '3. Restart your dev server'
            );
          }
    } else {
          throw blockhashError;
        }
      }

      // 2. Ensure fee account exists (simplified - you may want to implement ensureFeeAccountExists)
      // For now, we'll use a simple approach without fee account if it fails
      let feeAccount: any = null;
      try {
        // Try to derive fee account address (simplified version)
        // In production, you'd want to implement ensureFeeAccountExists properly
        feeAccount = await ensureFeeAccountExists(
          connection,
          wallet as WalletContextState, // Payer
          outputMint,
          feeAccountOwner,
          TOKEN_PROGRAM_ID
        );; // Simplified - use owner as fee account for now
        console.log("🚀 ~ signAndExecuteSwap ~ feeAccount:", feeAccount)
      } catch (feeError) {
        console.warn('[Jupiter] Fee account setup failed, continuing without fee account:', feeError);
      }

      // 3. Get fresh swap transaction (important for retries)
      const swapPayload: any = {
        quoteResponse,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
      };
      
      if (feeAccount) {
        swapPayload.feeAccount = feeAccount.toString();
      }
      console.log("🚀 ~ signAndExecuteSwap ~ swapPayload:", swapPayload)

      const swapResponse = await fetch(`${JUPITER_LITE_API_BASE}/swap/v1/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(swapPayload),
    });
    
    if (!swapResponse.ok) {
      const errorText = await swapResponse.text().catch(() => swapResponse.statusText);
      throw new Error(`Jupiter Swap API error: ${errorText || swapResponse.statusText}`);
    }
    
    const swapData = await swapResponse.json();
    
    if (!swapData.swapTransaction) {
      throw new Error('No swap transaction in response');
    }
    
      const swapTransaction = VersionedTransaction.deserialize(
        Buffer.from(swapData.swapTransaction, 'base64')
      );

      // 4. Simulate transaction before sending
      const simulation = await currentConnection.simulateTransaction(swapTransaction, {
        commitment: 'processed',
        replaceRecentBlockhash: true,
        sigVerify: false,
      });
      console.log("🚀 ~ signAndExecuteSwap ~ simulation:", simulation.value.err)
      console.log("🚀 ~ signAndExecuteSwap ~ simulation:", simulation)

      // Check if simulation was successful
      if (simulation.value.err) {
        console.error('[Jupiter] Transaction simulation failed:', simulation.value.err);
        // throw new Error('SimulationError: network overloaded or insufficient funds');
      }

      console.log('[Jupiter] Simulation successful. Estimated fee:', simulation.value.fee);

      // 5. Sign with fresh blockhash
      const signedTx = await wallet.signTransaction(swapTransaction);

      // 6. Send with skipPreflight=false for better reliability
      const txid = await currentConnection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 2,
      });

      console.log('[Jupiter] Transaction sent:', txid);

      // 7. Enhanced confirmation with timeout
      const result = await currentConnection.confirmTransaction(
        {
          signature: txid,
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        },
        'confirmed'
      );

      if (result.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
      }

      return txid; // Success case
    } catch (error: any) {
      lastError = error;
      console.warn(`[Jupiter] Attempt ${attempt} failed:`, error);

      // Specific handling for blockheight exceeded
      const errorMessage = error?.message || error?.toString() || '';
      if (error instanceof TransactionExpiredBlockheightExceededError || 
          errorMessage.includes('Blockhash not found') ||
          errorMessage.includes('blockheight exceeded') ||
          errorMessage.includes('TransactionExpiredBlockheightExceeded')) {
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        continue;
      }

      // For other errors, decide whether to retry
      if (shouldRetryError(error)) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      break;
    }
  }

  throw lastError || new Error('Max retries exceeded');
};

/**
 * Execute an order (send the transaction) - Legacy function for backward compatibility
 * @deprecated Use signAndExecuteSwap instead
 */
export const executeJupiterOrder = async (
  requestId: string,
  transaction: string // Base64 encoded signed transaction
): Promise<JupiterExecuteResponse | null> => {
  try {
    const connection = await createSolanaConnection();
    
    const transactionBuffer = Buffer.from(transaction, 'base64');
    const { VersionedTransaction } = await import('@solana/web3.js');
    const tx = VersionedTransaction.deserialize(transactionBuffer);
    
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
    });
    
    await connection.confirmTransaction(signature, 'confirmed');
    
    return {
      txid: signature,
      status: 'success',
    };
  } catch (error) {
    console.error('Error executing Jupiter order:', error);
    return null;
  }
};

/**
 * Convert amount to smallest unit (considering decimals)
 */
export const toSmallestUnit = (amount: string, decimals: number): string => {
  try {
    if (!amount || amount === '0') return '0';
    
    // Handle scientific notation
    if (amount.includes('e') || amount.includes('E')) {
      const num = parseFloat(amount);
      return (num * Math.pow(10, decimals)).toFixed(0);
    }
    
    const decimalIndex = amount.indexOf('.');
    if (decimalIndex === -1) {
      // No decimal point, just multiply by 10^decimals
      return (BigInt(amount) * BigInt(10 ** decimals)).toString();
    }
    
    const integerPart = amount.substring(0, decimalIndex) || '0';
    let decimalPart = amount.substring(decimalIndex + 1);
    
    // Pad or truncate decimal part to match decimals
    if (decimalPart.length > decimals) {
      decimalPart = decimalPart.substring(0, decimals);
    } else {
      decimalPart = decimalPart.padEnd(decimals, '0');
    }
    
    // Remove leading zeros
    const result = integerPart + decimalPart;
    return result.replace(/^0+/, '') || '0';
  } catch (error) {
    console.error('Error converting to smallest unit:', error);
    return '0';
  }
};

/**
 * Convert from smallest unit to human-readable format
 */
export const fromSmallestUnit = (amount: string, decimals: number): string => {
  try {
    if (!amount || amount === '0') return '0';
    
    const amountBigInt = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const wholePart = amountBigInt / divisor;
    const fractionalPart = amountBigInt % divisor;
    
    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }
    
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    return trimmedFractional ? `${wholePart}.${trimmedFractional}` : wholePart.toString();
  } catch (error) {
    console.error('Error converting from smallest unit:', error);
    return '0';
  }
};

