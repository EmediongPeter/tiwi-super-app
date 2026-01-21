# Architectural Audit Report
**Date:** 2024  
**Phase:** Pre-Refactor Analysis  
**Status:** Analysis Only - No Code Changes

---

## Executive Summary

This audit examines the codebase structure, identifies architectural issues, and proposes improvements to ensure the codebase adheres to core engineering principles: **Simplicity, Modularity, Scalability, Readability, Reusability, and Future Extensibility**.

### Key Findings

✅ **Strengths:**
- Clear separation between API routes and business logic
- Provider pattern for token/chain aggregation
- Type safety with TypeScript
- TanStack Query for data fetching

⚠️ **Critical Issues:**
- **Unclear backend/frontend boundary** - Backend logic mixed with frontend code
- **Inconsistent folder structure** - Business logic scattered across `lib/`
- **Mixed responsibilities** - Services contain both business logic and data transformation
- **Limited mobile reusability** - React-specific code not clearly separated. NOTE WE ARE USING REACT NATIVE FOR THE MOBILE
- **Unclear domain boundaries** - Swap, tokens, chains logic intermingled

---

## 1. Current Architecture Overview

### 1.1 Folder Structure

```
tiwi-super-app/
├── app/                          # Next.js App Router
│   ├── api/v1/                   # Backend API routes
│   │   ├── chains/route.ts       # ✅ Clear backend
│   │   └── tokens/route.ts       # ✅ Clear backend
│   ├── swap/page.tsx             # Frontend page
│   └── layout.tsx                # Root layout
│
├── components/                    # React UI components
│   ├── swap/                      # Swap-specific UI
│   ├── wallet/                    # Wallet-specific UI
│   ├── ui/                        # Generic UI components
│   └── prefetch/                  # Data prefetching
│
├── hooks/                         # React hooks
│   ├── useTokenSearch.ts          # Complex search logic
│   ├── useSwapQuote.ts            # Quote fetching
│   └── useChains.ts               # Chain fetching
│
├── lib/                           # ⚠️ MIXED: Backend + Frontend + Shared
│   ├── api/                       # Frontend API clients
│   │   ├── tokens.ts              # Frontend API service
│   │   └── chains.ts              # Frontend API service
│   ├── services/                  # ⚠️ Backend business logic
│   │   ├── token-service.ts       # Backend service
│   │   └── chain-service.ts       # Backend service
│   ├── providers/                 # ⚠️ Backend providers
│   │   ├── base.ts                # Backend base class
│   │   ├── lifi.ts                # Backend provider
│   │   └── query-provider.tsx     # ⚠️ Frontend React component
│   ├── store/                     # Frontend state (Zustand)
│   ├── types/                     # ⚠️ Mixed types
│   │   ├── tokens.ts              # Frontend types
│   │   └── backend-tokens.ts      # Backend types
│   ├── utils/                     # ⚠️ Mixed utilities
│   ├── chains/                    # Backend registry
│   └── swap/                      # Frontend calculations
│
└── data/                          # Mock data
```

### 1.2 Current Data Flow

```
User Action
    ↓
React Component (app/swap/page.tsx)
    ↓
Hook (hooks/useTokenSearch.ts)
    ↓
Frontend API Client (lib/api/tokens.ts)
    ↓
Backend API Route (app/api/v1/tokens/route.ts)
    ↓
Backend Service (lib/services/token-service.ts)
    ↓
Backend Provider (lib/providers/lifi.ts)
    ↓
External API (LiFi SDK)
```

---

## 2. Architectural Issues

### 2.1 ❌ **Critical: Unclear Backend/Frontend Boundary**

**Problem:**
- Backend business logic (`lib/services/`, `lib/providers/`) lives in `lib/` alongside frontend code
- No clear folder structure indicating what runs on server vs client
- Services are imported by both API routes (backend) and frontend hooks (client)

**Evidence:**
```typescript
// app/api/v1/tokens/route.ts (BACKEND - Server)
import { getTokenService } from '@/lib/services/token-service'; // ✅ Correct

// hooks/useTokenSearch.ts (FRONTEND - Client)
import { fetchTokens } from '@/lib/api/tokens'; // ✅ Correct

// But both are in lib/ with no clear separation
```

**Impact:**
- Confusion about what runs where
- Risk of importing server-only code in client components
- Difficult to identify backend logic for mobile reuse
- No clear separation for future backend extraction

---

### 2.2 ❌ **Critical: Mixed Responsibilities**

**Problem:**
Services contain both business logic AND data transformation:

```typescript
// lib/services/token-service.ts
class TokenService {
  // ✅ Business logic: Fetching tokens
  async getAllTokens() { ... }
  
  // ❌ Data transformation: Should be in API route or separate transformer
  async getSupportedChains(): Promise<ChainDTO[]> {
    return canonicalChains.map(chain => ({
      // Transformation logic mixed with business logic
    }));
  }
}
```

**Impact:**
- Services are harder to test
- Transformation logic can't be reused independently
- Business logic and presentation logic coupled

---

### 2.3 ❌ **Critical: Inconsistent Folder Organization**

**Problem:**
Related code is scattered:

- **Token logic:**
  - Types: `lib/types/tokens.ts` (frontend) + `lib/types/backend-tokens.ts` (backend)
  - Services: `lib/services/token-service.ts` (backend)
  - API clients: `lib/api/tokens.ts` (frontend)
  - Hooks: `hooks/useTokenSearch.ts` (frontend)
  - Components: `components/swap/token-selector-modal.tsx` (frontend)

- **Chain logic:**
  - Registry: `lib/chains/registry.ts` (backend)
  - Services: `lib/services/chain-service.ts` (backend)
  - API clients: `lib/api/chains.ts` (frontend)
  - Hooks: `hooks/useChains.ts` (frontend)

**Impact:**
- Hard to find related code
- No clear domain boundaries
- Difficult to understand feature scope

---

### 2.4 ⚠️ **Moderate: Limited Mobile Reusability**

**Problem:**
Business logic is tied to React/Next.js:

1. **Hooks are React-specific:**
   - `useTokenSearch.ts` uses React hooks (`useState`, `useMemo`)
   - Can't be reused in mobile (React Native would need separate implementation)

2. **Services are platform-agnostic but location is unclear:**
   - `TokenService` and `ChainService` are pure TypeScript (reusable)
   - But they're in `lib/` mixed with frontend code
   - Mobile developers won't know what's reusable

3. **Utils are mixed:**
   - `lib/utils/formatting.ts` - Pure functions (reusable)
   - `lib/utils/number.ts` - Pure functions (reusable)
   - But mixed with React-specific code

**Impact:**
- Mobile team can't easily identify reusable code
- Risk of code duplication
- No clear "shared" module

---

### 2.5 ⚠️ **Moderate: Large Files with Multiple Responsibilities**

**Problem:**
Some files are doing too much:

1. **`hooks/useTokenSearch.ts` (286 lines):**
   - Search logic
   - Fuzzy matching algorithm
   - Cache management
   - API integration
   - Data merging

2. **`lib/services/token-service.ts` (405 lines):**
   - Business logic
   - Data transformation
   - Error handling
   - Fallback logic
   - Mock data

3. **`components/swap/token-selector-modal.tsx` (312 lines):**
   - Modal UI
   - Chain selection logic
   - Token search integration
   - Prefetching logic
   - State management

**Impact:**
- Hard to test individual concerns
- Difficult to understand file purpose
- Risk of bugs when modifying

---

### 2.6 ⚠️ **Moderate: Implicit Dependencies**

**Problem:**
Dependencies are not explicit:

1. **Chain Registry:**
   - `lib/chains/registry.ts` is imported everywhere
   - No clear indication of what depends on it
   - Hard to understand impact of changes

2. **Type Dependencies:**
   - `lib/types/backend-tokens.ts` used by both backend and frontend
   - But frontend also has `lib/types/tokens.ts`
   - Unclear when to use which

3. **Provider Dependencies:**
   - Services depend on providers
   - Providers depend on registry
   - No clear dependency graph

**Impact:**
- Hard to understand system architecture
- Risk of circular dependencies
- Difficult to refactor safely

---

### 2.7 ⚠️ **Minor: Inconsistent Naming**

**Problem:**
Naming doesn't clearly indicate purpose:

- `lib/api/tokens.ts` - Frontend API client (not backend API)
- `lib/services/token-service.ts` - Backend service (not frontend)
- `lib/providers/query-provider.tsx` - React component (not a provider in the same sense)

**Impact:**
- Confusion about file purpose
- Harder to navigate codebase

---

## 3. What's Working Well ✅

### 3.1 Clear API Route Structure
- `app/api/v1/` clearly indicates backend endpoints
- Routes are thin (delegate to services)
- Good error handling

### 3.2 Provider Pattern
- `BaseTokenProvider` provides clear interface
- Easy to add new providers
- Good abstraction

### 3.3 Type Safety
- Strong TypeScript usage
- Clear type definitions
- Good separation of backend vs frontend types (though location is unclear)

### 3.4 State Management
- Zustand store is well-structured
- Clear separation of UI state vs business state

### 3.5 Data Fetching
- TanStack Query for caching
- Good prefetching strategy
- Request deduplication

---

## 4. Reusability Analysis (Web + Mobile)

### 4.1 Currently Reusable (Platform-Agnostic)

✅ **Pure Business Logic:**
- `lib/services/token-service.ts` - Pure TypeScript class
- `lib/services/chain-service.ts` - Pure TypeScript class
- `lib/providers/base.ts` - Abstract class
- `lib/providers/lifi.ts` - Provider implementation
- `lib/chains/registry.ts` - Data + lookup functions
- `lib/utils/formatting.ts` - Pure functions
- `lib/utils/number.ts` - Pure functions
- `lib/types/backend-tokens.ts` - Type definitions

✅ **Backend Types:**
- All types in `lib/types/backend-tokens.ts` are reusable

### 4.2 Not Reusable (Platform-Specific)

❌ **React-Specific:**
- All hooks (`hooks/*.ts`)
- React components (`components/**/*.tsx`)
- React providers (`lib/providers/query-provider.tsx`)
- Zustand store (`lib/store/swap-store.ts`) - Though Zustand works in React Native

❌ **Next.js-Specific:**
- API routes (`app/api/**/*.ts`)
- Next.js pages (`app/**/page.tsx`)
- Next.js layout (`app/layout.tsx`)

### 4.3 Partially Reusable (Needs Extraction)

⚠️ **Business Logic Mixed with React:**
- `hooks/useTokenSearch.ts` - Search algorithm is reusable, but hook wrapper is React-specific
- `hooks/useSwapQuote.ts` - Quote logic is reusable, but hook wrapper is React-specific

**Solution:** Extract pure functions, keep hooks as thin wrappers

---

## 5. Proposed Folder Structure

### 5.1 New Structure (Recommended)

```
tiwi-super-app/
├── app/                              # Next.js App Router (Frontend)
│   ├── api/                          # Backend API Routes (Server-only)
│   │   └── v1/
│   │       ├── chains/route.ts
│   │       └── tokens/route.ts
│   ├── swap/page.tsx                 # Frontend pages
│   └── layout.tsx
│
├── components/                       # React UI Components (Frontend)
│   ├── swap/
│   ├── wallet/
│   └── ui/
│
├── hooks/                            # React Hooks (Frontend)
│   └── ...
│
├── lib/                              # ⚠️ TO BE REORGANIZED
│   │
│   ├── backend/                      # 🆕 Backend Logic (Server-only)
│   │   ├── services/                 # Business logic
│   │   │   ├── token-service.ts
│   │   │   └── chain-service.ts
│   │   ├── providers/                # External API providers
│   │   │   ├── base.ts
│   │   │   ├── lifi.ts
│   │   │   ├── dexscreener.ts
│   │   │   └── relay.ts
│   │   ├── registry/                 # Chain registry
│   │   │   └── chains.ts
│   │   └── types/                    # Backend types
│   │       └── backend-tokens.ts
│   │
│   ├── frontend/                     # 🆕 Frontend Logic (Client)
│   │   ├── api/                      # API clients
│   │   │   ├── tokens.ts
│   │   │   └── chains.ts
│   │   ├── store/                    # State management
│   │   │   └── swap-store.ts
│   │   ├── types/                    # Frontend types
│   │   │   └── tokens.ts
│   │   └── calculations/            # Frontend calculations
│   │       └── swap.ts
│   │
│   └── shared/                        # 🆕 Shared Logic (Platform-Agnostic)
│       ├── utils/                    # Pure utilities
│       │   ├── formatting.ts
│       │   └── number.ts
│       ├── constants/                 # Constants
│       │   └── popular-chains.ts
│       └── types/                     # Shared types (if any)
│
└── data/                              # Mock data
```

### 5.2 Alternative: Domain-Based Structure

```
tiwi-super-app/
├── app/                              # Next.js App Router
│   └── api/v1/...
│
├── features/                         # 🆕 Feature-based organization
│   ├── tokens/
│   │   ├── backend/                  # Backend logic
│   │   │   ├── services/
│   │   │   ├── providers/
│   │   │   └── types/
│   │   ├── frontend/                 # Frontend logic
│   │   │   ├── api/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   └── shared/                   # Shared utilities
│   │
│   ├── chains/
│   │   ├── backend/
│   │   ├── frontend/
│   │   └── shared/
│   │
│   └── swap/
│       ├── backend/
│       ├── frontend/
│       └── shared/
│
└── shared/                            # Cross-feature shared code
    ├── utils/
    └── types/
```

**Recommendation:** Start with **Structure 5.1** (backend/frontend/shared) as it's clearer and easier to migrate. Consider domain-based structure later if features grow large.

---

## 6. Refactor Plan (Step-by-Step)

### Phase 1: Create Clear Backend/Frontend Boundaries

**Goal:** Separate backend logic from frontend logic

**Steps:**
1. Create `lib/backend/` folder
2. Move `lib/services/` → `lib/backend/services/`
3. Move `lib/providers/` → `lib/backend/providers/` (except `query-provider.tsx`)
4. Move `lib/chains/registry.ts` → `lib/backend/registry/chains.ts`
5. Move `lib/types/backend-tokens.ts` → `lib/backend/types/backend-tokens.ts`
6. Update all imports
7. Verify no client code imports from `lib/backend/`

**Risk:** Medium - Many import updates needed  
**Stopping Point:** After step 7, verify build works

---

### Phase 2: Organize Frontend Code

**Goal:** Consolidate frontend-specific code

**Steps:**
1. Create `lib/frontend/` folder
2. Move `lib/api/` → `lib/frontend/api/`
3. Move `lib/store/` → `lib/frontend/store/`
4. Move `lib/types/tokens.ts` → `lib/frontend/types/tokens.ts`
5. Move `lib/swap/calculations.ts` → `lib/frontend/calculations/swap.ts`
6. Move `lib/providers/query-provider.tsx` → `lib/frontend/providers/query-provider.tsx`
7. Update all imports

**Risk:** Low - Mostly moving files  
**Stopping Point:** After step 7, verify build works

---

### Phase 3: Extract Shared Utilities

**Goal:** Identify and extract platform-agnostic code

**Steps:**
1. Create `lib/shared/` folder
2. Move `lib/utils/formatting.ts` → `lib/shared/utils/formatting.ts`
3. Move `lib/utils/number.ts` → `lib/shared/utils/number.ts`
4. Move `lib/utils.ts` → `lib/shared/utils/cn.ts` (rename function)
5. Move `lib/constants/popular-chains.ts` → `lib/shared/constants/popular-chains.ts`
6. Update all imports

**Risk:** Low - Pure utilities, easy to move  
**Stopping Point:** After step 6, verify build works

---

### Phase 4: Split Large Files

**Goal:** Break down files with multiple responsibilities

**Steps:**
1. **Split `hooks/useTokenSearch.ts`:**
   - Extract `calculateSimilarity()` → `lib/shared/utils/search.ts`
   - Extract `filterTokensByQuery()` → `lib/shared/utils/search.ts`
   - Extract `mergeTokens()` → `lib/shared/utils/tokens.ts`
   - Extract `getCachedTokens()` → `lib/frontend/utils/cache.ts`
   - Keep hook as thin wrapper

2. **Split `lib/services/token-service.ts`:**
   - Extract transformation logic → `lib/backend/transformers/token-transformer.ts`
   - Keep service as pure business logic

3. **Split `components/swap/token-selector-modal.tsx`:**
   - Extract prefetching logic → `hooks/useTokenPrefetch.ts`
   - Extract chain selection logic → `hooks/useChainSelection.ts`
   - Keep component as UI only

**Risk:** Medium - Need to ensure no behavior changes  
**Stopping Point:** After each file split, test thoroughly

---

### Phase 5: Improve Type Organization

**Goal:** Clear type boundaries

**Steps:**
1. Review all types in `lib/backend/types/`
2. Review all types in `lib/frontend/types/`
3. Identify truly shared types → `lib/shared/types/`
4. Update imports
5. Document type usage guidelines

**Risk:** Low - Mostly organizational  
**Stopping Point:** After step 5, verify types are correct

---

### Phase 6: Documentation & Guidelines

**Goal:** Document architectural decisions

**Steps:**
1. Create `docs/ARCHITECTURE.md` explaining structure
2. Document backend/frontend boundaries
3. Document shared code guidelines
4. Add comments to key files explaining their purpose
5. Create contribution guidelines

**Risk:** None - Documentation only  
**Stopping Point:** Documentation complete

---

## 7. Risk Assessment

### High Risk
- **Phase 1 (Backend/Frontend separation):** Many import updates, risk of breaking client imports
  - **Mitigation:** Use TypeScript path aliases, test thoroughly

### Medium Risk
- **Phase 4 (File splitting):** Risk of behavior changes
  - **Mitigation:** Extract functions first, test, then update imports

### Low Risk
- **Phase 2, 3, 5, 6:** Mostly organizational changes
  - **Mitigation:** Standard file moves, easy to verify

---

## 8. Success Criteria

This refactor is complete when:

✅ **Clear Boundaries:**
- Backend code is clearly in `lib/backend/`
- Frontend code is clearly in `lib/frontend/`
- Shared code is clearly in `lib/shared/`
- No client code imports from `lib/backend/`

✅ **Modularity:**
- Files have single responsibility
- Large files are split appropriately
- Related code is co-located

✅ **Reusability:**
- Mobile team can easily identify reusable code in `lib/shared/`
- Business logic is platform-agnostic
- React-specific code is clearly marked

✅ **Readability:**
- New engineers can navigate codebase easily
- File purposes are clear from location
- Dependencies are explicit

✅ **No Regressions:**
- All existing functionality works
- No behavior changes
- Build passes
- Tests pass (if any)

---

## 9. What NOT to Change

**Intentionally Preserved:**
- ✅ Provider pattern (working well)
- ✅ TanStack Query usage (good pattern)
- ✅ Zustand store structure (well-designed)
- ✅ API route structure (clear and correct)
- ✅ Component structure (reasonable)
- ✅ Type definitions (correct, just need better organization)

**Not Refactoring:**
- ❌ Business logic (only moving, not rewriting)
- ❌ Component implementations (only extracting logic)
- ❌ API contracts (no breaking changes)
- ❌ External dependencies (no changes)

---

## 10. Next Steps

1. **Review this audit report**
2. **Approve refactor plan** (or request modifications)
3. **Begin Phase 1** (Backend/Frontend separation)
4. **Stop after each phase** for review
5. **Iterate based on feedback**

---

## Appendix: File Size Analysis

| File | Lines | Responsibilities | Status |
|------|-------|------------------|--------|
| `hooks/useTokenSearch.ts` | 286 | Search, fuzzy match, cache, merge | ⚠️ Too large |
| `lib/services/token-service.ts` | 405 | Business logic, transformation, fallback | ⚠️ Too large |
| `components/swap/token-selector-modal.tsx` | 312 | UI, chain selection, prefetching | ⚠️ Too large |
| `lib/providers/lifi.ts` | 345 | Provider implementation | ✅ OK |
| `app/swap/page.tsx` | 228 | Page orchestration | ✅ OK |
| `lib/store/swap-store.ts` | 163 | State management | ✅ OK |

**Threshold:** Files > 300 lines should be reviewed for splitting.

---

**End of Audit Report**

