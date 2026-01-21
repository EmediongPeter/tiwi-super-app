# Architecture Documentation

This document explains the overall architecture of the tiwi-super-app codebase, including folder structure, boundaries, and design principles.

---

## Table of Contents

1. [Overview](#overview)
2. [Folder Structure](#folder-structure)
3. [Architectural Boundaries](#architectural-boundaries)
4. [Data Flow](#data-flow)
5. [Design Principles](#design-principles)
6. [Key Components](#key-components)

---

## Overview

The tiwi-super-app follows a **layered architecture** with clear separation between:

- **Backend** - Server-side logic (services, providers, registry)
- **Frontend** - Client-side logic (API clients, state, UI)
- **Shared** - Platform-agnostic utilities and types

This architecture ensures:
- ✅ Clear separation of concerns
- ✅ Reusability across web and mobile
- ✅ Maintainability and scalability
- ✅ Type safety and boundaries

---

## Folder Structure

```
tiwi-super-app/
├── app/                          # Next.js App Router
│   ├── api/v1/                   # API routes (backend)
│   │   ├── tokens/route.ts
│   │   └── chains/route.ts
│   ├── swap/                     # Swap page
│   └── layout.tsx                 # Root layout
│
├── components/                    # React components (frontend)
│   ├── swap/                     # Swap-related components
│   ├── ui/                       # Reusable UI components
│   └── wallet/                   # Wallet components
│
├── hooks/                         # React hooks (frontend)
│   ├── useTokenSearch.ts
│   ├── useTokensQuery.ts
│   └── ...
│
├── lib/
│   ├── backend/                  # Backend Logic (Server-only)
│   │   ├── data/                 # Mock data
│   │   ├── providers/            # Token providers (LiFi, Relay, etc.)
│   │   ├── registry/             # Chain registry
│   │   ├── services/             # Business logic
│   │   ├── types/                # Backend types
│   │   └── utils/                # Backend utilities
│   │
│   ├── frontend/                  # Frontend Logic (Client)
│   │   ├── api/                  # API clients
│   │   ├── calculations/          # Frontend calculations
│   │   ├── providers/             # React providers
│   │   ├── store/                 # State management (Zustand)
│   │   ├── types/                 # Frontend types
│   │   └── utils/                 # Frontend utilities
│   │
│   └── shared/                    # Shared (Web + Mobile)
│       ├── constants/             # Shared constants
│       ├── types/                 # Shared types (API contracts)
│       └── utils/                # Platform-agnostic utilities
│
└── docs/                          # Documentation
```

---

## Architectural Boundaries

### Backend (`lib/backend/`)

**Purpose:** Server-side logic that runs only on the server.

**Contains:**
- **Services** - Business logic (TokenService, ChainService)
- **Providers** - External API integrations (LiFi, Relay, DexScreener)
- **Registry** - Chain registry and mappings
- **Types** - Backend data structures
- **Utils** - Backend-specific utilities

**Rules:**
- ✅ Can be imported by API routes (`app/api/`)
- ✅ Can be imported by frontend API clients (for types only)
- ❌ Should NOT be imported by React components
- ❌ Should NOT be imported by React hooks (except API clients)
- ❌ Should NOT use React or browser APIs

**Example:**
```typescript
// ✅ Correct - API route importing backend service
import { getTokenService } from '@/lib/backend/services/token-service';

// ✅ Correct - Frontend API client importing backend types
import type { NormalizedToken } from '@/lib/backend/types/backend-tokens';

// ❌ Wrong - Component importing backend service
import { getTokenService } from '@/lib/backend/services/token-service'; // In component
```

---

### Frontend (`lib/frontend/`)

**Purpose:** Client-side logic that runs in the browser.

**Contains:**
- **API Clients** - Functions to call backend APIs
- **Store** - State management (Zustand)
- **Calculations** - Frontend-specific calculations
- **Providers** - React context providers
- **Types** - Frontend data structures
- **Utils** - Frontend-specific utilities

**Rules:**
- ✅ Can be imported by React components
- ✅ Can be imported by React hooks
- ✅ Can import backend types (for transformation)
- ❌ Should NOT be imported by API routes
- ❌ Should NOT be imported by backend services

**Example:**
```typescript
// ✅ Correct - Component importing frontend types
import type { Token } from '@/lib/frontend/types/tokens';

// ✅ Correct - Hook importing frontend API client
import { fetchTokens } from '@/lib/frontend/api/tokens';

// ❌ Wrong - API route importing frontend store
import { useSwapStore } from '@/lib/frontend/store/swap-store'; // In API route
```

---

### Shared (`lib/shared/`)

**Purpose:** Platform-agnostic code that can be used in both web and mobile.

**Contains:**
- **Constants** - Shared constants (popular chains, etc.)
- **Types** - Shared types (API contracts)
- **Utils** - Platform-agnostic utilities (formatting, search, etc.)

**Rules:**
- ✅ Can be imported by backend code
- ✅ Can be imported by frontend code
- ✅ Should be pure functions (no side effects)
- ✅ Should have no framework dependencies
- ❌ Should NOT use React, Next.js, or browser APIs
- ❌ Should NOT use Node.js-specific APIs

**Example:**
```typescript
// ✅ Correct - Both backend and frontend can use
import { formatAddress } from '@/lib/shared/utils/formatting';
import { POPULAR_CHAIN_IDS } from '@/lib/shared/constants/popular-chains';

// ❌ Wrong - Using React in shared code
import { useState } from 'react'; // In shared utility
```

---

## Data Flow

### Token Fetching Flow

```
User Action
    ↓
Component (useTokenSearch hook)
    ↓
Frontend API Client (fetchTokens)
    ↓
Backend API Route (/api/v1/tokens)
    ↓
Backend Service (TokenService)
    ↓
Backend Provider (LiFiProvider)
    ↓
External API (LiFi SDK)
    ↓
[Response flows back up]
    ↓
Frontend API Client (transforms NormalizedToken → Token)
    ↓
Component (displays Token)
```

### Type Transformation Flow

```
Backend                          Shared                    Frontend
─────────────────────────────────────────────────────────────────────
NormalizedToken  ──────────>  TokensAPIResponse  ───>  Token
ChainDTO         ──────────>  ChainsAPIResponse   ───>  Chain
```

1. **Backend** creates `NormalizedToken` and `ChainDTO`
2. **Backend API route** wraps them in `TokensAPIResponse` / `ChainsAPIResponse`
3. **Frontend API client** receives shared API response types
4. **Frontend API client** transforms to `Token` / `Chain` for components

---

## Design Principles

### 1. Single Responsibility

Each module has one clear purpose:
- Services handle business logic
- Providers handle external API integration
- Components handle UI rendering
- Hooks handle state and side effects

### 2. Separation of Concerns

- **Backend** = Server-side logic
- **Frontend** = Client-side logic
- **Shared** = Platform-agnostic code

### 3. Dependency Direction

```
Frontend → Shared ← Backend
```

- Frontend can import from Shared
- Backend can import from Shared
- Frontend can import backend types (for transformation only)
- Backend should NOT import from Frontend

### 4. Platform-Agnostic Shared Code

Shared utilities should:
- Be pure functions
- Have no framework dependencies
- Work in both web and mobile
- Be easily testable

### 5. Type Safety

- Use TypeScript for all code
- Define clear type boundaries
- Transform types at API boundaries
- Use shared types for API contracts

---

## Key Components

### Backend Services

**TokenService** (`lib/backend/services/token-service.ts`)
- Aggregates tokens from multiple providers
- Handles fallback to mock data
- Provides unified API for token fetching

**ChainService** (`lib/backend/services/chain-service.ts`)
- Aggregates chains from multiple providers
- Normalizes chain data
- Provides unified API for chain fetching

### Backend Providers

**LiFiProvider** (`lib/backend/providers/lifi.ts`)
- Fetches tokens and chains from LiFi SDK
- Normalizes LiFi data to canonical format
- Handles multi-chain token mixing

**BaseTokenProvider** (`lib/backend/providers/base.ts`)
- Abstract base class for all providers
- Defines provider interface
- Ensures consistent behavior

### Frontend API Clients

**fetchTokens** (`lib/frontend/api/tokens.ts`)
- Calls `/api/v1/tokens` endpoint
- Transforms `NormalizedToken` → `Token`
- Handles errors and retries

**fetchChains** (`lib/frontend/api/chains.ts`)
- Calls `/api/v1/chains` endpoint
- Transforms `ChainDTO` → `Chain`
- Implements in-memory caching

### Frontend State Management

**useSwapStore** (`lib/frontend/store/swap-store.ts`)
- Zustand store for swap state
- Manages token selection, amounts, quotes
- UI-only state (modals) stays in components

### Shared Utilities

**formatting.ts** (`lib/shared/utils/formatting.ts`)
- Address formatting
- Balance formatting
- Currency formatting
- Image URL cleaning

**search.ts** (`lib/shared/utils/search.ts`)
- Similarity scoring
- Fuzzy matching
- Platform-agnostic search logic

---

## Best Practices

### ✅ DO

1. **Keep backend and frontend separate**
   - Backend code in `lib/backend/`
   - Frontend code in `lib/frontend/`
   - Shared code in `lib/shared/`

2. **Use appropriate types**
   - Backend types for backend code
   - Frontend types for frontend code
   - Shared types for API contracts

3. **Transform at boundaries**
   - Transform backend types to frontend types in API clients
   - Don't use backend types in components

4. **Keep shared code pure**
   - No side effects
   - No framework dependencies
   - Easy to test

5. **Document architectural decisions**
   - Add comments explaining why
   - Update this document when structure changes

### ❌ DON'T

1. **Don't mix concerns**
   - Don't put backend logic in frontend code
   - Don't put frontend logic in backend code

2. **Don't break boundaries**
   - Don't import backend services in components
   - Don't import frontend store in API routes

3. **Don't add framework deps to shared**
   - Don't use React in shared utilities
   - Don't use Next.js APIs in shared code

4. **Don't create circular dependencies**
   - Backend → Shared ← Frontend (OK)
   - Backend → Frontend (NOT OK)

---

## Migration Notes

This architecture was established through a phased refactor:

- **Phase 1:** Created backend/frontend boundaries
- **Phase 2:** Organized frontend code
- **Phase 3:** Extracted shared utilities
- **Phase 4:** Split large files
- **Phase 5:** Improved type organization
- **Phase 6:** Created this documentation

See `docs/PHASE_*_REFACTOR_COMPLETE.md` for details on each phase.

---

## Related Documentation

- [Type Usage Guidelines](./TYPE_USAGE_GUIDELINES.md) - How to use types correctly
- [Architectural Audit Report](./ARCHITECTURAL_AUDIT_REPORT.md) - Initial analysis
- [Phase Completion Reports](./PHASE_*_REFACTOR_COMPLETE.md) - Refactor history

---

## Questions?

If you're unsure about where code should go:

1. **Is it server-only?** → `lib/backend/`
2. **Is it client-only?** → `lib/frontend/`
3. **Can it work in mobile?** → `lib/shared/`
4. **Is it a React component?** → `components/`
5. **Is it a React hook?** → `hooks/`

When in doubt, ask or check existing patterns in the codebase.

