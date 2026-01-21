# Token & Chain Provider Aggregation System Analysis

**Date:** 2024  
**Phase:** Token Provider Integration - Step 1  
**Status:** Analysis Complete

---

## Executive Summary

This document analyzes the current token and chain fetching system, identifies architectural patterns, coupling points, and normalization requirements for integrating multiple providers (starting with DexScreener) while maintaining simplicity and scalability.

---

## Current System Analysis

### ✅ What's Working Well

1. **Provider Abstraction**
   - `BaseTokenProvider` interface provides clean contract
   - `LiFiProvider` implements interface correctly
   - Easy to extend for new providers

2. **Normalization Layer**
   - `normalizeToken()` and `normalizeChain()` methods exist
   - Canonical chain registry provides chain ID mapping
   - Provider-specific quirks are isolated in adapters

3. **Service Layer**
   - `TokenService` orchestrates provider calls
   - Clean separation: Service → Provider → API
   - Graceful fallback to mock data

4. **Type System**
   - Clear type boundaries: `ProviderToken` → `NormalizedToken`
   - `CanonicalChain` provides single source of truth
   - Type-safe chain ID transformations

### ⚠️ Areas of Concern

1. **Single Provider Dependency**
   - `TokenService` directly instantiates `LiFiProvider`
   - Hard to add multiple providers without refactoring
   - No provider registry or selection logic

2. **No Aggregation Strategy**
   - Currently returns tokens from single provider (LiFi)
   - No merging/deduplication logic
   - No provider prioritization

3. **Limited Caching**
   - No caching layer mentioned
   - Every request hits provider API
   - No stale-while-revalidate pattern

4. **Search Logic Coupling**
   - Search happens at provider level (LiFi handles it)
   - No unified search across providers
   - Search threshold not configurable (currently 20%)

5. **Token Limit Enforcement**
   - Limit passed to provider, but no post-aggregation enforcement
   - If multiple providers return tokens, could exceed limit

---

## Reference Implementation Analysis (@tiwi-test)

### DexScreener Implementation Insights

**What Worked:**
- Direct API calls to DexScreener endpoints
- Pair-based token extraction (DexScreener returns pairs, not tokens)
- Chain ID mapping (numeric → string identifiers)
- Liquidity-based sorting

**What Caused Complexity:**
- **Pair-to-Token Conversion:** DexScreener returns pairs, need to extract unique tokens
- **Chain ID Mapping:** Different format (string vs numeric)
- **Missing Data:** Defaults for decimals (18), empty logoURI
- **No Normalization:** Direct use of DexScreener format in components
- **Scattered Logic:** Chain ID mapping in multiple places

**Key Learnings:**
1. DexScreener uses **pairs**, not tokens directly
2. Chain IDs are **strings** ("ethereum", "bsc") not numbers
3. Need to extract tokens from pairs (baseToken + quoteToken)
4. Default values needed (decimals: 18, logoURI: '')
5. Must normalize to canonical format immediately

### Jupiter Implementation Insights (Context)

**What to Watch For:**
- Solana token addresses differ (So1111... vs 11111111...)
- Chain ID differences (7565164 vs provider-specific)
- Token list fetching required for mint address mapping

### Squid Implementation Insights (Context)

**What to Watch For:**
- Cosmos chain identifiers (string-based: "osmosis-1")
- EVM chains use numeric IDs (but as strings: "1", "56")
- Token identifier format differences

---

## Architectural Requirements

### 1. Canonical Token Model

**Current Model (Good):**
```typescript
interface NormalizedToken {
  chainId: number;              // Canonical chain ID
  address: string;              // Canonical address format
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  priceUSD: string;
  providers: string[];          // Which providers contributed this token
  verified?: boolean;
  vmType?: 'evm' | 'solana' | 'cosmos';
  chainBadge?: string;
  chainName?: string;
}
```

**Enhancements Needed:**
- `providers` array to track source providers
- Merge strategy: combine data from multiple providers
- Priority: which provider's data takes precedence

### 2. Canonical Chain Model

**Current Model (Good):**
```typescript
interface CanonicalChain {
  id: number;                   // Canonical chain ID
  name: string;
  type: 'EVM' | 'Solana' | 'Cosmos' | 'CosmosAppChain' | 'Sui' | 'TON' | 'Bitcoin';
  logoURI?: string;
  nativeCurrency?: {
    symbol: string;
    decimals: number;
  };
  providerIds: {
    lifi?: number | null;
    dexscreener?: string | null;
    relay?: string | null;
    squid?: string | null;
    jupiter?: number | null;
  };
}
```

**Enhancements Needed:**
- DexScreener chain ID mapping (string identifiers)
- Ensure all providers can map to canonical IDs

### 3. Provider Adapter Pattern

**Current Pattern (Good):**
```typescript
abstract class BaseTokenProvider {
  abstract name: string;
  abstract getChainId(canonicalChain: CanonicalChain): string | number | null;
  abstract fetchTokens(params: FetchTokensParams): Promise<ProviderToken[]>;
  abstract fetchChains(): Promise<ProviderChain[]>;
  abstract normalizeToken(token: ProviderToken, canonicalChain: CanonicalChain): NormalizedToken;
  abstract normalizeChain(chain: ProviderChain): CanonicalChain | null;
}
```

**Enhancements Needed:**
- Provider priority/weight system
- Provider capability declaration (supports search, supports all tokens, etc.)
- Error handling strategy per provider

### 4. Token Selection & Enrichment Strategy

**Note:** This is NOT a merge strategy - it's a provider selection and enrichment strategy.

**Requirements:**
1. **Primary Provider Selection:** Use chain-specific primary provider's data
2. **Token Discovery:** Search multiple providers to find tokens
3. **Router Compatibility:** Lookup token in router providers for routing parameters
4. **Data Enrichment:** Add liquidity/volume data from DexScreener
5. **Provider Attribution:** Track which providers found/enriched each token
6. **Limit Enforcement:** After selection, cap at 30 tokens

**Selection Rules:**
- **Primary Data Source:** Use primary provider's data (chain-specific)
  - Solana → Jupiter
  - Cosmos → Squid
  - EVM → LiFi
- **If same token from multiple providers:**
  - Use primary provider's data
  - Track all providers that found it: `foundBy: ["jupiter", "lifi"]`
  - Store router-specific formats: `routerFormats: { lifi: {...}, squid: {...} }`
- **Sort by:** Exact match > Similarity score > Liquidity/volume
- **Limit to 30 tokens** after selection

**Enrichment Rules:**
- **Router Formats:** For each token, check router providers for compatibility
- **Liquidity Data:** Background fetch from DexScreener (non-blocking)
- **Provider Tracking:** Track `foundBy`, `primarySource`, `enrichedBy`

### 5. Caching Strategy

**Requirements:**
1. **Lightweight:** In-memory cache (replaceable later)
2. **Cache Key:** `chainId:query:limit` or `chainIds:query:limit`
3. **Stale-While-Revalidate:**
   - Return cached results immediately if available
   - Fetch fresh data in background
   - Update UI when ready
4. **Cache Invalidation:** On provider error, keep cache; on success, update cache

**Search Threshold:**
- Current: 20% similarity
- New: 50% similarity (to balance speed + freshness)

---

## Normalization Points

### Where Normalization Happens

1. **Provider Level** (Current)
   - Each provider normalizes its own tokens
   - `normalizeToken()` in each provider class
   - ✅ Good: Isolation of provider quirks

2. **Service Level** (Needed)
   - Merge tokens from multiple providers
   - Final deduplication and limit enforcement
   - Provider attribution

### Normalization Requirements

**Chain ID Normalization:**
- DexScreener: `"ethereum"` → Canonical `1`
- LiFi: `1` → Canonical `1` (same)
- Jupiter: Solana chain ID mapping
- Squid: String/numeric hybrid

**Token Address Normalization:**
- EVM: `0x...` (same across providers). somehow, some use 0xeeEee... like Squid, don't really know for lifi and relay
- Solana: `So1111...` vs `11111111...` (Jupiter vs others)
- Cosmos: Different identifier formats

**Data Field Normalization:**
- Decimals: Default to 18 if missing
- LogoURI: Default to '' if missing
- PriceUSD: Default to '0' if missing
- Verified: Default to false if missing

---

## Coupling Analysis

### Current Coupling Points

1. **TokenService → LiFiProvider**
   - Direct instantiation: `new LiFiProvider()`
   - Hard-coded provider selection
   - ⚠️ Needs: Provider registry or factory

2. **Provider → Chain Registry**
   - Providers call `getCanonicalChainByProviderId()`
   - ✅ Good: Providers don't know about each other

3. **Service → Chain Registry**
   - Service validates chains via registry
   - ✅ Good: Single source of truth

### Decoupling Requirements

1. **Provider Registry**
   - Register providers dynamically
   - Select providers based on chain support
   - Priority-based provider selection

2. **Aggregation Service**
   - Separate from TokenService
   - Handles merging, deduplication, limiting
   - Provider-agnostic

---

## Extension Points

### How Future Providers Plug In

**Current (Needs Improvement):**
1. Create provider class extending `BaseTokenProvider`
2. Implement all abstract methods
3. Manually add to `TokenService` constructor
4. Update chain registry with provider IDs

**Proposed (Better):**
1. Create provider class extending `BaseTokenProvider`
2. Implement all abstract methods
3. Register provider in `ProviderRegistry`
4. Update chain registry with provider IDs
5. Service automatically uses registered providers

---

## Data Flow Requirements

### Current Flow (Single Provider)
```
Request → TokenService → LiFiProvider → LiFi API → Normalize → Return
```

### Proposed Flow (Multiple Providers)
```
Request → TokenService → ProviderRegistry → Select Providers (by chain + query)
                                                      ↓
                                            Try Primary Provider First
                                                      ↓
                                            Check Results:
                                            - >= 3 results + exact match? → Use
                                            - < 3 results OR no exact? → Try DexScreener
                                                      ↓
                                            [ProviderTokens from all sources]
                                                      ↓
                                            Normalize & Apply Similarity Scoring
                                                      ↓
                                            Token Enrichment (Background):
                                            - Check router providers (for routing)
                                            - Fetch DexScreener liquidity
                                                      ↓
                                            Deduplicate (chainId + address)
                                                      ↓
                                            Sort: Exact > Similarity > Liquidity
                                                      ↓
                                            Limit to 30 tokens
                                                      ↓
                                            [NormalizedTokens with enrichment]
                                                      ↓
                                            Return (cached or fresh)
```

---

## Search & Caching Strategy

### Search Flow (Hybrid Approach)

1. **Frontend (Cached Data):**
   - Apply similarity search to cached tokens (instant results)
   - Threshold: 50% (increased from 20%)
   - Purpose: Show instant results while fetching fresh data

2. **Backend (Provider Search):**
   - Try primary provider first (chain-specific):
     - Solana → Jupiter
     - Cosmos → Squid
     - EVM → LiFi
   - Check results:
     - If results >= 3 AND has exact/contains match → Use these
     - If results < 3 OR no exact match → Try DexScreener (fallback)
   - Apply similarity scoring to all provider results (for ranking)
   - Normalize all tokens to canonical format

3. **Token Enrichment (Background):**
   - For each token found:
     - Check other router providers for same token (for routing compatibility)
     - Fetch liquidity data from DexScreener (non-blocking)
     - Store router-specific formats and enrichment data

4. **Final Merge:**
   - Combine cached + fresh provider results
   - Apply similarity scoring to all results (for final ranking)
   - Sort by: Exact match > Similarity score > Liquidity
   - Limit to 30 tokens

### Similarity Threshold

- **Current:** 20% (too low, causes unnecessary refreshes)
- **New:** 50% (better balance)
- **Application:**
  - Frontend: Applied to cached data (for instant filtering)
  - Backend: Applied to combined provider results (for ranking)
  - Final: Applied to all merged results (for final ranking)
- **Purpose:** Ranking and sorting, not filtering (show all results, rank by relevance)
- **Implementation:** Use existing `calculateSimilarity()` utility

---

## Provider-Specific Requirements

### DexScreener (Priority 1)

**API Endpoints:**
- Search: `https://api.dexscreener.com/latest/dex/search?q={query}`
- Token Pairs: `https://api.dexscreener.com/latest/dex/tokens/{address}`

**Role: Dual Purpose (Search + Liquidity)**
- **Primary Role:** Search/discovery fallback (when primary provider has low/no results)
- **Secondary Role:** Liquidity/volume data enrichment
- **Not Used As:** Primary data source (missing metadata like logoURI, decimals)

**Key Differences:**
- Returns **pairs**, not tokens (need to extract baseToken + quoteToken)
- Chain IDs are **strings** ("ethereum", "bsc") not numbers
- Need to extract tokens from pairs
- Default decimals: 18
- Default logoURI: ''

**Normalization:**
- Map chain ID: `"ethereum"` → `1`
- Extract tokens from pairs (baseToken + quoteToken)
- Deduplicate by address
- Use primary provider's data, enrich with DexScreener liquidity

**When to Use DexScreener:**
- **Search:** When primary provider returns < 3 results OR no exact match found
- **Enrichment:** Background fetch for liquidity/volume data (non-blocking)
- **All Chains:** Works for EVM, Solana, and other chains

---

## Implementation Constraints

### Hard Limits
- **Max 30 tokens** returned (enforced after aggregation)
- **No over-fetching** (respect provider limits)
- **No heavy aggregation** (keep it lightweight)

### Performance Requirements
- **Fast initial response** (cached results)
- **Background refresh** (non-blocking)
- **Parallel provider calls** (when possible)

### Error Handling
- **Graceful degradation:** If one provider fails, use others
- **Cache preservation:** Keep cache even if provider fails
- **Silent failures:** Log errors, don't break user experience

---

## Questions Resolved

1. **Provider Priority (Chain-Specific):**
   - **Solana:** Jupiter takes precedence (native, best coverage)
   - **Cosmos:** Squid takes precedence (best Cosmos support)
   - **EVM:** LiFi, Relay primary, DexScreener for low-cap search fallback
   - **Rationale:** Each provider excels in their domain

2. **Token Data Strategy:**
   - **Use one provider's data per token** (primary provider)
   - **But search other providers** for:
     a) Token discovery (if primary doesn't have it)
     b) Router compatibility (get token in router's format for routing)
   - **Store router-specific formats:** `routerFormats: { lifi: {...}, squid: {...} }`
   - **Rationale:** Different routers need different parameter formats

3. **Cache TTL:**
   - **5 minutes (300 seconds)** - balances freshness and API call reduction
   - Token data doesn't change rapidly
   - Can be adjusted later if needed

4. **Search Threshold:**
   - **50% similarity threshold** (increased from 20%)
   - Applied to: cached data (frontend), combined provider results (backend), final merged results
   - Used for ranking, not filtering (show all results, rank by similarity)

5. **Provider Selection:**
   - **Query only relevant providers** (not all)
   - Select based on chain type and query characteristics
   - Reduces unnecessary API calls and improves performance

6. **Similarity Search Application:**
   - **Frontend:** Apply to cached data (for instant results) ✅ Keep
   - **Backend:** Apply to combined provider results (for ranking) ✅ Add
   - **Final Merge:** Apply to all combined results (cached + fresh) ✅ Add
   - **Purpose:** Ranking and sorting, not filtering 

---

## Next Steps

1. **Design Aggregation Architecture** (Step 2)
   - Provider registry pattern
   - Merge/deduplication strategy
   - Caching implementation
   - Search threshold adjustment

2. **Wait for Approval**
   - Review architecture proposal
   - Get feedback
   - Refine design

3. **Implement DexScreener** (Step 3)
   - Create DexScreenerProvider
   - Implement normalization
   - Integrate with aggregation
   - Test with real data

---

## Conclusion

The current system has a solid foundation:
- ✅ Clean provider abstraction
- ✅ Normalization layer exists
- ✅ Type-safe chain ID mapping

**What Needs Enhancement:**
- ⚠️ Provider registry/selection
- ⚠️ Multi-provider aggregation
- ⚠️ Caching layer
- ⚠️ Merge/deduplication logic

**Key Insights:**

1. **DexScreener Integration:**
   - Pair-to-token extraction (DexScreener returns pairs, not tokens)
   - Chain ID string → number mapping ("ethereum" → 1)
   - Default value handling (decimals: 18, logoURI: '')
   - Use as search fallback + liquidity enrichment (not primary data source)

2. **Provider Strategy:**
   - Chain-specific primary providers (Jupiter/Squid/LiFi,Relay)
   - DexScreener as search fallback for all chains
   - Multi-provider token lookup for routing compatibility
   - Enrichment in background (non-blocking)

3. **Similarity Search:**
   - Applied to cached data (frontend) for instant results
   - Applied to provider results (backend) for ranking
   - Applied to final merged results for final ranking
   - Used for ranking, not filtering (50% threshold)

4. **Architecture Approach:**
   - Provider selection strategy (not merge strategy)
   - One primary data source per token
   - Multi-provider lookup for routing compatibility
   - Lightweight enrichment (liquidity, router formats)

The architecture is ready for extension, but needs provider registry and enrichment infrastructure before adding providers.

