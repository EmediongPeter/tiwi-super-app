/**
 * Jupiter Token Provider
 * 
 * Fetches Solana tokens from Jupiter's token search APIs.
 * Uses Jupiter Ultra Search API for search queries and Tokens V2 API for categories.
 */

import { BaseTokenProvider } from './base';
import { getCanonicalChain, getChainBadge } from '@/lib/backend/registry/chains';
import { SOLANA_CHAIN_ID } from '@/lib/backend/providers/moralis';
import type {
  CanonicalChain,
  ProviderToken,
  ProviderChain,
  NormalizedToken,
  FetchTokensParams,
} from '@/lib/backend/types/backend-tokens';

// Jupiter API endpoints
const JUPITER_API_BASE = 'https://api.jup.ag';
const JUPITER_ULTRA_SEARCH_API = `${JUPITER_API_BASE}/ultra/v1/search`;
const JUPITER_TOKENS_V2_SEARCH_API = `${JUPITER_API_BASE}/tokens/v2/search`;
const JUPITER_TOKENS_V2_CATEGORY_API = `${JUPITER_API_BASE}/tokens/v2`;

// Jupiter API Key (required for Ultra API and Tokens V2 API)
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';

// Native SOL mint address (Jupiter format)
const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Jupiter Ultra Search API Response
 */
interface JupiterUltraSearchToken {
  id: string; // Mint address
  name: string;
  symbol: string;
  icon: string;
  decimals: number;
  twitter?: string;
  telegram?: string;
  website?: string;
  dev?: string;
  circSupply?: number;
  totalSupply?: number;
  tokenProgram?: string;
  launchpad?: string;
  partnerConfig?: string;
  graduatedPool?: string;
  graduatedAt?: string;
  holderCount?: number;
  fdv?: number;
  mcap?: number;
  usdPrice?: number;
  priceBlockId?: number;
  liquidity?: number;
  stats5m?: any;
  stats1h?: any;
  stats6h?: any;
  stats24h?: any;
  firstPool?: {
    id: string;
    createdAt: string;
  };
  audit?: {
    isSus?: boolean;
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    topHoldersPercentage?: number;
    devBalancePercentage?: number;
    devMigrations?: number;
  };
  organicScore?: number;
  organicScoreLabel?: string;
  isVerified?: boolean;
  cexes?: string[];
  tags?: string[];
  updatedAt?: string;
}

/**
 * Jupiter Tokens V2 API Response
 */
interface JupiterTokensV2Token {
  id: string; // Mint address
  name: string;
  symbol: string;
  icon: string;
  decimals: number;
  circSupply?: number;
  totalSupply?: number;
  tokenProgram?: string;
  firstPool?: {
    id: string;
    createdAt: string;
  };
  holderCount?: number;
  audit?: {
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    topHoldersPercentage?: number;
  };
  organicScore?: number;
  organicScoreLabel?: string;
  isVerified?: boolean;
  tags?: string[];
  fdv?: number;
  mcap?: number;
  usdPrice?: number;
  liquidity?: number;
  stats24h?: {
    priceChange?: number;
    volumeChange?: number;
    buyVolume?: number;
    sellVolume?: number;
  };
  updatedAt?: string;
}

export class JupiterTokenProvider extends BaseTokenProvider {
  name = 'jupiter';

  getChainId(canonicalChain: CanonicalChain): string | number | null {
    // Jupiter only supports Solana
    if (canonicalChain.type === 'Solana' && canonicalChain.id === SOLANA_CHAIN_ID) {
      return SOLANA_CHAIN_ID;
    }
    return null;
  }

  async supportsChain(chainId: number): Promise<boolean> {
    return chainId === SOLANA_CHAIN_ID;
  }

  async fetchTokens(params: FetchTokensParams): Promise<ProviderToken[]> {
    try {
      // Jupiter only supports Solana
      const chainIds = params.chainIds || (params.chainId ? [params.chainId] : []);
      const hasSolana = chainIds.includes(SOLANA_CHAIN_ID);
      
      if (!hasSolana) {
        return []; // Not Solana, return empty
      }

      const limit = params.limit ?? 30;
      const search = params.search;

      if (search && search.trim()) {
        // Use Ultra Search API for search queries (better metadata)
        return this.searchTokens(search.trim(), limit);
      } else {
        // Use category endpoints for "all tokens" (popular tokens)
        return this.getTopTokens(limit);
      }
    } catch (error: any) {
      console.error(`[JupiterTokenProvider] Error fetching tokens:`, error);
      return [];
    }
  }

  /**
   * Search tokens using Jupiter Ultra Search API
   * Returns rich metadata including stats, audit, organic score, etc.
   */
  private async searchTokens(query: string, limit: number = 20): Promise<ProviderToken[]> {
    try {
      if (!JUPITER_API_KEY) {
        console.warn('[JupiterTokenProvider] JUPITER_API_KEY not configured. Falling back to Tokens V2 API.');
        return this.searchTokensV2(query, limit);
      }

      const url = `${JUPITER_ULTRA_SEARCH_API}?query=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'x-api-key': JUPITER_API_KEY,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`[JupiterTokenProvider] Ultra Search API failed (${response.status}), falling back to V2 API`);
        return this.searchTokensV2(query, limit);
      }

      const tokens: JupiterUltraSearchToken[] = await response.json();
      
      return this.transformUltraTokens(tokens.slice(0, limit));
    } catch (error: any) {
      console.error('[JupiterTokenProvider] Error in Ultra Search API:', error);
      // Fallback to V2 API
      return this.searchTokensV2(query, limit);
    }
  }

  /**
   * Search tokens using Jupiter Tokens V2 Search API (fallback)
   */
  private async searchTokensV2(query: string, limit: number = 20): Promise<ProviderToken[]> {
    try {
      const url = `${JUPITER_TOKENS_V2_SEARCH_API}?query=${encodeURIComponent(query)}`;
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };
      
      if (JUPITER_API_KEY) {
        headers['x-api-key'] = JUPITER_API_KEY;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Jupiter V2 Search API failed: ${response.statusText}`);
      }

      const tokens: JupiterTokensV2Token[] = await response.json();
      
      return this.transformV2Tokens(tokens.slice(0, limit));
    } catch (error: any) {
      console.error('[JupiterTokenProvider] Error in V2 Search API:', error);
      return [];
    }
  }

  /**
   * Get top tokens using Jupiter category endpoints
   */
  private async getTopTokens(limit: number = 50): Promise<ProviderToken[]> {
    try {
      // Use toptraded/24h for most traded tokens
      const url = `${JUPITER_TOKENS_V2_CATEGORY_API}/toptraded/24h?limit=${limit}`;
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };
      
      if (JUPITER_API_KEY) {
        headers['x-api-key'] = JUPITER_API_KEY;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Jupiter Category API failed: ${response.statusText}`);
      }

      const tokens: JupiterTokensV2Token[] = await response.json();
      
      return this.transformV2Tokens(tokens);
    } catch (error: any) {
      console.error('[JupiterTokenProvider] Error fetching top tokens:', error);
      return [];
    }
  }

  /**
   * Transform Jupiter Ultra Search tokens to ProviderToken format
   * The raw field contains the full Ultra API response for execute route usage
   */
  private transformUltraTokens(tokens: JupiterUltraSearchToken[]): ProviderToken[] {
    return tokens.map(token => {
      // Normalize SOL address (ensure we use Jupiter format)
      const address = token.id === '11111111111111111111111111111111' 
        ? NATIVE_SOL_MINT 
        : token.id;

      return {
        address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.icon || '',
        priceUSD: token.usdPrice?.toString() || '0',
        chainId: SOLANA_CHAIN_ID,
        verified: token.isVerified || false,
        // Raw field contains full Ultra API response - needed for execute route
        // This includes all metadata: stats, audit, organicScore, liquidity, etc.
        raw: token,
      };
    });
  }

  /**
   * Transform Jupiter Tokens V2 tokens to ProviderToken format
   * The raw field contains the full V2 API response for execute route usage
   */
  private transformV2Tokens(tokens: JupiterTokensV2Token[]): ProviderToken[] {
    return tokens.map(token => {
      // Normalize SOL address (ensure we use Jupiter format)
      const address = token.id === '11111111111111111111111111111111' 
        ? NATIVE_SOL_MINT 
        : token.id;

      return {
        address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.icon || '',
        priceUSD: token.usdPrice?.toString() || '0',
        chainId: SOLANA_CHAIN_ID,
        verified: token.isVerified || false,
        // Raw field contains full V2 API response - needed for execute route
        // This includes metadata: stats24h, audit, organicScore, liquidity, etc.
        raw: token,
      };
    });
  }

  async fetchChains(): Promise<ProviderChain[]> {
    // Jupiter only supports Solana
    const canonicalChain = getCanonicalChain(SOLANA_CHAIN_ID);
    if (!canonicalChain) {
      return [];
    }

    return [{
      id: SOLANA_CHAIN_ID,
      name: canonicalChain.name,
      type: 'Solana',
      logoURI: canonicalChain.logoURI,
      nativeCurrency: canonicalChain.nativeCurrency,
      raw: canonicalChain,
    }];
  }

  normalizeToken(token: ProviderToken, canonicalChain: CanonicalChain): NormalizedToken {
    return {
      chainId: canonicalChain.id,
      address: token.address, // Already in Jupiter format (So111...11112)
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.logoURI || '',
      priceUSD: token.priceUSD || '0',
      providers: [this.name],
      verified: token.verified || false,
      vmType: 'solana',
      chainBadge: getChainBadge(canonicalChain),
      chainName: canonicalChain.name,
    };
  }

  normalizeChain(chain: ProviderChain): CanonicalChain | null {
    // Jupiter only supports Solana
    if (chain.id === SOLANA_CHAIN_ID) {
      return getCanonicalChain(SOLANA_CHAIN_ID);
    }
    return null;
  }
}

