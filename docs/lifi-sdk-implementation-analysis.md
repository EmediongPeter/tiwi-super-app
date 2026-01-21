# LiFi SDK Implementation Analysis & Plan

## Executive Summary

After studying the [LiFi SDK documentation](https://docs.li.fi/sdk/) and comparing it with our current implementation, I've identified several deviations from best practices and areas requiring improvement. This document outlines findings and provides a comprehensive implementation plan.

---

## 1. Current Implementation Analysis

### 1.1 Frontend Implementation (`lib/frontend/providers/lifi-sdk-provider.tsx`)

**What's Working:**
- ✅ `createConfig` is called at module level (correct)
- ✅ EVM provider is configured with Wagmi integration
- ✅ Providers are set when wallet connects
- ✅ Fallback provider configuration in executor

**Issues Identified:**
- ❌ **Not using `useSyncWagmiConfig` hook** - Recommended by LiFi for syncing chains
- ❌ **Not loading chains from LiFi API** - Should fetch and sync chains dynamically
- ❌ **RPC URLs not passed to LiFi SDK** - We have RPC config but not using it
- ❌ **Chains hardcoded in Wagmi** - Should be loaded from LiFi API and synced
- ❌ **Solana provider not implemented** - We support Solana but no LiFi Solana provider
- ❌ **No chain preloading strategy** - Should load chains on mount, not lazily

### 1.2 Backend Implementation (`lib/backend/routers/adapters/lifi-adapter.ts`)

**What's Working:**
- ✅ Uses `getQuote` and `getRoutes` from LiFi SDK
- ✅ Proper error handling

**Issues Identified:**
- ❌ **No `createConfig` call** - Backend uses SDK but doesn't configure it
- ❌ **No RPC URLs configured** - Backend might need RPCs for certain operations
- ❌ **No integrator string** - Required for partner tracking

**Analysis:** According to LiFi docs, `createConfig` is only needed if:
- Using SDK execution features (executeRoute) - **Backend doesn't need this**
- Want to configure RPC URLs for better reliability - **Backend should have this**
- Want to set integrator for tracking - **Backend should have this**

**Recommendation:** Backend should call `createConfig` with integrator and RPC URLs, but **doesn't need providers** (only frontend needs providers for execution).

### 1.3 RPC Configuration (`lib/backend/utils/rpc-config.ts`)

**What's Working:**
- ✅ Has RPC URLs for all supported chains
- ✅ Uses Alchemy RPCs (reliable)
- ✅ Environment variable support

**Issues Identified:**
- ❌ **RPC URLs not passed to LiFi SDK** - Should be configured in `createConfig`
- ❌ **Not using `setRPCUrls` method** - Should update SDK with our RPCs

---

## 2. Deviations from LiFi SDK Best Practices

### 2.1 Chain Management

**LiFi Recommendation:**
```typescript
// Load chains from LiFi API
const chains = await getChains({ chainTypes: [ChainType.EVM] });
config.setChains(chains);

// Sync with Wagmi using useSyncWagmiConfig hook
useSyncWagmiConfig(wagmiConfig, connectors, chains);
```

**Our Current Approach:**
- Hardcoded chains in Wagmi config
- Not loading from LiFi API
- Not syncing chains dynamically

**Impact:** 
- Missing new chains that LiFi adds
- Not using latest chain configurations
- Potential compatibility issues

### 2.2 RPC URL Configuration

**LiFi Recommendation:**
```typescript
createConfig({
  integrator: 'Your dApp/company name',
  rpcUrls: {
    [ChainId.ARB]: ["https://arbitrum-example.node.com/"],
    [ChainId.SOL]: ["https://solana-example.node.com/"],
  },
});
```

**Our Current Approach:**
- RPC URLs exist in `rpc-config.ts` but not passed to LiFi SDK
- SDK uses default public RPCs (can be rate-limited)

**Impact:**
- Potential rate limiting issues
- Less reliable connections
- Not using our premium Alchemy RPCs

### 2.3 Provider Configuration

**LiFi Recommendation:**
- Configure providers in `createConfig` initially OR
- Use `config.setProviders()` dynamically when wallet connects
- Use `useSyncWagmiConfig` for chain synchronization

**Our Current Approach:**
- ✅ Configuring providers dynamically (correct)
- ❌ Not using `useSyncWagmiConfig` hook
- ❌ Not following the recommended Wagmi integration pattern

### 2.4 Solana Support

**LiFi Recommendation:**
```typescript
import { Solana, config } from '@lifi/sdk';
import { useWallet } from '@solana/wallet-adapter-react';

config.setProviders([
  Solana({
    async getWalletAdapter() {
      return wallet?.adapter as SignerWalletAdapter;
    },
  }),
]);
```

**Our Current Approach:**
- ❌ No Solana provider implementation
- We support Solana (Jupiter) but not through LiFi

**Impact:**
- Can't execute Solana cross-chain swaps via LiFi
- Missing Solana bridge functionality

---

## 3. Implementation Plan

### Phase 1: Frontend Configuration (High Priority)

#### 1.1 Create Centralized LiFi SDK Config Module

**File:** `lib/frontend/config/lifi-sdk-config.ts`

**Purpose:** Centralize LiFi SDK configuration with RPC URLs and integrator

**Implementation:**
```typescript
import { createConfig, ChainId } from '@lifi/sdk';
import { RPC_CONFIG } from '@/lib/backend/utils/rpc-config';

// Initialize LiFi SDK config ONCE at module level
export function initializeLiFiSDK() {
  createConfig({
    integrator: 'TIWI Protocol',
    rpcUrls: {
      [ChainId.ETH]: [RPC_CONFIG[1]],
      [ChainId.ARB]: [RPC_CONFIG[42161]],
      [ChainId.OPT]: [RPC_CONFIG[10]],
      [ChainId.POL]: [RPC_CONFIG[137]],
      [ChainId.BSC]: [RPC_CONFIG[56]],
      [ChainId.BAS]: [RPC_CONFIG[8453]],
      // Add Solana RPC when available
    },
    preloadChains: false, // We'll load dynamically
  });
}
```

#### 1.2 Update LiFi SDK Provider with Chain Synchronization

**File:** `lib/frontend/providers/lifi-sdk-provider.tsx`

**Changes:**
1. Import and call `initializeLiFiSDK()` at module level
2. Use `useSyncWagmiConfig` hook (from `@lifi/wallet-management` if available, or implement similar)
3. Load chains from LiFi API on mount
4. Sync chains with Wagmi config
5. Update RPC URLs in SDK config

**Key Changes:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { getChains, ChainType, config } from '@lifi/sdk';
import { useSyncWagmiConfig } from '@lifi/wallet-management'; // If available

// Load chains from LiFi API
const { data: chains } = useQuery({
  queryKey: ['lifi-chains'],
  queryFn: async () => {
    const chains = await getChains({ chainTypes: [ChainType.EVM] });
    config.setChains(chains);
    return chains;
  },
});

// Sync with Wagmi
useSyncWagmiConfig(wagmiConfig, connectors, chains);
```

#### 1.3 Update Wallet Providers

**File:** `lib/frontend/providers/wallet-providers.tsx`

**Changes:**
1. Import `initializeLiFiSDK` and call it
2. Ensure proper initialization order
3. Update Wagmi config to support dynamic chains

### Phase 2: Backend Configuration (Medium Priority)

#### 2.1 Create Backend LiFi SDK Config

**File:** `lib/backend/config/lifi-sdk-config.ts`

**Purpose:** Configure LiFi SDK for backend API calls

**Implementation:**
```typescript
import { createConfig, ChainId } from '@lifi/sdk';
import { RPC_CONFIG } from '@/lib/backend/utils/rpc-config';

let isInitialized = false;

export function initializeBackendLiFiSDK() {
  if (isInitialized) return;
  
  createConfig({
    integrator: 'TIWI Protocol',
    rpcUrls: {
      // Same RPC mapping as frontend
    },
    // No providers needed - backend doesn't execute routes
  });
  
  isInitialized = true;
}
```

#### 2.2 Initialize in Backend Entry Points

**Files to Update:**
- `lib/backend/routers/adapters/lifi-adapter.ts` - Call `initializeBackendLiFiSDK()`
- `lib/backend/providers/lifi.ts` - Call `initializeBackendLiFiSDK()`

### Phase 3: Solana Provider Support (Future Enhancement)

#### 3.1 Check Solana Wallet Integration

**Investigation Needed:**
- Do we have `@solana/wallet-adapter-react` installed?
- How is Solana wallet currently integrated?
- What Solana wallet adapters are we using?

#### 3.2 Implement Solana Provider

**File:** `lib/frontend/providers/lifi-sdk-provider.tsx`

**Implementation:**
```typescript
import { Solana } from '@lifi/sdk';
import { useWallet } from '@solana/wallet-adapter-react';

// In LiFiSDKProvider component
const { wallet } = useWallet(); // If using Solana wallet adapter

useEffect(() => {
  if (wallet?.adapter) {
    config.setProviders([
      ...existingProviders,
      Solana({
        async getWalletAdapter() {
          return wallet.adapter as SignerWalletAdapter;
        },
      }),
    ]);
  }
}, [wallet?.adapter]);
```

---

## 4. Required Dependencies

### Check if Installed:
- [ ] `@lifi/wallet-management` - For `useSyncWagmiConfig` hook
- [ ] `@solana/wallet-adapter-react` - For Solana provider (if needed)
- [ ] `@solana/wallet-adapter-base` - For Solana types

### Install if Missing:
```bash
pnpm add @lifi/wallet-management
# For Solana (if implementing):
pnpm add @solana/wallet-adapter-react @solana/wallet-adapter-base
```

---

## 5. Implementation Checklist

### Frontend (High Priority)
- [ ] Create `lib/frontend/config/lifi-sdk-config.ts` with RPC URLs
- [ ] Update `lifi-sdk-provider.tsx` to use chain synchronization
- [ ] Implement `useSyncWagmiConfig` or equivalent chain sync
- [ ] Load chains from LiFi API on provider mount
- [ ] Update RPC URLs in SDK config from our RPC_CONFIG
- [ ] Test EVM provider configuration
- [ ] Verify chain switching works correctly

### Backend (Medium Priority)
- [ ] Create `lib/backend/config/lifi-sdk-config.ts`
- [ ] Initialize in `lifi-adapter.ts`
- [ ] Initialize in `lifi.ts` provider
- [ ] Test backend API calls still work

### Solana (Future)
- [ ] Investigate current Solana wallet integration
- [ ] Install required Solana wallet adapter packages
- [ ] Implement Solana provider in `lifi-sdk-provider.tsx`
- [ ] Test Solana cross-chain swaps

---

## 6. Testing Plan

### 6.1 Frontend Tests
1. **Provider Configuration:**
   - Connect wallet → Verify providers configured
   - Check console for "LiFi SDK providers configured successfully"
   - Verify EVM provider is set

2. **Chain Synchronization:**
   - Verify chains loaded from LiFi API
   - Check Wagmi config has all LiFi chains
   - Test chain switching

3. **RPC Configuration:**
   - Verify RPC URLs are set in SDK config
   - Test transaction execution uses our RPCs

4. **Route Execution:**
   - Execute same-chain swap → Should work
   - Execute cross-chain swap → Should work
   - Verify no "SDK Execution Provider not found" error

### 6.2 Backend Tests
1. **Config Initialization:**
   - Verify `createConfig` is called
   - Check integrator is set
   - Verify RPC URLs are configured

2. **API Calls:**
   - Test `getQuote` still works
   - Test `getRoutes` still works
   - Test `getTokens` still works

---

## 7. Risk Assessment

### Low Risk:
- ✅ Adding RPC URLs to config
- ✅ Loading chains from LiFi API
- ✅ Backend config initialization

### Medium Risk:
- ⚠️ Chain synchronization with Wagmi (might need `@lifi/wallet-management`)
- ⚠️ Dynamic chain updates in Wagmi config

### High Risk:
- ⚠️ Breaking existing functionality if not tested properly
- ⚠️ Solana provider integration (if wallet setup is complex)

---

## 8. Recommended Implementation Order

1. **Phase 1.1:** Create centralized config module (Frontend)
2. **Phase 1.2:** Update provider with chain sync (Frontend)
3. **Phase 1.3:** Test frontend execution
4. **Phase 2.1:** Create backend config (Backend)
5. **Phase 2.2:** Initialize in backend (Backend)
6. **Phase 3:** Solana provider (Future)

---

## 9. Key Findings Summary

### Critical Issues:
1. ❌ RPC URLs not configured in LiFi SDK
2. ❌ Chains not loaded from LiFi API
3. ❌ Not using recommended chain synchronization pattern
4. ❌ Backend doesn't have `createConfig` (should have for RPCs)

### Important Improvements:
1. ⚠️ Should use `useSyncWagmiConfig` or equivalent
2. ⚠️ Should load chains dynamically
3. ⚠️ Should configure RPC URLs for reliability

### Future Enhancements:
1. 💡 Solana provider for cross-chain Solana swaps
2. 💡 Chain preloading strategy
3. 💡 Better error handling for provider configuration

---

## 10. References

- [LiFi SDK Overview](https://docs.li.fi/sdk/)
- [LiFi SDK Configuration](https://docs.li.fi/sdk/configure-sdk)
- [Multi-VM Support](https://docs.li.fi/sdk/multi-vm-support)
