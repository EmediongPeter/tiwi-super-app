# Token Aggregation & Chain Resolution Service - Architecture Proposal

## Executive Summary

This document proposes a clean, scalable backend architecture for token aggregation that addresses chain identity resolution, provider abstraction, and extensibility for future multi-chain expansion.

**Status:** ⛔ **PROPOSAL - AWAITING APPROVAL**

---

## 1. System Analysis: Existing Implementation (`tiwi-test`)

### 1.1 What Works Well ✅

1. **Bridge Mappers Pattern** (`bridge-mappers.ts`)
   - Concept of mapping internal chain IDs to provider-specific IDs
   - Functions like `toLifiChainId()`, `toSquidChainIdOrKey()` show good abstraction intent
   - **Keep:** This pattern, but make it more systematic

2. **Normalization Functions** (`squid-chains.ts`)
   - `normalizeSquidChain()`, `normalizeSquidToken()` show good data transformation
   - Deduplication logic (`normalizeAndDeduplicateTokens`)
   - **Keep:** Normalization pattern, but generalize for all providers

3. **API Routes Pattern** (`/api/squid/tokens`)
   - Server-side provider access via Next.js API routes
   - Good separation of client/server concerns
   - **Keep:** This pattern, but unify under a single entry point

### 1.2 What Needs Improvement ⚠️

1. **Chain ID Mapping Scattered**
   - `bridge-mappers.ts` has LiFi/Squid mappings
   - `squid-chains.ts` has `WELL_KNOWN_CHAIN_NAMES` hardcoded
   - `dexscreener.ts` has `chainIdToDexScreener` mapping
   - **Problem:** No single source of truth for chain identity
   - **Solution:** Centralized chain registry with provider mappings

2. **String-to-Number Hashing** (`hashStringToNumber`)
   - Used for Cosmos chains like "osmosis-1" → numeric ID
   - **Problem:** Fragile, collision-prone, hard to debug
   - **Solution:** Explicit chain registry with stable numeric IDs

3. **Provider Logic in Components**
   - `TokenSelector.tsx` has provider selection logic (DexScreener → LiFi → Squid)
   - `SwapInterface.tsx` duplicates token fetching logic
   - **Problem:** Business logic leaks into UI layer
   - **Solution:** Backend handles aggregation, frontend receives unified data

4. **No Unified Token Model**
   - DexScreener returns `DexScreenerTokenData`
   - Squid returns `NormalizedSquidToken`
   - LiFi returns `Token` (from SDK)
   - **Problem:** Frontend must handle multiple formats
   - **Solution:** Single canonical token DTO from backend

5. **Provider-Specific API Routes**
   - `/api/squid/tokens`, `/api/squid/chains`
   - **Problem:** Frontend must know which provider to call
   - **Solution:** Single `/api/tokens` route with provider abstraction

---

## 2. Proposed Architecture

### 2.1 Core Principles

1. **Single Source of Truth for Chains**
   - Centralized chain registry
   - Canonical internal chain representation
   - Provider-specific mappings stored explicitly

2. **Provider Abstraction Layer**
   - Providers are pluggable modules
   - No provider logic leaks outside abstraction
   - Easy to add new providers (Squid, Sui, TON, etc.)

3. **Unified Data Model**
   - Single token DTO for frontend
   - Single chain DTO for frontend
   - Provider responses normalized before aggregation

4. **Explicit Chain Identity Resolution**
   - No magic hashing or implicit conversions
   - Chain identity is explicit and traceable
   - Provider-specific IDs mapped explicitly

---

## 3. Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                        │
│  (Token Selector, Swap UI, etc.)                         │
│  - Calls single API endpoint                             │
│  - Receives unified token/chain DTOs                     │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              API Route Layer                            │
│  /api/tokens?chainId=1&search=USDC                      │
│  /api/chains                                            │
│  - Single entry point                                   │
│  - Query parameter routing                              │
│  - Error handling & validation                          │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│          Aggregation Service Layer                       │
│  - Fetches from multiple providers                       │
│  - Deduplicates tokens                                  │
│  - Prioritizes sources                                  │
│  - Returns unified DTOs                                 │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│         Provider Abstraction Layer                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  LiFi    │  │DexScreener│  │  Relay   │              │
│  │ Provider │  │ Provider │  │ Provider │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│  - Normalizes provider responses                        │
│  - Maps chain IDs                                       │
│  - Handles provider quirks                             │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│         Chain Registry Layer                            │
│  - Canonical chain definitions                          │
│  - Provider-specific chain ID mappings                  │
│  - Chain metadata (name, logo, type)                    │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Component Design

### 4.1 Chain Registry (`lib/chains/registry.ts`)

**Purpose:** Single source of truth for chain identity and provider mappings.

```typescript
// Canonical chain representation
export interface CanonicalChain {
  id: number;                    // Our internal numeric ID (stable, never changes)
  name: string;                  // Display name
  type: 'EVM' | 'Solana' | 'Cosmos' | 'Sui' | 'TON' | 'Bitcoin';
  logoURI?: string;
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
  
  // Additional chain metadata (for app chains, Cosmos chains, etc.)
  metadata?: {
    chainId?: string;            // Native chain ID (e.g., "osmosis-1", "cosmoshub-4")
    rpcUrl?: string;             // RPC endpoint
    explorerUrl?: string;        // Block explorer URL
    [key: string]: any;          // Additional chain-specific metadata
  };
  
  // Provider-specific chain identifiers
  providerIds: {
    lifi?: number | string;      // LiFi chain ID (numeric or special like Solana)
    squid?: string;              // Squid chain key (e.g., "solana-mainnet-beta", "56")
    dexscreener?: string;         // DexScreener chain slug (e.g., "ethereum", "bsc", "solana")
    relay?: number;              // Relay chain ID (numeric)
    // Future: sui, ton, etc.
  };
}

// Example:
const ETHEREUM: CanonicalChain = {
  id: 1,
  name: 'Ethereum',
  type: 'EVM',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  providerIds: {
    lifi: 1,
    squid: '1',
    dexscreener: 'ethereum',
    relay: 1,
  },
};

const SOLANA: CanonicalChain = {
  id: 7565164,  // Stable numeric ID (not hashed)
  name: 'Solana',
  type: 'Solana',
  nativeCurrency: { symbol: 'SOL', decimals: 9 },
  providerIds: {
    lifi: 1151111081099710,  // LiFi's special Solana ID
    squid: 'solana-mainnet-beta',
    dexscreener: null,  // Not supported
    relay: 792703809,
  },
};

const OSMOSIS: CanonicalChain = {
  id: 2,  // Stable numeric ID (not hashed from string)
  name: 'Osmosis',
  type: 'Cosmos',
  nativeCurrency: { symbol: 'OSMO', decimals: 6 },
  metadata: {
    chainId: 'osmosis-1',  // Native Cosmos chain ID
    rpcUrl: 'https://rpc.osmosis.zone',
    explorerUrl: 'https://www.mintscan.io/osmosis',
  },
  providerIds: {
    lifi: null,  // Not supported
    squid: 'osmosis-1',  // Squid uses string key
    dexscreener: null,
    relay: null,
  },
};

// Example: Another Cosmos app chain
const JUNO: CanonicalChain = {
  id: 3,
  name: 'Juno',
  type: 'CosmosAppChain',
  nativeCurrency: { symbol: 'JUNO', decimals: 6 },
  metadata: {
    chainId: 'juno-1',
    rpcUrl: 'https://rpc-juno.itastakers.com',
  },
  providerIds: {
    lifi: null,
    squid: 'juno-1',
    dexscreener: null,
    relay: null,
  },
};
```

**Key Design Decisions:**
- **Stable numeric IDs:** No hashing, explicit assignment
- **Provider IDs nullable:** Not all providers support all chains
- **Type-safe:** TypeScript ensures provider ID types match provider expectations

---

### 4.2 Provider Abstraction (`lib/providers/base.ts`)

**Purpose:** Abstract interface that all providers implement.

```typescript
export interface TokenProvider {
  name: string;
  
  // Get provider-specific chain ID for a canonical chain
  getChainId(canonicalChain: CanonicalChain): string | number | null;
  
  // Fetch tokens for a chain
  fetchTokens(params: {
    chainId: string | number;  // Provider-specific chain ID
    search?: string;           // Optional search query
  }): Promise<ProviderToken[]>;
  
  // Fetch all supported chains
  fetchChains(): Promise<ProviderChain[]>;
  
  // Normalize provider token to canonical format
  normalizeToken(token: ProviderToken, canonicalChain: CanonicalChain): NormalizedToken;
  
  // Normalize provider chain to canonical format
  normalizeChain(chain: ProviderChain): CanonicalChain | null;
}

// Provider-specific token (raw from API)
export interface ProviderToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  priceUSD?: string;
  chainId?: string | number;  // Provider's chain identifier (for chain detection)
  volume24h?: number;         // 24h volume (from DexScreener)
  liquidity?: number;          // Liquidity in USD (from DexScreener)
  marketCap?: number;          // Market cap (from DexScreener)
  // Provider-specific fields stored here
  [key: string]: any;
}

// Provider-specific chain (raw from API)
export interface ProviderChain {
  chainId: string | number;
  name?: string;
  // Provider-specific fields stored here
  [key: string]: any;
}
```

---

### 4.3 Provider Implementations

#### 4.3.1 LiFi Provider (`lib/providers/lifi.ts`)

```typescript
import { getTokens, getChains } from '@lifi/sdk';
import { TokenProvider, ProviderToken, ProviderChain } from './base';
import { CanonicalChain } from '../chains/registry';

export class LiFiProvider implements TokenProvider {
  name = 'lifi';
  
  getChainId(canonicalChain: CanonicalChain): number | null {
    return canonicalChain.providerIds.lifi ?? null;
  }
  
  async fetchTokens(params: { chainId: number; search?: string }): Promise<ProviderToken[]> {
    const response = await getTokens({ chains: [params.chainId] });
    const tokens = response.tokens[params.chainId] || [];
    
    // Apply search filter if provided
    if (params.search) {
      const query = params.search.toLowerCase();
      return tokens.filter(t => 
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.address.toLowerCase().includes(query)
      );
    }
    
    return tokens;
  }
  
  async fetchChains(): Promise<ProviderChain[]> {
    const chains = await getChains();
    return chains.map(chain => ({
      chainId: chain.id,
      name: chain.name,
      // Store raw LiFi chain for normalization
      raw: chain,
    }));
  }
  
  normalizeToken(token: ProviderToken, canonicalChain: CanonicalChain): NormalizedToken {
    return {
      chainId: canonicalChain.id,  // Use canonical ID
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.deimals,
      logoURI: token.logoURI || '',
      priceUSD: token.priceUSD || '0',
      providers: ['lifi'],  // Track which providers have this token
    };
  }
  
  normalizeChain(chain: ProviderChain): CanonicalChain | null {
    // Lookup canonical chain by LiFi chain ID
    return getCanonicalChainByProviderId('lifi', chain.chainId);
  }
}
```

#### 4.3.2 DexScreener Provider (`lib/providers/dexscreener.ts`)

**Note:** DexScreener API structure clarified (see Section 10.4)

```typescript
// DexScreener API response types
interface DexScreenerPair {
  chainId: string;  // e.g., "solana", "ethereum", "bsc" (string, not number)
  dexId: string;
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
  priceUsd: string;
  priceNative: string;
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  marketCap?: number;
  fdv?: number;
  info?: {
    imageUrl?: string;
    websites?: Array<{ url: string; label: string }>;
    socials?: Array<{ url: string; type: string }>;
  };
  [key: string]: any;
}

interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[];
}

export class DexScreenerProvider implements TokenProvider {
  name = 'dexscreener';
  
  getChainId(canonicalChain: CanonicalChain): string | null {
    return canonicalChain.providerIds.dexscreener ?? null;
  }
  
  async fetchTokens(params: { chainId?: string; search?: string }): Promise<ProviderToken[]> {
    // DexScreener search endpoint: https://api.dexscreener.com/latest/dex/search?q={query}
    // Returns pairs across all chains, filtered by chainId in response
    
    let url: string;
    if (params.search && params.search.startsWith('0x')) {
      // Token address search
      url = `https://api.dexscreener.com/latest/dex/tokens/${params.search}`;
    } else if (params.search) {
      // General search (token name, symbol)
      url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(params.search)}`;
    } else if (params.chainId) {
      // Chain-specific: search by chain slug
      url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(params.chainId)}`;
    } else {
      return [];  // Need either chainId or search
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status} ${response.statusText}`);
    }
    
    const data: DexScreenerResponse = await response.json();
    const tokensMap = new Map<string, ProviderToken>();
    
    if (data.pairs && Array.isArray(data.pairs)) {
      for (const pair of data.pairs) {
        // Filter by chainId if specified
        if (params.chainId && pair.chainId !== params.chainId) continue;
        
        // Extract base token
        if (pair.baseToken) {
          const baseKey = `${pair.chainId}:${pair.baseToken.address.toLowerCase()}`;
          if (!tokensMap.has(baseKey)) {
            tokensMap.set(baseKey, {
              address: pair.baseToken.address,
              symbol: pair.baseToken.symbol,
              name: pair.baseToken.name,
              decimals: 18,  // Default, may need contract call for exact decimals
              logoURI: pair.info?.imageUrl || '',  // Use imageUrl from info
              priceUSD: pair.priceUsd || '0',
              chainId: pair.chainId,  // Store DexScreener chainId for chain detection
              volume24h: pair.volume?.h24 || 0,
              liquidity: pair.liquidity?.usd || 0,
              marketCap: pair.marketCap,
              raw: pair,  // Store full pair data
            });
          }
        }
        
        // Extract quote token
        if (pair.quoteToken) {
          const quoteKey = `${pair.chainId}:${pair.quoteToken.address.toLowerCase()}`;
          if (!tokensMap.has(quoteKey)) {
            tokensMap.set(quoteKey, {
              address: pair.quoteToken.address,
              symbol: pair.quoteToken.symbol,
              name: pair.quoteToken.name,
              decimals: 18,
              logoURI: pair.info?.imageUrl || '',
              priceUSD: pair.priceUsd || '0',
              chainId: pair.chainId,
              volume24h: pair.volume?.h24 || 0,
              liquidity: pair.liquidity?.usd || 0,
              marketCap: pair.marketCap,
              raw: pair,
            });
          }
        }
      }
    }
    
    return Array.from(tokensMap.values());
  }
  
  async fetchChains(): Promise<ProviderChain[]> {
    // DexScreener doesn't have a chains endpoint
    // Return chains we know DexScreener supports (from registry)
    return getCanonicalChains()
      .filter(chain => chain.providerIds.dexscreener !== null)
      .map(chain => ({
        chainId: chain.providerIds.dexscreener!,
        name: chain.name,
      }));
  }
  
  normalizeToken(token: ProviderToken, canonicalChain: CanonicalChain): NormalizedToken {
    // CRITICAL: Detect chain from DexScreener's chainId field
    // DexScreener returns pairs with chainId like "solana", "ethereum", "bsc"
    // We need to map this to our canonical chain for proper chain badge display
    const detectedChain = this.detectChainFromDexScreenerChainId(token.chainId || '');
    const finalChain = detectedChain || canonicalChain;
    
    return {
      chainId: finalChain.id,  // Use detected chain ID (for chain badge)
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.logoURI || token.raw?.info?.imageUrl || '',
      priceUSD: token.priceUSD || '0',
      providers: ['dexscreener'],
      // Additional metadata from DexScreener
      volume24h: token.volume24h,
      liquidity: token.liquidity,
      marketCap: token.marketCap,
      // Chain detection metadata for UI
      chainBadge: getChainBadge(finalChain),  // For UI chain badge display
      chainName: finalChain.name,  // Chain display name
    };
  }
  
  /**
   * Detect canonical chain from DexScreener's chainId string
   * DexScreener uses string chain IDs like "solana", "ethereum", "bsc"
   * This is critical for proper chain badge display in the UI
   */
  private detectChainFromDexScreenerChainId(dexChainId: string): CanonicalChain | null {
    if (!dexChainId) return null;
    
    // Map DexScreener chain IDs to canonical chains via registry
    return getCanonicalChainByProviderId('dexscreener', dexChainId);
  }
  
  normalizeChain(chain: ProviderChain): CanonicalChain | null {
    return getCanonicalChainByProviderId('dexscreener', chain.chainId);
  }
}
```

#### 4.3.3 Relay Provider (`lib/providers/relay.ts`)

**Note:** Relay API structure clarified (see Section 10.1)

```typescript
export class RelayProvider implements TokenProvider {
  name = 'relay';
  private readonly API_BASE = 'https://api.relay.link/currencies/v2';
  
  getChainId(canonicalChain: CanonicalChain): number | null {
    // Relay uses numeric chain IDs (same as canonical for EVM, special for Solana)
    return canonicalChain.providerIds.relay ?? null;
  }
  
  async fetchTokens(params: { 
    chainIds: number[];  // Relay supports multiple chains in one request
    term?: string;
    limit?: number;
  }): Promise<ProviderToken[]> {
    try {
      const response = await fetch(this.API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chainIds: params.chainIds,
          term: params.term || '',
          defaultList: false,
          limit: params.limit || 30,  // Relay's default limit
          depositAddressOnly: false,
          referrer: 'tiwi-protocol',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Relay API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Relay returns array of tokens directly
      if (Array.isArray(data)) {
        return data.map(token => ({
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.metadata?.logoURI || '',
          priceUSD: '0',  // Relay doesn't provide price
          verified: token.metadata?.verified || false,
          vmType: token.vmType,
          raw: token,  // Store raw Relay response
        }));
      }
      
      return [];
    } catch (error) {
      console.error('[Relay Provider] Error fetching tokens:', error);
      return [];
    }
  }
  
  async fetchChains(): Promise<ProviderChain[]> {
    // Relay doesn't have a dedicated chains endpoint
    // We'll use our chain registry to determine which chains Relay supports
    return getCanonicalChains()
      .filter(chain => chain.providerIds.relay !== null)
      .map(chain => ({
        chainId: chain.providerIds.relay!,
        name: chain.name,
      }));
  }
  
  normalizeToken(token: ProviderToken, canonicalChain: CanonicalChain): NormalizedToken {
    return {
      chainId: canonicalChain.id,
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.logoURI || '',
      priceUSD: token.priceUSD || '0',
      providers: ['relay'],
      verified: token.verified || false,  // Relay provides verification status
      chainBadge: getChainBadge(canonicalChain),  // For UI chain badge display
      chainName: canonicalChain.name,  // Chain display name
    };
  }
  
  normalizeChain(chain: ProviderChain): CanonicalChain | null {
    return getCanonicalChainByProviderId('relay', chain.chainId);
  }
}
```

**Key Implementation Notes:**
- Relay supports **multiple chainIds in a single request** - this is powerful!
- Relay uses numeric chain IDs (mapped in our registry)
- Relay returns tokens directly as an array
- Relay provides `metadata.verified` flag - we should preserve this
- Relay doesn't provide price data - we'll need to get it from other providers or we can keep it null

---

### 4.4 Aggregation Service (`lib/services/token-aggregator.ts`)

**Update:** Service should support Relay's multi-chain request pattern.

**Purpose:** Orchestrates multiple providers, deduplicates, and prioritizes.

```typescript
import { TokenProvider } from '../providers/base';
import { CanonicalChain, getCanonicalChain, getCanonicalChains } from '../chains/registry';
import { NormalizedToken } from '../types/tokens';

export interface AggregationOptions {
  providers?: string[];  // Optional: restrict to specific providers
  priority?: string[];    // Provider priority order (default: ['dexscreener', 'lifi', 'relay'])
  deduplicateBy?: 'address' | 'symbol';  // How to deduplicate (default: 'address')
}

export class TokenAggregator {
  private providers: Map<string, TokenProvider> = new Map();
  
  registerProvider(provider: TokenProvider): void {
    this.providers.set(provider.name, provider);
  }
  
  async fetchTokens(
    chainId: number,  // Canonical chain ID
    options: AggregationOptions & { search?: string } = {}
  ): Promise<NormalizedToken[]> {
    const canonicalChain = getCanonicalChain(chainId);
    if (!canonicalChain) {
      throw new Error(`Chain ${chainId} not found in registry`);
    }
    
    const providersToUse = options.providers || Array.from(this.providers.keys());
    const priority = options.priority || ['dexscreener', 'lifi', 'relay'];
    
    // Sort providers by priority
    const sortedProviders = providersToUse.sort((a, b) => {
      const aIndex = priority.indexOf(a);
      const bIndex = priority.indexOf(b);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
    
    // Fetch from all providers in parallel
    const results = await Promise.allSettled(
      sortedProviders.map(async (providerName) => {
        const provider = this.providers.get(providerName);
        if (!provider) return [];
        
        const providerChainId = provider.getChainId(canonicalChain);
        if (!providerChainId) return [];  // Provider doesn't support this chain
        
        const tokens = await provider.fetchTokens({ chainId: providerChainId });
        return tokens.map(token => provider.normalizeToken(token, canonicalChain));
      })
    );
    
    // Aggregate and deduplicate
    const tokenMap = new Map<string, NormalizedToken>();
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const token of result.value) {
          const key = options.deduplicateBy === 'symbol'
            ? `${token.chainId}:${token.symbol.toLowerCase()}`
            : `${token.chainId}:${token.address.toLowerCase()}`;
          
          if (tokenMap.has(key)) {
            // Merge providers list
            const existing = tokenMap.get(key)!;
            existing.providers = [...new Set([...existing.providers, ...token.providers])];
            // Prefer non-empty logoURI and priceUSD
            if (!existing.logoURI && token.logoURI) existing.logoURI = token.logoURI;
            if (existing.priceUSD === '0' && token.priceUSD !== '0') existing.priceUSD = token.priceUSD;
          } else {
            tokenMap.set(key, token);
          }
        }
      }
    }
    
    return Array.from(tokenMap.values());
  }
  
  async fetchTokensForMultipleChains(
    chainIds: number[],  // Array of canonical chain IDs
    options: AggregationOptions & { search?: string; limit?: number } = {}
  ): Promise<NormalizedToken[]> {
    // Special handling for Relay: it can fetch multiple chains in one request
    // Other providers need separate calls per chain
    
    const relayProvider = this.providers.get('relay');
    const otherProviders = Array.from(this.providers.entries())
      .filter(([name]) => name !== 'relay')
      .map(([, provider]) => provider);
    
    const results: Promise<NormalizedToken[]>[] = [];
    
    // Relay: Single request for all chains
    if (relayProvider) {
      const relayChainIds = chainIds
        .map(id => {
          const chain = getCanonicalChain(id);
          if (!chain) return null;
          const relayId = relayProvider.getChainId(chain);
          return typeof relayId === 'number' ? relayId : null;
        })
        .filter((id): id is number => id !== null);
      
      if (relayChainIds.length > 0) {
        results.push(
          relayProvider.fetchTokens({
            chainIds: relayChainIds,
            term: options.search,
            limit: options.limit,
          }).then(tokens => 
            chainIds.map(chainId => {
              const chain = getCanonicalChain(chainId);
              return tokens
                .filter(t => {
                  // Map Relay chainId back to canonical
                  const relayId = chain?.providerIds.relay;
                  return t.raw?.chainId === relayId;
                })
                .map(token => relayProvider.normalizeToken(token, chain!));
            }).flat()
          )
        );
      }
    }
    
    // Other providers: One request per chain
    for (const provider of otherProviders) {
      for (const chainId of chainIds) {
        const chain = getCanonicalChain(chainId);
        if (!chain) continue;
        
        const providerChainId = provider.getChainId(chain);
        if (!providerChainId) continue;
        
        results.push(
          provider.fetchTokens({
            chainId: providerChainId,
            search: options.search,
          }).then(tokens =>
            tokens.map(token => provider.normalizeToken(token, chain))
          )
        );
      }
    }
    
    // Aggregate all results
    const allResults = await Promise.allSettled(results);
    const tokenMap = new Map<string, NormalizedToken>();
    
    for (const result of allResults) {
      if (result.status === 'fulfilled') {
        for (const token of result.value) {
          const key = `${token.chainId}:${token.address.toLowerCase()}`;
          
          if (tokenMap.has(key)) {
            const existing = tokenMap.get(key)!;
            existing.providers = [...new Set([...existing.providers, ...token.providers])];
            if (!existing.logoURI && token.logoURI) existing.logoURI = token.logoURI;
            if (existing.priceUSD === '0' && token.priceUSD !== '0') existing.priceUSD = token.priceUSD;
          } else {
            tokenMap.set(key, token);
          }
        }
      }
    }
    
    let tokens = Array.from(tokenMap.values());
    
    // Apply search filter if provided
    if (options.search) {
      const queryLower = options.search.toLowerCase();
      tokens = tokens.filter(token =>
        token.symbol.toLowerCase().includes(queryLower) ||
        token.name.toLowerCase().includes(queryLower) ||
        token.address.toLowerCase().includes(queryLower)
      );
    }
    
    // Apply limit
    if (options.limit && options.limit > 0) {
      tokens = tokens.slice(0, options.limit);
    }
    
    return tokens;
  }
  
  async searchTokens(
    query: string,
    chainId?: number,  // Optional: search within specific chain
    options: AggregationOptions = {}
  ): Promise<NormalizedToken[]> {
    const chainsToSearch = chainId 
      ? [getCanonicalChain(chainId)!]
      : getCanonicalChains();
    
    // Use multi-chain fetch if multiple chains
    if (chainsToSearch.length > 1) {
      return this.fetchTokensForMultipleChains(
        chainsToSearch.map(c => c.id),
        { ...options, search: query }
      );
    }
    
    // Single chain: use regular fetch
    return this.fetchTokens(chainsToSearch[0].id, { ...options, search: query });
  }
  
  async fetchChains(): Promise<CanonicalChain[]> {
    // Return all chains from registry (single source of truth)
    return getCanonicalChains();
  }
}
```

---

### 4.5 API Route (`app/api/tokens/route.ts`)

**Purpose:** Single entry point for token fetching.

**Design Inspiration:** Relay's API structure (see Section 10.1)

**Response Strategy:**
1. **Immediate Response:** Return Relay's tokens first (fast multi-chain response)
2. **Progressive Updates:** Stream other providers' tokens as they arrive
3. **Final Aggregation:** Frontend merges and deduplicates all tokens

**Implementation Options:**
- **Option A:** Server-Sent Events (SSE) - Stream updates to frontend
- **Option B:** Two-phase response - Return Relay immediately, then second response with all providers
- **Option C:** Single response with priority ordering - Relay tokens first, then others (simpler, but slower)

**Recommended:** Option A (SSE) for best UX, Option C for simpler implementation initially.

**Proposed API Design (Inspired by Relay):**

**Option A: POST with Body (Like Relay)**
```typescript
// POST /api/tokens
// Body: { chainIds: [1, 56], term: "USDC", limit: 100 }
```

**Option B: GET with Query Params (More RESTful)**
```typescript
// GET /api/tokens?chainIds=1,56&term=USDC&limit=100
```

**Option C: Hybrid (Support Both)**
```typescript
// GET /api/tokens?chainIds=1,56&term=USDC&limit=100
// POST /api/tokens (with body)
```

**Recommended: Option C (Hybrid)** - Most flexible, supports both patterns.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { TokenAggregator } from '@/lib/services/token-aggregator';
import { LiFiProvider } from '@/lib/providers/lifi';
import { DexScreenerProvider } from '@/lib/providers/dexscreener';
import { RelayProvider } from '@/lib/providers/relay';

// Initialize aggregator (singleton pattern)
let aggregator: TokenAggregator | null = null;

function getAggregator(): TokenAggregator {
  if (!aggregator) {
    aggregator = new TokenAggregator();
    aggregator.registerProvider(new LiFiProvider());
    aggregator.registerProvider(new DexScreenerProvider());
    aggregator.registerProvider(new RelayProvider());
  }
  return aggregator;
}

// Request interface (inspired by Relay)
interface TokenRequest {
  chainIds?: number[];        // Array of canonical chain IDs (empty = all chains)
  term?: string;              // Search term (empty string = no search)
  limit?: number;             // Result limit (default: no limit)
  providers?: string[];       // Optional: restrict to specific providers
}

// GET /api/tokens?chainIds=1,56&term=USDC&limit=100
// POST /api/tokens (with body)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Parse chainIds (comma-separated)
    const chainIdsParam = searchParams.get('chainIds');
    const chainIds = chainIdsParam
      ? chainIdsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
      : undefined;
    
    const term = searchParams.get('term') || searchParams.get('search') || searchParams.get('q') || '';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    
    return await handleTokenRequest({ chainIds, term, limit });
  } catch (error: any) {
    console.error('[API] /api/tokens GET error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch tokens', tokens: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: TokenRequest = await req.json();
    return await handleTokenRequest(body);
  } catch (error: any) {
    console.error('[API] /api/tokens POST error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch tokens', tokens: [] },
      { status: 500 }
    );
  }
}

async function handleTokenRequest(params: TokenRequest) {
  const { chainIds, term = '', limit, providers } = params;
  const aggregator = getAggregator();
  
  // Determine chains to search
  const chainsToSearch = chainIds && chainIds.length > 0
    ? chainIds.map(id => getCanonicalChain(id)).filter(Boolean) as CanonicalChain[]
    : getCanonicalChains();  // All chains if none specified
  
  // OPTIMIZATION: Fetch Relay first (multi-chain, fast response)
  const relayProvider = aggregator.getProvider('relay');
  let relayTokens: NormalizedToken[] = [];
  
  if (!providers || providers.includes('relay')) {
    try {
      const relayChainIds = chainsToSearch
        .map(chain => {
          const relayId = relayProvider?.getChainId(chain);
          return typeof relayId === 'number' ? relayId : null;
        })
        .filter((id): id is number => id !== null);
      
      if (relayChainIds.length > 0) {
        const relayResponse = await relayProvider.fetchTokens({
          chainIds: relayChainIds,
          term: term || undefined,
          limit: limit,
        });
        
        // Map Relay tokens back to canonical chain IDs
        relayTokens = relayResponse.map(token => {
          const canonicalChain = chainsToSearch.find(chain => 
            chain.providerIds.relay === token.raw?.chainId
          );
          if (!canonicalChain) return null;
          return relayProvider.normalizeToken(token, canonicalChain);
        }).filter((t): t is NormalizedToken => t !== null);
      }
    } catch (error) {
      console.error('[API] Relay fetch error:', error);
      // Continue with other providers
    }
  }
  
  // Fetch from other providers in parallel (LiFi, DexScreener)
  const otherProviders = providers 
    ? providers.filter(p => p !== 'relay').map(p => aggregator.getProvider(p))
    : ['lifi', 'dexscreener'].map(p => aggregator.getProvider(p));
  
  const otherResults = await Promise.allSettled(
    chainsToSearch.flatMap(chain =>
      otherProviders.map(async (provider) => {
        if (!provider) return [];
        const providerChainId = provider.getChainId(chain);
        if (!providerChainId) return [];
        
        const tokens = await provider.fetchTokens({
          chainId: providerChainId,
          search: term || undefined,
        });
        return tokens.map(token => provider.normalizeToken(token, chain));
      })
    )
  );
  
  // Aggregate other providers' tokens
  const otherTokens: NormalizedToken[] = [];
  for (const result of otherResults) {
    if (result.status === 'fulfilled') {
      otherTokens.push(...result.value);
    }
  }
  
  // Merge Relay tokens first (priority), then others
  const tokenMap = new Map<string, NormalizedToken>();
  
  // Add Relay tokens first (they have priority)
  for (const token of relayTokens) {
    const key = `${token.chainId}:${token.address.toLowerCase()}`;
    tokenMap.set(key, token);
  }
  
  // Add other providers' tokens (merge if exists, add if new)
  for (const token of otherTokens) {
    const key = `${token.chainId}:${token.address.toLowerCase()}`;
    if (tokenMap.has(key)) {
      const existing = tokenMap.get(key)!;
      existing.providers = [...new Set([...existing.providers, ...token.providers])];
      // Prefer non-empty logoURI and priceUSD from other providers
      if (!existing.logoURI && token.logoURI) existing.logoURI = token.logoURI;
      if (existing.priceUSD === '0' && token.priceUSD !== '0') existing.priceUSD = token.priceUSD;
    } else {
      tokenMap.set(key, token);
    }
  }
  
  let tokens = Array.from(tokenMap.values());
  
  // Apply search filter if term provided (should already be filtered, but double-check)
  if (term) {
    const termLower = term.toLowerCase();
    tokens = tokens.filter(token =>
      token.symbol.toLowerCase().includes(termLower) ||
      token.name.toLowerCase().includes(termLower) ||
      token.address.toLowerCase().includes(termLower)
    );
  }
  
  // Apply limit
  if (limit && limit > 0) {
    tokens = tokens.slice(0, limit);
  }
  
  // Return in Relay-inspired format (predictable structure)
  return NextResponse.json({
    tokens: tokens.map(token => ({
      chainId: token.chainId,
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      vmType: getVmType(token.chainId),  // 'evm' | 'solana' | 'cosmos' | etc.
      metadata: {
        logoURI: token.logoURI || '',
        verified: token.providers.length > 1 || token.verified || false,  // Verified if multiple providers or Relay verified
      },
    })),
    total: tokens.length,
    chainIds: chainIds || [],
    term: term || '',
    limit: limit || null,
  });
}

function getVmType(chainId: number): string {
  const chain = getCanonicalChain(chainId);
  if (!chain) return 'unknown';
  
  switch (chain.type) {
    case 'EVM': return 'evm';
    case 'Solana': return 'solana';
    case 'Cosmos': return 'cosmos';
    case 'Sui': return 'sui';
    case 'TON': return 'ton';
    case 'Bitcoin': return 'bitcoin';
    default: return 'unknown';
  }
}
```

---

### 4.6 Chains API Route (`app/api/chains/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { TokenAggregator } from '@/lib/services/token-aggregator';
import { getAggregator } from './tokens/route';  // Reuse aggregator

// GET /api/chains
export async function GET(req: NextRequest) {
  try {
    const aggregator = getAggregator();
    const chains = await aggregator.fetchChains();
    
    return NextResponse.json({
      chains,
      total: chains.length,
    });
  } catch (error: any) {
    console.error('[API] /api/chains error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch chains', chains: [] },
      { status: 500 }
    );
  }
}
```

---

### 4.7 Data Types (`lib/types/tokens.ts`)

```typescript
// Unified token DTO (what frontend receives)
// Structure inspired by Relay's predictable format
export interface NormalizedToken {
  chainId: number;           // Canonical chain ID (for chain badge display)
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  priceUSD: string;
  providers: string[];        // Which providers have this token (e.g., ['dexscreener', 'lifi'])
  verified?: boolean;         // Verification status (from Relay or multiple providers)
  vmType?: string;            // 'evm' | 'solana' | 'cosmos' | etc. (from Relay)
  
  // Additional metadata (from DexScreener)
  volume24h?: number;         // 24h trading volume
  liquidity?: number;          // Liquidity in USD
  marketCap?: number;          // Market capitalization
  
  // Chain detection metadata
  chainBadge?: string;        // Chain badge identifier for UI display
  chainName?: string;         // Chain display name (for UI)
}

// Unified chain DTO (what frontend receives)
export interface ChainDTO {
  id: number;                // Canonical chain ID
  name: string;
  type: 'EVM' | 'Solana' | 'Cosmos' | 'Sui' | 'TON' | 'Bitcoin';
  logoURI?: string;
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
  supportedProviders: string[];  // Which providers support this chain
}
```

---

## 5. Chain Identity Resolution Strategy

### 5.1 Problem Statement

Different providers use different identifiers for the same chain:
- **LiFi:** Numeric IDs (1, 56, 1151111081099710 for Solana)
- **Squid:** String keys for non-EVM ("solana-mainnet-beta", "osmosis-1"), numeric strings for EVM ("1", "56")
- **DexScreener:** String slugs ("ethereum", "bsc")
- **Relay:** Provider-specific format (TBD)

### 5.2 Solution: Explicit Chain Registry

**Key Principles:**
1. **Canonical Internal ID:** We assign stable numeric IDs (no hashing)
2. **Provider Mappings:** Explicit mapping for each provider
3. **No Magic:** All conversions are explicit and traceable

**Example Chain Registry Entry:**

```typescript
export const CHAIN_REGISTRY: CanonicalChain[] = [
  {
    id: 1,
    name: 'Ethereum',
    type: 'EVM',
    logoURI: '/assets/chains/ethereum.svg',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {
      lifi: 1,
      squid: '1',
      dexscreener: 'ethereum',
      relay: 'ethereum-mainnet',
    },
  },
  {
    id: 7565164,  // Stable ID, not hashed
    name: 'Solana',
    type: 'Solana',
    logoURI: '/assets/chains/solana.svg',
    nativeCurrency: { symbol: 'SOL', decimals: 9 },
    providerIds: {
      lifi: 1151111081099710,  // LiFi's special Solana ID
      squid: 'solana-mainnet-beta',
      dexscreener: null,  // Not supported
      relay: 'solana-mainnet',
    },
  },
  {
    id: 2,  // Stable ID for Osmosis
    name: 'Osmosis',
    type: 'Cosmos',
    logoURI: '/assets/chains/osmosis.svg',
    nativeCurrency: { symbol: 'OSMO', decimals: 6 },
    providerIds: {
      lifi: null,  // Not supported
      squid: 'osmosis-1',
      dexscreener: null,
      relay: null,
    },
  },
];
```

**Helper Functions:**

```typescript
export function getCanonicalChain(chainId: number): CanonicalChain | null {
  return CHAIN_REGISTRY.find(chain => chain.id === chainId) || null;
}

export function getCanonicalChainByProviderId(
  provider: 'lifi' | 'squid' | 'dexscreener' | 'relay',
  providerChainId: string | number
): CanonicalChain | null {
  return CHAIN_REGISTRY.find(chain => {
    const providerId = chain.providerIds[provider];
    if (providerId === null || providerId === undefined) return false;
    return String(providerId) === String(providerChainId);
  }) || null;
}

export function getCanonicalChains(): CanonicalChain[] {
  return CHAIN_REGISTRY;
}

/**
 * Detect chain from token's provider-specific chain identifier
 * Used when provider returns chainId but we need to map to canonical chain
 */
export function detectChainFromProviderChainId(
  provider: 'lifi' | 'squid' | 'dexscreener' | 'relay',
  providerChainId: string | number
): CanonicalChain | null {
  return getCanonicalChainByProviderId(provider, providerChainId);
}

/**
 * Get chain badge identifier for UI display
 * Returns a consistent identifier for chain badge component
 */
export function getChainBadge(chain: CanonicalChain): string {
  // Use chain type + name for badge identification
  // e.g., "evm-ethereum", "solana-mainnet", "cosmos-osmosis"
  return `${chain.type.toLowerCase()}-${chain.name.toLowerCase().replace(/\s+/g, '-')}`;
}
```

---

## 6. Extensibility Plan

### 6.1 Adding a New Provider (Example: Sui)

**Step 1:** Add provider implementation

```typescript
// lib/providers/sui.ts
export class SuiProvider implements TokenProvider {
  name = 'sui';
  
  getChainId(canonicalChain: CanonicalChain): string | null {
    return canonicalChain.providerIds.sui ?? null;
  }
  
  async fetchTokens(params: { chainId: string; search?: string }): Promise<ProviderToken[]> {
    // Sui-specific API integration
    const response = await fetch(`https://api.sui.com/tokens?chain=${params.chainId}`);
    const data = await response.json();
    return data.tokens || [];
  }
  
  // ... implement other methods
}
```

**Step 2:** Add Sui chains to registry

```typescript
{
  id: 100,  // New stable ID
  name: 'Sui',
  type: 'Sui',
  providerIds: {
    sui: 'sui-mainnet',
    // Other providers may not support Sui yet
    lifi: null,
    squid: null,
    dexscreener: null,
    relay: null,
  },
}
```

**Step 3:** Register provider in aggregator

```typescript
aggregator.registerProvider(new SuiProvider());
```

**That's it!** No changes needed to:
- API routes
- Aggregation logic
- Frontend code

---

## 7. API Contract

### 7.1 GET /api/tokens (Inspired by Relay's Design)

**Query Parameters:**
- `chainIds` (optional): Comma-separated canonical chain IDs (e.g., `1,56,42161`). If omitted, searches all chains.
- `term` or `search` or `q` (optional): Search query (name, symbol, or address). Empty string = no search.
- `limit` (optional): Maximum number of results to return.

**Example Requests:**
```
GET /api/tokens?chainIds=1,56&term=USDC&limit=50
GET /api/tokens?term=ETH&limit=100
GET /api/tokens?chainIds=1
```

### 7.2 POST /api/tokens (Inspired by Relay's Design)

**Request Body:**
```json
{
  "chainIds": [1, 56, 42161, 8453],
  "term": "USDC",
  "limit": 100,
  "providers": ["relay", "lifi"]  // Optional: restrict to specific providers
}
```

**Response (Predictable Structure - Like Relay):**
```json
{
  "tokens": [
    {
      "chainId": 1,
      "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "vmType": "evm",
      "metadata": {
        "logoURI": "https://...",
        "verified": true
      }
    }
  ],
  "total": 1,
  "chainIds": [1, 56],
  "term": "USDC",
  "limit": 100
}
```

**Key Design Principles (From Relay):**
- ✅ **Multi-chain support:** Request tokens for multiple chains in one call
- ✅ **Predictable structure:** Response format is always consistent
- ✅ **Clean search:** `term` field - empty = all, populated = filtered
- ✅ **Flexible limits:** `limit` parameter for result pagination
- ✅ **Ordered data:** Tokens returned in consistent order

### 7.2 GET /api/chains

**Response:**
```json
{
  "chains": [
    {
      "id": 1,
      "name": "Ethereum",
      "type": "EVM",
      "logoURI": "/assets/chains/ethereum.svg",
      "nativeCurrency": {
        "symbol": "ETH",
        "decimals": 18
      },
      "supportedProviders": ["lifi", "squid", "dexscreener", "relay"]
    }
  ],
  "total": 50
}
```

---

## 8. Error Handling Strategy

### 8.1 Provider Failures

- **Graceful Degradation:** If one provider fails, others continue
- **Error Logging:** Log provider errors but don't fail entire request
- **Partial Results:** Return tokens from successful providers

### 8.2 Chain Not Found

- **400 Bad Request:** Invalid chainId parameter
- **404 Not Found:** Chain exists but no tokens found (return empty array, not error)

### 8.3 Rate Limiting

- **429 Too Many Requests:** Return clear error message
- **Retry Logic:** Implement exponential backoff (future enhancement)

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create chain registry with initial chains (EVM + Solana)
- [ ] Implement base provider interface
- [ ] Implement LiFi provider
- [ ] Implement DexScreener provider
- [ ] Create aggregation service
- [ ] Create `/api/tokens` route

### Phase 2: Relay Integration (Week 2)
- [ ] Implement Relay provider
- [ ] Add Relay chain mappings to registry
- [ ] Test aggregation with all 3 providers

### Phase 3: Chain Expansion (Week 3)
- [ ] Add Cosmos chains to registry
- [ ] Update Squid provider (if needed)
- [ ] Test cross-chain token discovery

### Phase 4: Frontend Integration (Week 4)
- [ ] Update TokenSelector to use new API
- [ ] Remove provider-specific logic from components
- [ ] Test end-to-end flow

---

## 10. Clarifications & Decisions

### 10.1 Relay API Structure ✅ (CLARIFIED)

**Endpoint:** `https://api.relay.link/currencies/v2`

**Request Structure (POST):**
```json
{
  "chainIds": [1, 56, 42161, 8453, 792703809, ...],  // Array of chain IDs
  "term": "",                                         // Search term (empty = no search)
  "defaultList": false,                               // Boolean flag
  "limit": 12,                                        // Result limit
  "depositAddressOnly": true,                         // Filter flag
  "referrer": "relay.link"                           // Referrer identifier
}
```

**Response Structure:**
```json
{
  "chainId": 56,
  "address": "0x55d398326f99059ff775485246999027b3197955",
  "symbol": "USDT",
  "name": "Tether USD",
  "decimals": 18,
  "vmType": "evm",
  "metadata": {
    "logoURI": "https://coin-images.coingecko.com/coins/images/39963/large/usdt.png?1724952731",
    "verified": true
  }
}
```

**Key Insights from Relay's Design:**
1. ✅ **Multi-chain requests:** Can request tokens for multiple chains in a single call
2. ✅ **Clean search pattern:** `term` field - empty string = no search, populated = search
3. ✅ **Predictable structure:** Consistent response format with metadata nested
4. ✅ **Flexible filtering:** `limit`, `depositAddressOnly`, `defaultList` flags
5. ✅ **Ordered & predictable:** Response structure is always the same

**Design Decision:** Our API should adopt similar patterns:
- Support multiple `chainIds` in a single request
- Use `term` for search (empty = all tokens, populated = filtered)
- Consistent response structure with metadata
- Support `limit` parameter
- Return tokens in predictable format

### 10.2 Response Strategy ✅ (CLARIFIED)

**Optimization Approach:**
Since Relay returns multiple chains in one request (much faster than per-chain requests):
1. ✅ **Return Relay's response first** - Send to frontend immediately for fast initial render
2. ✅ **Fetch other providers in parallel** - LiFi and DexScreener fetch simultaneously
3. ✅ **Merge results** - Backend aggregates and deduplicates before sending final response
4. ✅ **Priority ordering** - Relay tokens appear first, then others are merged in

**Implementation:**
- Fetch Relay first (single multi-chain request)
- Fetch LiFi + DexScreener in parallel (per-chain requests)
- Merge results with Relay having priority
- Return single aggregated response

**Future Enhancement (Optional):**
- Consider Server-Sent Events (SSE) for streaming updates
- Send Relay tokens immediately, then stream other providers' tokens as they arrive
- Frontend progressively updates UI as new tokens arrive

### 10.4 DexScreener API Structure ✅ (CLARIFIED)

**Search Endpoint:** `https://api.dexscreener.com/latest/dex/search?q={query}`

**Response Structure:**
```json
{
  "schemaVersion": "1.0.0",
  "pairs": [
    {
      "chainId": "solana",  // String chain ID (not numeric!)
      "dexId": "orca",
      "pairAddress": "5zpyutJu9ee6jFymDGoK7F6S5Kczqtc9FomP3ueKuyA9",
      "baseToken": {
        "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        "name": "Bonk",
        "symbol": "Bonk"
      },
      "quoteToken": {
        "address": "So11111111111111111111111111111111111111112",
        "name": "Wrapped SOL",
        "symbol": "SOL"
      },
      "priceUsd": "0.000008028",
      "volume": { "h24": 482094.37 },
      "liquidity": { "usd": 224126.06 },
      "marketCap": 664956520,
      "info": {
        "imageUrl": "https://cdn.dexscreener.com/...",
        "websites": [...],
        "socials": [...]
      }
    }
  ]
}
```

**Key Observations:**
1. ✅ **Returns pairs, not tokens** - Need to extract tokens from `baseToken` and `quoteToken`
2. ✅ **chainId is string** - e.g., "solana", "ethereum", "bsc" (not numeric)
3. ✅ **Rich metadata** - Price, volume, liquidity, marketCap, imageUrl
4. ✅ **Cross-chain search** - Search returns pairs from all chains, need to filter by chainId
5. ✅ **Chain detection required** - `chainId` field in pairs helps detect which chain token belongs to

**Chain Detection Strategy:**
- DexScreener provides `chainId` field in each pair (e.g., "solana", "ethereum")
- Map DexScreener chainId to canonical chain using registry
- Use detected chain for chain badge display in UI
- Fallback to requested chainId if detection fails

### 10.5 Chain Type System ✅ (CLARIFIED)

**Important:** Canonical chains are not limited to high-level categories. Even within Cosmos, there are app chains with their own details (chainId, RPC, explorer, etc.).

**Chain Type Hierarchy:**
- `EVM` - Ethereum Virtual Machine chains (Ethereum, BSC, Polygon, etc.)
- `Solana` - Solana mainnet/devnet
- `Cosmos` - Generic Cosmos chains (deprecated, use CosmosAppChain)
- `CosmosAppChain` - Specific Cosmos app chains (Osmosis, Juno, Stargaze, etc.)
  - Each has its own `metadata.chainId` (e.g., "osmosis-1", "juno-1")
  - Each has its own RPC, explorer, native currency
- `Sui` - Sui blockchain
- `TON` - TON blockchain
- `Bitcoin` - Bitcoin network
- `Other` - Future chains that don't fit above categories

**Registry Design:**
- Each Cosmos app chain should be a separate entry in the registry
- Store native chainId in `metadata.chainId`
- Store RPC/explorer URLs in `metadata`
- Map to provider-specific IDs in `providerIds`

### 10.6 Remaining Questions

1. **Chain Priority:** Should we prioritize certain providers for certain chains? (Default: LiFi → Relay and Dexscreener as fallback) ✅ **DECIDED: Relay first (fast), then LiFi/DexScreener**
2. **Caching:** Should we implement caching for token/chain data? (Redis, in-memory?)
3. **Rate Limits:** What are the rate limits for each provider?
4. **Token Deduplication:** Should we merge tokens with same address but different metadata? ✅ **DECIDED: Yes, merge by address, preserve best metadata**
5. **API Method:** Should we use POST (like Relay) or GET with query params? (Consider: POST allows body, GET is more RESTful for read operations). USE THE BEST APPROACH ✅ **DECIDED: Hybrid - Support both GET and POST**
6. **Chain Detection:** How to handle chain detection for tokens from DexScreener? ✅ **DECIDED: Use DexScreener's chainId field, map to canonical chain via registry**

---

## 11. Success Criteria

✅ **Phase 1 Complete When:**
- Single `/api/tokens` endpoint works for EVM chains
- LiFi + DexScreener aggregation works
- Chain registry is the single source of truth
- Frontend receives unified token DTOs
- Adding a new provider is straightforward (documented process)

---

## 12. Next Steps

1. **Review this proposal** - Get feedback on architecture decisions
2. **Clarify questions** - Answer questions in Section 10
3. **Approve approach** - Get sign-off before implementation
4. **Begin Phase 1** - Start with chain registry and LiFi provider

---

**Document Status:** 📋 **PROPOSAL - AWAITING APPROVAL**

**Last Updated:** [Current Date]

**Author:** AI Assistant (based on analysis of `tiwi-test` codebase)

