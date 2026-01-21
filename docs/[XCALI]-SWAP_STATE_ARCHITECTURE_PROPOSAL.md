# Swap State Architecture Proposal

**Date:** 2025-01-27  
**Status:** 📋 **PROPOSAL - AWAITING APPROVAL**  
**Scope:** Swap/Limit Order state management architecture

---

## Executive Summary

This proposal outlines a **feature-scoped, modular state management architecture** for the Swap/Limit Order experience. The design prioritizes:

- **Simplicity** - Minimal abstractions, clear ownership
- **Predictability** - Unidirectional flow, explicit updates
- **Debuggability** - Clear state shape, easy to inspect
- **Scalability** - Easy to extend without refactoring

**Key Decision:** Use **Zustand** for feature-scoped swap state, keeping it separate from global app state (wallet, auth) which will be handled later.

---

## 1. State Categorization

### 1.1 Local Component State (Remains Local)

**UI-Only State** - These stay in components:

```typescript
// SwapCard.tsx
const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

// TokenSelectorModal.tsx
const [showChainList, setShowChainList] = useState(false);
const [selectedChain, setSelectedChain] = useState<Chain | "all">("all");
const [searchQuery, setSearchQuery] = useState("");
const [chainSearchQuery, setChainSearchQuery] = useState("");

// Wallet modals/toasts (already in hook)
const [isModalOpen, setIsModalOpen] = useState(false);
const [isToastOpen, setIsToastOpen] = useState(false);
```

**Reasoning:**
- These are purely presentational
- Don't affect business logic
- Don't need to be shared across components
- Moving them would add complexity without benefit

### 1.2 Feature-Scoped State (Centralized in Store)

**Core Swap State** - These move to Zustand store:

```typescript
// Swap mode
activeTab: "swap" | "limit"

// Token selection
fromToken: Token | null
toToken: Token | null

// Amounts
fromAmount: string
toAmount: string (derived from quote, read-only)

// Limit order specific
limitPrice: string
expires: "never" | "24h" | "7d" | "custom"

// Derived/computed (computed in store selectors)
fromUsdValue: string
toUsdValue: string
limitPriceUsd: string
hasValidFromAmount: boolean
```

**Reasoning:**
- Used across multiple components
- Core business logic state
- Needs to persist across component unmounts
- Benefits from centralized updates

### 1.3 Server State (Future: TanStack Query)

**Quote State** - Will be handled by TanStack Query later:

```typescript
// Quote data (future)
quote: {
  toAmount: string
  rate: number
  priceImpact: number
  fees: number
}
isQuoteLoading: boolean
quoteError: Error | null
```

**Reasoning:**
- This is server-derived data
- Needs caching, refetching, invalidation
- TanStack Query handles this better than Zustand
- **For now:** Keep in Zustand, migrate later

### 1.4 Global State (Out of Scope)

**Wallet State** - Handled separately:

```typescript
// Already in useWalletConnection hook
connectedAddress: string | null
isConnected: boolean
```

**Reasoning:**
- Global app state, not swap-specific
- Already has its own hook
- Will be moved to global store later (Phase 2)

---

## 2. Tooling Decisions

### 2.1 Zustand vs Context API

#### **Zustand Selected** ✅

**Why Zustand:**
1. **Simplicity** - Minimal boilerplate, no provider nesting
2. **Performance** - Built-in selector optimization, prevents unnecessary re-renders
3. **DevTools** - Excellent debugging support
4. **TypeScript** - Excellent type inference
5. **Small Bundle** - ~1KB gzipped
6. **No Provider Hell** - Can use store without wrapping app

**Why NOT Context API:**
1. **Provider Nesting** - Would need SwapProvider wrapping SwapPage
2. **Re-render Issues** - All consumers re-render on any state change (without careful optimization)
3. **More Boilerplate** - Need to create context, provider, custom hooks
4. **Performance** - Requires manual optimization with useMemo/useCallback

**Example Comparison:**

```typescript
// Zustand (proposed)
const useSwapStore = create<SwapState>((set) => ({
  fromAmount: "",
  setFromAmount: (amount) => set({ fromAmount: amount }),
}));

// Usage - no provider needed
const fromAmount = useSwapStore((state) => state.fromAmount);

// Context API (alternative)
const SwapContext = create<SwapState>(...);
const SwapProvider = ({ children }) => { ... };
const useSwap = () => useContext(SwapContext);

// Usage - requires provider
<SwapProvider>
  <SwapPage />
</SwapProvider>
```

**Decision:** ✅ **Use Zustand** for feature-scoped swap state.

### 2.2 TanStack Query (Future Consideration)

#### **Not Now, But Plan For It** ⏸️

**What TanStack Query Is Good For:**
- Server state (quotes, prices, balances)
- Caching and invalidation
- Background refetching
- Optimistic updates
- Request deduplication

**What TanStack Query Is NOT Good For:**
- Client-only state (UI state, form state)
- Derived state calculations
- Local state that doesn't come from server

**Current State:**
- Quotes are mocked (no real API yet)
- No caching needed yet
- No background refetching needed yet

**Future Plan:**
- When real quote API is integrated, migrate quote state to TanStack Query
- Keep swap form state in Zustand
- Use Zustand selectors to combine client + server state

**Decision:** ⏸️ **Defer TanStack Query** until real API integration. Keep quote state in Zustand for now.

### 2.3 Redux (Not Considered)

**Why NOT Redux:**
- Too much boilerplate for this use case
- Overkill for feature-scoped state
- Zustand is simpler and sufficient

**Decision:** ❌ **Do not use Redux**.

---

## 3. Swap State Model

### 3.1 Core State Shape

```typescript
interface SwapState {
  // ===== Core Swap State =====
  
  // Mode
  activeTab: "swap" | "limit";
  
  // Token selection
  fromToken: Token | null;
  toToken: Token | null;
  
  // Amounts
  fromAmount: string;        // User input (editable)
  toAmount: string;         // Quote result (read-only, derived)
  
  // Limit order specific
  limitPrice: string;
  expires: "never" | "24h" | "7d" | "custom";
  
  // Quote state (server-derived, will migrate to TanStack Query later)
  isQuoteLoading: boolean;
  quoteError: Error | null;
  
  // ===== Actions =====
  
  // Tab actions
  setActiveTab: (tab: "swap" | "limit") => void;
  
  // Token actions
  setFromToken: (token: Token | null) => void;
  setToToken: (token: Token | null) => void;
  swapTokens: () => void;  // Swap fromToken <-> toToken
  
  // Amount actions
  setFromAmount: (amount: string) => void;
  setToAmount: (amount: string) => void;  // For quote updates
  setMaxAmount: () => void;  // Set fromAmount to max balance
  
  // Limit order actions
  setLimitPrice: (price: string) => void;
  setExpires: (expires: "never" | "24h" | "7d" | "custom") => void;
  
  // Quote actions
  setQuoteLoading: (loading: boolean) => void;
  setQuoteError: (error: Error | null) => void;
  
  // Reset actions
  resetSwap: () => void;  // Reset to initial state
  resetAmounts: () => void;  // Reset only amounts
}
```

### 3.2 Derived State (Computed Selectors)

**Derived state is computed via Zustand selectors** - not stored in state:

```typescript
// Selectors (computed, not stored)
const fromUsdValue = useSwapStore((state) => {
  const amount = parseNumber(state.fromAmount);
  return calculateFromUsdValue(amount);
});

const toUsdValue = useSwapStore((state) => {
  const amount = parseNumber(state.toAmount);
  return calculateToUsdValue(amount);
});

const limitPriceUsd = useSwapStore((state) => {
  const price = parseNumber(state.limitPrice);
  return calculateLimitPriceUsd(price);
});

const hasValidFromAmount = useSwapStore((state) => {
  return parseNumber(state.fromAmount) > 0;
});

const canExecuteSwap = useSwapStore((state) => {
  // Validation logic
  const hasFromToken = !!state.fromToken;
  const hasToToken = !!state.toToken;
  const hasValidAmount = parseNumber(state.fromAmount) > 0;
  const hasQuote = !!state.toAmount && !state.isQuoteLoading;
  
  if (state.activeTab === "limit") {
    const hasLimitPrice = parseNumber(state.limitPrice) > 0;
    return hasFromToken && hasToToken && hasValidAmount && hasLimitPrice;
  }
  
  return hasFromToken && hasToToken && hasValidAmount && hasQuote;
});
```

**Why Selectors Over Stored Derived State:**
- ✅ Always in sync with source state
- ✅ No risk of stale derived values
- ✅ Computed on-demand (only when accessed)
- ✅ Zustand optimizes re-renders automatically

### 3.4 Limit Order Extension

**Limit orders extend base swap state:**

```typescript
// Limit order is just additional fields on base swap state
interface SwapState {
  // ... base swap state ...
  
  // Limit order specific
  limitPrice: string;
  expires: "never" | "24h" | "7d" | "custom";
  
  // Limit order actions
  setLimitPrice: (price: string) => void;
  setExpires: (expires: "never" | "24h" | "7d" | "custom") => void;
}
```

**Reasoning:**
- Limit orders share all swap state (tokens, amounts)
- Only adds 2 fields + 2 actions
- No need for separate store or complex inheritance
- `activeTab` determines which fields are relevant

---

## 4. Boundaries & Ownership

### 4.1 State Ownership

**Zustand Store Owns:**
- ✅ Core swap state (tokens, amounts, mode)
- ✅ Limit order state (price, expiry)
- ✅ Quote loading state

**Components Own:**
- ✅ UI-only state (expanded, modals, toasts)
- ✅ Modal filtering state (search queries, chain selection)

**Hooks Own:**
- ✅ Quote calculation logic (`useSwapQuote` will read from store)
- ✅ Wallet connection state (existing hook)

### 4.2 Component Responsibilities

#### **SwapPage (Orchestrator)**
- **Reads:** Swap state from store
- **Writes:** None directly (delegates to store actions)
- **Owns:** Modal visibility state (local)
- **Responsibilities:**
  - Render layout
  - Coordinate modals
  - Pass store values/actions to children

#### **SwapCard (Presentational)**
- **Reads:** Swap state via props (from SwapPage)
- **Writes:** None (calls callbacks)
- **Owns:** `isDetailsExpanded` (local UI state)
- **Responsibilities:**
  - Render swap UI
  - Handle UI interactions
  - Call parent callbacks

#### **TokenInput (Presentational)**
- **Reads:** Token, amount, balance via props
- **Writes:** None (calls `onAmountChange` callback)
- **Owns:** None
- **Responsibilities:**
  - Display token/amount
  - Handle input changes
  - Call parent callbacks

#### **TokenSelectorModal (Feature Component)**
- **Reads:** Selected token from store (via props)
- **Writes:** Updates store via `setFromToken`/`setToToken` actions
- **Owns:** Modal UI state (search, filters)
- **Responsibilities:**
  - Display token list
  - Handle token selection
  - Update store on selection

### 4.3 State Update Flow

**Unidirectional Flow:**

```
User Action
  └──> Component calls store action
        └──> Store updates state
              └──> Components re-render (only those using changed state)
                    └──> UI updates
```

**Example: User changes from amount**

```
1. User types in TokenInput
2. TokenInput calls onAmountChange("100")
3. SwapPage receives callback, calls store.setFromAmount("100")
4. Store updates: fromAmount = "100"
5. useSwapQuote hook detects change, fetches quote
6. useSwapQuote calls store.setToAmount("0.00015")
7. Store updates: toAmount = "0.00015"
8. Components using fromAmount/toAmount re-render
9. UI updates with new amounts
```

**Key Points:**
- ✅ Single source of truth (store)
- ✅ Updates flow through store actions
- ✅ Components only read state, don't mutate
- ✅ Derived state computed via selectors

### 4.4 Component Read Patterns

**Direct Store Access (Recommended):**
```typescript
// SwapPage reads directly from store
const fromAmount = useSwapStore((state) => state.fromAmount);
const setFromAmount = useSwapStore((state) => state.setFromAmount);

// Pass to children
<SwapCard fromAmount={fromAmount} onFromAmountChange={setFromAmount} />
```

**Props Pattern (Alternative):**
```typescript
// SwapPage reads from store, passes via props
const fromAmount = useSwapStore((state) => state.fromAmount);
const setFromAmount = useSwapStore((state) => state.setFromAmount);

// Children receive via props (current pattern)
<SwapCard fromAmount={fromAmount} onFromAmountChange={setFromAmount} />
```

**Decision:** Start with **props pattern** (maintains current component API), can optimize to direct store access later if needed.

---

## 5. Implementation Plan

### 5.1 Phase 1: Minimal Store Setup

**Goal:** Create basic store with core swap state, no breaking changes.

**Files to Create:**
```
lib/
└── store/
    └── swap-store.ts       # Zustand store for swap state
```

**Implementation:**
1. Install Zustand: `pnpm add zustand`
2. Create `swap-store.ts` with:
   - Core state shape (tokens, amounts, mode)
   - Basic actions (setters)
   - Initial state
3. Update `SwapPage` to use store (read/write)
4. Keep component APIs unchanged (pass via props)

**Success Criteria:**
- ✅ Store exists and works
- ✅ SwapPage uses store
- ✅ No breaking changes to components
- ✅ State updates work correctly

### 5.2 Phase 2: Integrate Quote Logic

**Goal:** Move quote state into store, update `useSwapQuote` to use store.

**Changes:**
1. Add quote state to store (`isQuoteLoading`, `quoteError`)
2. Update `useSwapQuote` to read/write store
3. Remove quote state from hook's internal state

**Success Criteria:**
- ✅ Quote state in store
- ✅ `useSwapQuote` uses store
- ✅ Quote updates trigger re-renders correctly

### 5.3 Phase 3: Add Derived State Selectors

**Goal:** Add computed selectors for USD values, validation.

**Changes:**
1. Create selector hooks (`useFromUsdValue`, `useToUsdValue`, etc.)
2. Update components to use selectors
3. Remove manual calculations from SwapPage

**Success Criteria:**
- ✅ Derived state computed via selectors
- ✅ No manual calculations in components
- ✅ Performance optimized (only re-renders when needed)

### 5.4 Phase 4: Add Missing State

**Goal:** Add validation state, transaction state, slippage.

**Changes:**
1. Add validation state to store
2. Add transaction state to store
3. Add slippage/deadline state to store
4. Create validation selectors

**Success Criteria:**
- ✅ All required state exists
- ✅ Validation works correctly
- ✅ Transaction state tracked

---

## 6. File Structure

### 6.1 Proposed Structure

```
lib/
└── store/
    ├── swap-store.ts           # Main swap store (Zustand)
    ├── swap-selectors.ts       # Computed selectors (optional, can be in store file)
    └── swap-types.ts           # Type definitions (optional, can be in store file)

hooks/
└── useSwapQuote.ts            # Updated to use store (existing, modify)

app/
└── swap/
    └── page.tsx               # Updated to use store (existing, modify)
```

### 6.2 Store File Organization

**Option A: Single File (Recommended for Start)**
```typescript
// lib/store/swap-store.ts
import { create } from 'zustand';
import type { Token } from '@/lib/types/tokens';

// Types
interface SwapState { ... }

// Store
export const useSwapStore = create<SwapState>((set) => ({ ... }));

// Selectors (exported hooks)
export const useFromUsdValue = () => { ... };
export const useToUsdValue = () => { ... };
```

**Option B: Split Files (If Store Grows Large)**
```
lib/store/
├── swap-store.ts       # Store definition
├── swap-selectors.ts    # Selector hooks
└── swap-types.ts       # Type definitions
```

**Decision:** Start with **Option A** (single file), split later if needed.

---

## 7. Migration Strategy

### 7.1 Non-Breaking Migration

**Approach:** Gradual migration, maintain component APIs.

**Steps:**
1. Create store alongside existing state
2. Update `SwapPage` to read from store, write to store
3. Keep component props unchanged
4. Remove old state variables once store is working
5. Optionally optimize to direct store access later

**Benefits:**
- ✅ No breaking changes
- ✅ Can test incrementally
- ✅ Easy to rollback
- ✅ Components don't need changes initially

### 7.2 Testing Strategy

**Before Migration:**
- Document current behavior
- Note any bugs (e.g., `setToAmount` undefined)

**During Migration:**
- Test each piece incrementally
- Verify state updates work
- Verify components re-render correctly

**After Migration:**
- Verify all functionality works
- Check performance (should be same or better)
- Fix any bugs found

---

## 8. Tradeoffs & Considerations

### 8.1 Zustand vs Context API

**Zustand Pros:**
- ✅ No provider nesting
- ✅ Better performance (automatic optimization)
- ✅ Smaller bundle
- ✅ Better DevTools

**Zustand Cons:**
- ⚠️ External dependency (but small, ~1KB)
- ⚠️ Learning curve (minimal)

**Context API Pros:**
- ✅ Built into React (no dependency)
- ✅ Familiar to React developers

**Context API Cons:**
- ⚠️ Provider nesting required
- ⚠️ Manual optimization needed
- ⚠️ More boilerplate

**Decision:** ✅ Zustand is better fit for this use case.

### 8.2 Store Scope

**Feature-Scoped (Proposed):**
- Store only contains swap-related state
- Separate stores for other features (wallet, etc.)

**Global Store (Alternative):**
- Single store for all app state
- More complex, harder to reason about

**Decision:** ✅ Feature-scoped is better for modularity and clarity.

### 8.3 Direct Store Access vs Props

**Direct Access (Future Optimization):**
```typescript
// Component reads directly from store
const fromAmount = useSwapStore((state) => state.fromAmount);
```

**Props Pattern (Current):**
```typescript
// Parent reads from store, passes via props
<SwapCard fromAmount={fromAmount} />
```

**Decision:** Start with **props pattern** (maintains current API), optimize later if needed.

---

## 9. Success Criteria

### 9.1 Phase 1 Complete When:

- ✅ Zustand installed
- ✅ Swap store created with core state
- ✅ SwapPage uses store (reads/writes)
- ✅ No breaking changes to components
- ✅ State updates work correctly
- ✅ Bug fixed (`setToAmount` undefined)

### 9.2 Architecture Complete When:

- ✅ All swap state in store
- ✅ Derived state computed via selectors
- ✅ Quote logic integrated with store
- ✅ Validation state added
- ✅ Transaction state added
- ✅ Code is readable and maintainable
- ✅ Easy to extend with new state

---

## 10. Open Questions

### 10.1 Questions for Review

1. **Store Scope:** Should we include token selector modal state in swap store, or keep it separate?

   **Proposal:** Keep modal UI state separate (search, filters), but token selection actions in store.

2. **Quote Integration:** Should `useSwapQuote` hook be refactored to use store, or kept separate?

   **Proposal:** Refactor hook to read/write store, but keep hook for encapsulation.

3. **Validation:** Should validation state be in store, or computed via selectors?

   **Proposal:** Computed via selectors (derived state), but validation errors stored in state.

4. **Persistence:** Should swap state persist across page reloads?

   **Proposal:** Not now, add later if needed (localStorage).

---

## 11. Next Steps

### 11.1 Immediate Actions (After Approval)

1. ✅ Review and approve this proposal
2. ✅ Install Zustand: `pnpm add zustand`
3. ✅ Create `lib/store/swap-store.ts`
4. ✅ Implement core state + actions
5. ✅ Update `SwapPage` to use store
6. ✅ Fix `setToAmount` bug
7. ✅ Test and verify

### 11.2 Future Phases

1. Integrate quote logic with store
2. Add derived state selectors
3. Add validation state
4. Add transaction state
5. Optimize to direct store access (if needed)

---

## 12. Summary

### Key Decisions

1. ✅ **Use Zustand** for feature-scoped swap state
2. ✅ **Keep UI state local** in components
3. ✅ **Defer TanStack Query** until real API integration
4. ✅ **Start with props pattern**, optimize later
5. ✅ **Feature-scoped store**, not global

### Architecture Benefits

- ✅ **Simplicity** - Minimal abstractions, clear ownership
- ✅ **Predictability** - Unidirectional flow, explicit updates
- ✅ **Debuggability** - Clear state shape, Zustand DevTools
- ✅ **Scalability** - Easy to extend without refactoring
- ✅ **Performance** - Automatic optimization, selective re-renders

### Risks & Mitigations

- ⚠️ **Risk:** Over-engineering with too many abstractions
  - **Mitigation:** Start minimal, add only what's needed

- ⚠️ **Risk:** Breaking existing components
  - **Mitigation:** Gradual migration, maintain component APIs

- ⚠️ **Risk:** Performance issues
  - **Mitigation:** Zustand handles optimization automatically

---

**Status:** ⏸️ **AWAITING APPROVAL**

**Next Step:** After approval, implement Phase 1 (minimal store setup).

---

**End of Proposal**

