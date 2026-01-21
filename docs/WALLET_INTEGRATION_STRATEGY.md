# Wallet Integration Strategy - Revised

**Date:** 2025-01-27  
**Status:** 📋 Proposal - Awaiting Approval  
**Based On:** TIWI-TEST audit + Existing Architecture Review

---

## Executive Summary

This document proposes a wallet integration strategy that:
1. **Respects existing backend routing architecture** (quotes via `/api/v1/route`)
2. **Integrates wallet connection** from `tiwi-test` (extracted and cleaned)
3. **Implements client-side swap execution** (web vs mobile compatible)
4. **Uses Wagmi best practices** for EVM chains
5. **Supports secondary wallet** for recipient addresses
6. **Follows engineering principles** (simplicity, modularity, predictability)

---

## 1. Architecture Overview

### 1.1 Current State

**✅ What Exists:**
- Backend routing via `/api/v1/route` (LiFi, PancakeSwap, Uniswap adapters)
- Frontend quote fetching via `useSwapQuote` hook
- Zustand store for swap state
- Mock wallet connection (`useWalletConnection` returns mock addresses)
- Swap execution **NOT implemented** (`handleSwapClick` is placeholder)

**❌ What's Missing:**
- Real wallet connection (detection, connection, state management)
- Swap execution (transaction signing and submission)
- Balance fetching (for "Max" button)
- Secondary wallet support (for recipient addresses)
- Transaction tracking

### 1.2 Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Web/Mobile)                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Wallet Module (Client-Side)                   │  │
│  │  • Detection (lib/wallet/detection/)                 │  │
│  │  • Connection (lib/wallet/connection/)               │  │
│  │  • State (lib/wallet/state/) - Zustand               │  │
│  │  • Hooks (lib/wallet/hooks/)                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Swap Execution (Client-Side)                 │  │
│  │  • Execution (lib/frontend/services/swap-executor/) │  │
│  │  • Transaction tracking (lib/frontend/store/)        │  │
│  │  • Balance fetching (lib/frontend/api/balances.ts)   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Quote Fetching (Already Exists)              │  │
│  │  • useSwapQuote hook                                 │  │
│  │  • fetchRoute() → /api/v1/route                     │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP POST /api/v1/route
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (Already Implemented)                  │
│  • RouteService                                             │
│  • Router Adapters (LiFi, PancakeSwap, Uniswap)           │
│  • Route scoring and selection                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** Backend handles routing/quotes, frontend handles wallet interaction and execution.

---

## 2. Wallet Module Architecture

### 2.1 Module Structure

```
lib/wallet/
├── detection/              # Wallet detection (pure functions)
│   ├── detector.ts        # Main detection logic
│   ├── helpers.ts         # Detection helper functions
│   ├── supported-wallets.ts # Wallet list (from tiwi-test)
│   └── types.ts           # Detection types
│
├── connection/             # Wallet connection (pure functions)
│   ├── connector.ts       # Connection logic (EVM + Solana)
│   ├── providers.ts       # Provider management
│   └── types.ts           # Connection types
│
├── state/                  # Wallet state management
│   ├── store.ts           # Zustand store
│   ├── persistence.ts     # localStorage sync
│   └── types.ts           # State types
│
├── hooks/                  # React hooks (thin layer)
│   ├── useWallet.ts       # Main wallet hook
│   ├── useWalletConnection.ts # Connection hook
│   └── useSecondaryWallet.ts # Secondary wallet hook
│
└── index.ts               # Public API
```

### 2.2 Detection Module

**Location:** `lib/wallet/detection/`

**Responsibilities:**
- Detect installed wallets (EVM + Solana)
- Identify wallet providers
- Map wallet IDs to providers

**Key Functions:**
```typescript
// lib/wallet/detection/detector.ts
export function detectInstalledWallets(): WalletProvider[];
export function getWalletProvider(walletId: string, chain: Chain): Provider | null;
export function isWalletInstalled(wallet: SupportedWallet): boolean;
```

**Implementation Notes:**
- Extract from `tiwi-test/app/utils/wallet-detector.ts`
- Remove React dependencies (pure functions)
- Keep wallet-specific workarounds (Rabby, OKX) but document them
- Support EIP-6963 (multiple wallets)

**Source:** `docs/tiwi-test/app/utils/wallet-detector.ts` (747 lines)

### 2.3 Connection Module

**Location:** `lib/wallet/connection/`

**Responsibilities:**
- Connect to wallet (EVM via Wagmi, Solana direct)
- Disconnect from wallet
- Switch chains
- Get wallet account

**Key Functions:**
```typescript
// lib/wallet/connection/connector.ts
export async function connectWallet(
  walletId: string,
  chain: Chain
): Promise<WalletAccount>;

export async function disconnectWallet(
  walletId: string,
  chain: Chain
): Promise<void>;

export async function switchChain(
  walletId: string,
  chainId: number
): Promise<void>;
```

**Wagmi Integration:**
- Use Wagmi for EVM chains (MetaMask, Coinbase, WalletConnect, etc.)
- Use direct provider for Solana (Phantom, Solflare, etc.)
- Wagmi config in `lib/wallet/providers/wagmi-config.ts`

**Implementation Notes:**
- Extract from `tiwi-test/app/utils/wallet-detector.ts` → `connectWallet()`
- Integrate Wagmi for EVM (best practices)
- Keep Solana connection direct (as in tiwi-test)
- Handle chain switching via Wagmi `switchChain`

**Source:** `docs/tiwi-test/app/utils/wallet-detector.ts` (lines 338-521)

### 2.4 State Module

**Location:** `lib/wallet/state/`

**Responsibilities:**
- Manage wallet connection state
- Persist state to localStorage
- Sync state across tabs
- Support primary + secondary wallet

**Store Structure:**
```typescript
// lib/wallet/state/store.ts
interface WalletStore {
  // Primary wallet
  primaryWallet: WalletAccount | null;
  isConnecting: boolean;
  error: string | null;
  
  // Secondary wallet (for recipient addresses)
  secondaryWallet: WalletAccount | null;
  secondaryAddress: string | null; // Can be pasted address
  
  // Actions
  connect: (walletId: string, chain: Chain) => Promise<void>;
  disconnect: () => Promise<void>;
  setSecondaryWallet: (wallet: WalletAccount | null) => void;
  setSecondaryAddress: (address: string | null) => void; // For pasted addresses
  clearError: () => void;
}

export const useWalletStore = create<WalletStore>(...);
```

**Persistence Strategy:**
- ✅ Persist to localStorage (via Zustand persistence middleware)
- ✅ Clear only on explicit disconnect (NOT on page load)
- ✅ Sync with Wagmi (but don't depend on it)
- ✅ Support cross-tab sync

**Implementation Notes:**
- Use Zustand with persistence middleware
- Don't clear localStorage on mount (fix from tiwi-test)
- Sync with Wagmi state (read-only, don't write to Wagmi)
- Secondary wallet can be:
  - Connected wallet (via `setSecondaryWallet`)
  - Pasted address (via `setSecondaryAddress`)

**Source:** `docs/tiwi-test/app/contexts/WalletContext.tsx` (but fix localStorage clearing)

### 2.5 Hooks Module

**Location:** `lib/wallet/hooks/`

**Responsibilities:**
- Provide React hooks for wallet state
- Handle React-specific concerns (effects, cleanup)
- Wallet event listeners

**Key Hooks:**
```typescript
// lib/wallet/hooks/useWallet.ts
export function useWallet() {
  const store = useWalletStore();
  // React-specific logic (wallet events, etc.)
  return store;
}

// lib/wallet/hooks/useSecondaryWallet.ts
export function useSecondaryWallet() {
  const store = useWalletStore();
  return {
    secondaryWallet: store.secondaryWallet,
    secondaryAddress: store.secondaryAddress,
    setSecondaryWallet: store.setSecondaryWallet,
    setSecondaryAddress: store.setSecondaryAddress,
  };
}
```

**Implementation Notes:**
- Thin wrapper around Zustand store
- Handle wallet events (accountsChanged, chainChanged)
- Provide convenient API for components

---

## 3. Swap Execution Module

### 3.1 Execution Architecture

**Key Principle:** Execution is **client-side** because it requires wallet interaction (signing transactions).

**Web vs Mobile:**
- **Web**: Direct wallet extension interaction (MetaMask, Phantom, etc.)
- **Mobile**: WalletConnect or mobile wallet SDKs
- **Architecture**: Abstract execution layer that works for both

### 3.2 Execution Service

**Location:** `lib/frontend/services/swap-executor/`

```
lib/frontend/services/swap-executor/
├── executor.ts            # Main execution logic
├── evm-executor.ts        # EVM execution (Wagmi + Viem)
├── solana-executor.ts     # Solana execution (direct)
├── transaction-tracker.ts # Transaction status tracking
└── types.ts               # Execution types
```

**Key Functions:**
```typescript
// lib/frontend/services/swap-executor/executor.ts
export async function executeSwap(
  route: RouterRoute,           // From backend API
  wallet: WalletAccount,         // Primary wallet
  recipient?: string             // Secondary wallet address (optional)
): Promise<TransactionResult>;

// lib/frontend/services/swap-executor/evm-executor.ts
export async function executeEVMSwap(
  route: RouterRoute,
  wallet: WalletAccount,
  recipient?: string
): Promise<TransactionResult>;

// lib/frontend/services/swap-executor/solana-executor.ts
export async function executeSolanaSwap(
  route: RouterRoute,
  wallet: WalletAccount,
  recipient?: string
): Promise<TransactionResult>;
```

**Execution Flow:**
```
User clicks "Swap"
    ↓
executeSwap(route, primaryWallet, secondaryAddress)
    ↓
Determine chain type (EVM vs Solana)
    ↓
If EVM:
  → executeEVMSwap()
    → Get wallet client (Wagmi or custom)
    → Build transaction from route
    → Request approval (if needed)
    → Sign transaction
    → Submit transaction
    → Track status
    ↓
If Solana:
  → executeSolanaSwap()
    → Get Solana wallet adapter
    → Build transaction from route
    → Sign transaction
    → Submit transaction
    → Track status
    ↓
Return TransactionResult
    ↓
Update transaction store
    ↓
Show success/error notification
```

**Implementation Notes:**
- Use route from backend API (already has transaction data)
- For LiFi routes: Use `executeRoute()` from LiFi SDK
- For PancakeSwap/Uniswap: Build transaction from route data
- Handle approvals (ERC20 token approvals)
- Track transaction status (pending → confirmed → failed)

**Source:** `docs/tiwi-test/app/components/SwapInterface.tsx` (lines 2000-3000, execution logic)

### 3.3 Transaction Tracking

**Location:** `lib/frontend/store/transaction-store.ts`

**Store Structure:**
```typescript
interface TransactionStore {
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (txHash: string, status: TransactionStatus) => void;
  getTransaction: (txHash: string) => Transaction | null;
}

interface Transaction {
  id: string;
  txHash: string;
  chainId: number;
  status: 'pending' | 'confirmed' | 'failed';
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
  toAmount: string;
  timestamp: number;
  error?: string;
}
```

**Implementation Notes:**
- Store transactions in Zustand
- Persist to localStorage (optional)
- Update status via polling or event listeners
- Show transaction history in UI (future)

---

## 4. Balance Fetching

### 4.1 Balance API

**Location:** `lib/frontend/api/balances.ts`

**Key Functions:**
```typescript
export async function fetchTokenBalance(
  chainId: number,
  tokenAddress: string,
  walletAddress: string
): Promise<string>;

export async function fetchNativeBalance(
  chainId: number,
  walletAddress: string
): Promise<string>;
```

**Implementation Notes:**
- For EVM: Use Viem to read contract balance
- For Solana: Use Solana Web3.js to read balance
- Cache balances (optional, via React Query)
- Update on wallet/chain change

### 4.2 Balance Hook

**Location:** `hooks/useTokenBalance.ts`

```typescript
export function useTokenBalance(
  token: Token | null,
  walletAddress: string | null
): {
  balance: string | null;
  isLoading: boolean;
  error: Error | null;
};
```

**Implementation Notes:**
- Fetch balance when token/wallet changes
- Cache via React Query (optional)
- Update on wallet/chain change

---

## 5. Secondary Wallet Support

### 5.1 Purpose

**Use Case:** User wants to swap but send to a different address (or receive from different address).

**Examples:**
- Swap on MetaMask, send to Phantom wallet
- Swap on Phantom, send to pasted address
- Cross-chain swap to different wallet

### 5.2 Implementation

**Store Support:**
```typescript
interface WalletStore {
  // Primary wallet (required for execution)
  primaryWallet: WalletAccount | null;
  
  // Secondary wallet (optional, for recipient)
  secondaryWallet: WalletAccount | null;      // Connected wallet
  secondaryAddress: string | null;            // Pasted address
}
```

**UI Support:**
- Add "Recipient Address" field in swap UI (optional)
- Allow user to:
  - Connect secondary wallet
  - Paste recipient address
  - Use primary wallet address (default)

**Execution:**
- Pass `recipient` to `executeSwap()` if secondary address exists
- Backend route API already supports `recipient` parameter

---

## 6. Wagmi Integration

### 6.1 Wagmi Setup

**Location:** `lib/wallet/providers/wagmi-config.ts`

**Configuration:**
```typescript
import { createConfig, http } from 'wagmi';
import { mainnet, arbitrum, optimism, polygon, base, bsc } from 'wagmi/chains';
import { metaMask, walletConnect, injected } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [mainnet, arbitrum, optimism, polygon, base, bsc],
  connectors: [
    metaMask(),
    walletConnect({ projectId: '...' }),
    injected(),
  ],
  transports: {
    [mainnet.id]: http(),
    // ... other chains
  },
});
```

**Provider Setup:**
```typescript
// app/providers.tsx (or app/layout.tsx)
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  );
}
```

### 6.2 Best Practices

**✅ DO:**
- Use Wagmi for EVM chains (MetaMask, Coinbase, WalletConnect)
- Use `useAccount`, `useConnect`, `useDisconnect` hooks
- Use `useWalletClient` for transaction signing
- Sync Wagmi state with our Zustand store (read-only)

**❌ DON'T:**
- Don't depend on Wagmi for Solana (use direct providers)
- Don't write to Wagmi state (only read)
- Don't mix Wagmi and custom detection (use Wagmi for connection, custom for detection)

**Implementation:**
- Detection: Use custom detection (from tiwi-test)
- Connection: Use Wagmi for EVM, direct for Solana
- State: Zustand store (syncs with Wagmi read-only)

---

## 7. Error Handling

### 7.1 Error Strategy

**Principles:**
- ✅ Consistent error types
- ✅ User-friendly error messages
- ✅ Error recovery strategies
- ✅ Error boundaries (React)

**Error Types:**
```typescript
// lib/shared/types/errors.ts
export class WalletConnectionError extends Error {
  code: 'WALLET_NOT_FOUND' | 'USER_REJECTED' | 'NETWORK_ERROR';
}

export class SwapExecutionError extends Error {
  code: 'INSUFFICIENT_BALANCE' | 'SLIPPAGE_EXCEEDED' | 'TRANSACTION_FAILED';
}
```

**Error Handling:**
- Wallet connection errors → Show in wallet modal
- Swap execution errors → Show in swap UI
- Network errors → Retry with exponential backoff
- User rejection → Don't show error (expected behavior)

**Implementation:**
- Use error boundaries for React errors
- Handle async errors in try-catch
- Provide error recovery (retry, cancel)
- Log errors for debugging

---

## 8. Caching Strategy

### 8.1 Quote Caching

**Current State:** Quotes fetched on every input change (with debounce)

**Proposed:**
- ✅ Keep current behavior (quotes change frequently)
- ✅ Add quote expiration check (60 seconds)
- ✅ Auto-refresh expired quotes
- ❌ Don't cache quotes (they're time-sensitive)

**Implementation:**
- Use `expiresAt` from route response
- Check expiration before execution
- Show expiration countdown in UI

### 8.2 Balance Caching

**Proposed:**
- ✅ Cache balances (they change less frequently)
- ✅ Invalidate on wallet/chain change
- ✅ Refresh on transaction confirmation
- ✅ Use React Query for caching (optional)

**Implementation:**
- Cache balances in React Query (5 minute TTL)
- Invalidate on wallet/chain change
- Refresh on transaction confirmation

---

## 9. Chain Support

### 9.1 Current Support

**EVM Chains:**
- Ethereum (1)
- BNB Chain (56)
- Polygon (137)
- Arbitrum (42161)
- Optimism (10)
- Base (8453)

**Solana:**
- Mainnet (7565164 - canonical ID)

### 9.2 Future Support

**Planned:**
- Cosmos chains (via Squid adapter)
- Sui (via future adapter)
- Other chains (extensible architecture)

**Extensibility:**
- Chain registry in `lib/backend/registry/chains.ts`
- Router adapters support new chains
- Wallet detection supports new wallets
- Execution layer supports new chains

---

## 10. Implementation Plan

### Phase 1: Wallet Detection & Connection (Foundation)

**Goal:** Extract and integrate wallet detection/connection from tiwi-test

**Tasks:**
1. ✅ Create `lib/wallet/detection/` module
   - Extract detection logic from tiwi-test
   - Remove React dependencies
   - Add comprehensive tests

2. ✅ Create `lib/wallet/connection/` module
   - Extract connection logic from tiwi-test
   - Integrate Wagmi for EVM
   - Keep Solana direct

3. ✅ Create `lib/wallet/state/` module
   - Create Zustand store
   - Add persistence (fix localStorage clearing)
   - Support primary + secondary wallet

4. ✅ Create `lib/wallet/hooks/` module
   - Create React hooks
   - Handle wallet events
   - Provide convenient API

5. ✅ Install Wagmi dependencies
   - `wagmi`, `@wagmi/core`, `@wagmi/connectors`
   - `viem` (already installed)
   - `@tanstack/react-query` (already installed)

**Estimated Time:** 2-3 days

---

### Phase 2: Swap Execution (Critical)

**Goal:** Implement swap transaction execution

**Tasks:**
1. ✅ Create `lib/frontend/services/swap-executor/` module
   - Main executor (route to EVM/Solana)
   - EVM executor (Wagmi + Viem)
   - Solana executor (direct)

2. ✅ Create transaction tracking
   - Transaction store (Zustand)
   - Status polling/events
   - Transaction history

3. ✅ Update `app/swap/page.tsx`
   - Implement `handleSwapClick()`
   - Integrate swap executor
   - Handle execution errors

4. ✅ Add execution UI
   - Loading states
   - Success/error notifications
   - Transaction status display

**Estimated Time:** 3-4 days

---

### Phase 3: Balance Fetching

**Goal:** Implement balance fetching for "Max" button

**Tasks:**
1. ✅ Create `lib/frontend/api/balances.ts`
   - EVM balance fetching (Viem)
   - Solana balance fetching (Web3.js)

2. ✅ Create `hooks/useTokenBalance.ts`
   - Balance hook
   - Caching (optional)

3. ✅ Update `lib/frontend/store/swap-store.ts`
   - Implement `setMaxAmount()`
   - Add balance state

4. ✅ Update swap UI
   - Show balances
   - "Max" button functionality

**Estimated Time:** 1-2 days

---

### Phase 4: Secondary Wallet Support

**Goal:** Support secondary wallet/address for recipient

**Tasks:**
1. ✅ Update wallet store
   - Add secondary wallet/address
   - Add actions

2. ✅ Update swap UI
   - Add "Recipient Address" field
   - Connect secondary wallet option
   - Paste address option

3. ✅ Update execution
   - Pass recipient to `executeSwap()`
   - Handle recipient in executors

**Estimated Time:** 1-2 days

---

### Phase 5: Error Handling & Polish

**Goal:** Comprehensive error handling and UX improvements

**Tasks:**
1. ✅ Error types and handling
   - Consistent error types
   - User-friendly messages
   - Error recovery

2. ✅ Error boundaries
   - React error boundaries
   - Error logging

3. ✅ UX improvements
   - Loading states
   - Success animations
   - Error notifications

**Estimated Time:** 1-2 days

---

## 11. File Structure

### New Files to Create

```
lib/wallet/
├── detection/
│   ├── detector.ts
│   ├── helpers.ts
│   ├── supported-wallets.ts (from tiwi-test)
│   └── types.ts
├── connection/
│   ├── connector.ts
│   ├── providers.ts
│   └── types.ts
├── state/
│   ├── store.ts
│   ├── persistence.ts
│   └── types.ts
├── hooks/
│   ├── useWallet.ts
│   ├── useWalletConnection.ts
│   └── useSecondaryWallet.ts
├── providers/
│   └── wagmi-config.ts
└── index.ts

lib/frontend/
├── services/
│   └── swap-executor/
│       ├── executor.ts
│       ├── evm-executor.ts
│       ├── solana-executor.ts
│       ├── transaction-tracker.ts
│       └── types.ts
├── api/
│   └── balances.ts
└── store/
    └── transaction-store.ts

hooks/
└── useTokenBalance.ts
```

### Files to Update

```
app/
├── layout.tsx (add WagmiProvider)
└── swap/
    └── page.tsx (implement handleSwapClick)

components/
├── wallet/
│   └── connect-wallet-modal.tsx (integrate real connection)
└── swap/
    └── swap-card.tsx (add balance display)

hooks/
└── useWalletConnection.ts (replace mock with real)

lib/frontend/store/
└── swap-store.ts (add balance state, setMaxAmount)
```

---

## 12. Dependencies to Add

```json
{
  "dependencies": {
    "wagmi": "^3.0.0",
    "@wagmi/core": "^3.0.0",
    "@wagmi/connectors": "^7.0.0",
    "@solana/web3.js": "^1.98.4",
    "@solana/wallet-adapter-base": "^0.9.27",
    "@solana/wallet-adapter-react": "^0.15.39"
  }
}
```

---

## 13. Key Decisions

### ✅ Backend Routing (Keep As-Is)
- Backend handles all routing/quotes
- Frontend only calls `/api/v1/route`
- No routing logic in frontend

### ✅ Client-Side Execution
- Execution requires wallet interaction (signing)
- Different for web vs mobile (abstracted)
- Transaction tracking in frontend

### ✅ Wagmi for EVM
- Use Wagmi for EVM chains (best practices)
- Direct providers for Solana
- Sync Wagmi state with Zustand (read-only)

### ✅ Secondary Wallet
- Support connected wallet OR pasted address
- Use for recipient in swaps
- Optional (defaults to primary wallet)

### ✅ Error Handling
- Consistent error types
- User-friendly messages
- Error recovery strategies

### ✅ Caching
- Don't cache quotes (time-sensitive)
- Cache balances (5 minute TTL)
- Invalidate on wallet/chain change

---

## 14. Next Steps

1. **Review this strategy** with team
2. **Approve architecture** decisions
3. **Begin Phase 1** (Wallet Detection & Connection)
4. **Test incrementally** after each phase
5. **Proceed to Phase 2** (Swap Execution)

---

## 15. Questions & Answers

**Q: Why not use Wagmi for everything?**  
A: Solana doesn't use Wagmi. We use Wagmi for EVM, direct providers for Solana.

**Q: Why Zustand instead of Wagmi state?**  
A: Zustand gives us:
- Single source of truth (primary + secondary wallet)
- Cross-chain support (EVM + Solana)
- Persistence control
- Simpler API

**Q: Why client-side execution?**  
A: Execution requires wallet interaction (signing transactions). This must be client-side.

**Q: How does secondary wallet work?**  
A: User can:
- Connect a second wallet (e.g., Phantom)
- Paste a recipient address
- Use primary wallet (default)

The secondary address is passed to `executeSwap()` as `recipient`.

**Q: What about mobile?**  
A: Execution layer is abstracted. For mobile:
- Use WalletConnect for EVM
- Use mobile wallet SDKs for Solana
- Same execution interface

---

**Document Status:** 📋 Proposal - Awaiting Approval

**Next Action:** Review and approve before implementation begins.

