# Swap Implementation Comparison Analysis

## Executive Summary

**Problem**: Swap execution fails with "HTTP request failed" when checking token approval on BSC (chain 56). The error shows it's trying to use `https://56.rpc.thirdweb.com` which is unreliable.

**Root Cause**: Our `getCachedPublicClient` function is NOT using the custom RPC URLs from `rpc-config.ts`. It's using `http(undefined)` which defaults to viem's chain RPCs (thirdweb for BSC), which are unreliable.

**Solution**: Update `getCachedPublicClient` to use RPC URLs from `rpc-config.ts` with proper timeout and retry settings, exactly like tiwi-test does.

---

## Top-Down Analysis

### 1. **RPC Client Configuration** ❌ CRITICAL ISSUE

#### tiwi-test Implementation:
```typescript
// app/providers.tsx (lines 46-60)
client({ chain }) {
  const customRpcUrl = getRpcUrl(chain.id);
  
  if (customRpcUrl) {
    return createClient({ 
      chain, 
      transport: http(customRpcUrl, RPC_TRANSPORT_OPTIONS) // ✅ Uses custom RPC
    });
  }
  
  return createClient({ chain, transport: http() }); // Fallback
}

// app/utils/optimization.ts (lines 28-44)
export function getCachedClient(chainId: number): PublicClient {
  if (!clientCache.has(chainId)) {
    const chain = getChainConfig(chainId);
    clientCache.set(chainId, createPublicClient({
      chain,
      transport: http(undefined, { // ⚠️ Uses default RPC BUT...
        timeout: 2000,
        retryCount: 1,
      }),
    }));
  }
  return clientCache.get(chainId)!;
}
```

**Note**: tiwi-test's `getCachedClient` also uses `http(undefined)`, BUT:
- They configure custom RPCs in Wagmi config (which is used for wallet operations)
- Their `optimization.ts` has aggressive timeouts (2s) and fast retries
- They use `getCachedClient` for read operations, which might work better with default RPCs

#### Our Implementation:
```typescript
// lib/frontend/utils/viem-clients.ts (lines 48-65)
export function getCachedPublicClient(chainId: number): PublicClient {
  if (!publicClientCache.has(chainId)) {
    const chain = getChainConfig(chainId);
    publicClientCache.set(chainId, createPublicClient({
      chain,
      transport: http(undefined, { // ❌ NOT using rpc-config.ts URLs!
        timeout: 5000,
        retryCount: 2,
      }),
    }));
  }
  return publicClientCache.get(chainId)!;
}
```

**Problem**: We have `rpc-config.ts` with Alchemy RPC URLs, but `getCachedPublicClient` doesn't use them!

---

### 2. **Token Approval Check Flow**

#### tiwi-test Flow:
1. `handleSwap` → `ensureTokenApproval` (from pancakeswapv2.ts)
2. `ensureTokenApproval` → `checkTokenAllowance` (from pancakeswapv2.ts)
3. `checkTokenAllowance` → `getCachedClient(chainId)` → `publicClient.readContract`
4. Uses `getCachedClient` which has fast timeouts (2s) and single retry

#### Our Flow:
1. `executeSwapTransaction` → `PancakeSwapExecutor.execute`
2. `PancakeSwapExecutor.execute` → `ensureTokenApproval` (from approval-handler.ts)
3. `ensureTokenApproval` → `checkTokenApproval` (from approval-handler.ts)
4. `checkTokenApproval` → `getCachedPublicClient(chainId)` → `publicClient.readContract`
5. Uses `getCachedPublicClient` which uses **default RPC** (thirdweb) ❌

**Problem**: Our approval check is using unreliable thirdweb RPC instead of Alchemy.

---

### 3. **Error Analysis**

```
Failed to check token approval: HTTP request failed.
URL: https://56.rpc.thirdweb.com
```

**What's happening**:
- `getCachedPublicClient(56)` creates a client with BSC chain config
- BSC chain config has `rpcUrls: ['https://56.rpc.thirdweb.com']` as default
- We're NOT overriding it with our Alchemy RPC from `rpc-config.ts`
- thirdweb RPC is unreliable/failing

**Expected behavior**:
- Should use `https://bnb-mainnet.g.alchemy.com/v2/...` from `rpc-config.ts`
- Should have proper timeout (30s) and retry (3x) settings

---

### 4. **Key Differences Summary**

| Component | tiwi-test | Our Implementation | Status |
|-----------|-----------|-------------------|--------|
| **RPC Configuration** | Uses `getRpcUrl()` in Wagmi config | Has `rpc-config.ts` but NOT used | ❌ |
| **Public Client** | `getCachedClient()` with fast timeouts | `getCachedPublicClient()` with default RPC | ❌ |
| **Approval Check** | Uses `getCachedClient()` | Uses `getCachedPublicClient()` | ❌ |
| **Error Handling** | Fast timeouts (2s), single retry | Slower timeouts (5s), 2 retries | ⚠️ |
| **RPC Reliability** | Uses Alchemy via Wagmi config | Uses thirdweb (unreliable) | ❌ |

---

## What's Missing in Our Implementation

### 1. **RPC URL Integration** ❌ CRITICAL
- `getCachedPublicClient` doesn't import or use `getRpcUrl` from `rpc-config.ts`
- Should check for custom RPC URL and use it if available
- Should fall back to default only if no custom RPC configured

### 2. **Transport Options** ⚠️
- Should use `RPC_TRANSPORT_OPTIONS` from `rpc-config.ts` (30s timeout, 3 retries)
- Currently using hardcoded values (5s timeout, 2 retries)

### 3. **Error Handling** ⚠️
- tiwi-test has faster timeouts (fail fast) with single retry
- Our implementation has slower timeouts which might mask issues
- Should add better error messages for RPC failures

### 4. **Environment Variable Support** ⚠️
- tiwi-test uses `NEXT_PUBLIC_*` prefix for env vars
- Our `rpc-config.ts` uses `ETH_RPC_URL` (no prefix) - might not work in browser
- Should use `NEXT_PUBLIC_*` prefix for client-side access

---

## Implementation Plan

### Phase 1: Fix RPC Configuration (CRITICAL)

**File**: `lib/frontend/utils/viem-clients.ts`

**Changes**:
1. Import `getRpcUrl` and `RPC_TRANSPORT_OPTIONS` from `rpc-config.ts`
2. Update `getCachedPublicClient` to use custom RPC URL if available
3. Use `RPC_TRANSPORT_OPTIONS` for timeout and retry settings

**Code**:
```typescript
import { getRpcUrl, RPC_TRANSPORT_OPTIONS } from '@/lib/backend/utils/rpc-config';

export function getCachedPublicClient(chainId: number): PublicClient {
  if (!publicClientCache.has(chainId)) {
    const chain = getChainConfig(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not supported`);
    }
    
    // ✅ Get custom RPC URL if available
    const customRpcUrl = getRpcUrl(chainId);
    
    // ✅ Use custom RPC with proper transport options, or fallback to default
    publicClientCache.set(chainId, createPublicClient({
      chain,
      transport: customRpcUrl 
        ? http(customRpcUrl, RPC_TRANSPORT_OPTIONS) // Custom RPC with proper settings
        : http(undefined, RPC_TRANSPORT_OPTIONS),    // Default RPC with proper settings
    }));
  }
  
  return publicClientCache.get(chainId)!;
}
```

### Phase 2: Fix Environment Variables

**File**: `lib/backend/utils/rpc-config.ts`

**Changes**:
1. Update all env var names to use `NEXT_PUBLIC_*` prefix
2. This ensures they're available in the browser

**Code**:
```typescript
export const RPC_CONFIG: Record<number, string> = {
  1: process.env.NEXT_PUBLIC_ETH_RPC_URL || 
     'https://eth-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
  // ... etc
};
```

### Phase 3: Add Better Error Handling

**File**: `lib/frontend/services/swap-executor/services/approval-handler.ts`

**Changes**:
1. Add specific error handling for RPC failures
2. Provide helpful error messages
3. Add retry logic for transient failures

---

## Comparison: handleSwap vs Our Implementation

### tiwi-test `handleSwap` Flow:
1. ✅ Gets wallet client from `getWalletClientFromConnectedWallet` (uses specific provider)
2. ✅ Checks approval using `checkTokenAllowance` (uses `getCachedClient`)
3. ✅ Approves using `ensureTokenApproval` (uses wallet client directly)
4. ✅ Gets fresh quote from router using `getCachedClient`
5. ✅ Executes swap using `sendTransactionViaWallet` (tries walletClient, falls back to provider)

### Our Implementation Flow:
1. ✅ Gets wallet client from `getEVMWalletClient` (uses specific provider) 
2. ❌ Checks approval using `checkTokenApproval` (uses `getCachedPublicClient` with wrong RPC)
3. ✅ Approves using `approveToken` (uses wallet client)
4. ✅ Gets fresh quote using `getCachedPublicClient` (with wrong RPC)
5. ✅ Executes swap using wallet client

**Key Difference**: We're using the wrong RPC for read operations (approval checks, quotes).

---

## Files That Need Changes

1. **`lib/frontend/utils/viem-clients.ts`** - Add RPC URL support
2. **`lib/backend/utils/rpc-config.ts`** - Fix env var names (add `NEXT_PUBLIC_` prefix)
3. **`lib/frontend/services/swap-executor/services/approval-handler.ts`** - Add better error handling (optional)

---

## Testing Checklist

After fixes:
- [ ] Approval check works on BSC (should use Alchemy RPC)
- [ ] Quote fetching works on BSC (should use Alchemy RPC)
- [ ] Swap execution works end-to-end
- [ ] Error messages are clear when RPC fails
- [ ] Fallback to default RPC works if custom RPC not configured

---

## Additional Notes

1. **tiwi-test's approach**: They use `getCachedClient` with default RPCs for read operations, but configure custom RPCs in Wagmi for wallet operations. This works because:
   - Default RPCs might be okay for read operations (less critical)
   - Custom RPCs are used for write operations (more critical)
   - They have fast timeouts (2s) to fail fast

2. **Our approach should be**: Use custom RPCs (Alchemy) for ALL operations because:
   - More reliable
   - Better rate limits
   - Consistent behavior

3. **Why thirdweb RPC fails**: 
   - Public RPC endpoints are often rate-limited
   - thirdweb's free tier might have restrictions
   - Alchemy is more reliable for production use
