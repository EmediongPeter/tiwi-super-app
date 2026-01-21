# Fetch + Custom Cache vs TanStack Query: Scalability Analysis

## Executive Summary

**Recommendation: Migrate to TanStack Query** for better scalability, maintainability, and consistency with the existing codebase.

## Current Implementation: Fetch + Custom Wallet Cache

### Architecture
- Custom in-memory cache (`lib/frontend/cache/wallet-cache.ts`)
- Manual cache key management
- TTL-based expiration
- Manual cleanup via intervals
- Fetch API with manual error handling

### Pros ✅

1. **Lightweight**: No additional dependencies (fetch is native)
2. **Full Control**: Complete control over caching logic
3. **Simple**: Straightforward implementation for basic use cases
4. **No Learning Curve**: Uses standard fetch API

### Cons ❌

1. **Manual Request Deduplication**: Must implement manually
2. **No Background Refetching**: No automatic stale-while-revalidate
3. **Manual Cache Invalidation**: Must manually clear cache on wallet disconnect
4. **No Request Cancellation**: Can't cancel in-flight requests
5. **No Optimistic Updates**: Must implement manually
6. **Limited Error Recovery**: Basic retry logic must be implemented
7. **No DevTools**: No debugging tools for cache inspection
8. **Inconsistent with Codebase**: Other parts use TanStack Query
9. **Maintenance Burden**: More code to maintain and test
10. **No Request Batching**: Multiple components fetching same data = duplicate requests

## TanStack Query Implementation

### Architecture
- Built-in caching with intelligent invalidation
- Automatic request deduplication
- Background refetching (stale-while-revalidate)
- Request cancellation
- Optimistic updates support
- DevTools for debugging
- Already integrated in codebase

### Pros ✅

1. **Request Deduplication**: Multiple components requesting same data = single request
2. **Background Refetching**: Automatically refetches stale data in background
3. **Intelligent Caching**: Smart cache invalidation and garbage collection
4. **Request Cancellation**: Automatically cancels requests when components unmount
5. **Optimistic Updates**: Built-in support for optimistic UI updates
6. **Error Recovery**: Advanced retry logic with exponential backoff
7. **DevTools**: Excellent debugging tools (`@tanstack/react-query-devtools`)
8. **Consistency**: Matches existing codebase patterns (`useTokensQuery`, `useTokenSearch`)
9. **Less Code**: Less boilerplate, more declarative
10. **Type Safety**: Better TypeScript integration
11. **Pagination Support**: Built-in infinite query support
12. **Focus Refetching**: Can refetch on window focus (configurable)
13. **Network Status**: Automatic detection of online/offline status

### Cons ❌

1. **Bundle Size**: Adds ~13KB gzipped (but already in dependencies)
2. **Learning Curve**: Team needs to understand TanStack Query concepts
3. **Overhead**: Slight overhead for very simple use cases (not applicable here)

## Scalability Comparison

### Scenario 1: Multiple Components Fetching Same Data

**Fetch + Cache:**
```typescript
// Component A
const { balances } = useWalletBalances(address); // Request 1

// Component B (same address)
const { balances } = useWalletBalances(address); // Request 2 (duplicate!)

// Result: 2 API calls, cache helps but both components trigger fetch
```

**TanStack Query:**
```typescript
// Component A
const { data } = useQuery(['wallet-balances', address], fetchBalances);

// Component B (same address)
const { data } = useQuery(['wallet-balances', address], fetchBalances);

// Result: 1 API call (automatic deduplication)
```

**Winner: TanStack Query** - Eliminates duplicate requests automatically

---

### Scenario 2: Wallet Disconnect

**Fetch + Cache:**
```typescript
// Must manually clear cache
const disconnect = () => {
  cache.clearWallet(address);
  // ... disconnect logic
};
```

**TanStack Query:**
```typescript
// Automatic or simple invalidation
const disconnect = () => {
  queryClient.invalidateQueries(['wallet-balances', address]);
  // ... disconnect logic
};
```

**Winner: TanStack Query** - Simpler, more declarative

---

### Scenario 3: Stale Data Refetching

**Fetch + Cache:**
```typescript
// Must manually implement
const fetchBalances = async () => {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data; // Return stale data
  }
  // Fetch new data
};
// No background refetching
```

**TanStack Query:**
```typescript
// Automatic stale-while-revalidate
useQuery({
  queryKey: ['wallet-balances', address],
  queryFn: fetchBalances,
  staleTime: 30000, // Considered fresh for 30s
  gcTime: 300000, // Cache for 5min
});
// Automatically refetches in background when stale
```

**Winner: TanStack Query** - Better UX with background updates

---

### Scenario 4: Component Unmount During Fetch

**Fetch + Cache:**
```typescript
// Must manually cancel
useEffect(() => {
  const abortController = new AbortController();
  fetch(url, { signal: abortController.signal });
  return () => abortController.abort();
}, []);
```

**TanStack Query:**
```typescript
// Automatic cancellation
useQuery(['key'], fetchFn);
// Automatically cancels when component unmounts
```

**Winner: TanStack Query** - Automatic request cancellation

---

### Scenario 5: Error Recovery & Retry

**Fetch + Cache:**
```typescript
// Must implement manually
let retries = 0;
const fetchWithRetry = async () => {
  try {
    return await fetch(url);
  } catch (error) {
    if (retries < 3) {
      retries++;
      await delay(1000 * retries);
      return fetchWithRetry();
    }
    throw error;
  }
};
```

**TanStack Query:**
```typescript
// Built-in retry with exponential backoff
useQuery({
  queryKey: ['key'],
  queryFn: fetchFn,
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

**Winner: TanStack Query** - Advanced retry logic out of the box

---

### Scenario 6: Infinite Scroll / Pagination

**Fetch + Cache:**
```typescript
// Must implement manually
const [transactions, setTransactions] = useState([]);
const [offset, setOffset] = useState(0);

const loadMore = async () => {
  const newData = await fetchTransactions(offset);
  setTransactions([...transactions, ...newData]);
  setOffset(offset + limit);
};
```

**TanStack Query:**
```typescript
// Built-in infinite query
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: ['transactions', address],
  queryFn: ({ pageParam = 0 }) => fetchTransactions(pageParam),
  getNextPageParam: (lastPage, pages) => lastPage.hasMore ? pages.length * 20 : undefined,
});
```

**Winner: TanStack Query** - Much simpler pagination

---

### Scenario 7: Optimistic Updates

**Fetch + Cache:**
```typescript
// Must implement manually
const updateBalance = async (newBalance) => {
  // Optimistically update UI
  setBalance(newBalance);
  try {
    await updateBalanceAPI(newBalance);
  } catch (error) {
    // Rollback on error
    setBalance(oldBalance);
  }
};
```

**TanStack Query:**
```typescript
// Built-in optimistic updates
const mutation = useMutation({
  mutationFn: updateBalanceAPI,
  onMutate: async (newBalance) => {
    await queryClient.cancelQueries(['wallet-balances']);
    const previous = queryClient.getQueryData(['wallet-balances']);
    queryClient.setQueryData(['wallet-balances'], newBalance);
    return { previous };
  },
  onError: (err, newBalance, context) => {
    queryClient.setQueryData(['wallet-balances'], context.previous);
  },
});
```

**Winner: TanStack Query** - Better UX with optimistic updates

---

## Performance Metrics

### Bundle Size Impact
- **TanStack Query**: ~13KB gzipped (already in dependencies)
- **Custom Cache**: ~2KB (minimal, but adds maintenance)

### Runtime Performance
- **TanStack Query**: Slightly more overhead, but negligible
- **Custom Cache**: Minimal overhead, but missing features

### Network Efficiency
- **TanStack Query**: Better (request deduplication, smart refetching)
- **Custom Cache**: Good, but requires manual optimization

---

## Codebase Consistency

### Current State
- ✅ Token fetching: Uses TanStack Query (`useTokensQuery`, `useTokenSearch`)
- ✅ QueryProvider: Already configured
- ❌ Wallet balances: Uses custom fetch + cache
- ❌ Wallet transactions: Uses custom fetch + cache
- ❌ Token balances: Uses custom fetch + cache

### After Migration
- ✅ All data fetching: Consistent TanStack Query pattern
- ✅ Single caching strategy
- ✅ Easier to maintain and understand

---

## Migration Effort

### Estimated Time
- **Small**: 2-3 hours
- **Benefits**: Long-term maintainability and scalability

### Migration Steps
1. Replace `useWalletBalances` with TanStack Query
2. Replace `useWalletTransactions` with TanStack Query (use `useInfiniteQuery`)
3. Replace `useTokenBalance` with TanStack Query
4. Remove custom cache utility
5. Update components to use new hooks

---

## Final Recommendation

### ✅ **Migrate to TanStack Query**

**Reasons:**
1. **Already in codebase**: TanStack Query is already installed and used
2. **Better scalability**: Automatic request deduplication, background refetching
3. **Consistency**: Matches existing patterns (`useTokensQuery`)
4. **Less code**: Less boilerplate, more declarative
5. **Better DX**: DevTools, better error handling, optimistic updates
6. **Future-proof**: Industry standard, actively maintained
7. **Pagination**: Built-in infinite query support for transactions

**When to keep custom cache:**
- Only if you need very specific caching behavior not supported by TanStack Query
- If bundle size is critical (not applicable - already installed)
- If you need server-side caching (TanStack Query can work with SSR)

---

## Conclusion

For a production application that needs to scale, **TanStack Query is the better choice**. It provides:
- Better performance (request deduplication)
- Better UX (background refetching, optimistic updates)
- Better maintainability (less code, consistent patterns)
- Better developer experience (DevTools, TypeScript support)

The custom cache approach works, but requires more code and manual optimization. Since TanStack Query is already in the codebase and used for token fetching, migrating wallet data fetching to TanStack Query will create consistency and reduce maintenance burden.

