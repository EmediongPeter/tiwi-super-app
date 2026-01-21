# Wallet Connection and Swap Fix Analysis

## Problem Summary

1. **Rabby intercepting MetaMask requests**: When connected to Rabby wallet, clicking swap calls MetaMask instead
2. **Multiple wallets triggering**: When clicking to connect MetaMask, both Rabby and MetaMask providers are called
3. **Root cause**: The code was falling back to `window.ethereum` instead of using the specific wallet provider

## Root Cause Analysis

### Issue 1: Fallback to `window.ethereum`
**Location**: `lib/frontend/utils/viem-clients.ts` (lines 141-156)

**Problem**: When `getWalletForChain()` failed to get a specific provider, the code fell back to `window.ethereum`. This is problematic because:
- Rabby can intercept `window.ethereum` requests
- Multiple wallets can inject into `window.ethereum.providers` array
- The fallback doesn't respect which wallet the user actually connected

**Fix**: Removed the fallback to `window.ethereum` when `providerId` is provided. Now it throws an error if the specific provider cannot be found, ensuring we always use the correct wallet.

### Issue 2: Chain switching using wrong provider
**Location**: `lib/frontend/services/swap-executor/utils/wallet-helpers.ts` (line 60)

**Problem**: When switching chains, the code used `window.ethereum` as a fallback, which could be intercepted by Rabby.

**Fix**: 
1. Extract provider from wallet client transport
2. If that fails, use `getWalletForChain()` with the `providerId` to get the correct provider
3. Only use `window.ethereum` as a last resort (and log a warning)

### Issue 3: Wallet detection already correct
**Location**: `lib/wallet/connection/connector.ts` (lines 87-124)

**Status**: ✅ Already correct! The wallet detection logic:
- Checks Rabby FIRST before MetaMask (lines 89-96)
- Excludes Rabby and OKX when detecting MetaMask (lines 105, 109, 113-119)
- Uses EIP-6963 provider detection when available
- Falls back to single-provider detection when needed

## Key Differences from tiwi-test

### What tiwi-test does correctly:
1. **Uses Wagmi MetaMask connector for MetaMask**: When connecting MetaMask, it uses Wagmi's `metaMask()` connector specifically (lines 348-393 in `WalletSelector.tsx`)
2. **Never falls back to window.ethereum**: When a specific provider is requested, it always uses that provider
3. **Detects wallet from actual provider**: After connection, it detects which wallet is actually connected (lines 431-456)

### What we fixed:
1. **Removed fallback to window.ethereum**: When `providerId` is provided, we now throw an error instead of falling back
2. **Fixed chain switching**: Now uses the correct provider from the wallet client or `getWalletForChain()`
3. **Better error messages**: More descriptive errors when provider cannot be found

## Implementation Details

### Fix 1: `getWalletClientForChain()` in `viem-clients.ts`

**Before**:
```typescript
if (providerId) {
  try {
    provider = await getWalletForChain(providerId, 'ethereum');
    // ... use provider
  } catch (error) {
    // ❌ FALLBACK TO window.ethereum - THIS IS THE PROBLEM
    provider = (window as any).ethereum;
  }
}
```

**After**:
```typescript
if (providerId) {
  // ✅ NO FALLBACK - Always use specific provider
  provider = await getWalletForChain(providerId, 'ethereum');
  if (!provider) {
    throw new Error(`Wallet provider "${providerId}" not found...`);
  }
  // ... use provider
}
```

### Fix 2: Chain switching in `wallet-helpers.ts`

**Before**:
```typescript
const provider = (walletClient.transport as any)?.value || (window as any).ethereum;
```

**After**:
```typescript
let provider: any;
// Try to get from transport
if (transport?.value) {
  provider = transport.value;
} else if (providerId) {
  // ✅ Use getWalletForChain with providerId
  provider = await getWalletForChain(providerId, 'ethereum');
} else {
  // Last resort only
  provider = (window as any).ethereum;
}
```

## Testing Checklist

- [ ] Connect Rabby wallet → Click swap → Should use Rabby (not MetaMask)
- [ ] Connect MetaMask wallet → Click swap → Should use MetaMask (not Rabby)
- [ ] Connect Rabby → Switch chain → Should use Rabby for chain switch
- [ ] Connect MetaMask → Switch chain → Should use MetaMask for chain switch
- [ ] Connect Rabby → Click MetaMask in wallet selector → Should only connect MetaMask (not both)

## Additional Notes

1. **MetaMask SDK**: The `@metamask/sdk` package is installed but not currently used. The tiwi-test implementation uses Wagmi's `metaMask()` connector which internally uses MetaMask SDK. Our current implementation should work without it, but we could add it for better MetaMask support if needed.

2. **Wallet detection priority**: The `getWalletForChain()` function already has the correct priority:
   - Rabby is checked FIRST (before MetaMask)
   - MetaMask detection excludes Rabby and OKX
   - Uses EIP-6963 when available

3. **Provider isolation**: Each wallet now uses its own provider, preventing cross-wallet interference.

## Files Modified

1. `lib/frontend/utils/viem-clients.ts` - Removed fallback to `window.ethereum`
2. `lib/frontend/services/swap-executor/utils/wallet-helpers.ts` - Fixed chain switching to use correct provider

## Files Already Correct

1. `lib/wallet/connection/connector.ts` - Wallet detection logic is correct
2. `lib/frontend/services/swap-executor/services/approval-handler.ts` - Uses `getWalletClientForChain()` correctly





