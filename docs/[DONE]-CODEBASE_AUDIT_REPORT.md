# TIWI Super App - Codebase Audit Report

**Date:** 2025-01-27  
**Last Updated:** 2025-01-27  
**Scope:** Complete codebase analysis and architectural review  
**Objective:** Validate design patterns, identify strengths/gaps, and propose future-proof implementation plan

---

## 📋 Executive Summary

This audit examines the TIWI Super App codebase to assess its alignment with core architectural principles (simplicity, modularity, scalability, maintainability) and readiness for production-grade integrations (wallets, APIs, routing, aggregators).

**Overall Assessment:** The codebase demonstrates **strong foundational architecture** with well-separated components, clear prop interfaces, and thoughtful UI/UX implementation. Recent additions (Token Selector Modal, Wallet Connection) follow good patterns. However, **code duplication** and **business logic in components** are emerging concerns that should be addressed before scaling further. Several areas require attention before production integrations to ensure scalability and maintainability.

### 🎯 Key Findings Summary

**Strengths:**
- ✅ Well-structured components (most ~100-200 lines, appropriately sized)
- ✅ Good separation of concerns
- ✅ TypeScript used effectively throughout
- ✅ Responsive design patterns implemented well
- ✅ Token selector modal follows good patterns
- ✅ Mobile chain list panel implements Relay-style pattern correctly

**Areas Needing Attention:**
- ⚠️ **Code Duplication:** Search bar UI duplicated in 3 components (~150 lines of duplicate code)
- ⚠️ **Component Size:** `SwapCard` at 373 lines should be decomposed into smaller components
- ⚠️ **Business Logic:** Calculations and formatting logic in components instead of utilities
- ⚠️ **Type Organization:** Types defined in component files instead of shared location
- ⚠️ **Unused Code:** `chain-selector-sheet.tsx` (159 lines) no longer used, should be removed

**Immediate Recommendations (Priority Order):**
1. **Extract `SearchInput` component** - Reduces ~150 lines of duplication (Priority: High)
2. **Extract formatting utilities** - `formatAddress`, `formatBalance` to `lib/utils/formatting.ts` (Priority: High)
3. **Extract number utilities** - `sanitizeDecimal`, `parseNumber` to `lib/utils/number.ts` (Priority: High)
4. **Move types** - Token/Chain types to `lib/types/tokens.ts` (Priority: Medium)
5. **Decompose `SwapCard`** - Break into smaller components (Priority: Medium)
6. **Remove unused code** - Delete `chain-selector-sheet.tsx` (Priority: Low)

---

## 1. Codebase Exploration & Understanding

### 1.1 Project Structure

```
tiwi-super-app/
├── app/                    # Next.js 16 App Router
│   ├── layout.tsx          # Root layout with Navbar/StatusBar
│   ├── page.tsx            # Home page (placeholder)
│   ├── swap/
│   │   └── page.tsx        # Swap page (main feature - 239 lines)
│   └── globals.css         # Global styles + design tokens
├── components/
│   ├── layout/             # Global layout components
│   │   ├── navbar.tsx
│   │   └── status-bar.tsx
│   ├── swap/               # Swap-specific components (14 files)
│   │   ├── swap-card.tsx           # 373 lines - largest component
│   │   ├── swap-tabs.tsx           # 39 lines - well-sized
│   │   ├── token-input.tsx         # 172 lines - well-sized
│   │   ├── token-selector-modal.tsx # 240 lines - complex but manageable
│   │   ├── token-list-panel.tsx   # 110 lines
│   │   ├── mobile-chain-list-panel.tsx # 109 lines
│   │   ├── chain-selector-panel.tsx # 93 lines
│   │   ├── chain-row.tsx           # 66 lines
│   │   ├── token-row.tsx           # 105 lines
│   │   ├── mobile-chain-filter-row.tsx # 89 lines
│   │   ├── chain-selector-sheet.tsx # 159 lines (unused - can be removed)
│   │   ├── trading-chart.tsx
│   │   └── swap-background-elements.tsx
│   ├── wallet/             # Wallet components (4 files)
│   │   ├── connect-wallet-modal.tsx
│   │   ├── wallet-option-card.tsx
│   │   ├── external-wallet-icon.tsx
│   │   └── wallet-connected-toast.tsx
│   └── ui/                 # shadcn/ui base components
│       ├── button.tsx
│       ├── input.tsx
│       └── dialog.tsx
├── lib/
│   └── utils.ts            # Utility functions (cn helper only)
├── hooks/
│   └── useWalletConnection.ts # Wallet connection hook
├── data/
│   └── mock-tokens.ts      # Mock data (143 lines)
└── public/assets/          # Static assets (SVGs)

Total Components: ~25
Average Component Size: ~120 lines
Largest Component: swap-card.tsx (373 lines)
```

**Assessment:** ✅ **Well-organized** - Clear separation of concerns, logical grouping, follows Next.js 16 conventions. Most components are appropriately sized. `swap-card.tsx` is the largest and could benefit from decomposition.

### 1.2 Technology Stack

- **Framework:** Next.js 16.0.10 (App Router)
- **React:** 19.2.1
- **Styling:** Tailwind CSS 4.0
- **UI Library:** shadcn/ui (minimal usage)
- **TypeScript:** 5.x (strict mode)
- **Package Manager:** pnpm

**Assessment:** ✅ **Modern & Appropriate** - Latest stable versions, good tooling choices.

### 1.3 Component Hierarchy

```
RootLayout
├── Navbar (global)
├── StatusBar (global)
└── SwapPage
    ├── SwapBackgroundElements
    ├── TradingChart
    └── SwapCard
        ├── SwapTabs
        ├── TokenInput (From)
        ├── TokenInput (To)
        └── [Conditional: Limit fields, Details card]
```

**Assessment:** ✅ **Clear Hierarchy** - Logical parent-child relationships, appropriate component boundaries.

---

## 2. Design Pattern & Best Practices Validation

### 2.1 ✅ Strengths

#### **A. Component Modularity**
- **Excellent separation:** Each component has a single, well-defined responsibility
- **Reusability:** `TokenInput`, `SwapTabs`, `Button`, `Input` are highly reusable
- **Composition:** Components compose cleanly (e.g., `SwapCard` uses `SwapTabs` + `TokenInput`)
- **Props interfaces:** Well-typed, clear contracts between components

**Example:**
```tsx
// TokenInput is reusable for both "from" and "to" with type prop
<TokenInput type="from" ... />
<TokenInput type="to" ... />
```

#### **B. Presentational Components**
- **UI-focused:** Components are primarily presentational with minimal business logic
- **Event handlers:** Business logic passed down via props (`onSwapClick`, `onTokenSelect`)
- **State lifting:** State managed at appropriate levels (`SwapPage` for swap state, `SwapCard` for UI state)

#### **C. TypeScript Usage**
- **Strong typing:** Interfaces defined for all component props
- **Type safety:** Proper use of TypeScript for props, state, and handlers
- **No `any` types:** Clean type definitions throughout

#### **D. Styling Approach**
- **Tailwind-first:** Consistent use of Tailwind utility classes
- **Design tokens:** CSS variables defined in `globals.css` for design system colors
- **Responsive design:** Mobile-first approach with breakpoint utilities
- **Custom animations:** Well-defined CSS animations for marquee and collapse effects

#### **E. Code Organization**
- **File naming:** Consistent kebab-case for components
- **Import organization:** Clean imports, proper use of path aliases (`@/components`)
- **Separation of concerns:** Layout components separate from feature components

### 2.2 ⚠️ Areas of Concern

#### **A. Code Duplication (NEW FINDING)**

**Current State:**
- Search bar UI duplicated in 3 components:
  - `TokenListPanel` (lines 46-83)
  - `MobileChainListPanel` (lines 32-69)
  - `ChainSelectorPanel` (lines 26-63)
- Formatting utilities duplicated:
  - `formatAddress` in `TokenListPanel` (lines 24-29) and `TokenRow` (lines 24-29)
  - `formatBalance` in `TokenListPanel` (lines 33-41)
- Similar list panel structures with duplicate scrollable container patterns

**Issues:**
1. **Maintenance burden:** Changes to search bar require updates in 3 places
2. **Inconsistency risk:** Search bars may diverge over time
3. **Code bloat:** ~150 lines of duplicated code across components
4. **Formatting logic scattered:** Address/balance formatting in multiple locations

**Impact:** ⚠️ **Medium** - Not blocking, but creates technical debt and maintenance overhead.

**Recommendation:** Extract to shared components/utilities:
- `components/ui/search-input.tsx` - Reusable search bar component
- `lib/utils/formatting.ts` - Shared formatting utilities (formatAddress, formatBalance, formatNumber)
- Consider creating `components/swap/list-panel-base.tsx` for shared list panel structure

#### **B. Component Size & Complexity**

**Current State:**
- `SwapCard` component is 373 lines - largest component in codebase
- Contains multiple responsibilities:
  - Token input rendering
  - Limit order fields (When Price, Expires)
  - Expandable details section
  - Button rendering logic
  - Conditional rendering for swap vs limit tabs

**Issues:**
1. **Single Responsibility Principle violation:** Component handles too many concerns
2. **Hard to test:** Large component harder to unit test
3. **Hard to maintain:** Changes require navigating large file
4. **Reusability limited:** Can't reuse limit order fields elsewhere

**Impact:** ⚠️ **Low-Medium** - Component works but violates simplicity principle. Will worsen as features grow.

**Recommendation:** Break down into smaller components:
- `components/swap/limit-order-fields.tsx` - When Price + Expires fields
- `components/swap/swap-details-card.tsx` - Expandable details section
- `components/swap/swap-action-button.tsx` - Primary CTA button logic
- Keep `SwapCard` as orchestrator component (~150 lines)

#### **C. Business Logic in Components**

**Current State:**
- `sanitizeDecimal` function in `SwapPage` (lines 69-74)
- `parseNumber` function in `SwapPage` (lines 102-105)
- USD conversion calculations inline in `SwapPage` (lines 112-120)
- Quote calculation logic in `SwapPage` useEffect (lines 123-147)
- Formatting logic (`formatAddress`, `formatBalance`) in `TokenListPanel` and `TokenRow`

**Issues:**
1. **Mixed concerns:** UI component contains business logic
2. **Not testable:** Logic embedded in component, hard to unit test
3. **Not reusable:** Calculation logic can't be shared with other features
4. **Duplication:** Formatting logic duplicated across components

**Impact:** ⚠️ **Medium** - Will make testing and future features harder.

**Recommendation:** Extract business logic to:
- `lib/utils/number.ts` - Number utilities (sanitizeDecimal, parseNumber, formatNumber)
- `lib/utils/formatting.ts` - Formatting utilities (formatAddress, formatBalance, formatCurrency)
- `lib/swap/calculations.ts` - Swap calculations (USD conversions, quote calculations)
- `hooks/useSwapQuote.ts` - Custom hook for quote fetching
- `hooks/useTokenBalance.ts` - Custom hook for balance fetching

#### **D. Type Definitions Location**

**Current State:**
- `Token` and `Chain` types exported from `token-selector-modal.tsx`
- Types imported by multiple components (`TokenRow`, `TokenListPanel`, `ChainRow`, etc.)
- No centralized types file

**Issues:**
1. **Coupling:** Components depend on modal component for types
2. **Discoverability:** Types not in obvious location
3. **Reusability:** Types tied to specific component

**Impact:** ⚠️ **Low** - Works but not ideal for long-term maintainability.

**Recommendation:** Create shared types file:
- `lib/types/tokens.ts` - Token and Chain type definitions
- `lib/types/swap.ts` - Swap-related types
- Import types from shared location

#### **E. State Management**

**Current State:**
- All state managed via `useState` in `SwapPage`
- Wallet state managed via custom hook `useWalletConnection`
- No global state management solution (Context, Zustand, Redux, etc.)
- Token selection state managed locally in `SwapPage`

**Issues:**
1. **No wallet state:** Wallet connection state not shared across components (though hook exists)
2. **No token list management:** Token selection requires modal, but no token list/registry
3. **No quote/price state:** Quote loading state is local, but price data should be global
4. **No transaction state:** No way to track pending transactions across pages

**Impact:** ⚠️ **Medium** - Will require refactoring when adding wallet/API integrations.

**Recommendation:** Introduce a lightweight state management solution (Context API or Zustand) for:
- Wallet connection state (extend existing hook to Context)
- Selected tokens
- Price/quote data
- Transaction history


#### **F. API Integration Readiness**

**Current State:**
- All handlers have `TODO` comments
- Dummy data hardcoded (token balances, prices, quotes)
- No API client setup
- No error handling patterns

**Issues:**
1. **No API abstraction:** No service layer for API calls
2. **No error boundaries:** No error handling for failed API calls
3. **No loading states:** Only `isQuoteLoading` exists, no general loading pattern
4. **No retry logic:** No mechanism for handling network failures

**Impact:** ⚠️ **High** - Critical for production readiness.

**Recommendation:** Create:
- `lib/api/` - API client setup (fetch/axios wrapper)
- `lib/api/swap.ts` - Swap-specific API calls
- `lib/api/tokens.ts` - Token list/price API calls
- Error boundary component
- Loading state management

#### **G. Wallet Integration Readiness**

**Current State:**
- `isConnected` prop passed down but hardcoded to `false`
- `onConnectClick` handler is a placeholder
- No wallet provider setup
- No wallet state management

**Issues:**
1. **No wallet abstraction:** No interface for wallet providers (MetaMask, WalletConnect, etc.)
2. **No chain management:** No way to switch chains or detect current chain
3. **No transaction signing:** No integration points for transaction signing
4. **No balance fetching:** No mechanism to fetch real token balances

**Impact:** ⚠️ **High** - Critical for DeFi functionality.

**Recommendation:** Create:
- `lib/wallet/` - Wallet provider abstraction
- `contexts/WalletContext.tsx` - Wallet state context
- `hooks/useWallet.ts` - Wallet connection hook
- `hooks/useTokenBalance.ts` - Token balance hook
- Support for multiple wallet providers (wagmi, viem, or custom)

#### **H. Token Management**

**Current State:**
- Token data in `data/mock-tokens.ts` (well-structured)
- Token selector modal implemented (`TokenSelectorModal`)
- Token filtering and search implemented
- Mock data structure ready for API replacement

**Issues:**
1. **No token validation:** No way to validate token addresses
2. **No token metadata:** Missing decimals in some cases
3. **Types defined in component:** Token/Chain types in modal file

**Impact:** ⚠️ **Low-Medium** - Token selector works well, but needs validation and better type organization.

**Recommendation:** Enhance existing structure:
- Move Token/Chain types to `lib/types/tokens.ts`
- Add token validation utilities in `lib/tokens/utils.ts`
- Ensure all tokens have complete metadata (decimals, addresses)

#### **I. Input Validation & Error Handling**

**Current State:**
- Basic input sanitization (`sanitizeDecimal`)
- No validation for:
  - Insufficient balance
  - Invalid amounts
  - Slippage tolerance
  - Minimum/maximum amounts

**Issues:**
1. **No error messages:** No UI for displaying validation errors
2. **No user feedback:** Users don't know why swap is disabled
3. **No edge case handling:** No handling for edge cases (zero balance, network errors)

**Impact:** ⚠️ **Medium** - Affects user experience and safety.

**Recommendation:** Create:
- `lib/validation/` - Validation utilities
- `components/swap/swap-errors.tsx` - Error display component
- Validation hooks (`useSwapValidation`)
- Error message constants

#### **J. Unused Code**

**Current State:**
- `chain-selector-sheet.tsx` (159 lines) exists but is no longer used
- Component was replaced by `MobileChainListPanel` which shows chain list inline
- File still exists in codebase

**Issues:**
1. **Dead code:** Unused component adds confusion
2. **Maintenance burden:** May be accidentally modified
3. **Code bloat:** Unnecessary file in codebase

**Impact:** ⚠️ **Low** - Not blocking but adds confusion.

**Recommendation:** Remove unused file:
- Delete `components/swap/chain-selector-sheet.tsx`
- Verify no imports reference it
- Clean up any related unused code

#### **K. Testing Infrastructure**

**Current State:**
- No test files found
- No testing setup (Jest, Vitest, React Testing Library)
- No test utilities

**Issues:**
1. **No unit tests:** Business logic not tested
2. **No component tests:** UI components not tested
3. **No integration tests:** No end-to-end testing

**Impact:** ⚠️ **Medium** - Will make refactoring risky.

**Recommendation:** Add:
- `vitest` or `jest` setup
- `@testing-library/react` for component tests
- Test utilities in `__tests__/` or `*.test.tsx`
- CI/CD test pipeline

---

## 3. Findings & Suggestions

### 3.1 ✅ What is Working Well

1. **Component Architecture**
   - Clean separation of concerns
   - Reusable, composable components (`TokenInput`, `SwapTabs`, `Button`, `Input`)
   - Well-defined prop interfaces
   - Proper use of TypeScript
   - Most components appropriately sized (~100-200 lines)
   - Token selector modal well-structured with clear separation

2. **Styling & Design System**
   - Consistent Tailwind usage
   - Design tokens in CSS variables
   - Responsive design patterns (mobile-first approach)
   - Custom animations well-implemented (collapse, slide-in)
   - Custom scrollbar styling consistent

3. **Code Organization**
   - Logical folder structure
   - Clear naming conventions (kebab-case for files)
   - Proper use of Next.js App Router
   - Good separation of layout vs. feature components
   - Mock data well-structured in `data/` folder

4. **Developer Experience**
   - Clear TODO comments marking integration points
   - TypeScript provides good IDE support
   - Path aliases (`@/`) improve import clarity
   - shadcn/ui provides consistent base components
   - Custom hooks (`useWalletConnection`) follow React patterns

5. **Recent Improvements**
   - Token selector modal follows good patterns
   - Mobile chain list panel implements Relay-style pattern correctly
   - Scrollable lists properly implemented with custom scrollbars
   - Responsive design handled well across components

### 3.2 ⚠️ What Could Become Problematic

1. **Code Duplication**
   - **Risk:** Search bar UI duplicated in 3 components, formatting logic duplicated
   - **Impact:** Maintenance burden, inconsistency risk, code bloat
   - **Timeline:** Already present, will worsen as features grow
   - **Priority:** Medium - Should be addressed before adding more features

2. **Component Size**
   - **Risk:** `SwapCard` at 373 lines violates simplicity principle
   - **Impact:** Harder to test, maintain, and understand
   - **Timeline:** Already an issue, will worsen with more features
   - **Priority:** Low-Medium - Can be addressed incrementally

3. **Business Logic in Components**
   - **Risk:** Logic embedded in UI makes testing difficult
   - **Impact:** Hard to refactor, duplicate code, not reusable
   - **Timeline:** Already an issue, will worsen with more features
   - **Priority:** Medium - Should be extracted before API integration

4. **State Management Scalability**
   - **Risk:** As features grow, prop drilling will increase
   - **Impact:** Hard to maintain, performance issues
   - **Timeline:** Will become problematic when adding wallet/API integrations
   - **Priority:** Medium - Can be addressed when needed

5. **No Error Handling Strategy**
   - **Risk:** Unhandled errors will crash the app
   - **Impact:** Poor user experience, production issues
   - **Timeline:** Critical when adding API calls
   - **Priority:** High - Must be addressed before production

6. **Hardcoded Data**
   - **Risk:** Difficult to switch between testnet/mainnet
   - **Impact:** Requires code changes for different environments
   - **Timeline:** Will block production deployment
   - **Priority:** Medium - Can use environment variables

7. **No Loading/Error States**
   - **Risk:** Users don't know when operations are in progress
   - **Impact:** Confusing UX, potential for duplicate transactions
   - **Timeline:** Critical for wallet/API integrations
   - **Priority:** High - Must be addressed before production

### 3.3 🔧 What Should Be Improved

#### **Priority 1: Critical (Before Production)**

1. **Error Handling Infrastructure**
   - Error boundaries
   - User-friendly error messages
   - Error logging/monitoring
   - Loading state management

2. **API Integration Layer**
   - Create API client abstraction
   - Error handling patterns
   - Retry logic for failed requests
   - Request cancellation

3. **Wallet Integration**
   - Wallet provider abstraction (extend existing hook)
   - Wallet connection flow (partially implemented)
   - Chain switching
   - Transaction signing

#### **Priority 2: Important (Before Major Features)**

4. **Code Duplication Reduction**
   - Extract `SearchInput` component
   - Extract formatting utilities (`formatAddress`, `formatBalance`)
   - Create shared list panel base component

5. **Business Logic Extraction**
   - Move calculations to utility functions (`lib/utils/number.ts`, `lib/swap/calculations.ts`)
   - Create custom hooks (`useSwapQuote`, `useTokenBalance`)
   - Separate validation logic

6. **Component Decomposition**
   - Break down `SwapCard` into smaller components
   - Extract limit order fields
   - Extract details card
   - Extract action button logic

7. **Type Organization**
   - Move Token/Chain types to `lib/types/tokens.ts`
   - Create shared types file
   - Improve type discoverability

8. **State Management Layer**
   - Add Context API or Zustand for global state
   - Wallet connection state (extend existing hook)
   - Token selection state
   - Transaction state

#### **Priority 3: Nice to Have (Ongoing)**

9. **Input Validation**
   - Comprehensive validation rules
   - Error message display
   - User feedback for invalid inputs

10. **Testing Infrastructure**
    - Unit tests for utilities
    - Component tests
    - Integration tests

11. **Performance Optimization**
    - Memoization where needed
    - Code splitting
    - Image optimization

12. **Documentation**
    - Component documentation
    - API documentation
    - Integration guides

---

## 4. Proposed Forward Implementation Plan

### 4.0 Phase 0: Code Quality & Refactoring (Week 1) - **NEW PRIORITY**

**Objective:** Reduce code duplication, extract utilities, and improve component structure before adding new features.

#### **A. Extract Shared Components & Utilities**

**Files to Create:**
```
components/
├── ui/
│   └── search-input.tsx      # Reusable search bar component
lib/
├── utils/
│   ├── formatting.ts         # formatAddress, formatBalance, formatCurrency
│   └── number.ts             # sanitizeDecimal, parseNumber, formatNumber
├── types/
│   ├── tokens.ts             # Token, Chain type definitions
│   └── swap.ts               # Swap-related types
```

**Implementation:**
- Extract search bar from `TokenListPanel`, `MobileChainListPanel`, `ChainSelectorPanel` into `SearchInput` component
- Extract `formatAddress` and `formatBalance` to `lib/utils/formatting.ts`
- Extract `sanitizeDecimal` and `parseNumber` to `lib/utils/number.ts`
- Move `Token` and `Chain` types to `lib/types/tokens.ts`
- Update all imports across codebase

**Guardrails:**
- Maintain exact same UI/UX behavior
- No breaking changes to component APIs
- All formatting logic must be unit tested

#### **B. Component Decomposition**

**Files to Create:**
```
components/
├── swap/
│   ├── limit-order-fields.tsx    # When Price + Expires fields
│   ├── swap-details-card.tsx    # Expandable details section
│   └── swap-action-button.tsx   # Primary CTA button logic
```

**Implementation:**
- Extract limit order fields from `SwapCard` (~80 lines)
- Extract details card from `SwapCard` (~50 lines)
- Extract button logic from `SwapCard` (~30 lines)
- Keep `SwapCard` as orchestrator (~200 lines)

**Guardrails:**
- Maintain exact same functionality
- Props interfaces must remain backward compatible
- No visual changes

#### **C. Business Logic Extraction**

**Files to Create:**
```
lib/
├── swap/
│   └── calculations.ts       # USD conversions, quote calculations
hooks/
├── useSwapQuote.ts           # Quote fetching hook
└── useTokenBalance.ts        # Token balance hook
```

**Implementation:**
- Extract USD conversion logic from `SwapPage` to `lib/swap/calculations.ts`
- Extract quote calculation to `useSwapQuote` hook
- Extract balance fetching logic to `useTokenBalance` hook
- Update `SwapPage` to use new hooks

**Guardrails:**
- All calculations must be unit tested
- Hooks must handle loading/error states
- Maintain exact same behavior

### 4.1 Phase 1: Foundation Layer (Week 2-3)

**Objective:** Establish core infrastructure for state management, API integration, and error handling.

#### **A. State Management Setup**

**Files to Create:**
```
lib/
├── store/
│   ├── wallet-store.ts        # Wallet state (Zustand or Context)
│   ├── swap-store.ts          # Swap state (optional, if needed globally)
│   └── index.ts
```

**Implementation:**
- Choose between Context API (simpler) or Zustand (more powerful)
- Create wallet state store with:
  - `isConnected: boolean`
  - `address: string | null`
  - `chainId: number | null`
  - `connect()`, `disconnect()` methods
- Create swap state store (if needed globally) with:
  - Selected tokens
  - Swap amounts
  - Quote data

**Guardrails:**
- Keep state stores focused (single responsibility)
- Use TypeScript for all state interfaces
- Provide clear getters/setters

#### **B. API Client Setup**

**Files to Create:**
```
lib/
├── api/
│   ├── client.ts              # Base API client (fetch wrapper)
│   ├── swap.ts                 # Swap API endpoints
│   ├── tokens.ts               # Token API endpoints
│   ├── prices.ts              # Price API endpoints
│   └── types.ts               # API response types
```

**Implementation:**
- Create base API client with:
  - Error handling
  - Request/response interceptors
  - Retry logic
  - Loading state management
- Create typed API functions for:
  - `getSwapQuote(fromToken, toToken, amount)`
  - `getTokenList(chainId)`
  - `getTokenPrice(tokenAddress, chainId)`
  - `getTokenBalance(address, tokenAddress, chainId)`

**Guardrails:**
- All API calls must be typed
- All errors must be handled gracefully
- Use environment variables for API endpoints
- Implement request cancellation for debounced calls

#### **C. Error Handling Infrastructure**

**Files to Create:**
```
components/
├── error-boundary.tsx         # React Error Boundary
lib/
├── errors/
│   ├── types.ts               # Error type definitions
│   ├── messages.ts            # User-friendly error messages
│   └── handlers.ts            # Error handling utilities
```

**Implementation:**
- Create Error Boundary component
- Define error types (NetworkError, ValidationError, WalletError, etc.)
- Create user-friendly error messages
- Implement error logging (console for now, Sentry later)

**Guardrails:**
- Never show raw error messages to users
- Always provide actionable error messages
- Log errors for debugging

### 4.2 Phase 2: Wallet Integration (Week 3-4)

**Objective:** Integrate wallet connection and transaction signing.

#### **A. Wallet Provider Setup**

**Files to Create:**
```
lib/
├── wallet/
│   ├── providers.ts           # Wallet provider abstraction
│   ├── connectors.ts          # Wallet connectors (MetaMask, WalletConnect, etc.)
│   └── types.ts               # Wallet types
contexts/
├── WalletContext.tsx          # Wallet context provider
hooks/
├── useWallet.ts               # Wallet connection hook
├── useTokenBalance.ts         # Token balance hook
└── useChain.ts                # Chain management hook
```

**Implementation:**
- Choose wallet library (wagmi + viem recommended for multi-chain support)
- Create wallet provider abstraction
- Implement wallet connection flow
- Implement chain switching
- Implement transaction signing

**Guardrails:**
- Support multiple wallet providers
- Handle wallet disconnection gracefully
- Validate chain compatibility
- Never store private keys

#### **B. Token Management**

**Files to Create:**
```
lib/
├── tokens/
│   ├── registry.ts            # Token registry with metadata
│   ├── utils.ts               # Token utilities (formatting, validation)
│   └── types.ts               # Token types
components/
├── token-selector/
│   ├── token-selector-modal.tsx
│   ├── token-list.tsx
│   └── token-search.tsx
```

**Implementation:**
- Create token registry with:
  - Token addresses
  - Decimals
  - Icons
  - Chain compatibility
- Create token selector modal
- Implement token search/filtering
- Implement token validation

**Guardrails:**
- Validate token addresses
- Handle missing token metadata gracefully
- Cache token data for performance

### 4.3 Phase 3: Business Logic Extraction (Week 4-5) - **MOSTLY COMPLETE**

**Note:** Most business logic extraction should be done in Phase 0. This phase focuses on remaining extraction and validation.

**Objective:** Extract business logic from components into reusable utilities and hooks.

#### **A. Swap Logic Extraction**

**Files to Create:**
```
lib/
├── swap/
│   ├── calculations.ts        # Swap calculations
│   ├── validation.ts          # Swap validation
│   └── utils.ts               # Swap utilities
hooks/
├── useSwapQuote.ts            # Quote fetching hook
├── useSwapValidation.ts       # Swap validation hook
└── useSwapExecution.ts         # Swap execution hook
```

**Implementation:**
- Extract `sanitizeDecimal` to `lib/utils/number.ts`
- Extract quote calculation to `useSwapQuote` hook
- Extract validation logic to `useSwapValidation` hook
- Extract swap execution to `useSwapExecution` hook

**Guardrails:**
- All calculations must be unit tested
- All validation must be comprehensive
- All hooks must handle loading/error states

#### **B. Input Validation**

**Files to Create:**
```
lib/
├── validation/
│   ├── swap.ts                # Swap-specific validation
│   ├── amount.ts              # Amount validation
│   └── messages.ts            # Validation error messages
components/
├── swap/
│   └── swap-errors.tsx         # Error display component
```

**Implementation:**
- Create validation rules for:
  - Amount validation (sufficient balance, minimum/maximum)
  - Slippage tolerance validation
  - Token pair validation
- Create error display component
- Integrate validation into swap flow

**Guardrails:**
- Validation must be real-time (on input change)
- Error messages must be user-friendly
- Validation must prevent invalid swaps

### 4.4 Phase 4: Integration & Testing (Week 5-6)

**Objective:** Integrate all pieces and ensure everything works together.

#### **A. Component Updates**

**Update Existing Components:**
- `SwapPage`: Use new hooks and state management
- `SwapCard`: Integrate validation and error display
- `TokenInput`: Integrate with token selector
- `Navbar`: Integrate with wallet connection

#### **B. Testing**

**Files to Create:**
```
__tests__/
├── lib/
│   ├── swap/
│   │   └── calculations.test.ts
│   └── validation/
│       └── swap.test.ts
├── hooks/
│   └── useSwapQuote.test.ts
└── components/
    └── swap/
        └── swap-card.test.tsx
```

**Implementation:**
- Unit tests for utilities
- Hook tests
- Component tests (critical paths)
- Integration tests (swap flow)

**Guardrails:**
- Aim for 80%+ code coverage
- Test edge cases
- Test error scenarios

### 4.5 Phase 5: Polish & Optimization (Week 6-7)

**Objective:** Optimize performance and improve UX.

#### **A. Performance Optimization**

- Memoize expensive calculations
- Implement code splitting
- Optimize image loading
- Add loading skeletons

#### **B. UX Improvements**

- Add transaction status tracking
- Add transaction history
- Improve error messages
- Add success/error toasts

---

## 5. Architectural Guardrails & Conventions

### 5.1 State Management Rules

1. **Global State:** Only for truly global state (wallet, user preferences)
2. **Local State:** Use `useState` for component-specific UI state
3. **Derived State:** Use `useMemo` for computed values
4. **Server State:** Use React Query or SWR for API data (future consideration)

### 5.2 Component Rules

1. **Presentational First:** Components should be primarily presentational
2. **Props Over State:** Prefer props over internal state when possible
3. **Single Responsibility:** Each component should do one thing well
4. **Composition Over Configuration:** Use composition for flexibility

### 5.3 File Organization Rules

1. **Feature-Based:** Group by feature (`swap/`, `pool/`, etc.)
2. **Shared Components:** Put reusable components in `components/ui/` or `components/shared/`
3. **Business Logic:** Put in `lib/` organized by domain
4. **Hooks:** Put in `hooks/` organized by feature

### 5.4 Naming Conventions

1. **Components:** PascalCase (`SwapCard.tsx`)
2. **Hooks:** camelCase with `use` prefix (`useSwapQuote.ts`)
3. **Utilities:** camelCase (`sanitizeDecimal.ts`)
4. **Types/Interfaces:** PascalCase (`SwapCardProps`)
5. **Constants:** UPPER_SNAKE_CASE (`MAX_SLIPPAGE`)

### 5.5 TypeScript Rules

1. **Strict Mode:** Always use strict TypeScript
2. **No `any`:** Avoid `any` types, use `unknown` if needed
3. **Explicit Types:** Define types for all props, state, and functions
4. **Type Safety:** Leverage TypeScript for compile-time safety

### 5.6 Error Handling Rules

1. **Never Crash:** Always handle errors gracefully
2. **User-Friendly:** Show actionable error messages
3. **Log Errors:** Log errors for debugging (never show raw errors to users)
4. **Error Boundaries:** Use error boundaries for component-level errors

### 5.7 API Integration Rules

1. **Typed Responses:** All API responses must be typed
2. **Error Handling:** All API calls must handle errors
3. **Loading States:** All API calls must show loading states
4. **Retry Logic:** Implement retry logic for failed requests
5. **Cancellation:** Cancel requests when components unmount

---

## 6. Risk Assessment

### 6.1 High Risk Areas

1. **Wallet Integration Complexity**
   - **Risk:** Multiple wallet providers, chain compatibility
   - **Mitigation:** Use established library (wagmi), thorough testing

2. **API Reliability**
   - **Risk:** External API failures, rate limiting
   - **Mitigation:** Error handling, retry logic, fallback mechanisms

3. **State Management Scalability**
   - **Risk:** Prop drilling, performance issues
   - **Mitigation:** Implement state management early, use Context/Zustand

### 6.2 Medium Risk Areas

1. **Business Logic Complexity**
   - **Risk:** Calculations, validation logic
   - **Mitigation:** Extract to utilities, comprehensive testing

2. **Token Management**
   - **Risk:** Token metadata, validation
   - **Mitigation:** Token registry, validation utilities

### 6.3 Low Risk Areas

1. **UI Components**
   - **Risk:** Minor styling issues
   - **Mitigation:** Already well-structured, easy to fix

2. **Styling System**
   - **Risk:** Consistency issues
   - **Mitigation:** Design tokens, Tailwind utilities

---

## 7. Recommendations Summary

### ✅ Do's

1. **Implement state management early** (Context API or Zustand)
2. **Extract business logic** to utilities and hooks
3. **Create API abstraction layer** before integrating real APIs
4. **Set up error handling** infrastructure
5. **Implement wallet integration** using established libraries
6. **Add comprehensive validation** for all user inputs
7. **Create token management system** before token selector
8. **Write tests** for critical business logic
9. **Use TypeScript strictly** throughout
10. **Follow established patterns** for consistency

### ❌ Don'ts

1. **Don't mix business logic with UI** components
2. **Don't hardcode data** that should come from APIs
3. **Don't skip error handling** for API calls
4. **Don't store sensitive data** (private keys) in state
5. **Don't ignore loading states** for async operations
6. **Don't use `any` types** in TypeScript
7. **Don't create deep prop drilling** - use state management
8. **Don't skip validation** for user inputs
9. **Don't ignore edge cases** in calculations
10. **Don't deploy without testing** critical paths

---

## 8. Conclusion

The TIWI Super App codebase demonstrates **strong foundational architecture** with well-structured components, clear separation of concerns, and thoughtful UI implementation. Recent additions (Token Selector Modal, Wallet Connection) follow good patterns. However, **code duplication** and **business logic in components** are emerging concerns that should be addressed before scaling further.

### Key Takeaways

1. **Component architecture is solid** - Most components appropriately sized, well-structured
2. **Code duplication exists** - Search bars and formatting utilities duplicated (should be extracted)
3. **One large component** - `SwapCard` at 373 lines should be decomposed
4. **Business logic in components** - Should be extracted to utilities/hooks for testability
5. **State management needed** - Before adding wallet/API integrations
6. **Error handling critical** - Must be implemented before production
7. **Type organization** - Types should be centralized for better discoverability

### Immediate Action Items (Priority Order)

1. **Extract shared components** - `SearchInput` component (reduces ~150 lines of duplication)
2. **Extract formatting utilities** - `formatAddress`, `formatBalance` to shared location
3. **Extract number utilities** - `sanitizeDecimal`, `parseNumber` to shared location
4. **Move types** - Token/Chain types to `lib/types/tokens.ts`
5. **Decompose SwapCard** - Break into smaller components (limit fields, details card, button)
6. **Extract business logic** - Calculations to utilities, hooks for async operations

### Next Steps

1. **Review this audit** - Validate findings and priorities
2. **Execute Phase 0** - Code quality improvements (Week 1)
3. **Prioritize Phase 1** - Foundation Layer (API, Error Handling) - Week 2-3
4. **Implement state management** - Enables all other integrations - Week 3-4
5. **Integrate wallet** - Core DeFi functionality - Week 4-5
6. **Add testing** - Ensures reliability - Week 5-6

The codebase is in a **good position** to scale, but addressing code duplication and extracting business logic now will prevent technical debt accumulation. Following the proposed implementation plan will ensure it remains maintainable, testable, and production-ready as features are added.

---

**End of Audit Report**

