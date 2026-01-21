# TIWI-TEST Wallet System Audit Report

## Executive Summary

This document provides a comprehensive analysis of the `tiwi-test` wallet connection and swap implementation. The audit focuses on understanding the architecture, identifying strengths and weaknesses, and proposing a clean integration strategy for our main codebase.

**Key Findings:**
- **Wallet System**: Complex but functional, with significant coupling between detection, connection, and state management
- **Swap System**: Well-structured routing logic but tightly coupled to wallet implementation
- **Architecture**: Mixed concerns, with wallet logic leaking into UI components
- **State Management**: Multiple overlapping state systems (localStorage, React Context, Wagmi)

---

## 1. System Breakdown

### 1.1 Wallet Connection System

#### 1.1.1 Architecture Overview

The wallet system in `tiwi-test` uses a **multi-layered detection and connection approach**:

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer                              │
│  (WalletSelector.tsx - 1067 lines)                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Detection Layer                             │
│  • wallet-detector.ts (747 lines)                       │
│  • wallet-detection-helpers.ts (404 lines)              │
│  • supported-wallets.ts (1136 lines)                    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│            Connection Layer                              │
│  • connectWallet() - Direct provider connection         │
│  • Wagmi integration (fallback/parallel)               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│            State Management Layer                        │
│  • WalletContext.tsx (localStorage + React Context)    │
│  • SecondaryWalletProvider (separate context)          │
│  • Wagmi state (parallel system)                       │
└─────────────────────────────────────────────────────────┘
```

#### 1.1.2 Wallet Detection Mechanism

**Location**: `app/utils/wallet-detector.ts`, `app/utils/wallet-detection-helpers.ts`

**How It Works:**

1. **Supported Wallets List** (`supported-wallets.ts`)
   - Hardcoded list of 100+ wallets with metadata
   - Each wallet has: `id`, `name`, `supportedChains`, `detectionKeys`, `imageId`
   - Source: WalletConnect Explorer API

2. **Detection Process** (`wallet-detection-helpers.ts`)
   - **Method 1**: Direct window property checks (`window.ethereum`, `window.solana`, etc.)
   - **Method 2**: EIP-6963 providers array (multiple wallets installed)
   - **Method 3**: Single provider case (window.ethereum without providers array)
   - **Method 4**: Wallet-specific property checks (isMetaMask, isRabby, etc.)
   - **Method 5**: RDNS (Reverse Domain Name Service) checks
   - **Method 6**: Direct window property checks for specific wallets

3. **Critical Detection Logic**:
   ```typescript
   // Priority order for MetaMask detection (to avoid Rabby/OKX conflicts):
   1. Check rdns (most reliable)
   2. Check name
   3. Check isMetaMask property (but exclude Rabby/OKX)
   4. Check MetaMask-specific properties (_metamask, _state)
   ```

**Key Characteristics:**
- ✅ **Comprehensive**: Handles 100+ wallets
- ✅ **EIP-6963 Support**: Detects multiple wallets via providers array
- ⚠️ **Complex**: Multiple detection methods with priority logic
- ⚠️ **Fragile**: Wallet-specific workarounds (Rabby, OKX masquerading as MetaMask)
- ⚠️ **Tightly Coupled**: Detection logic mixed with connection logic

#### 1.1.3 Wallet Connection Flow

**Location**: `app/utils/wallet-detector.ts` → `connectWallet()`

**Connection Process:**

1. **Provider Selection** (`getWalletForChain()`)
   - Maps wallet ID to actual provider object
   - Handles EIP-6963 providers array
   - Special handling for MetaMask (Wagmi connector vs direct)
   - Returns provider instance or throws error

2. **Connection Execution** (`connectWallet()`)
   - **Solana**: Always disconnects first, then calls `wallet.connect()`
   - **Ethereum**: 
     - Phantom: Just requests accounts
     - Others: Revokes permissions first, then requests accounts
   - Returns `WalletAccount` object: `{ address, chain, provider }`

3. **State Persistence**:
   - Saves to `localStorage` via `WalletContext`
   - Also updates "wallet history" (last connected per chain type)
   - **Critical Issue**: Clears localStorage on page load (line 103-109 in WalletContext.tsx)

**Connection Flow Diagram:**
```
User clicks "Connect"
    ↓
WalletSelector.handleProviderSelect()
    ↓
handleConnectWithProvider()
    ↓
1. Disconnect all existing wallets
2. Clear internal state
3. Map wallet ID → provider ID (wallet-id-mapper.ts)
4. For MetaMask: Use Wagmi connector (special case)
5. For others: Use connectWallet() from wallet-detector
    ↓
connectWallet(providerId, chain)
    ↓
getWalletForChain() → Returns provider object
    ↓
Verify provider (MetaMask checks for Rabby/OKX conflicts)
    ↓
Chain-specific connection:
  - Solana: wallet.disconnect() → wallet.connect()
  - Ethereum: wallet.request({ method: 'eth_requestAccounts' })
    ↓
Return WalletAccount
    ↓
Update WalletContext → localStorage
```

**Critical Issues:**
- ❌ **Double Disconnection**: Disconnects before every connection (forces fresh prompt)
- ❌ **localStorage Clearing**: Clears on page load, breaking persistence
- ❌ **Mixed Systems**: Uses both Wagmi and custom detection simultaneously
- ⚠️ **Complex Error Handling**: Multiple fallback paths make debugging difficult

#### 1.1.4 State Management

**Location**: `app/contexts/WalletContext.tsx`, `app/hooks/use-secondary-wallet.tsx`

**Primary Wallet State** (`WalletContext.tsx`):
```typescript
interface WalletContextType {
  connectedWallet: WalletAccount | null;
  setConnectedWallet: (account: WalletAccount | null) => void;
  showWalletSelector: boolean;
  setShowWalletSelector: (show: boolean) => void;
  getWalletForChainType: (chainType: 'evm' | 'solana') => WalletAccount | null;
  clearWalletHistory: () => void;
}
```

**Storage Keys:**
- `lifi_connected_wallet`: Current connected wallet
- `lifi_wallet_history`: Last connected wallet per chain type

**Secondary Wallet State** (`use-secondary-wallet.tsx`):
- Separate context for "secondary" wallet (for transfers?)
- Same localStorage pattern
- **Issue**: No clear use case documented

**State Flow:**
```
WalletConnection
    ↓
WalletContext.setConnectedWallet()
    ↓
1. Update React state
2. Save to localStorage (lifi_connected_wallet)
3. Update wallet history (lifi_wallet_history)
    ↓
Components re-render via useWallet() hook
```

**Critical Issues:**
- ❌ **localStorage Cleared on Mount**: Lines 103-109 clear storage on every page load
- ❌ **No State Synchronization**: WalletContext and Wagmi state can diverge
- ⚠️ **Secondary Wallet Unclear**: Purpose not documented
- ⚠️ **No Persistence Strategy**: Clears on refresh, then saves on change

#### 1.1.5 Wallet-to-Wallet Transfers

**Location**: Not explicitly found in the codebase

**Analysis:**
- Secondary wallet context exists but no transfer logic found
- Swap interface uses `secondaryWallet` for destination address
- **Conclusion**: Transfer functionality appears incomplete or not implemented

### 1.2 Swap Functionality

#### 1.2.1 Swap State Model

**Location**: `app/components/SwapInterface.tsx` (4510 lines)

**State Structure:**
```typescript
// React state (local to component)
const [fromChain, setFromChain] = useState<number>(1);
const [toChain, setToChain] = useState<number>(1);
const [fromToken, setFromToken] = useState<Token | null>(null);
const [toToken, setToToken] = useState<Token | null>(null);
const [fromAmount, setFromAmount] = useState<string>('');
const [toAmount, setToAmount] = useState<string>('');
const [route, setRoute] = useState<RouteExtended | null>(null);
const [isExecuting, setIsExecuting] = useState(false);

// Wallet state (from contexts)
const { connectedWallet } = useWallet();
const { secondaryWallet } = useSecondaryWallet();
```

**Key Characteristics:**
- ✅ **Simple State Model**: Basic React state, no complex store
- ⚠️ **No State Persistence**: State lost on navigation
- ⚠️ **Large Component**: 4510 lines in single file
- ❌ **Mixed Concerns**: UI, state, API calls, wallet logic all in one file

#### 1.2.2 Token Selection

**Location**: `app/components/TokenSelector.tsx`, `app/components/SwapInterface.tsx`

**How It Works:**
1. Token list fetched from LI.FI SDK (`getChains()` → `tokens`)
2. User selects token via `TokenSelector` component
3. Token stored in component state
4. Token balance fetched via Moralis API (`getTokenBalance()`, `getSolanaTokenBalance()`)

**Issues:**
- ⚠️ **External Dependency**: Relies on Moralis for balances
- ⚠️ **No Caching**: Balance fetched on every render
- ⚠️ **No Error Handling**: Balance fetch failures not handled gracefully

#### 1.2.3 Amount Handling

**Location**: `app/components/SwapInterface.tsx`

**Amount Flow:**
```
User enters amount
    ↓
handleFromAmountChange()
    ↓
setFromAmount(value)
    ↓
useEffect triggers quote fetch
    ↓
getQuote() or getJupiterQuote()
    ↓
setToAmount(quote.outputAmount)
```

**Key Logic:**
- Input sanitization via `sanitizeDecimal()`
- Amount converted to smallest unit for API calls
- Output amount derived from quote (read-only)

**Issues:**
- ⚠️ **No Validation**: No max balance checks before quote
- ⚠️ **Race Conditions**: Multiple quote requests can overlap
- ⚠️ **No Debouncing**: Quote fetched on every keystroke

#### 1.2.4 Route/Quote Fetching

**Location**: `app/components/SwapInterface.tsx`, `app/utils/swap-router-selector.ts`

**Router Selection Logic** (`swap-router-selector.ts`):
```typescript
// Routing rules:
- Same-chain Solana → Jupiter
- Same-chain BSC → PancakeSwap
- Same-chain other EVM → Uniswap
- Cross-chain or other → LI.FI
```

**Quote Fetching:**
1. Determine router via `selectSwapRouter()`
2. Fetch quote:
   - **Jupiter**: `getJupiterQuote()` (Solana)
   - **PancakeSwap**: `getPancakeSwapV2Quote()` (BSC)
   - **Uniswap**: `getUniswapV2Quote()` (EVM)
   - **LI.FI**: `getQuote()` (cross-chain or fallback)
3. Store route in component state

**Key Characteristics:**
- ✅ **Smart Routing**: Chooses optimal router per chain
- ✅ **Fallback Strategy**: LI.FI as universal fallback
- ⚠️ **No Caching**: Quotes not cached
- ⚠️ **No Rate Limiting**: Can spam quote endpoints
- ❌ **Complex Logic**: Router selection mixed with quote fetching

#### 1.2.5 Execution Flow

**Location**: `app/components/SwapInterface.tsx` → `handleExecuteSwap()`

**Execution Process:**
1. Validate wallet connection
2. Check wallet compatibility with chain
3. Get wallet client (Wagmi or custom)
4. Execute route:
   - **Jupiter**: `executeJupiterOrder()` → Sign transaction
   - **PancakeSwap/Uniswap**: Build transaction → Approve → Swap
   - **LI.FI**: `executeRoute()` → SDK handles everything
5. Update UI with transaction status

**Key Characteristics:**
- ✅ **Multi-Router Support**: Handles different execution paths
- ⚠️ **Complex Error Handling**: Multiple try-catch blocks
- ⚠️ **No Transaction Tracking**: No persistent transaction history
- ❌ **Tightly Coupled**: Execution logic mixed with UI

### 1.3 Overall Architecture

#### 1.3.1 Folder Structure

```
app/
├── components/          # UI components (mixed concerns)
│   ├── SwapInterface.tsx (4510 lines - too large)
│   ├── WalletSelector.tsx (1067 lines - too large)
│   └── ...
├── contexts/            # React contexts
│   └── WalletContext.tsx
├── hooks/               # Custom hooks
│   ├── use-secondary-wallet.tsx
│   └── useWalletIcon.ts
├── lib/                 # External library configs
│   └── cosmos/
├── utils/               # Utility functions (mixed concerns)
│   ├── wallet-detector.ts (747 lines)
│   ├── wallet-detection-helpers.ts (404 lines)
│   ├── swap-router-selector.ts
│   ├── jupiter.ts
│   ├── pancakeswapv2.ts
│   ├── uniswapv2.ts
│   └── ...
└── providers.tsx        # Provider setup (Wagmi, LI.FI, etc.)
```

**Architectural Issues:**
- ❌ **No Clear Separation**: Business logic mixed with UI
- ❌ **Large Files**: Multiple files exceed 1000 lines
- ❌ **Utils Overload**: `utils/` contains everything (detection, connection, swap logic)
- ⚠️ **No Service Layer**: Direct API calls in components
- ⚠️ **No Type Safety**: Many `any` types, loose typing

#### 1.3.2 Component Responsibilities

**WalletSelector.tsx (1067 lines)**:
- ❌ **Too Many Responsibilities**:
  - Wallet detection
  - Wallet connection
  - UI rendering
  - State management
  - Error handling
  - Chain selection modal
  - Search functionality

**SwapInterface.tsx (4510 lines)**:
- ❌ **Massive Component**:
  - Token selection
  - Chain selection
  - Amount input
  - Quote fetching
  - Route execution
  - Balance fetching
  - Error handling
  - UI rendering

**Critical Violations:**
- ❌ **Single Responsibility Principle**: Components do everything
- ❌ **Separation of Concerns**: Business logic in UI
- ❌ **Testability**: Impossible to test in isolation

#### 1.3.3 Hooks and Utilities

**Custom Hooks:**
- `use-secondary-wallet.tsx`: Secondary wallet context (unclear purpose)
- `useWalletIcon.ts`: Wallet icon fetching (simple utility)

**Utility Functions:**
- **wallet-detector.ts**: Core wallet detection and connection
- **wallet-detection-helpers.ts**: Detection helper functions
- **swap-router-selector.ts**: Router selection logic
- **jupiter.ts**, **pancakeswapv2.ts**, **uniswapv2.ts**: DEX-specific logic

**Issues:**
- ⚠️ **No Hook Abstraction**: Wallet connection not abstracted into reusable hook
- ⚠️ **Utility Overload**: Utils contain business logic, not just helpers
- ❌ **No Error Boundaries**: Errors bubble up to UI

#### 1.3.4 State Management Approach

**Multiple Overlapping Systems:**

1. **React Context** (`WalletContext`, `SecondaryWalletProvider`)
   - Purpose: Wallet connection state
   - Storage: localStorage
   - Issue: Cleared on mount

2. **Wagmi State** (via `@wagmi/core`)
   - Purpose: EVM wallet state
   - Storage: Wagmi's internal storage
   - Issue: Not always in sync with custom state

3. **Component State** (React `useState`)
   - Purpose: UI state, swap state
   - Storage: Memory only
   - Issue: Lost on navigation

4. **localStorage** (manual)
   - Purpose: Persistence
   - Storage: Browser localStorage
   - Issue: Cleared on page load (intentional but problematic)

**Critical Issues:**
- ❌ **State Fragmentation**: State spread across multiple systems
- ❌ **No Single Source of Truth**: Multiple sources can conflict
- ❌ **Synchronization Problems**: Wagmi and custom state can diverge
- ⚠️ **No State Machine**: No clear state transitions

#### 1.3.5 API Boundaries

**External Dependencies:**
- **LI.FI SDK**: Cross-chain routing and execution
- **Jupiter API**: Solana swaps
- **PancakeSwap Router**: BSC swaps
- **Uniswap Router**: EVM swaps
- **Moralis API**: Token balances
- **WalletConnect Explorer**: Wallet icons/metadata

**API Integration Pattern:**
- Direct API calls in components
- No abstraction layer
- No error handling strategy
- No retry logic
- No rate limiting

**Issues:**
- ❌ **No API Client**: Direct fetch/axios calls
- ❌ **No Error Handling**: Errors not handled consistently
- ❌ **No Caching**: No request caching
- ⚠️ **No Type Safety**: API responses not typed

#### 1.3.6 Logic Leakage

**Where Logic Leaks into UI:**

1. **WalletSelector.tsx**:
   - Detection logic in component
   - Connection logic in component
   - Provider merging logic in component

2. **SwapInterface.tsx**:
   - Quote fetching in component
   - Route execution in component
   - Balance fetching in component
   - Router selection in component

3. **TokenSelector.tsx**:
   - Token filtering in component
   - Token search in component

**Impact:**
- ❌ **Untestable**: Business logic tied to React
- ❌ **Unreusable**: Logic can't be used outside React
- ❌ **Hard to Maintain**: Changes require component updates

---

## 2. Critical Evaluation

### 2.1 What Is Good

#### ✅ Comprehensive Wallet Support
- Supports 100+ wallets via WalletConnect Explorer
- Handles EIP-6963 (multiple wallets)
- Special handling for edge cases (Rabby, OKX)

#### ✅ Multi-Chain Support
- Ethereum (EVM chains)
- Solana
- Cross-chain routing via LI.FI

#### ✅ Smart Router Selection
- Chooses optimal DEX per chain
- Fallback strategy (LI.FI as universal fallback)
- Clear routing rules

#### ✅ Functional Implementation
- Actually works (user confirmed)
- Handles real-world edge cases
- Comprehensive error messages

### 2.2 What Is Fragile

#### ⚠️ Wallet Detection Logic
**Fragility Points:**
- Wallet-specific workarounds (Rabby, OKX)
- Priority-based detection (can break if wallet changes behavior)
- Multiple detection methods (if one fails, others might not catch it)

**Example:**
```typescript
// Fragile: Depends on specific wallet properties
if (ethereum.isRabby === true) return "rabby";
if (ethereum.isMetaMask === true && !ethereum.isRabby) return "metamask";
```

**Risk**: If wallets change their properties, detection breaks.

#### ⚠️ State Synchronization
**Fragility Points:**
- Wagmi state and custom state can diverge
- localStorage cleared on mount but saved on change
- No mechanism to detect and fix desync

**Risk**: Wallet appears connected but isn't, or vice versa.

#### ⚠️ Connection Flow
**Fragility Points:**
- Always disconnects before connecting (forces fresh prompt)
- Multiple fallback paths (Wagmi → custom → error)
- Chain switching logic complex

**Risk**: Connection can fail silently or show wrong wallet.

### 2.3 What Is Tightly Coupled

#### ❌ Wallet Detection ↔ Connection
**Coupling:**
- Detection logic knows about connection requirements
- Connection logic knows about detection methods
- Can't change one without affecting the other

**Impact**: Hard to test, hard to maintain, hard to extend.

#### ❌ Wallet State ↔ UI
**Coupling:**
- Wallet state managed in React Context
- UI components directly access wallet state
- No abstraction layer

**Impact**: Can't use wallet logic outside React, hard to test.

#### ❌ Swap Logic ↔ Wallet Logic
**Coupling:**
- Swap execution requires wallet connection
- Wallet connection state affects swap UI
- No clear boundary

**Impact**: Changes to wallet system affect swap, and vice versa.

#### ❌ DEX Logic ↔ Swap Logic
**Coupling:**
- Router selection in swap component
- DEX-specific logic in swap component
- No abstraction

**Impact**: Adding new DEX requires changing swap component.

### 2.4 What Violates Our Principles

#### ❌ Simplicity
**Violations:**
- 4510-line component
- 1067-line component
- Multiple overlapping state systems
- Complex detection logic with many edge cases

**Impact**: Hard to understand, hard to maintain.

#### ❌ Predictability
**Violations:**
- localStorage cleared on mount but saved on change
- Multiple fallback paths (unclear which path executes)
- State can diverge between systems

**Impact**: Unpredictable behavior, hard to debug.

#### ❌ Modularity
**Violations:**
- Business logic in UI components
- No clear module boundaries
- Utils folder contains everything

**Impact**: Can't reuse code, hard to test.

#### ❌ Reusability
**Violations:**
- Wallet connection logic tied to React
- Swap logic tied to specific component
- No service layer

**Impact**: Can't reuse logic in other contexts.

#### ❌ Readability
**Violations:**
- Large files (hard to navigate)
- Mixed concerns (hard to understand)
- Complex nested logic

**Impact**: Hard to read, hard to onboard new developers.

#### ❌ Scalability
**Violations:**
- No caching (every request hits API)
- No rate limiting
- No request deduplication
- State in memory (lost on navigation)

**Impact**: Performance issues at scale.

#### ❌ Explicit Data Flow
**Violations:**
- State flows through multiple systems
- No clear data flow diagram
- Side effects in multiple places

**Impact**: Hard to trace data flow, hard to debug.

#### ❌ Minimal Coupling
**Violations:**
- Wallet ↔ Swap coupling
- Detection ↔ Connection coupling
- UI ↔ Business logic coupling

**Impact**: Changes ripple through system.

---

## 3. Proposed Integration Strategy

### 3.1 High-Level Architecture

**Proposed Structure:**
```
lib/
├── wallet/
│   ├── detection/          # Wallet detection (pure functions)
│   │   ├── detector.ts
│   │   ├── helpers.ts
│   │   └── types.ts
│   ├── connection/         # Wallet connection (pure functions)
│   │   ├── connector.ts
│   │   ├── providers.ts
│   │   └── types.ts
│   ├── state/              # Wallet state management
│   │   ├── store.ts        # Zustand store (single source of truth)
│   │   ├── persistence.ts  # localStorage sync
│   │   └── types.ts
│   ├── hooks/              # React hooks (thin layer)
│   │   ├── useWallet.ts
│   │   └── useWalletConnection.ts
│   └── index.ts            # Public API
├── swap/
│   ├── routing/            # Router selection (pure functions)
│   │   ├── selector.ts
│   │   └── types.ts
│   ├── quotes/             # Quote fetching (service layer)
│   │   ├── lifi.ts
│   │   ├── jupiter.ts
│   │   ├── pancakeswap.ts
│   │   └── uniswap.ts
│   ├── execution/          # Swap execution (service layer)
│   │   ├── executor.ts
│   │   └── types.ts
│   ├── state/              # Swap state management
│   │   ├── store.ts        # Zustand store
│   │   └── types.ts
│   └── index.ts            # Public API
└── shared/
    ├── types/              # Shared types
    ├── utils/              # Pure utility functions
    └── constants/          # Constants
```

### 3.2 Wallet Connection Module

#### 3.2.1 Detection Module (`lib/wallet/detection/`)

**Responsibilities:**
- Detect installed wallets
- Identify wallet providers
- Map wallet IDs to providers

**Design Principles:**
- ✅ **Pure Functions**: No side effects
- ✅ **Testable**: Easy to unit test
- ✅ **Extensible**: Easy to add new wallets

**API:**
```typescript
// lib/wallet/detection/detector.ts
export function detectInstalledWallets(): WalletProvider[];
export function getWalletProvider(walletId: string, chain: Chain): Provider | null;
export function isWalletInstalled(wallet: SupportedWallet): boolean;
```

**Implementation Notes:**
- Extract detection logic from `wallet-detector.ts`
- Remove React dependencies
- Keep wallet-specific workarounds but document them
- Add comprehensive tests

#### 3.2.2 Connection Module (`lib/wallet/connection/`)

**Responsibilities:**
- Connect to wallet
- Disconnect from wallet
- Switch chains
- Get wallet account

**Design Principles:**
- ✅ **Pure Functions**: No side effects (except wallet prompts)
- ✅ **Chain-Agnostic**: Works for EVM and Solana
- ✅ **Error Handling**: Clear error messages

**API:**
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

export async function getWalletAccount(
  walletId: string,
  chain: Chain
): Promise<WalletAccount | null>;
```

**Implementation Notes:**
- Extract connection logic from `wallet-detector.ts`
- Remove React dependencies
- Integrate with Wagmi for EVM (but don't depend on it)
- Add comprehensive error handling

#### 3.2.3 State Module (`lib/wallet/state/`)

**Responsibilities:**
- Manage wallet connection state
- Persist state to localStorage
- Sync state across tabs

**Design Principles:**
- ✅ **Single Source of Truth**: Zustand store
- ✅ **Persistence**: Automatic localStorage sync
- ✅ **Type Safety**: Fully typed

**API:**
```typescript
// lib/wallet/state/store.ts
interface WalletStore {
  // State
  connectedWallet: WalletAccount | null;
  secondaryWallet: WalletAccount | null;
  isConnecting: boolean;
  error: string | null;
  
  // Actions
  connect: (walletId: string, chain: Chain) => Promise<void>;
  disconnect: () => Promise<void>;
  setSecondaryWallet: (wallet: WalletAccount | null) => void;
  clearError: () => void;
}

export const useWalletStore = create<WalletStore>(...);
```

**Implementation Notes:**
- Use Zustand for state management
- Add persistence middleware
- Sync with Wagmi (but don't depend on it)
- Add error state management

#### 3.2.4 Hooks Module (`lib/wallet/hooks/`)

**Responsibilities:**
- Provide React hooks for wallet state
- Handle React-specific concerns (effects, etc.)

**Design Principles:**
- ✅ **Thin Layer**: Just wraps store
- ✅ **React-Specific**: Handles effects, cleanup
- ✅ **Type Safe**: Fully typed

**API:**
```typescript
// lib/wallet/hooks/useWallet.ts
export function useWallet() {
  const store = useWalletStore();
  // React-specific logic (effects, etc.)
  return store;
}

export function useWalletConnection() {
  // Connection-specific hook
}
```

**Implementation Notes:**
- Thin wrapper around Zustand store
- Handle React effects (wallet events, etc.)
- Provide convenient API for components

### 3.3 Swap Module

#### 3.3.1 Routing Module (`lib/swap/routing/`)

**Responsibilities:**
- Select optimal router for swap
- Determine routing strategy

**Design Principles:**
- ✅ **Pure Functions**: No side effects
- ✅ **Testable**: Easy to unit test
- ✅ **Extensible**: Easy to add new routers

**API:**
```typescript
// lib/swap/routing/selector.ts
export function selectSwapRouter(
  fromChain: number,
  toChain: number,
  fromToken?: string,
  toToken?: string
): SwapRouter;
```

**Implementation Notes:**
- Extract from `swap-router-selector.ts`
- Keep routing rules but make them configurable
- Add tests for all routing scenarios

#### 3.3.2 Quotes Module (`lib/swap/quotes/`)

**Responsibilities:**
- Fetch quotes from different routers
- Normalize quote responses
- Handle errors

**Design Principles:**
- ✅ **Service Layer**: Abstract API calls
- ✅ **Error Handling**: Consistent error handling
- ✅ **Caching**: Cache quotes (optional)

**API:**
```typescript
// lib/swap/quotes/lifi.ts
export async function getLifiQuote(
  fromChain: number,
  toChain: number,
  fromToken: string,
  toToken: string,
  amount: string
): Promise<Quote>;

// Similar for jupiter.ts, pancakeswap.ts, uniswap.ts
```

**Implementation Notes:**
- Extract quote fetching from `SwapInterface.tsx`
- Add error handling
- Add request caching (optional)
- Add retry logic (optional)

#### 3.3.3 Execution Module (`lib/swap/execution/`)

**Responsibilities:**
- Execute swaps
- Handle approvals
- Track transaction status

**Design Principles:**
- ✅ **Service Layer**: Abstract execution logic
- ✅ **Error Handling**: Consistent error handling
- ✅ **Transaction Tracking**: Track transaction status

**API:**
```typescript
// lib/swap/execution/executor.ts
export async function executeSwap(
  route: Route,
  wallet: WalletAccount
): Promise<Transaction>;
```

**Implementation Notes:**
- Extract execution logic from `SwapInterface.tsx`
- Add transaction tracking
- Add error handling
- Add retry logic for failed transactions

#### 3.3.4 State Module (`lib/swap/state/`)

**Responsibilities:**
- Manage swap state
- Persist state (optional)

**Design Principles:**
- ✅ **Single Source of Truth**: Zustand store
- ✅ **Type Safety**: Fully typed

**API:**
```typescript
// lib/swap/state/store.ts
interface SwapStore {
  // State
  fromChain: number;
  toChain: number;
  fromToken: Token | null;
  toToken: Token | null;
  fromAmount: string;
  toAmount: string;
  route: Route | null;
  isExecuting: boolean;
  error: string | null;
  
  // Actions
  setFromChain: (chain: number) => void;
  setToChain: (chain: number) => void;
  setFromToken: (token: Token | null) => void;
  setToToken: (token: Token | null) => void;
  setFromAmount: (amount: string) => void;
  fetchQuote: () => Promise<void>;
  executeSwap: () => Promise<void>;
  clearError: () => void;
}

export const useSwapStore = create<SwapStore>(...);
```

**Implementation Notes:**
- Use Zustand for state management
- Add persistence (optional)
- Integrate with quote and execution modules

### 3.4 What Should Be Redesigned

#### ❌ Wallet Detection Logic
**Current Issues:**
- Too many detection methods
- Wallet-specific workarounds
- Complex priority logic

**Redesign:**
- Simplify detection to 2-3 methods max
- Document wallet-specific workarounds
- Make detection extensible via plugins

#### ❌ State Management
**Current Issues:**
- Multiple overlapping systems
- localStorage cleared on mount
- No single source of truth

**Redesign:**
- Single Zustand store
- Proper persistence strategy
- Clear state synchronization

#### ❌ Component Structure
**Current Issues:**
- 4510-line component
- 1067-line component
- Mixed concerns

**Redesign:**
- Break into smaller components
- Extract business logic to services
- Clear separation of concerns

#### ❌ Error Handling
**Current Issues:**
- Inconsistent error handling
- Errors bubble to UI
- No error recovery

**Redesign:**
- Consistent error types
- Error boundaries
- Error recovery strategies

### 3.5 What Should Be Reused Conceptually

#### ✅ Wallet Detection Approach
**What to Reuse:**
- EIP-6963 support
- Multiple detection methods
- Wallet-specific workarounds (but document them)

**How to Reuse:**
- Extract to pure functions
- Add comprehensive tests
- Document edge cases

#### ✅ Router Selection Logic
**What to Reuse:**
- Routing rules (same-chain vs cross-chain)
- Fallback strategy (LI.FI as universal fallback)

**How to Reuse:**
- Extract to pure function
- Make rules configurable
- Add tests

#### ✅ Multi-Chain Support
**What to Reuse:**
- Chain abstraction (EVM vs Solana)
- Chain-specific connection logic

**How to Reuse:**
- Extract to chain-specific modules
- Add chain registry
- Make extensible

### 3.6 What Should Be Discarded

#### ❌ localStorage Clearing on Mount
**Why Discard:**
- Breaks persistence
- Confusing behavior
- No clear benefit

**Replacement:**
- Proper persistence strategy
- Clear when to clear (explicit disconnect only)

#### ❌ Secondary Wallet Context
**Why Discard:**
- Unclear purpose
- Not used for transfers
- Adds complexity

**Replacement:**
- If needed, add to main wallet store
- Document use case clearly

#### ❌ Mixed State Systems
**Why Discard:**
- Causes synchronization issues
- Hard to debug
- Unpredictable behavior

**Replacement:**
- Single Zustand store
- Clear state flow

#### ❌ Large Components
**Why Discard:**
- Hard to maintain
- Hard to test
- Violates SRP

**Replacement:**
- Smaller, focused components
- Business logic in services

---

## 4. Implementation Roadmap

### Phase 1: Wallet Detection & Connection (Foundation)
1. Extract detection logic to `lib/wallet/detection/`
2. Extract connection logic to `lib/wallet/connection/`
3. Create Zustand store for wallet state
4. Add persistence layer
5. Create React hooks

### Phase 2: Swap Routing & Quotes
1. Extract routing logic to `lib/swap/routing/`
2. Extract quote fetching to `lib/swap/quotes/`
3. Create Zustand store for swap state
4. Add quote caching (optional)

### Phase 3: Swap Execution
1. Extract execution logic to `lib/swap/execution/`
2. Add transaction tracking
3. Add error handling
4. Integrate with wallet module

### Phase 4: UI Refactoring
1. Break down large components
2. Extract business logic to services
3. Add error boundaries
4. Improve error handling

### Phase 5: Testing & Documentation
1. Add comprehensive tests
2. Document architecture
3. Document API
4. Add examples

---

## 5. Key Decisions

### 5.1 State Management: Zustand
**Decision**: Use Zustand for state management

**Rationale:**
- ✅ Simple API
- ✅ TypeScript support
- ✅ Persistence middleware
- ✅ No boilerplate
- ✅ Good performance

**Alternatives Considered:**
- Redux: Too much boilerplate
- Jotai: Too new, less ecosystem
- Context API: Performance issues at scale

### 5.2 Persistence Strategy
**Decision**: Persist to localStorage with sync

**Rationale:**
- ✅ Survives page refresh
- ✅ Syncs across tabs
- ✅ Simple implementation

**Implementation:**
- Use Zustand persistence middleware
- Clear only on explicit disconnect
- Sync with Wagmi (but don't depend on it)

### 5.3 Wallet Detection: Keep Complexity
**Decision**: Keep comprehensive detection but extract to pure functions

**Rationale:**
- ✅ Works in practice
- ✅ Handles edge cases
- ✅ Supports 100+ wallets

**Mitigation:**
- Extract to pure functions
- Add comprehensive tests
- Document edge cases
- Make extensible via plugins

### 5.4 Router Selection: Keep Logic
**Decision**: Keep routing rules but make configurable

**Rationale:**
- ✅ Works well
- ✅ Clear rules
- ✅ Good fallback strategy

**Enhancement:**
- Extract to pure function
- Make rules configurable
- Add tests

---

## 6. Open Questions

1. **Secondary Wallet**: What is the use case? Should we keep it?
2. **Wagmi Integration**: How tightly should we integrate? Full replacement or parallel?
3. **Error Handling**: What error recovery strategies should we implement?
4. **Caching**: Should we cache quotes? For how long?
5. **Transaction Tracking**: Should we persist transaction history?
6. **Chain Support**: Should we support more chains? How to make it extensible?

---

## 7. Conclusion

The `tiwi-test` implementation is **functionally working** but **architecturally flawed**. The key insights are:

1. **Wallet System**: Comprehensive but complex. Needs extraction and simplification.
2. **Swap System**: Well-structured routing but tightly coupled. Needs service layer.
3. **Architecture**: Mixed concerns. Needs clear separation.

**Recommended Approach:**
- ✅ Extract business logic to services
- ✅ Use Zustand for state management
- ✅ Create clear module boundaries
- ✅ Add comprehensive tests
- ✅ Document architecture

**Next Steps:**
1. Review this audit with team
2. Answer open questions
3. Create detailed implementation plan
4. Begin Phase 1 implementation

---

**Document Version**: 1.0  
**Date**: 2025-01-27  
**Author**: AI Assistant  
**Status**: Draft - Awaiting Review

