# Type Usage Guidelines

This document explains how types are organized and when to use each type category.

---

## Type Categories

### 1. Backend Types (`lib/backend/types/`)

**Purpose:** Types used internally by the backend token aggregation system.

**Location:** `lib/backend/types/backend-tokens.ts`

**Types:**
- `CanonicalChain` - Internal chain representation with provider mappings
- `NormalizedToken` - Backend token format (what backend returns)
- `ChainDTO` - Backend chain format (what backend returns)
- `ProviderToken` - Provider-specific token (before normalization)
- `ProviderChain` - Provider-specific chain (before normalization)
- `FetchTokensParams` - Provider interface parameters
- `TokenProvider` - Provider interface

**When to use:**
- ✅ Backend services (`lib/backend/services/`)
- ✅ Backend providers (`lib/backend/providers/`)
- ✅ Backend registry (`lib/backend/registry/`)
- ✅ Frontend API clients (for transformation only - `lib/frontend/api/`)
- ❌ Frontend components
- ❌ Frontend hooks (except API clients)

**Example:**
```typescript
import type { NormalizedToken, ChainDTO } from '@/lib/backend/types/backend-tokens';
```

---

### 2. Frontend Types (`lib/frontend/types/`)

**Purpose:** Types used by frontend components and hooks.

**Location:** `lib/frontend/types/tokens.ts`

**Types:**
- `Token` - Frontend token representation (transformed from `NormalizedToken`)
- `Chain` - Frontend chain representation (transformed from `ChainDTO`)

**When to use:**
- ✅ Frontend components (`components/`)
- ✅ Frontend hooks (`hooks/`)
- ✅ Frontend store (`lib/frontend/store/`)
- ✅ Frontend calculations (`lib/frontend/calculations/`)
- ❌ Backend code
- ❌ API routes

**Example:**
```typescript
import type { Token, Chain } from '@/lib/frontend/types/tokens';
```

---

### 3. Shared Types (`lib/shared/types/`)

**Purpose:** Types that define the API contract between backend and frontend.

**Location:** `lib/shared/types/api.ts`

**Types:**
- `TokensAPIResponse` - API response format for `/api/v1/tokens`
- `ChainsAPIResponse` - API response format for `/api/v1/chains`

**When to use:**
- ✅ Backend API routes (`app/api/v1/*/route.ts`)
- ✅ Frontend API clients (`lib/frontend/api/`)
- ✅ Both sides need to agree on the API contract
- ❌ Frontend components (use frontend types instead)
- ❌ Backend services (use backend types instead)

**Example:**
```typescript
import type { TokensAPIResponse, ChainsAPIResponse } from '@/lib/shared/types/api';
```

---

## Type Transformation Flow

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

## Import Rules

### ✅ DO

```typescript
// Backend service
import type { NormalizedToken } from '@/lib/backend/types/backend-tokens';

// Frontend component
import type { Token } from '@/lib/frontend/types/tokens';

// API route or API client
import type { TokensAPIResponse } from '@/lib/shared/types/api';
```

### ❌ DON'T

```typescript
// ❌ Don't import backend types in frontend components
import type { NormalizedToken } from '@/lib/backend/types/backend-tokens'; // In component

// ❌ Don't import frontend types in backend code
import type { Token } from '@/lib/frontend/types/tokens'; // In backend service

// ❌ Don't import shared API types in components (use frontend types)
import type { TokensAPIResponse } from '@/lib/shared/types/api'; // In component
```

---

## Adding New Types

### Backend Types
- Add to `lib/backend/types/backend-tokens.ts`
- Use for internal backend logic
- Example: New provider interface, new normalization format

### Frontend Types
- Add to `lib/frontend/types/tokens.ts` (or create new file if needed)
- Use for frontend components and hooks
- Example: New UI state, new component props

### Shared Types
- Add to `lib/shared/types/api.ts` (or create new file if needed)
- Use when both backend and frontend need to agree on structure
- Example: New API endpoint response format

---

## Type Safety Guidelines

1. **Always use the correct type category** - Don't mix backend and frontend types
2. **Transform at boundaries** - Transform between backend and frontend types in API clients
3. **Keep shared types minimal** - Only include types that define the API contract
4. **Document type purposes** - Add JSDoc comments explaining when to use each type

---

## Migration Notes

- API response types (`TokensAPIResponse`, `ChainsAPIResponse`) were moved from `lib/backend/types/` to `lib/shared/types/api.ts` in Phase 5
- This ensures both backend and frontend agree on the API contract
- Update imports if you see old references

