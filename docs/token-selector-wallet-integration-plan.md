# Token Selector Wallet Integration - Implementation Plan

## Overview
Integrate wallet token balances into the token selector modal, prioritizing user's tokens, popular tokens (BNB), and protocol tokens (TWC), while removing duplicates and making wallet balances globally available.

## Goals
1. **Token Prioritization**: Display tokens in this order:
   - User's wallet tokens (with balance > 0). 
   - Popular tokens (BNB - native token on BNB Chain) NOT ONLY TOKENS ON BNB CHAIN BUT ALL CHAINS WE SUPPORT BUT TWC SHOULD BE TOP BEFORE THOSE POPULAR TOKENS
   - Protocol tokens (TWC/TIWICAT - 0xDA1060158F7D593667cCE0a15DB346BB3FfB3596 on chain 56)
   - Other tokens from API

2. **Duplicate Removal**: If a token exists in user's wallet, remove it from the API token list

3. **Global Wallet Balances**: Make wallet balances available globally across the app (swap, portfolio, market pages AND ANY OTHER PAGE OR COMPONENT THAT MAY NEED IT). NOT ONLY THE TOTAL WALLET BALANCE BUT FOR THE INDIVIDUAL TOKEN BALANCES

4. **Optimize Balance Fetching**: Remove redundant balance fetching from swap page - use balances from token selector or global state

## Architecture Decision: Frontend vs Backend

### ✅ **Recommended: Frontend Approach**

**Why Frontend?**
- Wallet connection state is frontend-only
- Already have `useWalletBalances` hook with TanStack Query caching
- More flexible - can work with/without wallet connection
- Better separation of concerns - wallet data separate from token data
- Easier to implement incremental improvements

**Implementation Location:**
- Frontend: `hooks/useTokenSearch.ts` or new `hooks/useTokensWithWallet.ts`
- Frontend: `components/swap/token-selector-modal.tsx`
- Frontend: Global wallet balance context/store (optional enhancement)

## Implementation Steps

### Phase 1: Create Token Prioritization & Merging Utility

**File**: `lib/shared/utils/token-prioritization.ts`

```typescript
/**
 * Token Prioritization Utilities
 * 
 * Handles merging wallet tokens with API tokens, removing duplicates,
 * and prioritizing tokens in the correct order.
 */

import type { Token } from '@/lib/frontend/types/tokens';
import type { WalletToken } from '@/lib/backend/types/wallet';

// Popular tokens (native tokens)
const POPULAR_TOKENS: Array<{ symbol: string; chainId: number }> = [
  { symbol: 'BNB', chainId: 56 }, // BNB Chain native
  { symbol: 'ETH', chainId: 1 },  // Ethereum native
  { symbol: 'MATIC', chainId: 137 }, // Polygon native
  { symbol: 'AVAX', chainId: 43114 }, // Avalanche native
  // Add more as needed
];

// Protocol tokens
const PROTOCOL_TOKENS: Array<{ address: string; chainId: number; symbol: string }> = [
  { 
    address: '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596', 
    chainId: 56, 
    symbol: 'TWC' 
  }, // TIWI CAT on BNB Chain
];

/**
 * Convert WalletToken to Token format
 */
function walletTokenToToken(walletToken: WalletToken): Token {
  return {
    id: `${walletToken.chainId}-${walletToken.address.toLowerCase()}`,
    name: walletToken.name,
    symbol: walletToken.symbol,
    address: walletToken.address,
    logo: walletToken.logoURI || '',
    chain: '', // Will be enriched later
    chainId: walletToken.chainId,
    decimals: walletToken.decimals,
    balance: walletToken.balanceFormatted,
    usdValue: walletToken.usdValue,
    price: walletToken.priceUSD,
    priceChange24h: walletToken.priceChange24h 
      ? parseFloat(walletToken.priceChange24h) 
      : undefined,
  };
}

/**
 * Check if token is a popular token (native token)
 */
function isPopularToken(token: Token): boolean {
  return POPULAR_TOKENS.some(
    pt => pt.symbol === token.symbol && pt.chainId === token.chainId
  );
}

/**
 * Check if token is a protocol token (TWC, etc.)
 */
function isProtocolToken(token: Token): boolean {
  return PROTOCOL_TOKENS.some(
    pt => pt.address.toLowerCase() === token.address.toLowerCase() 
      && pt.chainId === token.chainId
  );
}

/**
 * Get token priority for sorting
 * Lower number = higher priority
 */
function getTokenPriority(token: Token, hasBalance: boolean): number {
  // Priority 1: Wallet tokens with balance
  if (hasBalance) return 1;
  
  // Priority 2: Popular tokens (BNB, ETH, etc.)
  if (isPopularToken(token)) return 2;
  
  // Priority 3: Protocol tokens (TWC)
  if (isProtocolToken(token)) return 3;
  
  // Priority 4: Other tokens
  return 4;
}

/**
 * Create token ID for duplicate detection
 */
function getTokenId(token: Token | WalletToken): string {
  if ('chainId' in token && 'address' in token) {
    return `${token.chainId}-${token.address.toLowerCase()}`;
  }
  return token.id;
}

/**
 * Merge wallet tokens with API tokens, removing duplicates and prioritizing
 * 
 * @param walletTokens - Tokens from user's wallet (with balances)
 * @param apiTokens - Tokens from API endpoint
 * @returns Merged and prioritized token list
 */
export function mergeTokensWithWallet(
  walletTokens: WalletToken[],
  apiTokens: Token[]
): Token[] {
  // Convert wallet tokens to Token format
  const walletTokensAsTokens = walletTokens
    .filter(wt => parseFloat(wt.balanceFormatted || '0') > 0) // Only tokens with balance
    .map(walletTokenToToken);

  // Create a set of wallet token IDs for duplicate detection
  const walletTokenIds = new Set(
    walletTokens.map(wt => `${wt.chainId}-${wt.address.toLowerCase()}`)
  );

  // Filter out API tokens that exist in wallet
  const apiTokensFiltered = apiTokens.filter(
    token => !walletTokenIds.has(getTokenId(token))
  );

  // Combine: wallet tokens + filtered API tokens
  const allTokens = [...walletTokensAsTokens, ...apiTokensFiltered];

  // Sort by priority
  return allTokens.sort((a, b) => {
    const aHasBalance = parseFloat(a.balance || '0') > 0;
    const bHasBalance = parseFloat(b.balance || '0') > 0;
    
    const aPriority = getTokenPriority(a, aHasBalance);
    const bPriority = getTokenPriority(b, bHasBalance);
    
    // Primary sort: by priority
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // Secondary sort: within same priority, preserve original order
    // (wallet tokens first, then API order)
    return 0;
  });
}
```

### Phase 2: Enhance useTokenSearch Hook

**File**: `hooks/useTokenSearch.ts`

**Changes:**
1. Accept `walletAddress` parameter
2. Fetch wallet balances using `useWalletBalances`
3. Merge wallet tokens with API tokens using new utility
4. Return merged and prioritized tokens

**Key Changes:**
```typescript
export interface UseTokenSearchParams {
  chains?: number[];
  limit?: number;
  debounceDelay?: number;
  walletAddress?: string | null; // NEW: Wallet address for balance integration
}

export function useTokenSearch(
  params: UseTokenSearchParams = {}
): UseTokenSearchReturn {
  const { chains, limit, debounceDelay = 400, walletAddress } = params;
  
  // ... existing code ...
  
  // NEW: Fetch wallet balances if wallet is connected
  const { balances: walletTokens } = useWalletBalances(walletAddress);
  
  // NEW: Merge wallet tokens with API tokens
  const mergedWithWallet = useMemo(() => {
    if (!walletAddress || walletTokens.length === 0) {
      return mergedTokens; // No wallet, return API tokens as-is
    }
    
    return mergeTokensWithWallet(walletTokens, mergedTokens);
  }, [walletTokens, mergedTokens, walletAddress]);
  
  return {
    query,
    setQuery,
    tokens: mergedWithWallet, // Use merged tokens
    isLoading,
    isSearching,
    isApiFetching,
    error: apiError,
  };
}
```

### Phase 3: Update Token Selector Modal

**File**: `components/swap/token-selector-modal.tsx`

**Changes:**
1. Get connected wallet address using `useWalletConnection`
2. Pass `walletAddress` to `useTokenSearch`
3. Remove existing balance-based sorting (now handled in merge utility)

**Key Changes:**
```typescript
import { useWalletConnection } from "@/hooks/useWalletConnection";

export default function TokenSelectorModal({ ... }) {
  // ... existing code ...
  
  // NEW: Get connected wallet address
  const { connectedAddress } = useWalletConnection();
  
  // Update useTokenSearch to include wallet address
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    tokens,
    isLoading: tokensLoading,
    isSearching,
    isApiFetching,
    error: tokensError,
  } = useTokenSearch({
    chains: chainIds,
    limit: 30,
    walletAddress: connectedAddress, // NEW: Pass wallet address
  });
  
  // REMOVE: Existing sortedTokens logic (now handled in merge utility)
  // The tokens from useTokenSearch are already sorted and prioritized
  
  // ... rest of component ...
}
```

### Phase 4: Create Global Wallet Balance Context (Optional Enhancement)

**File**: `contexts/WalletBalanceContext.tsx` (NEW)

**Purpose**: Make wallet balances available globally without prop drilling

**Implementation:**
```typescript
"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useWalletBalances } from '@/hooks/useWalletBalances';

interface WalletBalanceContextValue {
  balances: WalletToken[];
  totalUSD: string;
  isLoading: boolean;
  error: string | null;
  getTokenBalance: (address: string, chainId: number) => WalletToken | null;
}

const WalletBalanceContext = createContext<WalletBalanceContextValue | null>(null);

export function WalletBalanceProvider({ children }: { children: ReactNode }) {
  const { connectedAddress } = useWalletConnection();
  const { balances, totalUSD, isLoading, error } = useWalletBalances(connectedAddress);
  
  const getTokenBalance = (address: string, chainId: number): WalletToken | null => {
    return balances.find(
      t => t.address.toLowerCase() === address.toLowerCase() && t.chainId === chainId
    ) || null;
  };
  
  return (
    <WalletBalanceContext.Provider value={{
      balances,
      totalUSD,
      isLoading,
      error,
      getTokenBalance,
    }}>
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

**Note**: This is optional. TanStack Query already provides global caching, so this is mainly for convenience.

### Phase 5: Update Swap Page to Use Global Balances

**File**: `app/swap/page.tsx`

**Changes:**
1. Remove `useTokenBalance` calls for fromToken and toToken
2. Get balances from token selector or global context
3. Show "0.00" if balance not available (user doesn't have token)

**Key Changes:**
```typescript
// REMOVE: These hooks
// const fromTokenBalance = useTokenBalance(...);
// const toTokenBalance = useTokenBalance(...);

// NEW: Get balance from selected token or global context
const getTokenBalance = (token: Token | null): string => {
  if (!token || !connectedAddress) return "0.00";
  
  // Option 1: Check if token has balance from token selector
  if (token.balance) {
    return token.balance;
  }
  
  // Option 2: Use global context (if implemented)
  // const { getTokenBalance: getBalance } = useWalletBalanceContext();
  // const walletToken = getBalance(token.address, token.chainId);
  // return walletToken?.balanceFormatted || "0.00";
  
  // Fallback: User doesn't have this token
  return "0.00";
};

const fromBalance = getTokenBalance(fromToken);
const toBalance = getTokenBalance(toToken);
```

### Phase 6: Ensure Routing Parameters Are Preserved

**Verification Checklist:**
- ✅ All tokens have `chainId` (required for routing)
- ✅ All tokens have `address` (required for routing)
- ✅ All tokens have `decimals` (required for routing)
- ✅ Wallet tokens include all routing parameters when converted

**File**: `lib/shared/utils/token-prioritization.ts`

**Ensure `walletTokenToToken` includes all required fields:**
```typescript
function walletTokenToToken(walletToken: WalletToken): Token {
  return {
    // ... existing fields ...
    decimals: walletToken.decimals, // ✅ Required for routing
    chainId: walletToken.chainId,   // ✅ Required for routing
    address: walletToken.address,   // ✅ Required for routing
    // ... rest of fields ...
  };
}
```

## Testing Checklist

### Token Selector Modal
- [ ] Wallet tokens appear first (with balance > 0)
- [ ] Popular tokens (BNB) appear after wallet tokens
- [ ] Protocol or featured tokens (TWC) appear with popular tokens
- [ ] Other tokens appear last
- [ ] No duplicate tokens (wallet tokens removed from API list)
- [ ] All tokens have routing parameters (chainId, address, decimals)
- [ ] Works when wallet is not connected (shows normal token list)
- [ ] Works when wallet has no tokens (shows normal token list)

### Swap Page
- [ ] Token balances shown correctly from token selector
- [ ] Shows "0.00" for tokens user doesn't have
- [ ] No unnecessary API calls for balance fetching
- [ ] Routing works correctly with selected tokens

### Global State
- [ ] Wallet balances cached globally (TanStack Query)
- [ ] Balance updates when wallet changes
- [ ] Balance updates when tokens are swapped

## Edge Cases

1. **Wallet Not Connected**: Show normal token list (no wallet tokens) with their prices
2. **Wallet Has No Tokens**: Show normal token list (no wallet tokens) WITH THEIR PRICES
3. **Token Exists in Wallet but Balance is 0**: Still show in wallet section, but prioritize tokens with balance > 0
4. **Token in Wallet but Not in API**: Show in wallet section, don't show in API section
5. **Token in API but Not in Wallet**: Show in API section normally
6. **Multiple Chains**: Handle tokens across different chains correctly
7. **Token Search**: Search should work across both wallet and API tokens

## Performance Considerations

1. **Caching**: TanStack Query already caches wallet balances (2min staleTime)
2. **Deduplication**: Use Set for O(1) duplicate detection
3. **Memoization**: Use `useMemo` for token merging and sorting
4. **Lazy Loading**: Only fetch wallet balances when wallet is connected

## Migration Path

1. **Phase 1**: Create utility functions (non-breaking)
2. **Phase 2**: Update `useTokenSearch` (backward compatible - walletAddress optional)
3. **Phase 3**: Update token selector modal (uses new hook)
4. **Phase 4**: Optional - Add global context
5. **Phase 5**: Update swap page (remove redundant balance fetching)
6. **Phase 6**: Test and verify routing parameters

## Questions for Clarification

1. **Balance Threshold**: Should we show wallet tokens with balance = 0, or only balance > 0?
   - **Recommendation**: Show all wallet tokens, but prioritize those with balance > 0

2. **Popular Tokens**: Should we hardcode BNB, or make it configurable?
   - **Recommendation**: Hardcode for now, make configurable later if needed

3. **Protocol Tokens**: Should we support multiple protocol tokens, or just TWC?
   - **Recommendation**: Support multiple, but start with TWC
THE CONCEPT BEHIND THIS POPULAR AND PROTOCOL TOKENS ARE 1. WE SHOW TOKENS THAT HAVE LET'S SAY A HIGH VOLUME IN 24H ACROSS CHAINS OR IN A CHAIN 2. WE SHOULD INCLUDE TOKENS LIKE BNB, ETH AND OTHER POPULAR TOKENS IN THE ECOSYSTEM 3. PROTOCOL TOKENS ARE ACTUALLY FEATURED TOKENS. TOKENS FEATURED BY THE PROTOCOL. IN FACT THEY SHOULD COME BEFORE POPULAR TOKENS
4. **Global Context**: Is the optional global context needed, or is TanStack Query caching sufficient?
   - **Recommendation**: Start without context, add if needed for convenience
   FOR THE GLOBAL CONTEXT WHY NOT ZUSTAND SINCE WE ALEREADY USING ZUSTAND

5. **Balance Display**: Should we show balance in token selector even if it's 0?
   - **Recommendation**: Yes, show "0.00" to indicate user has the token but no balance
   WHEN IT COMES TO BALANCE IN TOKENSELECTOR MODAL, I THINK WE SHOULD SHOW AMOUNT OF TOKENS THE USER HAVE THEN BENEATH IT WE SHOW THE USD VALUE OF THE TOKEN JUST LIKE WE DID FOR WALLET TOKENS BALANCE IN PORTFOLIO PAGE AND PLEASE NOTE, THIS SHOULDN'T DISTORT THE UI

## Next Steps

1. Review and approve this plan
2. Implement Phase 1 (utility functions)
3. Test Phase 1 in isolation
4. Implement Phase 2 (hook enhancement)
5. Test Phase 2 with token selector
6. Implement Phase 3 (modal update)
7. Test full flow
8. Implement Phase 5 (swap page optimization)
9. Final testing and deployment

