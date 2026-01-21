# Phase 1.0 — Backbone Implementation Plan

## Overview

This document outlines the minimal backbone implementation for token aggregation. This is **NOT** the full system—it's the absolute minimum foundation needed to support future expansion.

**Status:** 📋 **PLAN - AWAITING APPROVAL**

---

## Step 1: High-Level Plan

### 1.1 Proposed Folder Structure

```
tiwi-super-app/
├── app/
│   └── api/
│       └── v1
            └── tokens/
│               └── route.ts          # Single API endpoint (GET/POST)
│
├── lib/
│   ├── chains/
│   │   └── registry.ts           # Chain registry (minimal, 5-10 chains for now)
│   │
│   ├── providers/
│   │   ├── base.ts               # TokenProvider interface (abstract)
│   │   ├── lifi.ts               # LiFi provider (STUBBED - no real calls yet)
│   │   ├── dexscreener.ts        # DexScreener provider (STUBBED)
│   │   └── relay.ts              # Relay provider (STUBBED)
│   │
│   ├── services/
│   │   └── token-service.ts      # Token service (mocked data for now)
│   │
│   └── types/
│       └── tokens.ts             # Type definitions (Token, Chain DTOs)
│
└── data/
    └── mock-tokens.ts            # Existing mock data (reuse if appropriate)
```

### 1.2 Where Things Live

**API Routes:**
- Location: `app/api/tokens/route.ts`
- Purpose: Single entry point for token fetching
- For now: Returns mocked data, validates request structure

**Services:**
- Location: `lib/services/token-service.ts`
- Purpose: Business logic layer (minimal for now)
- Methods: `getAllTokens()`, `getTokensByChain()`, `searchTokens()`
- Implementation: Returns mocked/static data

**Providers:**
- Location: `lib/providers/`
- Purpose: Provider abstraction layer (foundation only)
- Implementation: Stubbed classes with interface compliance, no real API calls

**Chain Registry:**
- Location: `lib/chains/registry.ts`
- Purpose: Single source of truth for chain identity
- Implementation: Minimal registry (5-10 chains: Ethereum, BSC, Polygon, Solana, etc.)

**Types:**
- Location: `lib/types/tokens.ts`
- Purpose: Shared type definitions
- Implementation: Core interfaces only

### 1.3 How Providers Will Eventually Plug In

**Current State (Phase 1.0):**
- Provider interface defined (`TokenProvider`)
- Stub implementations exist (LiFi, DexScreener, Relay)
- No real API calls yet
- No aggregation logic yet

**Future Extension Points:**
- Provider classes implement `TokenProvider` interface
- Service layer will call providers via interface
- Aggregation logic will be added in future phases
- Registry will expand with more chains

**Example Future Flow (Not Implemented Yet):**
```
API Route → Token Service → Provider Interface → Real Provider Implementation → API Call
```

### 1.4 What Is Intentionally NOT Implemented Yet

**Not Implemented:**
- ❌ Real provider API calls (LiFi, DexScreener, Relay)
- ❌ Token aggregation logic (merging from multiple providers)
- ❌ Chain detection from provider responses
- ❌ Deduplication logic
- ❌ Provider prioritization
- ❌ Error handling beyond basic validation
- ❌ Caching
- ❌ Rate limiting
- ❌ Advanced search filtering
- ❌ Multi-chain request optimization (Relay's multi-chain capability)
- ❌ Chain registry expansion (Cosmos chains, Sui, TON, etc.)

**What IS Implemented:**
- ✅ Basic API route structure
- ✅ Request/response handling
- ✅ Type definitions
- ✅ Service layer boundaries
- ✅ Provider interface (abstract)
- ✅ Minimal chain registry (5-10 chains)
- ✅ Mocked data responses

---

## Step 2: Minimal API Route (After Approval)

**File:** `app/api/tokens/route.ts`

**What It Does:**
- Accepts GET requests with query params: `chainId`, `query` (optional)
- Accepts POST requests with body: `{ chainIds: [], query: "", limit: 100 }`
- Validates input parameters
- Calls token service
- Returns mocked token data in predictable format

**What It Does NOT Do:**
- No real provider calls
- No aggregation
- No complex logic

**Example Request:**
```
GET /api/tokens?chainId=1&query=USDC
POST /api/tokens { "chainIds": [1, 56], "query": "USDC" }
```

**Example Response (Mocked):**
```json
{
  "tokens": [
    {
      "chainId": 1,
      "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "logoURI": "",
      "priceUSD": "1.00",
      "providers": ["mock"]
    }
  ],
  "total": 1,
  "chainIds": [1],
  "query": "USDC"
}
```

---

## Step 3: Minimal Service Layer (After Approval)

**File:** `lib/services/token-service.ts`

**What It Does:**
- Provides clean function boundaries
- Methods: `getAllTokens()`, `getTokensByChain()`, `searchTokens()`
- Returns mocked/static data for now
- Validates chainId against registry

**What It Does NOT Do:**
- No provider calls
- No aggregation
- No complex filtering

**Methods:**
```typescript
class TokenService {
  getAllTokens(): Promise<NormalizedToken[]>
  getTokensByChain(chainId: number): Promise<NormalizedToken[]>
  searchTokens(query: string, chainId?: number): Promise<NormalizedToken[]>
}
```

---

## Step 4: Provider Interface (Foundation Only)

**File:** `lib/providers/base.ts`

**What It Does:**
- Defines `TokenProvider` interface
- Documents expected methods
- No implementation yet

**What It Does NOT Do:**
- No real implementations
- No API calls

**Interface:**
```typescript
interface TokenProvider {
  name: string;
  getChainId(canonicalChain: CanonicalChain): string | number | null;
  fetchTokens(params: {...}): Promise<ProviderToken[]>;
  normalizeToken(token: ProviderToken, chain: CanonicalChain): NormalizedToken;
}
```

---

## Step 5: Minimal Chain Registry

**File:** `lib/chains/registry.ts`

**What It Does:**
- Defines 5-10 core chains (Ethereum, BSC, Polygon, Solana, Arbitrum, Optimism, Base, Avalanche, etc.)
- Maps provider IDs (LiFi, DexScreener, Relay)
- Provides lookup functions

**What It Does NOT Do:**
- No Cosmos chains yet
- No Sui/TON/Bitcoin yet
- No complex metadata

**Example Chains:**
- Ethereum (id: 1)
- BSC (id: 56)
- Polygon (id: 137)
- Solana (id: 7565164)
- Arbitrum (id: 42161)
- Optimism (id: 10)
- Base (id: 8453)
- Avalanche (id: 43114)

---

## Step 6: Type Definitions

**File:** `lib/types/tokens.ts`

**What It Does:**
- Defines core types: `NormalizedToken`, `CanonicalChain`, `ProviderToken`
- Minimal, focused types
- Aligned with architecture document

---

## Implementation Order

1. ✅ **Step 1: Plan** (This document - awaiting approval)
2. ⏸️ **Step 2: Types** - Define core types
3. ⏸️ **Step 3: Chain Registry** - Minimal registry with 5-10 chains
4. ⏸️ **Step 4: Provider Interface** - Abstract interface only
5. ⏸️ **Step 5: Token Service** - Service layer with mocked data
6. ⏸️ **Step 6: API Route** - Single endpoint returning mocked data
7. ⏸️ **Step 7: Review & Pause** - Summarize, explain next steps, stop

---

## Success Criteria for Phase 1.0

✅ **Complete When:**
- API route exists and responds to requests
- Service layer has clear boundaries
- Types are defined and used consistently
- Chain registry exists with 5-10 chains
- Provider interface is defined (not implemented)
- System runs without errors
- Code is readable and understandable
- Foundation is ready for Phase 1.1 (real provider calls)

---

## Questions Before Implementation

1. **Mock Data Source:** Should I use existing `data/mock-tokens.ts` or create new minimal mocks?
2. **Chain Registry:** Should I start with exact chains from architecture doc or a smaller subset?
3. **API Response Format:** Should I match Relay's format exactly or use a simpler format for now?
4. **Error Handling:** How detailed should validation be? (e.g., invalid chainId → 400 vs 404)

---

**Status:** ⏸️ **AWAITING APPROVAL TO PROCEED**

**Next Step:** After approval, I will implement Steps 2-6 in order, pausing after each for review.

