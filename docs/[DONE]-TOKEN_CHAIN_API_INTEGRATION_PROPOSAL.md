# Token & Chain API Integration Proposal

**Date:** 2025-01-27  
**Status:** 📋 **PROPOSAL - AWAITING APPROVAL**  
**Scope:** Real backend API integration for tokens and chains

---

## Step 1: Backend Contract Review

### 1.1 Token API (`/api/v1/tokens`)

**Endpoint:** `GET /api/v1/tokens`

**Request Parameters:**
```typescript
{
  chains?: string;      // Comma-separated chain IDs (e.g., "1,56,137")
  query?: string;       // Search query (name, symbol, address)
  limit?: string;       // Result limit (default: 30)
}
```

**Response Shape:**
```typescript
{
  tokens: NormalizedToken[];
  total: number;
  chainIds?: number[];
  query?: string;
  limit?: number | null;
}
```

**NormalizedToken (Backend):**
```typescript
{
  chainId: number;           // Canonical chain ID
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  priceUSD: string;
  providers: string[];       // ['lifi', 'dexscreener', etc.]
  verified?: boolean;
  vmType?: string;            // 'evm' | 'solana' | 'cosmos'
  chainBadge?: string;        // Chain badge identifier
  chainName?: string;         // Chain display name
  volume24h?: number;
  liquidity?: number;
  marketCap?: number;
}
```

**Key Observations:**
- ✅ Supports multi-chain requests (comma-separated `chains` param)
- ✅ Server-side search (via `query` param)
- ✅ Default limit: 30 tokens
- ✅ Returns normalized, provider-agnostic format
- ✅ Includes chain metadata (`chainId`, `chainName`, `chainBadge`)

**Expected Latency:**
- Initial load: ~200-500ms (LiFi API call)
- Search: ~200-500ms (server-side filtering)
- Multi-chain: Single API call (efficient)

**Failure Modes:**
- Network errors → Returns empty array with error message
- Invalid chain IDs → 400 error
- Provider failures → Graceful degradation (empty array)

---

### 1.2 Chain API (`/api/v1/chains`)

**Endpoint:** `GET /api/v1/chains`

**Request Parameters:**
```typescript
{
  provider?: 'lifi' | 'dexscreener' | 'relay';  // Filter by provider
  type?: 'EVM' | 'Solana' | 'Cosmos' | ...;     // Filter by type
}
```

**Response Shape:**
```typescript
{
  chains: ChainDTO[];
  total: number;
}
```

**ChainDTO (Backend):**
```typescript
{
  id: number;                // Canonical chain ID
  name: string;
  type: 'EVM' | 'Solana' | 'Cosmos' | ...;
  logoURI?: string;
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
  supportedProviders: string[];  // ['lifi', 'dexscreener', etc.]
  chainBadge?: string;            // Chain badge identifier
}
```

**Key Observations:**
- ✅ Returns all supported chains (100+ chains from LiFi)
- ✅ Supports filtering by provider or type
- ✅ Includes provider support metadata
- ✅ Stable data (changes infrequently)

**Expected Latency:**
- Initial load: ~200-500ms (LiFi API call)
- Cached on backend (chain list doesn't change often)

**Failure Modes:**
- Network errors → Returns empty array
- Falls back to registry chains

---

### 1.3 Data Stability Analysis

**Stable Data (Cache-Friendly):**
- ✅ **Chains** - Rarely change, can be cached for hours/days
- ✅ **Token metadata** (name, symbol, decimals) - Stable
- ✅ **Chain metadata** (name, logo, native currency) - Stable

**Frequently Changing Data:**
- ⚠️ **Token prices** (`priceUSD`) - Changes frequently
- ⚠️ **Token list** - New tokens added regularly
- ⚠️ **Volume/liquidity** - Changes frequently

**Growth Considerations:**
- Token list will grow as more providers are added
- Multi-chain requests will become more common
- Search will need to handle larger result sets

---

## Step 2: Frontend Data Fetching Strategy

### 2.1 Fetching Architecture

#### **A. Service Layer Pattern**

**Proposal:** Create dedicated API service layer, separate from UI components.

**File Structure:**
```
lib/
└── api/
    ├── tokens.ts          # Token fetching functions
    ├── chains.ts          # Chain fetching functions
    └── types.ts           # API request/response types (if needed)
```

**Responsibilities:**
- ✅ Make API calls
- ✅ Handle request/response transformation
- ✅ Error handling
- ✅ Type safety

**Why Not Direct Fetch in Components:**
- ❌ Duplicates fetch logic
- ❌ Hard to test
- ❌ No request deduplication
- ❌ Hard to add caching later

**Why Not TanStack Query Yet:**
- ⚠️ We're starting simple
- ⚠️ Can add TanStack Query later without refactoring
- ⚠️ Service layer prepares for TanStack Query migration

#### **B. Data Transformation Layer**

**Problem:** Backend `NormalizedToken` ≠ Frontend `Token`

**Backend Format:**
```typescript
{
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  logoURI: string;
  chainName: string;
  chainBadge: string;
  // ...
}
```

**Frontend Format (Current):**
```typescript
{
  id: string;              // Generated from address+chainId
  name: string;
  symbol: string;
  address: string;
  logo: string;            // From logoURI
  chain: string;           // From chainName
  chainBadge?: string;    // From chainBadge
  balance?: string;        // Not from API (wallet data)
  usdValue?: string;       // Not from API (calculated)
  price?: string;          // From priceUSD
}
```

**Solution:** Transformation function in service layer

```typescript
// lib/api/tokens.ts
function transformToken(backendToken: NormalizedToken): Token {
  return {
    id: `${backendToken.chainId}-${backendToken.address.toLowerCase()}`,
    name: backendToken.name,
    symbol: backendToken.symbol,
    address: backendToken.address,
    logo: backendToken.logoURI,
    chain: backendToken.chainName || `Chain ${backendToken.chainId}`,
    chainBadge: backendToken.chainBadge,
    price: backendToken.priceUSD,
    // balance and usdValue are not from API (wallet data)
  };
}
```

**Why Transform:**
- ✅ Keeps frontend components unchanged
- ✅ Handles data shape differences
- ✅ Single place to update if backend changes

#### **C. Component Consumption Pattern**

**Proposal:** Custom hooks that use service layer

```typescript
// hooks/useTokens.ts
export function useTokens(params: {
  chains?: number[];
  query?: string;
  limit?: number;
}) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Fetch logic using service layer
  }, [params]);

  return { tokens, isLoading, error };
}
```

**Benefits:**
- ✅ Reusable across components
- ✅ Handles loading/error states
- ✅ Can be replaced with TanStack Query later

---

### 2.2 Performance Strategy

#### **A. Request Deduplication**

**Problem:** Multiple components might request same data simultaneously.

**Solution:** Simple request cache (Map-based)

```typescript
// lib/api/tokens.ts
const requestCache = new Map<string, Promise<Token[]>>();

export async function fetchTokens(params: {
  chains?: number[];
  query?: string;
  limit?: number;
}): Promise<Token[]> {
  const cacheKey = JSON.stringify(params);
  
  // Return existing request if in progress
  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey)!;
  }
  
  // Create new request
  const request = fetchFromAPI(params)
    .then(tokens => {
      requestCache.delete(cacheKey);
      return tokens;
    })
    .catch(error => {
      requestCache.delete(cacheKey);
      throw error;
    });
  
  requestCache.set(cacheKey, request);
  return request;
}
```

**Why This Approach:**
- ✅ Prevents duplicate requests
- ✅ Lightweight (no external dependencies)
- ✅ Easy to replace with TanStack Query later

#### **B. Search Debouncing**

**Problem:** User types quickly → many API calls.

**Solution:** Debounce search input (300-500ms)

```typescript
// hooks/useTokenSearch.ts
export function useTokenSearch() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  
  const { tokens, isLoading } = useTokens({
    query: debouncedQuery,
  });
  
  return { query, setQuery, tokens, isLoading };
}
```

**Why 400ms:**
- ✅ Balances responsiveness vs API load
- ✅ Standard debounce delay
- ✅ Can be adjusted based on testing

#### **C. Avoiding Unnecessary Refetches**

**Strategy:**
1. **Chains:** Fetch once on mount, cache in memory
2. **Tokens:** Refetch when params change (chains, query)
3. **No refetch:** If params haven't changed

**Implementation:**
```typescript
// Chains: Fetch once
const chains = useMemo(() => {
  // Fetch chains on mount
}, []);

// Tokens: Refetch when params change
const tokens = useTokens({
  chains: selectedChains,
  query: searchQuery,
});
```

---

### 2.3 Caching Strategy (Now vs Later)

#### **A. Current Phase (No Heavy Caching)**

**What We Cache:**
- ✅ **Request deduplication** - In-flight requests only
- ✅ **Chains** - In-memory cache (fetch once per session)

**What We DON'T Cache:**
- ❌ Token lists (too dynamic)
- ❌ Search results (user-specific)
- ❌ Prices (change frequently)

**Why Minimal Caching:**
- ✅ Keeps implementation simple
- ✅ Avoids stale data issues
- ✅ Easy to add TanStack Query later

#### **B. TanStack Query Migration Path**

**Current Design Prepares For:**
```typescript
// Current (service layer)
const tokens = await fetchTokens({ chains: [1, 56] });

// Future (TanStack Query)
const { data: tokens } = useQuery({
  queryKey: ['tokens', { chains: [1, 56] }],
  queryFn: () => fetchTokens({ chains: [1, 56] }),
});
```

**Migration Strategy:**
1. Service layer functions become `queryFn` implementations
2. Custom hooks become TanStack Query hooks
3. No component changes needed

**Why This Works:**
- ✅ Service layer is already separated
- ✅ Functions are pure (no side effects)
- ✅ Easy to wrap with TanStack Query

#### **C. When to Add TanStack Query**

**Add TanStack Query When:**
- ⚠️ We need background refetching
- ⚠️ We need optimistic updates
- ⚠️ We need cross-page caching
- ⚠️ We need request cancellation
- ⚠️ We need retry logic

**Not Needed Now Because:**
- ✅ Simple fetch is sufficient
- ✅ No background refetching needed
- ✅ No cross-page caching needed
- ✅ Request deduplication handles most cases

**Decision:** ⏸️ **Defer TanStack Query** until we need advanced features. Use service layer + custom hooks for now.

---

## Step 3: Integration Plan

### 3.1 Step-by-Step Implementation

#### **Step 1: API Service Layer**

**Files to Create:**
- `lib/api/tokens.ts` - Token fetching functions
- `lib/api/chains.ts` - Chain fetching functions

**Implementation:**
- Create `fetchTokens()` function
- Create `fetchChains()` function
- Add request deduplication
- Add error handling
- Add type transformations

**Success Criteria:**
- ✅ Functions can fetch from backend
- ✅ Request deduplication works
- ✅ Error handling works
- ✅ Type transformations work

---

#### **Step 2: Custom Hooks**

**Files to Create:**
- `hooks/useTokens.ts` - Token fetching hook
- `hooks/useChains.ts` - Chain fetching hook
- `hooks/useTokenSearch.ts` - Token search hook (with debounce)

**Implementation:**
- Create hooks that use service layer
- Add loading/error states
- Add debouncing for search
- Handle empty states

**Success Criteria:**
- ✅ Hooks return data, loading, error
- ✅ Search debouncing works
- ✅ Loading states work correctly

---

#### **Step 3: Token Selector Integration**

**Files to Modify:**
- `components/swap/token-selector-modal.tsx`
- `app/swap/page.tsx`

**Implementation:**
- Replace `MOCK_TOKENS` with `useTokens()` hook
- Replace `MOCK_CHAINS` with `useChains()` hook
- Add loading indicators
- Add error handling
- Add empty states

**Success Criteria:**
- ✅ Tokens load from API
- ✅ Chains load from API
- ✅ Loading states display correctly
- ✅ Error states display correctly
- ✅ Empty states display correctly

---

#### **Step 4: Search Integration**

**Files to Modify:**
- `components/swap/token-selector-modal.tsx`
- `hooks/useTokenSearch.ts`

**Implementation:**
- Use `useTokenSearch()` hook
- Pass search query to backend
- Remove client-side filtering (use server-side)
- Add debouncing

**Success Criteria:**
- ✅ Search works with backend
- ✅ Debouncing prevents excessive requests
- ✅ Search is responsive

---

#### **Step 5: Chain Filtering Integration**

**Files to Modify:**
- `components/swap/token-selector-modal.tsx`

**Implementation:**
- When chain selected, fetch tokens for that chain
- Update API call with `chains` parameter
- Handle "all chains" case

**Success Criteria:**
- ✅ Chain filtering works
- ✅ "All chains" shows all tokens
- ✅ Single chain shows filtered tokens

---

#### **Step 6: Loading & Error States**

**Files to Modify:**
- `components/swap/token-list-panel.tsx`
- `components/swap/chain-selector-panel.tsx`

**Implementation:**
- Add loading skeletons
- Add error messages
- Add empty state messages
- Handle network errors gracefully

**Success Criteria:**
- ✅ Loading states are clear
- ✅ Error messages are helpful
- ✅ Empty states are informative

---

### 3.2 Testing Checklist

**Token Fetching:**
- ✅ Initial load works
- ✅ Loading state displays
- ✅ Error handling works
- ✅ Empty state displays

**Token Search:**
- ✅ Search works
- ✅ Debouncing works (no excessive requests)
- ✅ Search is responsive
- ✅ Empty search results display

**Chain Filtering:**
- ✅ Chain selection works
- ✅ "All chains" works
- ✅ Single chain filtering works
- ✅ Multi-chain filtering works

**Performance:**
- ✅ No duplicate requests
- ✅ Fast initial load
- ✅ Responsive search
- ✅ No UI blocking

---

## 4. TanStack Query Justification

### 4.1 Why NOT TanStack Query Now

**Current Needs:**
- ✅ Simple fetch from API
- ✅ Loading/error states
- ✅ Request deduplication

**TanStack Query Provides:**
- ✅ All of the above
- ⚠️ Plus: Background refetching
- ⚠️ Plus: Optimistic updates
- ⚠️ Plus: Cross-page caching
- ⚠️ Plus: Request cancellation
- ⚠️ Plus: Retry logic

**Why Not Now:**
- ⚠️ We don't need advanced features yet
- ⚠️ Adds complexity (learning curve)
- ⚠️ Adds dependency (~15KB)
- ⚠️ Can add later without refactoring

### 4.2 When to Add TanStack Query

**Add When:**
- ⚠️ We need background refetching (e.g., price updates)
- ⚠️ We need optimistic updates (e.g., token selection)
- ⚠️ We need cross-page caching (e.g., token list persists across pages)
- ⚠️ We need request cancellation (e.g., cancel search on unmount)
- ⚠️ We need retry logic (e.g., retry failed requests)

**Migration Path:**
- ✅ Service layer functions become `queryFn`
- ✅ Custom hooks become TanStack Query hooks
- ✅ No component changes needed

**Decision:** ⏸️ **Defer TanStack Query** until we need advanced features. Use service layer + custom hooks for now.

---

## 5. File Structure

### 5.1 Proposed Structure

```
lib/
└── api/
    ├── tokens.ts          # Token fetching functions
    ├── chains.ts          # Chain fetching functions
    └── client.ts          # Base API client (optional, for shared config)

hooks/
├── useTokens.ts           # Token fetching hook
├── useChains.ts           # Chain fetching hook
└── useTokenSearch.ts      # Token search hook (with debounce)

components/
└── swap/
    ├── token-selector-modal.tsx    # Updated to use hooks
    ├── token-list-panel.tsx        # Updated for loading/error states
    └── chain-selector-panel.tsx    # Updated for loading/error states
```

---

## 6. Implementation Details

### 6.1 API Service Functions

**`lib/api/tokens.ts`:**
```typescript
import type { NormalizedToken } from '@/lib/types/backend-tokens';
import type { Token } from '@/lib/types/tokens';

// Request deduplication cache
const requestCache = new Map<string, Promise<Token[]>>();

export async function fetchTokens(params: {
  chains?: number[];
  query?: string;
  limit?: number;
}): Promise<Token[]> {
  // Implementation
}

function transformToken(backendToken: NormalizedToken): Token {
  // Transformation logic
}
```

**`lib/api/chains.ts`:**
```typescript
import type { ChainDTO } from '@/lib/types/backend-tokens';
import type { Chain } from '@/lib/types/tokens';

// In-memory cache (fetch once per session)
let chainsCache: Chain[] | null = null;

export async function fetchChains(params?: {
  provider?: string;
  type?: string;
}): Promise<Chain[]> {
  // Implementation
}

function transformChain(backendChain: ChainDTO): Chain {
  // Transformation logic
}
```

### 6.2 Custom Hooks

**`hooks/useTokens.ts`:**
```typescript
export function useTokens(params: {
  chains?: number[];
  query?: string;
  limit?: number;
}) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Fetch logic
  }, [params]);

  return { tokens, isLoading, error };
}
```

**`hooks/useTokenSearch.ts`:**
```typescript
export function useTokenSearch() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  
  const { tokens, isLoading, error } = useTokens({
    query: debouncedQuery,
  });
  
  return { query, setQuery, tokens, isLoading, error };
}
```

---

## 7. Success Criteria

### 7.1 Phase Complete When:

- ✅ Tokens load from real backend API
- ✅ Chains load from real backend API
- ✅ Search works with backend
- ✅ Loading states display correctly
- ✅ Error states display correctly
- ✅ Empty states display correctly
- ✅ Request deduplication works
- ✅ Search debouncing works
- ✅ No duplicate requests
- ✅ Fast initial load (<500ms)
- ✅ Responsive search
- ✅ Code is readable and modular
- ✅ Easy to migrate to TanStack Query later

---

## 8. Summary

### Key Decisions

1. ✅ **Service Layer Pattern** - Dedicated API functions, separate from UI
2. ✅ **Custom Hooks** - Reusable hooks that use service layer
3. ✅ **Request Deduplication** - Simple Map-based cache
4. ✅ **Search Debouncing** - 400ms debounce
5. ✅ **Minimal Caching** - Only in-flight requests and chains
6. ⏸️ **Defer TanStack Query** - Add when needed, easy migration path

### Architecture Benefits

- ✅ **Simple** - No unnecessary abstractions
- ✅ **Fast** - Request deduplication, debouncing
- ✅ **Scalable** - Easy to add TanStack Query later
- ✅ **Maintainable** - Clear separation of concerns
- ✅ **Testable** - Service layer is easy to test

### Next Steps

1. ✅ Review and approve this proposal
2. ⏸️ Implement Step 1: API Service Layer
3. ⏸️ Implement Step 2: Custom Hooks
4. ⏸️ Implement Step 3-6: Integration

---

**Status:** ⏸️ **AWAITING APPROVAL**

**Next Step:** After approval, implement Step 1 (API Service Layer).

---

**End of Proposal**

