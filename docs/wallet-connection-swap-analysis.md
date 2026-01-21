# Wallet Connection and Swap Execution Analysis

## Problem Statement

1. **When connecting Rabby wallet, clicking swap calls MetaMask instead**
2. **When clicking MetaMask to connect, both Rabby and MetaMask providers are called**
3. **Wallet connection logic doesn't properly isolate wallets**

## Root Cause Analysis

### Issue 1: Wallet Client Creation Uses `window.ethereum` Directly

**Current Implementation** (`lib/frontend/utils/viem-clients.ts`):
```typescript
export async function getWalletClientForChain(chainId: number): Promise<WalletClient> {
  // ...
  const provider = (window as any).ethereum;  // ❌ PROBLEM: Uses window.ethereum directly
  // ...
}
```

**Problem**: When multiple wallets are installed (Rabby, MetaMask, etc.), `window.ethereum` might point to a different wallet than the one the user connected. Rabby can intercept MetaMask requests, and vice versa.

**tiwi-test Solution** (`docs/tiwi-test/app/components/SwapInterface.tsx`):
```typescript
const getWalletClientFromConnectedWallet = async (chainId?: number): Promise<any> => {
  // ...
  // Get the actual provider object from the wallet
  const provider = await getWalletForChain(connectedWallet.provider, 'ethereum');  // ✅ Uses specific provider
  // ...
}
```

### Issue 2: No Provider Isolation During Connection

**Current Implementation**: The wallet connection stores the wallet ID but doesn't ensure the provider is isolated when creating wallet clients.

**tiwi-test Solution**: Uses `getWalletForChain(providerId, chain)` to get the SPECIFIC provider for the connected wallet, ensuring isolation.

### Issue 3: Wallet Detection Priority

**tiwi-test Implementation** (`docs/tiwi-test/app/utils/wallet-detector.ts`):
- Checks Rabby FIRST before MetaMask (line 135-142)
- Uses EIP-6963 providers array with proper priority
- Verifies wallet identity before using it

**Key Pattern**:
```typescript
// CRITICAL: Check Rabby FIRST - Rabby sets isMetaMask=true for compatibility
if (providerId === 'rabby') {
  const rabbyProvider = ethereum.providers.find((p: any) =>
    p.isRabby === true ||
    (p.info?.rdns || '').toLowerCase().includes('rabby')
  );
  if (rabbyProvider) return rabbyProvider;
} else if (providerId === 'metamask') {
  // MetaMask detection - prioritize rdns/name, exclude Rabby and OKX
  let metamaskProvider = ethereum.providers.find((p: any) => {
    // Exclude Rabby and OKX which masquerade as MetaMask
    if (p.isRabby === true || p.isOkxWallet === true) return false;
    // ... proper MetaMask detection
  });
}
```

## Solution

### Fix 1: Update `getWalletClientForChain` to Use Specific Provider

**File**: `lib/frontend/utils/viem-clients.ts`

**Changes**:
1. Accept `providerId` parameter (optional, defaults to getting from connected wallet)
2. Use `getWalletForChain` from wallet detector to get specific provider
3. Use that provider instead of `window.ethereum` directly

### Fix 2: Update `wallet-helpers.ts` to Pass Provider ID

**File**: `lib/frontend/services/swap-executor/utils/wallet-helpers.ts`

**Changes**:
1. Get connected wallet from wallet store
2. Extract provider ID from connected wallet
3. Pass provider ID to `getWalletClientForChain`

### Fix 3: Ensure Wallet Connection Uses Proper Provider Isolation

**File**: `lib/wallet/connection/connector.ts` (if needed)

**Changes**:
1. Ensure `getWalletForChain` is used correctly
2. Verify wallet identity after connection

## Implementation Plan

1. ✅ Import wallet detector utilities
2. ✅ Update `getWalletClientForChain` to accept and use provider ID
3. ✅ Update `getEVMWalletClient` to get provider from connected wallet
4. ✅ Test with Rabby and MetaMask both installed
5. ✅ Verify swap execution uses correct wallet

## Testing Checklist

- [ ] Connect Rabby wallet → Swap should use Rabby
- [ ] Connect MetaMask wallet → Swap should use MetaMask
- [ ] Both wallets installed → Each should work independently
- [ ] Click MetaMask to connect → Only MetaMask should be called
- [ ] Click Rabby to connect → Only Rabby should be called


