# Global Wallet & Token Balance State Management - Review & Recommendations

## Executive Summary

**Current State**: You're using TanStack Query (React Query) for data fetching, which already provides excellent caching and state management capabilities.

**Recommendation**: **Enhance your existing TanStack Query setup** rather than adding a separate global state library. This follows industry best practices and leverages what you already have.

---

## Industry Standards & Best Practices

### 1. **TanStack Query (React Query) - Industry Standard ✅**

**Why it's the best choice:**
- **Already in your stack** - You're using it, so no new dependencies
- **Automatic caching** - Built-in cache management with TTL
- **Request deduplication** - Multiple components requesting same data = 1 API call
- **Background refetching** - Keeps data fresh automatically
- **Optimistic updates** - Built-in support for optimistic UI updates
- **Used by**: Coinbase, Uniswap, MetaMask, most modern DeFi apps

**How it works:**
```typescript
// Multiple components can use the same hook
// TanStack Query automatically:
// 1. Deduplicates requests
// 2. Shares cache across components
// 3. Refetches in background when stale

// Component A
const { balances } = useWalletBalances(address);

// Component B (same address)
const { balances } = useWalletBalances(address); 
// ✅ Uses cached data, no extra API call!
```

### 2. **Alternative Approaches (Not Recommended for Your Case)**

#### ❌ **Zustand/Redux for Balance Data**
**Why not:**
- Duplicates what TanStack Query already does
- Manual cache invalidation needed
- More boilerplate code
- Doesn't handle loading/error states as elegantly
- **Use Zustand for**: UI state (modals, settings, preferences) ✅
- **Don't use for**: Server state (API data) ❌

#### ❌ **Context API for Balance Data**
**Why not:**
- No built-in caching
- No request deduplication
- Manual loading/error state management
- Performance issues with frequent updates
- **Use Context for**: Theme, auth state, user preferences ✅
- **Don't use for**: Frequently changing server data ❌

#### ❌ **SWR (Alternative to TanStack Query)**
**Why not:**
- You're already using TanStack Query (better ecosystem)
- Similar features, but TanStack Query is more feature-rich
- Switching would require refactoring

---

## Recommended Architecture

### **Current Setup (Good Foundation) ✅**

```typescript
// hooks/useWalletBalances.ts
export function useWalletBalances(walletAddress: string | null) {
  return useQuery({
    queryKey: ['wallet-balances', walletAddress],
    queryFn: () => fetchWalletBalances(walletAddress!),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
```

### **Enhancement Strategy**

#### **1. Create a Wallet Balance Context (Optional - For Convenience)**

**Purpose**: Provide easy access to wallet address and balance utilities without prop drilling.

```typescript
// contexts/wallet-balance-context.tsx
'use client';

import { createContext, useContext } from 'react';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useWalletBalances } from '@/hooks/useWalletBalances';

interface WalletBalanceContextValue {
  address: string | null;
  balances: TokenBalance[];
  totalUSD: string;
  isLoading: boolean;
  error: string | null;
  // Helper functions
  getTokenBalance: (tokenAddress: string, chainId: number) => TokenBalance | null;
  hasToken: (tokenAddress: string, chainId: number) => boolean;
}

const WalletBalanceContext = createContext<WalletBalanceContextValue | null>(null);

export function WalletBalanceProvider({ children }: { children: React.ReactNode }) {
  const { connectedAddress } = useWalletConnection();
  const { balances, totalUSD, isLoading, error } = useWalletBalances(connectedAddress);

  const getTokenBalance = (tokenAddress: string, chainId: number) => {
    return balances.find(
      (b) => b.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && b.chainId === chainId
    ) || null;
  };

  const hasToken = (tokenAddress: string, chainId: number) => {
    return getTokenBalance(tokenAddress, chainId) !== null;
  };

  return (
    <WalletBalanceContext.Provider
      value={{
        address: connectedAddress,
        balances,
        totalUSD,
        isLoading,
        error,
        getTokenBalance,
        hasToken,
      }}
    >
      {children}
    </WalletBalanceContext.Provider>
  );
}

export function useWalletBalanceContext() {
  const context = useContext(WalletBalanceContext);
  if (!context) {
    throw new Error('useWalletBalanceContext must be used within WalletBalanceProvider');
  }
  return context;
}
```

**Usage:**
```typescript
// Any component
function SwapCard() {
  const { getTokenBalance, isLoading } = useWalletBalanceContext();
  
  const fromTokenBalance = getTokenBalance(fromToken.address, fromToken.chainId);
  // ✅ No prop drilling, easy access
}
```

#### **2. Create Custom Hooks for Common Patterns**

```typescript
// hooks/useTokenBalance.ts (You already have this, enhance it)
export function useTokenBalance(
  walletAddress: string | null,
  tokenAddress: string | undefined,
  chainId: number | undefined
) {
  const { balances, isLoading } = useWalletBalances(walletAddress);
  
  const balance = useMemo(() => {
    if (!tokenAddress || !chainId || !balances) return null;
    return balances.find(
      (b) => 
        b.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && 
        b.chainId === chainId
    ) || null;
  }, [balances, tokenAddress, chainId]);

  return {
    balance: balance?.balance || '0',
    balanceFormatted: balance?.balanceFormatted || '0.00',
    usdValue: balance?.usdValue || '0.00',
    isLoading,
  };
}
```

#### **3. Optimize Query Configuration**

```typescript
// lib/react-query/config.ts
export const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes default
      gcTime: 10 * 60 * 1000, // 10 minutes default
      refetchOnWindowFocus: false, // Don't refetch on tab focus (optional)
      refetchOnReconnect: true, // Refetch on reconnect
      retry: 2,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
};
```

#### **4. Add Query Invalidation Utilities**

```typescript
// lib/react-query/invalidation.ts
export function invalidateWalletData(
  queryClient: QueryClient,
  walletAddress: string | null
) {
  if (!walletAddress) return;
  
  // Invalidate all wallet-related queries
  queryClient.invalidateQueries({
    queryKey: ['wallet-balances', walletAddress.toLowerCase()],
  });
  queryClient.invalidateQueries({
    queryKey: ['wallet-transactions', walletAddress.toLowerCase()],
  });
  queryClient.invalidateQueries({
    queryKey: ['wallet-nfts', walletAddress.toLowerCase()],
  });
}

// Use after successful transactions
// After swap completes:
invalidateWalletData(queryClient, walletAddress);
```

---

## Implementation Plan

### **Phase 1: Enhance Existing Hooks (Low Risk) ✅**

1. **Add helper functions to `useWalletBalances`**
   ```typescript
   export function useWalletBalances(walletAddress: string | null) {
     const query = useQuery({...});
     
     // Add helper methods
     const getTokenBalance = useCallback((tokenAddress: string, chainId: number) => {
       return query.data?.balances.find(...) || null;
     }, [query.data]);
     
     return {
       ...query,
       getTokenBalance, // ✅ Easy access
     };
   }
   ```

2. **Create `useTokenBalance` hook** (if not exists)
   - Wraps `useWalletBalances`
   - Filters for specific token
   - Returns formatted balance

### **Phase 2: Optional Context (Medium Risk)**

3. **Create `WalletBalanceProvider`** (optional)
   - Wraps app with context
   - Provides global access
   - Still uses TanStack Query under the hood

### **Phase 3: Optimization (Low Risk)**

4. **Add query invalidation utilities**
5. **Optimize query configuration**
6. **Add prefetching strategies**

---

## Comparison: TanStack Query vs Alternatives

| Feature | TanStack Query ✅ | Zustand | Context API | SWR |
|---------|------------------|---------|-------------|-----|
| **Caching** | ✅ Built-in | ❌ Manual | ❌ None | ✅ Built-in |
| **Deduplication** | ✅ Automatic | ❌ Manual | ❌ None | ✅ Automatic |
| **Background Refetch** | ✅ Yes | ❌ Manual | ❌ Manual | ✅ Yes |
| **Loading States** | ✅ Built-in | ❌ Manual | ❌ Manual | ✅ Built-in |
| **Error Handling** | ✅ Built-in | ❌ Manual | ❌ Manual | ✅ Built-in |
| **Optimistic Updates** | ✅ Yes | ⚠️ Manual | ❌ No | ⚠️ Limited |
| **DevTools** | ✅ Excellent | ⚠️ Basic | ❌ None | ⚠️ Basic |
| **Bundle Size** | ~13KB | ~1KB | 0KB | ~4KB |
| **Learning Curve** | Medium | Low | Low | Medium |

---

## Real-World Examples

### **Uniswap Interface**
- Uses React Query (TanStack Query) for all token/balance data
- No separate global state for balances
- Context only for wallet connection state

### **MetaMask Extension**
- Uses Redux (legacy), but migrating to React Query
- Separate state only for UI (modals, settings)

### **Coinbase Wallet**
- React Query for all API data
- Zustand for UI state only

---

## Final Recommendation

### **✅ DO:**
1. **Stick with TanStack Query** - It's perfect for your use case
2. **Enhance existing hooks** - Add helper functions for common patterns
3. **Create convenience hooks** - `useTokenBalance`, `useHasToken`, etc.
4. **Optional Context** - Only if you need to avoid prop drilling (not necessary with hooks)
5. **Add invalidation utilities** - For cache management after transactions

### **❌ DON'T:**
1. **Don't add Zustand/Redux for balance data** - Unnecessary duplication
2. **Don't use Context API for balances** - No caching, performance issues
3. **Don't create a separate global store** - TanStack Query IS your global store
4. **Don't over-engineer** - Your current setup is already good!

---

## Code Example: Enhanced Setup

```typescript
// ✅ RECOMMENDED: Enhanced hooks approach
// hooks/useWalletBalances.ts
export function useWalletBalances(walletAddress: string | null) {
  const query = useQuery({
    queryKey: ['wallet-balances', walletAddress?.toLowerCase()],
    queryFn: () => fetchWalletBalances(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 2 * 60 * 1000,
  });

  // Helper: Get specific token balance
  const getTokenBalance = useCallback(
    (tokenAddress: string, chainId: number) => {
      return query.data?.balances.find(
        (b) => 
          b.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() &&
          b.chainId === chainId
      ) || null;
    },
    [query.data]
  );

  // Helper: Check if user has token
  const hasToken = useCallback(
    (tokenAddress: string, chainId: number) => {
      const balance = getTokenBalance(tokenAddress, chainId);
      return balance && parseFloat(balance.balance) > 0;
    },
    [getTokenBalance]
  );

  return {
    ...query,
    balances: query.data?.balances || [],
    totalUSD: query.data?.totalUSD || '0.00',
    getTokenBalance, // ✅ Easy access
    hasToken, // ✅ Easy check
  };
}

// Usage in any component:
function SwapCard() {
  const { connectedAddress } = useWalletConnection();
  const { getTokenBalance, isLoading } = useWalletBalances(connectedAddress);
  
  const fromBalance = getTokenBalance(fromToken.address, fromToken.chainId);
  // ✅ Clean, simple, cached automatically!
}
```

---

## Summary

**Your current TanStack Query setup is already following industry best practices.** 

**Enhance it with:**
1. Helper functions in hooks
2. Convenience hooks for common patterns
3. Query invalidation utilities
4. Optional context (only if needed for convenience)

**Don't add:**
- Separate global state library for balance data
- Context API for frequently changing data
- Manual cache management

**Result**: Clean, performant, maintainable code that scales well! 🚀

