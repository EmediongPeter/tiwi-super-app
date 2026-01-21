# Swap State Management Audit

**Date:** 2025-01-27  
**Scope:** Swap/Limit Order state analysis  
**Objective:** Identify current state usage, pain points, and design a scalable state architecture

---

## 1. Current State Inventory

### 1.1 State Location Map

#### **`app/swap/page.tsx` (Primary State Container)**

**Core Swap State:**
```typescript
// Tab state
const [activeTab, setActiveTab] = useState<"swap" | "limit">("swap");

// Amount state
const [fromAmount, setFromAmount] = useState("");
const [limitPrice, setLimitPrice] = useState("");

// Limit order state
const [expires, setExpires] = useState<"never" | "24h" | "7d" | "custom">("never");

// Token selection state
const [fromToken, setFromToken] = useState<Token | null>(...);
const [toToken, setToToken] = useState<Token | null>(null);

// Modal state
const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
const [tokenModalType, setTokenModalType] = useState<"from" | "to">("from");
```

**Derived State (from hooks):**
```typescript
// Quote state (from useSwapQuote hook)
const { toAmount, isQuoteLoading } = useSwapQuote({
  fromAmount,
  activeTab,
});

// Wallet state (from useWalletConnection hook)
const {
  isModalOpen,
  isToastOpen,
  connectedAddress,
  openModal,
  closeModal,
  connectWallet,
  closeToast,
} = useWalletConnection();

// Computed USD values (derived from amounts)
const fromUsdValue = calculateFromUsdValue(fromAmountNum);
const toUsdValue = calculateToUsdValue(toAmountNum);
const limitPriceUsd = calculateLimitPriceUsd(limitPriceNum);
```

#### **`components/swap/swap-card.tsx` (UI State Only)**

```typescript
// Local UI state - details expansion
const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

// Derived validation
const hasValidFromAmount = parseNumber(fromAmount) > 0;
```

#### **`components/swap/token-selector-modal.tsx` (Modal-Scoped State)**

```typescript
// Chain filtering state
const [selectedChain, setSelectedChain] = useState<Chain | "all">("all");
const [chainSearchQuery, setChainSearchQuery] = useState("");

// Token search state
const [searchQuery, setSearchQuery] = useState("");

// Mobile UI state
const [showChainList, setShowChainList] = useState(false);

// Derived filtered tokens (useMemo)
const filteredTokens = useMemo(() => {...}, [tokens, selectedChain, searchQuery]);
const filteredChains = useMemo(() => {...}, [chains, chainSearchQuery]);
```

#### **`hooks/useSwapQuote.ts` (Quote Calculation State)**

```typescript
// Internal quote state
const [toAmount, setToAmount] = useState("");
const [isQuoteLoading, setIsQuoteLoading] = useState(false);
```

#### **`hooks/useWalletConnection.ts` (Wallet State)**

```typescript
// Wallet connection state
const [isModalOpen, setIsModalOpen] = useState(false);
const [isToastOpen, setIsToastOpen] = useState(false);
const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
```

---

## 2. State Flow Analysis

### 2.1 Current Data Flow

```
SwapPage (State Owner)
  ├── activeTab ──────────────> SwapCard ──────> SwapTabs
  ├── fromToken ───────────────> SwapCard ──────> TokenInput (from)
  ├── toToken ─────────────────> SwapCard ──────> TokenInput (to)
  ├── fromAmount ───────────────> SwapCard ──────> TokenInput (from)
  │                              └───────────────> useSwapQuote ──> toAmount
  ├── toAmount (derived) ───────> SwapCard ──────> TokenInput (to)
  ├── limitPrice ───────────────> SwapCard ──────> LimitOrderFields
  ├── expires ──────────────────> SwapCard ──────> LimitOrderFields
  │
  ├── isTokenModalOpen ─────────> TokenSelectorModal
  ├── tokenModalType ───────────> TokenSelectorModal
  └── handleTokenSelect ────────> TokenSelectorModal ──> Updates fromToken/toToken
```

### 2.2 State Update Patterns

**Unidirectional Flow:**
- ✅ State flows down via props
- ✅ Updates flow up via callbacks
- ✅ No direct state mutations

**Issues:**
- ⚠️ **Deep prop drilling:** 10+ props passed to `SwapCard`
- ⚠️ **Scattered handlers:** 15+ handler functions in `SwapPage`
- ⚠️ **Derived state duplication:** USD values recalculated on every render
- ⚠️ **Tight coupling:** `SwapPage` knows about all child component needs

---

## 3. Pain Points & Issues

### 3.1 Critical Issues

#### **A. Missing State Variable (Bug)**
```typescript
// Line 86: handleToAmountChange references setToAmount which doesn't exist
const handleToAmountChange = (value: string) => {
  setToAmount(sanitizeDecimal(value)); // ❌ setToAmount is undefined
};
```
**Impact:** ⚠️ **High** - Function is broken, will cause runtime error if called.

#### **B. Quote State Ownership Confusion**
- `toAmount` is derived from `useSwapQuote` hook
- But `handleToAmountChange` suggests it should be editable
- Unclear: Is `toAmount` read-only (from quote) or editable (manual input)?

**Current Behavior:**
- `toAmount` is read-only (from quote)
- `onToAmountChange` prop exists but handler is broken
- TokenInput has `readOnlyAmount={true}` for "to" field

**Issue:** Inconsistent API - prop exists but doesn't work.

#### **C. Token Selection State Complexity**
```typescript
// Three pieces of state for one modal
const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
const [tokenModalType, setTokenModalType] = useState<"from" | "to">("from");
const [fromToken, setFromToken] = useState<Token | null>(...);
const [toToken, setToToken] = useState<Token | null>(null);
```

**Issues:**
- Modal state + type state + token state = 4 state variables
- `handleTokenSelect` must check `tokenModalType` to decide which token to update
- Easy to get out of sync

### 3.2 Scalability Concerns

#### **A. Prop Drilling**
```typescript
<SwapCard
  activeTab={activeTab}
  fromToken={...}
  toToken={...}
  fromBalance={...}
  toBalance={...}
  fromAmount={fromAmount}
  fromUsdValue={fromUsdValue}
  toAmount={toAmount}
  toUsdValue={toUsdValue}
  limitPrice={limitPrice}
  limitPriceUsd={limitPriceUsd}
  expires={expires}
  onTabChange={handleTabChange}
  onFromTokenSelect={handleFromTokenSelect}
  onToTokenSelect={handleToTokenSelect}
  onFromAmountChange={handleFromAmountChange}
  onToAmountChange={handleToAmountChange}
  onLimitPriceChange={handleLimitPriceChange}
  onExpiresChange={setExpires}
  onMaxClick={handleMaxClick}
  onSwapClick={handleSwapClick}
  onConnectClick={handleConnectClick}
  isConnected={!!connectedAddress}
/>
```
**Count:** 23 props passed to `SwapCard`

**Impact:** ⚠️ **Medium** - Hard to maintain, easy to miss updates, verbose.

#### **B. Derived State Recalculation**
```typescript
// Recalculated on every render
const fromAmountNum = parseNumber(fromAmount);
const toAmountNum = parseNumber(toAmount);
const limitPriceNum = parseNumber(limitPrice);

const fromUsdValue = calculateFromUsdValue(fromAmountNum);
const toUsdValue = calculateToUsdValue(toAmountNum);
const limitPriceUsd = calculateLimitPriceUsd(limitPriceNum);
```

**Issues:**
- No memoization
- Recalculated even when inputs haven't changed
- Multiple parse operations per render

**Impact:** ⚠️ **Low-Medium** - Performance concern, but not critical yet.

#### **C. State Synchronization**
- `useSwapQuote` depends on `fromAmount` and `activeTab`
- When `fromToken` changes, quote should refetch (TODO comment exists)
- No automatic refetch when tokens change

**Impact:** ⚠️ **Medium** - Quote may be stale after token change.

### 3.3 Missing State

#### **A. Validation State**
- No validation state (e.g., `isValid`, `errors`)
- No insufficient balance check
- No slippage tolerance state
- No minimum/maximum amount validation

**Impact:** ⚠️ **High** - Critical for production.

#### **B. Transaction State**
- No pending transaction state
- No transaction history
- No error state for failed transactions

**Impact:** ⚠️ **High** - Required for swap execution.

#### **C. Slippage & Settings**
- No slippage tolerance state
- No deadline state
- No fee settings

**Impact:** ⚠️ **Medium** - Required for swap configuration.

---

## 4. State Categorization

### 4.1 Local Component State (Should Stay Local)

**UI-Only State:**
- ✅ `isDetailsExpanded` (SwapCard) - UI expansion state
- ✅ `showChainList` (TokenSelectorModal) - Mobile UI toggle
- ✅ `isModalOpen` (useWalletConnection) - Modal visibility
- ✅ `isToastOpen` (useWalletConnection) - Toast visibility

**Reason:** These are purely presentational, don't affect business logic.

### 4.2 Feature-Scoped State (Should Be Centralized)

**Swap Core State:**
- ⚠️ `activeTab` - Swap vs Limit mode
- ⚠️ `fromToken` - Selected from token
- ⚠️ `toToken` - Selected to token
- ⚠️ `fromAmount` - Input amount
- ⚠️ `toAmount` - Output amount (from quote)
- ⚠️ `limitPrice` - Limit order price
- ⚠️ `expires` - Limit order expiry

**Derived State:**
- ⚠️ `fromUsdValue` - USD value of from amount
- ⚠️ `toUsdValue` - USD value of to amount
- ⚠️ `limitPriceUsd` - USD value of limit price
- ⚠️ `isQuoteLoading` - Quote loading state

**Reason:** These are core swap state, used across multiple components, should be centralized.

### 4.3 Modal State (Could Be Simplified)

**Token Selector Modal:**
- ⚠️ `isTokenModalOpen` - Modal visibility
- ⚠️ `tokenModalType` - Which token is being selected
- ⚠️ `selectedChain` - Chain filter in modal
- ⚠️ `searchQuery` - Token search query
- ⚠️ `chainSearchQuery` - Chain search query

**Reason:** Modal state is tightly coupled to swap state. Could be simplified with a single "token selection context" state.

### 4.4 Server State (Future Consideration)

**Quote State:**
- ⚠️ `toAmount` - Quote result
- ⚠️ `isQuoteLoading` - Loading state
- ⚠️ Quote error state (missing)

**Reason:** This is server-derived state. Should be managed separately from client state (TanStack Query candidate).

### 4.5 Global State (Out of Scope for Now)

**Wallet State:**
- ✅ `connectedAddress` - Wallet address
- ✅ `isConnected` - Connection status

**Reason:** This is global app state, but out of scope for this phase.

---

## 5. State Dependencies Graph

```
Swap State Dependencies:
  activeTab
    └──> Determines if limit fields are shown
    └──> Affects quote calculation (useSwapQuote)

  fromToken
    └──> Affects fromBalance display
    └──> Should trigger quote refetch (TODO)
    └──> Affects limitPrice token display

  toToken
    └──> Affects toBalance display
    └──> Should trigger quote refetch (TODO)

  fromAmount
    └──> Triggers quote calculation (useSwapQuote)
    └──> Affects fromUsdValue calculation
    └──> Affects limit order validation (hasValidFromAmount)

  toAmount (derived)
    └──> Affects toUsdValue calculation
    └──> Displayed in TokenInput (read-only)

  limitPrice
    └──> Affects limitPriceUsd calculation
    └──> Required for limit order execution

  expires
    └──> Required for limit order execution
```

---

## 6. Current Architecture Strengths

### ✅ What's Working Well

1. **Clear Component Boundaries**
   - Components are well-separated
   - Props interfaces are clear
   - No direct state mutations

2. **Unidirectional Data Flow**
   - State flows down, events flow up
   - Predictable update patterns

3. **Custom Hooks for Logic**
   - `useSwapQuote` encapsulates quote logic
   - `useWalletConnection` encapsulates wallet logic
   - Good separation of concerns

4. **Type Safety**
   - TypeScript used throughout
   - Clear type definitions

---

## 7. Current Architecture Weaknesses

### ⚠️ What Needs Improvement

1. **State Scattered Across Components**
   - Swap state in `SwapPage`
   - Quote state in `useSwapQuote`
   - Modal state in `SwapPage` + `TokenSelectorModal`
   - Hard to see full picture

2. **Deep Prop Drilling**
   - 23 props passed to `SwapCard`
   - Many intermediate components just pass props through

3. **Derived State Not Memoized**
   - USD values recalculated on every render
   - Multiple parse operations

4. **Missing State**
   - No validation state
   - No transaction state
   - No error state

5. **State Update Logic Scattered**
   - 15+ handler functions in `SwapPage`
   - Hard to track what updates what

6. **Tight Coupling**
   - `SwapPage` knows about all child component needs
   - Hard to refactor components independently

---

## 8. Summary

### Current State Count

- **SwapPage:** 9 state variables
- **SwapCard:** 1 state variable (UI only)
- **TokenSelectorModal:** 5 state variables
- **useSwapQuote:** 2 state variables
- **useWalletConnection:** 3 state variables

**Total:** ~20 state variables across the swap feature

### Key Findings

1. ✅ **State is mostly well-organized** - Clear ownership, unidirectional flow
2. ⚠️ **Prop drilling is excessive** - 23 props to SwapCard
3. ⚠️ **Missing critical state** - Validation, transactions, errors
4. ⚠️ **Derived state not optimized** - Recalculated unnecessarily
5. ⚠️ **Bug exists** - `setToAmount` undefined
6. ⚠️ **State synchronization gaps** - Quote doesn't refetch on token change

### Next Steps

1. **Fix immediate bug** - Remove or fix `handleToAmountChange`
2. **Design state architecture** - Centralize swap state
3. **Reduce prop drilling** - Use context or store
4. **Add missing state** - Validation, transactions, errors
5. **Optimize derived state** - Memoize calculations

---

**End of State Audit**

