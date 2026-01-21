# MetaMask Connection Intercepted by Rabby - Analysis & Fix Plan

## 🔍 Problem Summary

When users try to connect MetaMask directly in the main project, the connection is intercepted by Rabby wallet. This issue was **fixed in tiwi-test** but not yet implemented in the main project.

---

## 🎯 Root Cause Analysis

### Why Rabby Intercepts MetaMask Connections

1. **Rabby Masquerades as MetaMask**: Rabby sets `isMetaMask = true` for compatibility, making it appear as MetaMask to applications
2. **Provider Detection Order**: When multiple wallets are installed, the detection logic may pick Rabby if it's checked before MetaMask
3. **Custom Connection Path**: The main project uses a custom `connectWallet` function that relies on `window.ethereum` detection, which can be intercepted

### Key Differences: tiwi-test (WORKING) vs Main Project (NOT WORKING)

#### ✅ tiwi-test Approach (WORKING)

**Location**: `docs/tiwi-test/app/components/WalletSelector.tsx` (lines 297-488)

**Key Strategy**:
1. **Uses Wagmi's MetaMask Connector FIRST** for MetaMask connections
2. **Bypasses custom connection logic** entirely when Wagmi connector is available
3. **Only falls back** to custom connection if Wagmi connector fails

**Code Flow**:
```typescript
if (chain === 'ethereum' && providerId === 'metamask') {
  // Find Wagmi's MetaMask connector
  const metamaskConnector = wagmiConnectors.find(...);
  
  if (metamaskConnector) {
    // Connect using Wagmi's MetaMask connector (BYPASSES custom logic)
    await wagmiConnect({ connector: metamaskConnector });
    
    // Get account directly from Wagmi
    const wagmiAccount = getAccount(wagmiConfig);
    // ... set account directly
  } else {
    // Fallback to custom connection
    account = await connectWallet(providerId, chain);
  }
}
```

**Why This Works**:
- Wagmi's MetaMask connector is specifically designed to connect to MetaMask
- It uses MetaMask's own provider detection, avoiding Rabby interception
- It doesn't rely on `window.ethereum` detection which can be ambiguous

#### ❌ Main Project Approach (NOT WORKING)

**Location**: `hooks/useWalletConnection.ts` (lines 102-181)

**Current Flow**:
1. User clicks MetaMask → calls `connectWalletHandler`
2. For single-chain wallets → calls `wallet.connect(walletId, chain)`
3. `wallet.connect()` → calls `connectWallet()` from connector
4. `connectWallet()` → calls `getWalletForChain()` 
5. `getWalletForChain()` → uses `window.ethereum` detection
6. **Rabby intercepts** because it sets `isMetaMask = true`

**The Problem**:
- Wagmi MetaMask connector logic exists BUT only in `selectChain()` (line 192-265)
- Direct connections (not through chain selection) bypass Wagmi connector
- Custom `getWalletForChain()` can be intercepted by Rabby

**Code Flow**:
```typescript
// Direct connection path (PROBLEMATIC)
connectWalletHandler() {
  // ... 
  await wallet.connect(walletId, chain); // Goes through custom connector
}

// Chain selection path (HAS FIX but not used for direct connections)
selectChain() {
  if (chain === 'ethereum' && providerId === 'metamask') {
    // Uses Wagmi connector (GOOD)
    await wagmiConnect({ connector: metamaskConnector });
  }
}
```

---

## 🔧 What's Missing in Main Project

### 1. Wagmi MetaMask Connector Not Used for Direct Connections

**Current State**:
- ✅ Wagmi MetaMask connector logic exists in `selectChain()`
- ❌ Direct connections don't use Wagmi connector
- ❌ Custom `connectWallet()` can be intercepted

**Required Fix**:
- Use Wagmi MetaMask connector for ALL MetaMask connections (not just chain selection)
- Apply the same logic from `selectChain()` to direct connections

### 2. Connection Flow Differences

**tiwi-test**:
```
User clicks MetaMask 
  → handleProviderSelect()
    → handleConnectWithProvider()
      → Check if MetaMask + Ethereum
        → Use Wagmi connector FIRST
        → Fallback to custom if needed
```

**Main Project**:
```
User clicks MetaMask
  → connectWalletHandler()
    → wallet.connect()
      → connectWallet() (custom)
        → getWalletForChain() (can be intercepted)
```

### 3. Detection Logic Differences

Both projects have similar detection logic in `getWalletForChain()`, but:

**tiwi-test**: 
- Uses Wagmi connector FIRST, so detection logic is rarely needed
- Detection is only used as fallback

**Main Project**:
- Always uses detection logic first
- Detection can be intercepted even with good checks

---

## 📋 Implementation Plan

### Phase 1: Update Direct Connection Path (CRITICAL)

**File**: `hooks/useWalletConnection.ts`

**Changes Needed**:

1. **Add Wagmi MetaMask connector logic to `connectWalletHandler()`**

   Before (lines 161-176):
   ```typescript
   // Single-chain wallet - connect immediately
   await wallet.connect(walletId, chain);
   ```

   After:
   ```typescript
   // Single-chain wallet - connect immediately
   // For MetaMask on Ethereum, use Wagmi's MetaMask connector
   if (chain === 'ethereum' && providerId === 'metamask') {
     try {
       // Find Wagmi's MetaMask connector
       const metamaskConnector = wagmiConnectors.find((c: any) => {
         const id = (c.id || '').toLowerCase();
         const name = (c.name || '').toLowerCase();
         const type = (c.type || '').toLowerCase();
         return id.includes('metamask') || 
                name.includes('metamask') ||
                type === 'metamask' ||
                c.id === 'metaMask' ||
                c.id === 'metaMaskSDK';
       });
       
       if (metamaskConnector) {
         console.log('[useWalletConnection] Using Wagmi MetaMask connector for direct connection');
         
         // Disconnect any existing wallet first
         if (wallet.primaryWallet) {
           try {
             await wallet.disconnect();
           } catch (error) {
             console.warn('Error disconnecting existing wallet:', error);
           }
         }
         
         // Connect using Wagmi's MetaMask connector
         await wagmiConnect({ connector: metamaskConnector });
         
         // Get the connected account directly from Wagmi core
         const wagmiAccount = getAccount(wagmiConfig);
         let address: string;
         
         if (!wagmiAccount.address) {
           await new Promise(resolve => setTimeout(resolve, 300));
           const retryAccount = getAccount(wagmiConfig);
           if (!retryAccount.address) {
             throw new Error('Failed to get account address from MetaMask connector. Please try again.');
           }
           address = retryAccount.address;
         } else {
           address = wagmiAccount.address;
         }
         
         // Update wallet store directly (don't call wallet.connect())
         const account: WalletAccount = {
           address: address,
           chain: 'ethereum',
           provider: walletId,
         };
         
         useWalletStore.getState().setAccount(account);
         
         setIsToastOpen(true);
         setIsModalOpen(false);
         return; // Exit early - connection complete
       } else {
         // Fallback to custom connection
         console.warn('[useWalletConnection] Wagmi MetaMask connector not found, using custom connection');
         await wallet.connect(walletId, chain);
       }
     } catch (wagmiError: any) {
       console.error('[useWalletConnection] Wagmi MetaMask connection failed, trying custom connection:', wagmiError);
       // Fallback to custom connection
       await wallet.connect(walletId, chain);
     }
   } else {
     // For other wallets, use normal connection
     await wallet.connect(walletId, chain);
   }
   ```

2. **Add required imports**:
   ```typescript
   import { getAccount } from "@wagmi/core";
   import { useWalletStore } from "@/lib/wallet/state/store";
   import type { WalletAccount } from "@/lib/wallet/connection/types";
   ```

### Phase 2: Ensure Wagmi Config is Available

**File**: `hooks/useWalletConnection.ts`

**Current**: Uses `useConfig()` hook ✅

**Verify**: Ensure `wagmiConfig` is properly imported and used

### Phase 3: Test & Verify

**Test Cases**:
1. ✅ Connect MetaMask directly (should use Wagmi connector)
2. ✅ Connect MetaMask through chain selection (should use Wagmi connector)
3. ✅ Connect other wallets (should use custom connection)
4. ✅ Connect when Rabby is installed (should NOT intercept MetaMask)
5. ✅ Connect when OKX is installed (should NOT intercept MetaMask)
6. ✅ Fallback works if Wagmi connector not found

---

## 🔍 Additional Improvements (Optional)

### 1. Improve Detection Logic (Already Good, But Can Be Better)

**File**: `lib/wallet/connection/connector.ts`

The detection logic is already good, but we can add more checks:

```typescript
// In getWalletForChain() for MetaMask detection
if (providerId === 'metamask') {
  // Priority 1: Check rdns (most reliable)
  const metamaskProvider = ethereum.providers?.find((p: any) => {
    const rdns = (p.info?.rdns || '').toLowerCase();
    return rdns.includes('io.metamask') || rdns.includes('metamask');
  });
  if (metamaskProvider) return metamaskProvider;
  
  // Priority 2: Check _metamask property
  if (ethereum._metamask !== undefined || ethereum._state !== undefined) {
    return ethereum;
  }
  
  // Priority 3: Check isMetaMask but exclude Rabby/OKX
  if (ethereum.isMetaMask === true && 
      ethereum.isRabby !== true && 
      ethereum.isOkxWallet !== true) {
    return ethereum;
  }
}
```

### 2. Add Better Error Messages

When Rabby intercepts, show a helpful error:
```typescript
if (wallet.isRabby === true && providerId === 'metamask') {
  throw new Error(
    'Rabby wallet detected instead of MetaMask. ' +
    'Please disable Rabby or use Rabby wallet option to connect.'
  );
}
```

---

## 📝 Summary

### The Fix

**Primary Solution**: Use Wagmi's MetaMask connector for ALL MetaMask connections (direct and chain selection)

**Why It Works**:
- Wagmi connector is specifically designed for MetaMask
- Bypasses ambiguous `window.ethereum` detection
- Avoids Rabby interception

**Implementation**:
1. Add Wagmi MetaMask connector logic to `connectWalletHandler()` in `useWalletConnection.ts`
2. Use same pattern as `selectChain()` but for direct connections
3. Keep custom connection as fallback

### Files to Modify

1. **`hooks/useWalletConnection.ts`** (PRIMARY)
   - Add Wagmi MetaMask connector logic to `connectWalletHandler()`
   - Add required imports

2. **`lib/wallet/connection/connector.ts`** (OPTIONAL - already good)
   - Improve detection logic (optional enhancement)

### Testing Checklist

- [ ] MetaMask direct connection works
- [ ] MetaMask chain selection works
- [ ] Other wallets still work
- [ ] Rabby doesn't intercept MetaMask
- [ ] OKX doesn't intercept MetaMask
- [ ] Fallback works if Wagmi connector missing

---

## 🚀 Next Steps

1. Implement Phase 1 (update `connectWalletHandler()`)
2. Test with MetaMask + Rabby installed
3. Test with MetaMask + OKX installed
4. Verify all other wallets still work
5. Deploy and monitor


