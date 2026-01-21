# Token Enrichment Timing Decision

**Date:** 2024  
**Status:** Decision Document

---

## Question

**When should token metadata enrichment happen?**
- During search?
- When looking for routes to swap?
- Will enrichment block the main response?

**Main Concern:** Speed and fast UX - enrichment must be non-blocking.

---

## Decision: Non-Blocking Background Enrichment

### ✅ Primary Response (Fast, Blocking)

**What Happens:**
1. Search primary providers (LiFi/Relay/Jupiter/Squid)
2. Try DexScreener if needed (fallback)
3. Normalize tokens
4. Apply similarity scoring
5. Deduplicate and sort
6. **Return immediately** (fast response)

**Timing:** Synchronous, blocking (but fast - only primary providers)

**Result:** User sees tokens immediately with primary provider data

---

### ✅ Background Enrichment (Non-Blocking)

**What Happens (After Response):**
1. For each returned token:
   - Check router providers for same token (LiFi, Squid, Relay, Jupiter)
   - Fetch DexScreener liquidity data
   - Store router-specific formats
2. Update cache when enrichment completes
3. **Does NOT block response**

**Timing:** Asynchronous, fire-and-forget

**Result:** Tokens are enriched in background, cache updated for future use

---

## Enrichment Strategy

### Option 1: During Search (Background) ✅ **SELECTED**

**Flow:**
```
Search Request
    ↓
Fetch Primary Providers (blocking, fast)
    ↓
Return Results Immediately ← User sees tokens here
    ↓
Background: Enrich tokens (non-blocking)
    ↓
Update Cache (for future requests)
```

**Pros:**
- ✅ Fast initial response
- ✅ Enrichment happens automatically
- ✅ Cache updated for future use
- ✅ Router formats available when user selects token

**Cons:**
- ⚠️ Enrichment may not complete before user selects token
- ⚠️ Some API calls may be unnecessary (if user doesn't select token)

**Decision:** ✅ Use this approach

---

### Option 2: On-Demand When Routing

**Flow:**
```
User Selects Token for Swap
    ↓
Check if router formats exist in cache
    ↓
If not, fetch from router providers (blocking)
    ↓
Use for routing
```

**Pros:**
- ✅ Only fetch what's needed
- ✅ No unnecessary API calls

**Cons:**
- ⚠️ Slower when user selects token (blocking)
- ⚠️ User waits for enrichment before swap

**Decision:** ❌ Too slow for UX

---

### Option 3: Hybrid Approach ✅ **BEST**

**Flow:**
```
Search Request
    ↓
Fetch Primary Providers (blocking, fast)
    ↓
Return Results Immediately ← User sees tokens here
    ↓
Background: Start enrichment (non-blocking)
    ↓
User Selects Token
    ↓
If enrichment complete → Use enriched data
If not complete → Fetch on-demand (fallback)
```

**Pros:**
- ✅ Fast initial response
- ✅ Enrichment happens in background
- ✅ Fallback if enrichment not ready
- ✅ Best of both worlds

**Cons:**
- ⚠️ Slightly more complex logic

**Decision:** ✅ Use this approach (Hybrid)

---

## Implementation Details

### Primary Response (Fast Path)

```typescript
async function searchTokens(params: SearchParams): Promise<NormalizedToken[]> {
  // 1. Fetch from primary providers (parallel, blocking)
  const primaryProviders = getPrimaryProviders(params.chainId);
  const results = await Promise.all(
    primaryProviders.map(p => p.fetchTokens(params))
  );
  
  // 2. Try DexScreener if needed (blocking)
  if (shouldUseDexScreener(results, params.query)) {
    const dexResults = await dexscreenerProvider.fetchTokens(params);
    results.push(dexResults);
  }
  
  // 3. Normalize, deduplicate, sort
  const normalized = normalizeAndDeduplicate(results);
  const sorted = sortByRelevance(normalized, params.query);
  const limited = sorted.slice(0, 30);
  
  // 4. Return immediately (fast!)
  return limited;
  
  // 5. Start background enrichment (fire-and-forget)
  enrichTokensInBackground(limited).catch(console.error);
}
```

### Background Enrichment (Non-Blocking)

```typescript
async function enrichTokensInBackground(
  tokens: NormalizedToken[]
): Promise<void> {
  // This runs in background, doesn't block response
  for (const token of tokens) {
    try {
      // Check router providers (parallel)
      const routerFormats = await Promise.allSettled([
        checkLiFiForToken(token),
        checkSquidForToken(token),
        checkRelayForToken(token),
        checkJupiterForToken(token),
      ]);
      
      // Fetch liquidity (if DexScreener available)
      const liquidity = await fetchDexScreenerLiquidity(token).catch(() => null);
      
      // Update token with enrichment
      const enriched = {
        ...token,
        routerFormats: extractRouterFormats(routerFormats),
        liquidity: liquidity || undefined,
        enrichedBy: ['lifi', 'squid', 'relay', 'dexscreener'].filter(p => 
          routerFormats.find(r => r.status === 'fulfilled' && r.value) || liquidity
        ),
      };
      
      // Update cache (for future requests)
      updateTokenInCache(enriched);
    } catch (error) {
      // Silent failure - don't break anything
      console.warn(`[Enrichment] Failed for token ${token.address}:`, error);
    }
  }
}
```

### On-Demand Fallback (When Routing)

```typescript
async function getTokenForRouting(
  token: NormalizedToken,
  router: 'lifi' | 'squid' | 'relay' | 'jupiter'
): Promise<RouterTokenFormat> {
  // Check cache first
  if (token.routerFormats?.[router]) {
    return token.routerFormats[router];
  }
  
  // If not in cache, fetch on-demand (blocking, but only when needed)
  return await fetchRouterFormat(token, router);
}
```

---

## Performance Characteristics

### Response Time

- **Primary Response:** ~200-500ms (primary providers only)
- **Background Enrichment:** ~1-3s (non-blocking, doesn't affect UX)
- **On-Demand Fallback:** ~200-500ms (only if enrichment not ready)

### User Experience

1. **User types query** → Instant cached results (if available)
2. **Primary providers fetch** → ~200-500ms → Results appear
3. **Background enrichment** → Happens silently, updates cache
4. **User selects token** → Router formats ready (or fetch on-demand)

**Result:** Fast, responsive UX with automatic enrichment

---

## Summary

**Enrichment Timing:**
- ✅ **During search (background)** - Non-blocking, automatic
- ✅ **On-demand fallback** - If enrichment not ready when routing

**Key Principle:**
- **Never block the main response for enrichment**
- **Speed first, enrich in background**
- **Cache enrichment for future use**

**Architecture:**
- Fast primary response (primary providers only)
- Background enrichment (fire-and-forget)
- On-demand fallback (if needed for routing)


