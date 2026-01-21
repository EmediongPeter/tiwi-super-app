# Jupiter + LiFi Token Search Implementation Plan

## Goal Statement

**Primary Goal**: Implement a robust, provider-optimized token search system where:
- **Jupiter** is the primary provider for Solana token search (same-chain)
- **LiFi SDK** is used for cross-chain token search (not just DexScreener)
- Both providers leverage their native search APIs for optimal results
- Address format consistency is maintained (Jupiter format for Solana)

---

## Honest Feedback & Analysis

### ✅ **What You're Doing Right**

1. **Recognizing LiFi SDK's Search Capability**
   - You're correct: LiFi SDK's `getTokens()` already supports search via `search` parameter
   - The current implementation in `LiFiProvider` already uses it (line 123)
   - **But**: It's not being prioritized for search scenarios

2. **Provider-Specific Strategy**
   - Using Jupiter for Solana makes perfect sense
   - Using LiFi for cross-chain is logical
   - This aligns with each provider's strengths

3. **Decimals from LiFi**
   - LiFi provides decimals in their token response
   - This is valuable and should be preserved

### ❌ **Current Issues**

1. **DexScreener Over-Prioritization**
   - Current code prioritizes DexScreener for search (line 75 in `token-aggregation-service.ts`)
   - This is backwards - should prioritize native providers first
   - DexScreener should be fallback, not primary

2. **LiFi Search Not Fully Leveraged**
   - LiFi SDK search is available but not optimized
   - Not using extended search parameters (`extended=true`, `minPriceUSD`)
   - Missing the direct API endpoint you mentioned for better control

3. **No Jupiter Token Provider**
   - Jupiter search APIs exist but aren't integrated
   - Need to create `JupiterTokenProvider` from scratch

4. **Search Strategy Confusion**
   - Current: DexScreener → Primary Providers
   - Should be: Primary Providers (Jupiter/LiFi) → DexScreener (fallback)

---

## Implementation Strategy

### Phase 1: Create Jupiter Token Provider

**Why This First:**
- Solana is a priority chain
- Jupiter has the best Solana token data
- Eliminates address format issues

**Implementation:**

```typescript
// lib/backend/providers/jupiter.ts
export class JupiterTokenProvider extends BaseTokenProvider {
  name = 'jupiter';
  
  async fetchTokens(params: FetchTokensParams): Promise<ProviderToken[]> {
    // Strategy:
    // 1. If search query: Use /ultra/v1/search (better metadata)
    // 2. If no query: Use /tokens/v2/search with limit
    // 3. Support category endpoints (toporganicscore, toptraded, toptrending)
    
    if (params.search) {
      return this.searchTokens(params.search, params.limit);
    }
    
    // For "all tokens" scenario, use category endpoints
    return this.getTopTokens(params.limit);
  }
  
  private async searchTokens(query: string, limit: number = 20) {
    // Use Ultra Search API for better metadata
    const response = await fetch(
      `https://api.jup.ag/ultra/v1/search?query=${encodeURIComponent(query)}`,
      { headers: { 'x-api-key': JUPITER_API_KEY } }
    );
    
    // Transform to ProviderToken format
    // Note: Ultra API returns rich metadata (stats, audit, etc.)
  }
  
  private async getTopTokens(limit: number = 50) {
    // Use category endpoints for popular tokens
    // toptraded/24h gives most traded tokens
    const response = await fetch(
      `https://api.jup.ag/tokens/v2/toptraded/24h?limit=${limit}`,
      { headers: { 'x-api-key': JUPITER_API_KEY } }
    );
  }
}
```

**Key Points:**
- Use `/ultra/v1/search` for search queries (better metadata)
- Use `/tokens/v2/search` as fallback if Ultra fails
- Use category endpoints (`toptraded`, `toporganicscore`) for "all tokens"
- Normalize to Jupiter's SOL format (`So111...11112`)

---

### Phase 2: Enhance LiFi Provider Search

**Why This Matters:**
- LiFi SDK already supports search, but we can optimize it
- Direct API access gives more control
- Better for cross-chain scenarios

**Current State:**
- ✅ Already uses `getTokens({ search: query })` from SDK
- ❌ Not using extended parameters
- ❌ Not using direct API for better control

**Enhancement:**

```typescript
// In LiFiProvider.fetchTokensFromLiFi()
private async fetchTokensFromLiFi(
  lifiChainIds: number[],
  search?: string,
  limit: number = 30
): Promise<ProviderToken[]> {
  // Option 1: Use SDK (current, works but limited control)
  // Option 2: Use direct API for better control (recommended for search)
  
  if (search && search.trim()) {
    // Use direct API for search with extended parameters
    const params = new URLSearchParams({
      chainTypes: 'EVM,SVM,UTXO,MVM',
      orderBy: 'volumeUSD24H',
      extended: 'true', // Get more metadata
      search: search.trim(),
      limit: limit.toString(),
      minPriceUSD: '0.000001', // Filter out dust tokens
    });
    
    const response = await fetch(`https://li.quest/v1/tokens?${params}`);
    // Parse and normalize
  } else {
    // Use SDK for "all tokens" (simpler)
    return this.fetchTokensFromLiFiSDK(lifiChainIds, limit);
  }
}
```

**Key Points:**
- Use direct API for search queries (better control, extended params)
- Use SDK for "all tokens" scenarios (simpler)
- Preserve decimals from LiFi response
- Filter by `minPriceUSD` to avoid dust tokens

---

### Phase 3: Update Token Aggregation Service

**Critical Changes:**

1. **Fix Search Priority**
   ```typescript
   // CURRENT (WRONG):
   if (query) {
     dexResults = await fetchFromDexScreener(...); // First
     primaryResults = await fetchFromPrimaryProviders(...); // Second
   }
   
   // SHOULD BE (CORRECT):
   if (query) {
     primaryResults = await fetchFromPrimaryProviders(...); // First
     dexResults = await fetchFromDexScreener(...); // Fallback only
   }
   ```

2. **Chain-Specific Provider Selection**
   ```typescript
   private async fetchFromPrimaryProviders(...) {
     // For Solana: Use Jupiter
     // For EVM/Cross-chain: Use LiFi
     // For other chains: Use appropriate provider
     
     const solanaChains = chainIds.filter(id => id === SOLANA_CHAIN_ID);
     const otherChains = chainIds.filter(id => id !== SOLANA_CHAIN_ID);
     
     const promises = [];
     
     // Jupiter for Solana
     if (solanaChains.length > 0) {
       const jupiter = this.registry.getProvider('jupiter');
       promises.push(jupiter.fetchTokens({ chainIds: solanaChains, search: query, limit }));
     }
     
     // LiFi for others (EVM, cross-chain)
     if (otherChains.length > 0) {
       const lifi = this.registry.getProvider('lifi');
       promises.push(lifi.fetchTokens({ chainIds: otherChains, search: query, limit }));
     }
     
     return Promise.all(promises);
   }
   ```

3. **DexScreener as True Fallback**
   ```typescript
   // Only use DexScreener if:
   // 1. Primary providers return < 3 results
   // 2. No exact match found
   // 3. Query is > 3 characters (intentional search)
   
   if (shouldUseDexScreener(primaryResults, query)) {
     const dexResults = await fetchFromDexScreener(...);
     allResults.push(...dexResults);
   }
   ```

---

## Architecture Flow (After Implementation)

### Solana Token Search
```
User searches "SOL" on Solana
  ↓
TokenAggregationService.searchTokens()
  ↓
fetchFromPrimaryProviders() detects Solana chain
  ↓
JupiterTokenProvider.fetchTokens()
  ↓
Jupiter Ultra Search API (/ultra/v1/search)
  ↓
Returns: SOL with address "So111...11112" ✅
  ↓
Swap uses same address ✅
```

### Cross-Chain Token Search
```
User searches "USDC" across chains
  ↓
TokenAggregationService.searchTokens()
  ↓
fetchFromPrimaryProviders() detects multiple chains
  ↓
LiFiProvider.fetchTokens() (direct API with extended=true)
  ↓
LiFi API (/v1/tokens?search=USDC&extended=true)
  ↓
Returns: USDC on multiple chains with decimals ✅
  ↓
Cross-chain swap uses LiFi ✅
```

### Fallback Scenario
```
User searches obscure token "XYZ123"
  ↓
Jupiter/LiFi return < 3 results
  ↓
shouldUseDexScreener() returns true
  ↓
DexScreenerProvider.fetchTokens()
  ↓
Returns: Additional results from DexScreener ✅
```

---

## Key Implementation Details

### 1. Jupiter Token Provider

**API Endpoints to Use:**
- **Search**: `/ultra/v1/search?query=...` (preferred - rich metadata)
- **Fallback Search**: `/tokens/v2/search?query=...` (if Ultra fails)
- **All Tokens**: `/tokens/v2/toptraded/24h?limit=...` (popular tokens)
- **Categories**: `/tokens/v2/toporganicscore/24h`, `/tokens/v2/toptrending/24h`

**Response Transformation:**
```typescript
// Ultra Search Response → ProviderToken
{
  address: token.id, // Mint address
  symbol: token.symbol,
  name: token.name,
  decimals: token.decimals, // ✅ Important!
  logoURI: token.icon,
  priceUSD: token.usdPrice?.toString() || '0',
  chainId: SOLANA_CHAIN_ID,
  // Additional metadata from Ultra API:
  raw: {
    liquidity: token.liquidity,
    mcap: token.mcap,
    stats24h: token.stats24h,
    audit: token.audit,
    organicScore: token.organicScore,
  }
}
```

**SOL Address Handling:**
- Always use `So11111111111111111111111111111111111111112` (Jupiter format)
- This matches swap execution format ✅

### 2. LiFi Provider Enhancement

**Direct API vs SDK:**
- **Direct API**: Better for search (extended params, filtering)
- **SDK**: Better for "all tokens" (simpler, handles pagination)

**Search Parameters:**
```typescript
{
  chainTypes: 'EVM,SVM,UTXO,MVM', // All chain types
  orderBy: 'volumeUSD24H', // Sort by volume
  extended: true, // Get more metadata
  search: 'USDC', // Search query
  limit: 1000, // Max results
  minPriceUSD: 0.000001, // Filter dust
}
```

**Decimals Preservation:**
- LiFi response includes `decimals` field
- Ensure it's preserved in normalization ✅

### 3. Provider Registry Updates

**Register Jupiter Provider:**
```typescript
// lib/backend/providers/init.ts
import { JupiterTokenProvider } from './jupiter';
import { getProviderRegistry } from './registry';

export function initProviders() {
  const registry = getProviderRegistry();
  
  // Register Jupiter for Solana
  registry.registerProvider(new JupiterTokenProvider(), {
    priority: 1, // Highest priority for Solana
    supportedChains: [SOLANA_CHAIN_ID],
  });
  
  // LiFi already registered (for EVM/cross-chain)
}
```

**Update Primary Provider Logic:**
```typescript
// In ProviderRegistry.getPrimaryProviders()
getPrimaryProviders(chainId: number): BaseTokenProvider[] {
  if (chainId === SOLANA_CHAIN_ID) {
    return [this.getProvider('jupiter')]; // Jupiter for Solana
  }
  
  // EVM and cross-chain: LiFi
  return [this.getProvider('lifi')];
}
```

---

## Migration Strategy

### Step 1: Create Jupiter Provider (Non-Breaking)
- Add `JupiterTokenProvider` class
- Register in provider registry
- Test with Solana chain only

### Step 2: Update Aggregation Service (Non-Breaking)
- Change search priority (primary → fallback)
- Add chain-specific provider selection
- Keep DexScreener as fallback

### Step 3: Enhance LiFi Provider (Non-Breaking)
- Add direct API support for search
- Keep SDK for "all tokens"
- Preserve backward compatibility

### Step 4: Remove Address Normalization (Breaking, but Good)
- Remove SOL address normalization from Jupiter adapter
- Tokens now come in correct format from Jupiter provider
- Cleaner architecture ✅

---

## Testing Checklist

### Solana Search
- [ ] Search "SOL" → Returns Jupiter format address
- [ ] Search "USDC" on Solana → Returns correct token
- [ ] Search obscure token → Falls back to DexScreener
- [ ] "All tokens" on Solana → Returns top traded tokens

### Cross-Chain Search
- [ ] Search "USDC" across chains → Returns from multiple chains
- [ ] Search with LiFi direct API → Uses extended params
- [ ] Decimals preserved from LiFi → ✅
- [ ] "All tokens" across chains → Uses LiFi SDK

### Fallback Logic
- [ ] Primary providers return < 3 results → DexScreener used
- [ ] No exact match → DexScreener used
- [ ] Query > 3 chars → DexScreener used

---

## Potential Issues & Solutions

### Issue 1: Jupiter API Rate Limits
**Problem**: Jupiter API may have rate limits
**Solution**: 
- Cache results (5 min TTL)
- Use category endpoints for "all tokens" (less API calls)
- Implement exponential backoff

### Issue 2: LiFi Direct API vs SDK
**Problem**: Two ways to fetch (SDK vs direct API)
**Solution**:
- Use direct API for search (better control)
- Use SDK for "all tokens" (simpler)
- Document the decision

### Issue 3: Address Format Consistency
**Problem**: Need to ensure Jupiter format throughout
**Solution**:
- Jupiter provider always returns Jupiter format ✅
- Remove normalization layer (no longer needed)
- Single source of truth

### Issue 4: Decimals from Multiple Sources
**Problem**: Decimals from LiFi, Jupiter, DexScreener
**Solution**:
- Prioritize: Jupiter (Solana) > LiFi (cross-chain) > DexScreener (fallback)
- Cache decimals to avoid redundant fetches
- Fetch on-demand if missing (RouteService)

---

## Success Metrics

### Before Implementation
- ❌ Solana search uses LiFi (wrong format)
- ❌ DexScreener prioritized for search
- ❌ Address format mismatch (swap failures)
- ❌ LiFi search not optimized

### After Implementation
- ✅ Solana search uses Jupiter (correct format)
- ✅ Primary providers prioritized
- ✅ Address format consistent (no swap failures)
- ✅ LiFi search optimized (direct API, extended params)
- ✅ Better token metadata (Jupiter Ultra API)
- ✅ Decimals preserved from all providers

---

## Conclusion

**Your approach is sound**, but the implementation needs refinement:

1. **Create Jupiter Provider** - Use Ultra Search API for best results
2. **Enhance LiFi Provider** - Use direct API for search, SDK for "all tokens"
3. **Fix Search Priority** - Primary providers first, DexScreener as fallback
4. **Remove Normalization** - Jupiter format throughout (cleaner)

**This will give you:**
- ✅ Consistent address formats
- ✅ Better search results
- ✅ Richer token metadata
- ✅ Proper provider prioritization
- ✅ Cleaner architecture

**Ready to implement?** Let me know and I'll start with the Jupiter provider!

