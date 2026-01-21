# Token & Chain Provider Aggregation Architecture Proposal

**Date:** 2024  
**Phase:** Token Provider Integration - Step 2  
**Status:** Proposal (Awaiting Approval)

---

## Executive Summary

This document proposes the architecture for integrating multiple token and chain providers (starting with DexScreener) while maintaining simplicity, modularity, and scalability. The design focuses on provider selection, token enrichment, and routing compatibility rather than complex merging.

---

## Design Principles

1. **Provider Selection Over Merging:** Use one primary data source per token, but search multiple providers
2. **Chain-Specific Priority:** Each chain type has primary providers (Solana→Jupiter, Cosmos→Squid, EVM→LiFi/Relay)
3. **DexScreener as Search Fallback:** Use for discovery when primary provider has low/no results
4. **Routing Compatibility:** Lookup tokens in router providers for correct parameter formats
5. **Lightweight Enrichment:** Background enrichment (liquidity, router formats) without blocking

---

## Architecture Components

### 1. Provider Registry

**Purpose:** Dynamic provider registration and selection

**Location:** `lib/backend/providers/registry.ts`

**Responsibilities:**
- Register providers dynamically
- Select providers based on chain support
- Priority-based provider selection
- Provider capability queries

**Interface:**
```typescript
class ProviderRegistry {
  register(provider: BaseTokenProvider): void;
  getProvidersForChain(chainId: number): BaseTokenProvider[];
  getPrimaryProvider(chainId: number): BaseTokenProvider | null;
  getSearchProviders(chainId: number): BaseTokenProvider[];
}
```

**Provider Priority:**
- Solana (7565164/115... for LiFi): Jupiter (primary), LiFi (routing), Squid (routing), Relay (routing, cross-chain)
- Cosmos: Squid (primary), LiFi (routing), Relay (routing, cross-chain)
- EVM: LiFi (primary), Relay (primary, cross-chain), DexScreener (search fallback)

---

### 2. Token Aggregation Service

**Purpose:** Orchestrate provider calls, normalize, enrich, and select tokens

**Location:** `lib/backend/services/token-aggregation-service.ts`

**Responsibilities:**
- Coordinate provider calls
- Apply similarity scoring
- Token enrichment (router formats, liquidity)
- Deduplication and limit enforcement
- Provider attribution

**Key Methods:**
```typescript
class TokenAggregationService {
  async searchTokens(params: SearchParams): Promise<NormalizedToken[]>;
  async enrichToken(token: NormalizedToken): Promise<EnrichedToken>;
  private selectPrimaryProvider(chainId: number): BaseTokenProvider;
  private shouldUseDexScreener(primaryResults: NormalizedToken[], query: string): boolean;
}
```

---

### 3. Token Enrichment Service

**Purpose:** Background enrichment of tokens (router formats, liquidity)

**Location:** `lib/backend/services/token-enrichment-service.ts`

**Responsibilities:**
- Check router providers for token compatibility
- Fetch DexScreener liquidity data
- Store router-specific formats
- Non-blocking enrichment

**Key Methods:**
```typescript
class TokenEnrichmentService {
  // Non-blocking: Starts enrichment, returns immediately
  enrichTokensInBackground(tokens: NormalizedToken[]): void;
  
  // On-demand: Fetch router format if not in cache
  async getRouterFormat(token: NormalizedToken, router: string): Promise<RouterFormat>;
  
  // Internal: Actual enrichment logic
  private async enrichToken(token: NormalizedToken): Promise<EnrichedToken>;
}
```

**Enrichment Timing:**
- **During Search:** Background (non-blocking) - starts after response returned
- **On-Demand:** When routing (if enrichment not ready) - blocking but only when needed
- **Cache:** Enriched tokens cached for future use

---

### 4. Enhanced Token Model

**Current Model (Enhanced):**
```typescript
interface NormalizedToken {
  // Core fields (from primary provider)
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  priceUSD: string;
  
  // Provider attribution
  providers: string[];              // All providers that found this token
  primarySource: string;            // Primary provider (for data)
  foundBy: string[];                // Providers that found this token (same as providers)
  enrichedBy?: string[];            // Providers that enriched this token
  
  // Router compatibility
  routerFormats?: {
    lifi?: { chainId: number; address: string; };
    squid?: { chainId: string; address: string; };
    jupiter?: { mint: string; };
    relay?: { chainId: string; address: string; };
  };
  
  // Enrichment data
  liquidity?: {
    usd: number;                    // Total liquidity in USD
    volume24h: number;               // 24h volume in USD
  };
  
  // Existing fields
  verified?: boolean;
  vmType?: 'evm' | 'solana' | 'cosmos';
  chainBadge?: string;
  chainName?: string;
}
```

---

## Data Flow

### Search Flow (With DexScreener Fallback)

```
User Query: "TWC"
    ↓
1. Frontend: Apply similarity to cached tokens (instant results)
    ↓
2. Backend: Try Primary Providers (chain-specific)
   - Solana → Jupiter
   - Cosmos → Squid
   - EVM → LiFi + Relay (both primary, parallel fetch)
    ↓
3. Check Results:
   - If results >= 3 AND has exact/contains match → Use these
   - If results < 3 OR no exact match → Try DexScreener
    ↓
4. DexScreener Search (if needed):
   - Extract tokens from pairs
   - Normalize to canonical format
    ↓
5. Combine All Results:
   - Apply similarity scoring (0-1)
   - Normalize all tokens
    ↓
6. Token Enrichment (Background):
   - Check router providers for same token
   - Fetch DexScreener liquidity data
   - Store router-specific formats
    ↓
7. Final Processing:
   - Deduplicate (chainId + address)
   - Sort: Exact match > Similarity > Liquidity
   - Limit to 30 tokens
    ↓
8. Return Enriched Tokens
```

---

## Provider Selection Logic

### Chain-Specific Primary Providers

```typescript
function getPrimaryProviders(chainId: number): BaseTokenProvider[] {
  const chain = getCanonicalChain(chainId);
  if (!chain) return [];
  
  switch (chain.type) {
    case 'Solana':
      return [registry.getProvider('jupiter')].filter(Boolean);
    case 'Cosmos':
    case 'CosmosAppChain':
      return [registry.getProvider('squid')].filter(Boolean);
    case 'EVM':
      // EVM has two primary providers: LiFi and Relay (both fetch in parallel)
      return [
        registry.getProvider('lifi'),
        registry.getProvider('relay')
      ].filter(Boolean);
    default:
      return [registry.getProvider('lifi')].filter(Boolean); // Default fallback
  }
}
```

### DexScreener Fallback Logic

```typescript
function shouldUseDexScreener(
  primaryResults: NormalizedToken[],
  query: string
): boolean {
  // Use DexScreener if:
  // 1. Primary provider has < 3 results
  // 2. No exact/contains match found
  // 3. Query is > 3 characters (likely intentional search)
  
  if (primaryResults.length >= 3) {
    const hasExactMatch = primaryResults.some(token =>
      token.symbol.toLowerCase() === query.toLowerCase() ||
      token.name.toLowerCase() === query.toLowerCase()
    );
    if (hasExactMatch) return false;
  }
  
  return primaryResults.length < 3 || query.length > 3;
}
```

---

## Token Enrichment Strategy

### Router Format Lookup

```typescript
async function enrichWithRouterFormats(
  token: NormalizedToken
): Promise<EnrichedToken> {
  const routerFormats: Record<string, any> = {};
  
  // Check LiFi (if EVM or Solana)
  if (token.vmType === 'evm' || token.chainId === 7565164) {
    const lifiToken = await checkLiFiForToken(token);
    if (lifiToken) {
      routerFormats.lifi = {
        chainId: lifiToken.chainId,
        address: lifiToken.address,
      };
    }
  }
  
  // Check Squid (if supported chain)
  if (isSquidSupportedChain(token.chainId)) {
    const squidToken = await checkSquidForToken(token);
    if (squidToken) {
      routerFormats.squid = {
        chainId: squidToken.chainId, // String format
        address: squidToken.address,
      };
    }
  }
  
  // Check Jupiter (if Solana)
  if (token.chainId === 7565164) {
    const jupiterToken = await checkJupiterForToken(token);
    if (jupiterToken) {
      routerFormats.jupiter = {
        mint: jupiterToken.mint,
      };
    }
  }
  
  return { ...token, routerFormats };
}
```

### Liquidity Enrichment

```typescript
async function enrichWithLiquidity(
  token: NormalizedToken
): Promise<EnrichedToken> {
  // Background fetch from DexScreener (non-blocking)
  try {
    const liquidity = await fetchDexScreenerLiquidity(token);
    return {
      ...token,
      liquidity: {
        usd: liquidity.usd,
        volume24h: liquidity.volume24h,
      },
      enrichedBy: [...(token.enrichedBy || []), 'dexscreener'],
    };
  } catch (error) {
    // Silent failure - return token without liquidity
    return token;
  }
}
```

---

## Similarity Search Application

### Three-Stage Application

1. **Frontend (Cached Data):**
   ```typescript
   // Apply to cached tokens for instant results
   const filteredCached = filterTokensByQuery(cachedTokens, query, 0.5);
   ```

2. **Backend (Provider Results):**
   ```typescript
   // Apply to combined provider results for ranking
   const scored = providerResults.map(token => ({
     token,
     score: calculateSimilarity(query, token.symbol, token.name),
   }));
   ```

3. **Final Merge:**
   ```typescript
   // Apply to all merged results for final ranking
   const finalScored = allResults.map(token => ({
     token,
     score: calculateSimilarity(query, token.symbol, token.name),
   })).sort((a, b) => b.score - a.score);
   ```

**Threshold:** 50% (increased from 20%)  
**Purpose:** Ranking and sorting, not filtering

---

## Caching Strategy

### Cache Structure

```typescript
interface TokenCache {
  key: string;                      // "chainId:query:limit" or "chainIds:query:limit"
  tokens: NormalizedToken[];
  timestamp: number;
  expiresAt: number;                // timestamp + 5 minutes
}
```

### Cache Flow

1. **Check Cache:**
   - If cached results exist and match query (50% similarity)
   - Return cached results immediately
   - Trigger background refresh

2. **Background Refresh:**
   - Fetch from providers
   - Normalize and enrich
   - Update cache
   - Update UI if still relevant

3. **Cache TTL:** 5 minutes (300 seconds)

---

## DexScreener Integration Details

### Implementation Strategy

**Role:** Search fallback + Liquidity enrichment

**When to Use:**
- **Search:** Primary provider has < 3 results OR no exact match
- **Enrichment:** Background fetch for liquidity/volume data

**API Usage:**
- Search: `GET https://api.dexscreener.com/latest/dex/search?q={query}`
- Token Pairs: `GET https://api.dexscreener.com/latest/dex/tokens/{address}`

**Normalization:**
1. Extract tokens from pairs (baseToken + quoteToken)
2. Map chain ID: `"ethereum"` → `1`
3. Default values: decimals (18), logoURI ('')
4. Use primary provider's data, add DexScreener liquidity

---

## Error Handling

### Graceful Degradation

1. **Provider Failure:**
   - Log error
   - Continue with other providers
   - Return partial results

2. **Enrichment Failure:**
   - Silent failure
   - Return token without enrichment
   - Don't block user experience

3. **Cache Preservation:**
   - Keep cache even if provider fails
   - Return cached results on error

---

## Extension Points

### Adding New Providers

1. Create provider class extending `BaseTokenProvider`
2. Implement all abstract methods
3. Register in `ProviderRegistry`
4. Update chain registry with provider IDs
5. Service automatically uses registered providers

### Adding New Enrichment Sources

1. Add enrichment method to `TokenEnrichmentService`
2. Call in background (non-blocking)
3. Store in token metadata
4. No breaking changes to token model

---

## Implementation Plan

### Phase 1: Foundation (This Phase)

1. **Provider Registry**
   - Create `ProviderRegistry` class
   - Register LiFi, Relay, and DexScreener
   - Implement provider selection logic (EVM: LiFi + Relay)

2. **Token Aggregation Service**
   - Create `TokenAggregationService`
   - Implement search flow with fallback
   - Apply similarity scoring
   - **Return immediately** (fast response)
   - **Start background enrichment** (non-blocking)

3. **DexScreener Provider**
   - Implement `DexScreenerProvider`
   - Pair-to-token extraction
   - Chain ID normalization

4. **Token Enrichment Service**
   - Create `TokenEnrichmentService`
   - Implement background enrichment (non-blocking)
   - Router format lookup
   - Liquidity enrichment

5. **Update TokenService**
   - Use `TokenAggregationService`
   - Remove direct LiFi dependency

### Phase 2: Enrichment (Future)

1. **Token Enrichment Service**
   - Router format lookup
   - Liquidity enrichment
   - Background processing

2. **Enhanced Token Model**
   - Add `routerFormats` field
   - Add `liquidity` field
   - Add provider tracking fields

---

## Questions & Decisions

### ✅ Resolved

1. **Provider Priority:** Chain-specific (Solana→Jupiter, Cosmos→Squid, EVM→LiFi/Relay)
2. **DexScreener Role:** Search fallback + Liquidity enrichment
3. **Merge Strategy:** Provider selection (one primary data source, multi-provider lookup)
4. **Cache TTL:** 5 minutes (300 seconds)
5. **Search Threshold:** 50% similarity
6. **Provider Selection:** Only relevant providers
7. **Similarity Search:** Applied to cached data, provider results, and final merge

### ✅ Resolved Questions

1. **Enrichment Timing:** 
   - **Decision:** Asynchronous (background) - NEVER blocks main response
   - **When:** During search, but returns immediately with primary data
   - **How:** Fire-and-forget background enrichment, update cache when ready
   - **Rationale:** Speed and UX are critical - users see results instantly

2. **Router Format Lookup:**
   - **Decision:** On-demand when token is selected for swap (or background during search)
   - **Storage:** Cache router formats in token metadata for future use
   - **Rationale:** Only fetch what's needed, when it's needed

3. **DexScreener Rate Limits:**
   - **Action:** Monitor and implement rate limiting if needed
   - **Fallback:** If rate limited, continue without DexScreener enrichment

---

## Success Criteria

1. ✅ DexScreener integrated as search fallback
2. ✅ Token enrichment (router formats, liquidity)
3. ✅ Provider registry working
4. ✅ Similarity search at 50% threshold
5. ✅ Caching with 5-minute TTL
6. ✅ Max 30 tokens enforced
7. ✅ No breaking changes to existing API

---

## Next Steps

1. **Review & Approval** (This Step)
   - Review architecture proposal
   - Get feedback
   - Refine design

2. **Implementation** (Step 3)
   - Implement Provider Registry
   - Implement Token Aggregation Service
   - Implement DexScreener Provider
   - Update TokenService
   - Test with real data

3. **Enrichment** (Future)
   - Implement Token Enrichment Service
   - Add router format lookup
   - Add liquidity enrichment

---

## Notes

- Architecture focuses on simplicity and extensibility
- No complex merging logic - just provider selection and enrichment
- Ready for future providers (Jupiter, Squid, Relay)
- Maintains backward compatibility with existing API

