# Portfolio Page Skeleton UI Implementation Plan

## Problem Analysis

**Current Issues:**
1. Page loads with default/mock values first (showing "$0.00", empty lists)
2. Skeleton UI appears 1-2 seconds AFTER page load (backwards behavior)
3. TanStack Query's `isLoading` is only `true` on first fetch - if cached data exists, it's `false` even during refetch
4. No skeleton for Send/Receive tabs
5. No prefetching of portfolio data on page load

**Root Cause:**
- TanStack Query returns `isLoading: false` if cached data exists, even if it's stale and being refetched
- Need to check `isFetching` or `!data` to show skeleton during refetch
- No prefetching means data fetch starts only when component mounts

## Solution Strategy

### 1. **Enhanced Loading State Detection**
   - Use `isLoading || isFetching` or check `!data` to show skeleton
   - Show skeleton immediately if no data exists, even if `isLoading` is false
   - Use `isPending` (TanStack Query v5) if available, or combine states

### 2. **Comprehensive Skeleton Components**
   - Create skeleton for ALL sections:
     - Balance section (total balance + daily change)
     - Assets list (left panel)
     - NFTs grid (left panel)
     - Send tab (form fields, buttons)
     - Receive tab (QR code, address)
     - Activities/Transactions list (right panel)
   - Use shimmer animation (like Bybit) for professional look

### 3. **Prefetching Strategy**
   - Prefetch portfolio data when wallet is connected
   - Prefetch on route navigation (before user reaches portfolio page)
   - Use TanStack Query's `prefetchQuery` in layout or route handler

### 4. **Server-Side Rendering (Optional Enhancement)**
   - Consider SSR for initial balance data (if wallet address available)
   - Use Next.js `getServerSideProps` or Server Components (App Router)
   - Hydrate with client-side data for real-time updates

## Implementation Plan

### Phase 1: Fix Loading State Detection

**File**: `hooks/useWalletBalances.ts`, `hooks/usePortfolioBalance.ts`, etc.

**Changes:**
```typescript
// Current: Only returns isLoading
return {
  balances: data?.balances || [],
  totalUSD: data?.totalUSD || '0.00',
  isLoading,
  // ...
};

// New: Return both isLoading and isFetching
const {
  data,
  isLoading,
  isFetching, // NEW: Track refetch state
  error,
  refetch,
} = useQuery({...});

// Determine if skeleton should show
const showSkeleton = isLoading || (isFetching && !data);

return {
  balances: data?.balances || [],
  totalUSD: data?.totalUSD || '0.00',
  isLoading: showSkeleton, // Combined state
  isFetching, // Expose separately if needed
  // ...
};
```

**Alternative Approach (Better):**
```typescript
// Check if data exists - if not, show skeleton
const hasData = !!data;
const showSkeleton = isLoading || (isFetching && !hasData);
```

### Phase 2: Create Comprehensive Skeleton Components

**New File**: `components/portfolio/skeletons/portfolio-skeletons.tsx`

**Components to Create:**
1. `BalanceSkeleton` - For total balance + daily change
2. `AssetListSkeleton` - For assets list (5-6 items)
3. `NFTGridSkeleton` - For NFT grid (4-6 items)
4. `SendFormSkeleton` - For send form (inputs, buttons)
5. `ReceiveSkeleton` - For receive tab (QR code, address)
6. `TransactionListSkeleton` - For activities list (8-10 items)

**Shimmer Animation:**
```css
/* Add to globals.css */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    #0E1310 0%,
    #1A1F1A 50%,
    #0E1310 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s ease-in-out infinite;
}
```

### Phase 3: Update Portfolio Page to Use Enhanced Loading States

**File**: `app/portfolio/page.tsx`

**Changes:**
1. Update all hooks to expose `isFetching`
2. Use combined loading state: `isLoading || (isFetching && !data)`
3. Replace all conditional rendering with skeleton components
4. Remove default/mock values - show skeleton instead

**Example:**
```typescript
// Current
const { data: balanceData, isLoading: balanceLoading } = usePortfolioBalance(connectedAddress);
const displayBalance = balanceData?.totalUSD || "0.00"; // ❌ Shows "0.00" immediately

// New
const { 
  data: balanceData, 
  isLoading: balanceLoading,
  isFetching: balanceFetching 
} = usePortfolioBalance(connectedAddress);

const hasBalanceData = !!balanceData;
const showBalanceSkeleton = balanceLoading || (balanceFetching && !hasBalanceData);

// In JSX
{showBalanceSkeleton ? (
  <BalanceSkeleton />
) : balanceData ? (
  <BalanceDisplay data={balanceData} />
) : (
  <BalanceError />
)}
```

### Phase 4: Add Prefetching

**Option A: Prefetch on Route Navigation (Recommended)**

**File**: `app/portfolio/page.tsx` or `components/prefetch/prefetch-provider.tsx`

```typescript
// In PrefetchProvider or portfolio page
useEffect(() => {
  const { connectedAddress } = useWalletConnection();
  
  if (connectedAddress) {
    // Prefetch portfolio data when wallet is connected
    queryClient.prefetchQuery({
      queryKey: ['wallet-balances', connectedAddress.toLowerCase()],
      queryFn: () => fetchWalletBalances(connectedAddress),
    });
    
    queryClient.prefetchQuery({
      queryKey: ['wallet-transactions', connectedAddress.toLowerCase(), 50],
      queryFn: () => fetchWalletTransactions(connectedAddress, { limit: 50, offset: 0 }),
    });
    
    queryClient.prefetchQuery({
      queryKey: ['wallet-nfts', connectedAddress.toLowerCase()],
      queryFn: () => fetchWalletNFTs(connectedAddress),
    });
  }
}, [connectedAddress, queryClient]);
```

**Option B: Prefetch on Link Hover (Advanced)**

**File**: `components/navigation/portfolio-link.tsx` (if exists)

```typescript
// Prefetch when user hovers over portfolio link
<Link
  href="/portfolio"
  onMouseEnter={() => {
    if (connectedAddress) {
      // Prefetch portfolio data
    }
  }}
>
  Portfolio
</Link>
```

### Phase 5: Server-Side Rendering (Optional - Future Enhancement)

**File**: `app/portfolio/page.tsx` (convert to Server Component or use `getServerSideProps`)

**Considerations:**
- Wallet address is client-side only (from wallet connection)
- Can't SSR wallet data without server-side wallet connection
- **Recommendation**: Skip SSR for now, focus on prefetching and better loading states

## Detailed Component Structure

### Balance Skeleton
```tsx
function BalanceSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-9 w-32 skeleton-shimmer" />
      <Skeleton className="h-5 w-40 skeleton-shimmer" />
    </div>
  );
}
```

### Asset List Skeleton
```tsx
function AssetListSkeleton() {
  return (
    <ul className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <li
          key={i}
          className="grid grid-cols-[20px_120px_80px_1fr] gap-3 items-center rounded-xl bg-[#0E1310] px-2 py-3"
        >
          <Skeleton className="h-5 w-5 rounded-full skeleton-shimmer" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-16 skeleton-shimmer" />
            <Skeleton className="h-3 w-24 skeleton-shimmer" />
          </div>
          <div className="flex justify-start">
            <Skeleton className="h-7 w-20 skeleton-shimmer" />
          </div>
          <div className="text-right space-y-1">
            <Skeleton className="h-4 w-16 skeleton-shimmer" />
            <Skeleton className="h-3 w-20 skeleton-shimmer" />
          </div>
        </li>
      ))}
    </ul>
  );
}
```

### Send Form Skeleton
```tsx
function SendFormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-xl skeleton-shimmer" />
      <Skeleton className="h-12 w-full rounded-xl skeleton-shimmer" />
      <Skeleton className="h-12 w-32 rounded-xl skeleton-shimmer" />
    </div>
  );
}
```

### Receive Tab Skeleton
```tsx
function ReceiveSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-48 rounded-md skeleton-shimmer" />
      <Skeleton className="h-12 w-full rounded-xl skeleton-shimmer" />
      <Skeleton className="h-10 w-32 rounded-full skeleton-shimmer" />
    </div>
  );
}
```

## Implementation Steps

### Step 1: Update Hooks to Expose `isFetching`
- [ ] Update `useWalletBalances` to return `isFetching`
- [ ] Update `usePortfolioBalance` to return `isFetching`
- [ ] Update `useWalletTransactions` to return `isFetching`
- [ ] Update `useWalletNFTs` to return `isFetching`

### Step 2: Create Skeleton Components
- [ ] Create `components/portfolio/skeletons/portfolio-skeletons.tsx`
- [ ] Implement `BalanceSkeleton`
- [ ] Implement `AssetListSkeleton`
- [ ] Implement `NFTGridSkeleton`
- [ ] Implement `SendFormSkeleton`
- [ ] Implement `ReceiveSkeleton`
- [ ] Implement `TransactionListSkeleton`
- [ ] Add shimmer animation to `globals.css`

### Step 3: Update Portfolio Page
- [ ] Replace balance section with skeleton logic
- [ ] Replace assets list with skeleton logic
- [ ] Replace NFTs grid with skeleton logic
- [ ] Replace send tab with skeleton logic
- [ ] Replace receive tab with skeleton logic
- [ ] Replace activities list with skeleton logic
- [ ] Remove all default/mock values

### Step 4: Add Prefetching
- [ ] Add prefetch logic to `PrefetchProvider` or portfolio page
- [ ] Prefetch when wallet is connected
- [ ] Test prefetching on route navigation

### Step 5: Testing
- [ ] Test with wallet connected (should show skeleton immediately)
- [ ] Test with wallet not connected (should show skeleton)
- [ ] Test with cached data (should show data immediately, no skeleton)
- [ ] Test with stale data (should show data + skeleton during refetch)
- [ ] Test all tabs (assets, NFTs, send, receive, activities)

## Expected Behavior (Bybit-style)

1. **Initial Load (No Cache)**:
   - Page renders → Skeleton shows immediately
   - API calls start → Skeleton continues
   - Data arrives → Skeleton fades out, data fades in

2. **Subsequent Loads (With Cache)**:
   - Page renders → Cached data shows immediately (no skeleton)
   - Background refetch starts → Data still visible (no skeleton)
   - New data arrives → Smooth update (no flicker)

3. **Wallet Not Connected**:
   - Page renders → Skeleton shows for all sections
   - User connects wallet → Skeleton continues
   - Data arrives → Skeleton fades out, data fades in

## Questions for Clarification

1. **Shimmer Animation**: Should we use shimmer (Bybit-style) or simple gray skeletons?
   - **Recommendation**: Shimmer for professional look

2. **Prefetching**: Should we prefetch on app load or only when navigating to portfolio?
   - **Recommendation**: Prefetch when wallet is connected (in PrefetchProvider)

3. **SSR**: Do you want server-side rendering, or is client-side prefetching sufficient?
   - **Recommendation**: Start with prefetching, add SSR later if needed

4. **Loading States**: Should we show skeleton during background refetch, or only on initial load?
   - **Recommendation**: Only on initial load (when no data exists)

5. **Error States**: Should error states also have skeleton-like placeholders?
   - **Recommendation**: No, show error message with retry button

## Next Steps

1. Review and approve this plan
2. Implement Step 1 (Update hooks)
3. Implement Step 2 (Create skeletons)
4. Implement Step 3 (Update portfolio page)
5. Implement Step 4 (Add prefetching)
6. Test and iterate
7. Deploy

