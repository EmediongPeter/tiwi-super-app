# Chain Registry Logic Explanation

## The Core Problem

Different providers use **different identifiers** for the same chain:

| Chain | LiFi | DexScreener | Relay | Squid |
|-------|------|-------------|-------|-------|
| Ethereum | `1` (number) | `"ethereum"` (string) | `1` (number) | `"1"` (string) |
| Solana | `1151111081099710` (special number) | `"solana"` (string) | `792703809` (number) | `"solana-mainnet-beta"` (string) |
| BSC | `56` (number) | `"bsc"` (string) | `56` (number) | `"56"` (string) |

**Problem:** If we hardcode provider-specific IDs, we can't:
- Add new providers easily
- Support chains that some providers don't support
- Handle provider-specific quirks (like LiFi's special Solana ID)

---

## The Solution: Canonical Chain Registry

### Concept: Single Source of Truth

We create **one canonical representation** of each chain, then **map** to provider-specific IDs.

```
┌─────────────────────────────────────┐
│   Canonical Chain (Our System)      │
│   id: 1                             │
│   name: "Ethereum"                  │
│   type: "EVM"                       │
└──────────────┬──────────────────────┘
               │
               │ Maps to provider IDs
               │
    ┌──────────┼──────────┐
    │          │          │
    ▼          ▼          ▼
┌──────┐  ┌──────────┐  ┌──────┐
│ LiFi │  │DexScreener│  │Relay │
│  1   │  │"ethereum" │  │  1   │
└──────┘  └──────────┘  └──────┘
```

### How It Works

**Step 1: Define Canonical Chain**
```typescript
const ETHEREUM: CanonicalChain = {
  id: 1,                    // Our stable internal ID (never changes)
  name: 'Ethereum',
  type: 'EVM',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  
  // Provider mappings (explicit, no magic)
  providerIds: {
    lifi: 1,                // LiFi uses numeric 1
    dexscreener: 'ethereum', // DexScreener uses string "ethereum"
    relay: 1,               // Relay uses numeric 1
    squid: '1',             // Squid uses string "1"
  },
};
```

**Step 2: Lookup Functions**
```typescript
// Get canonical chain by our internal ID
getCanonicalChain(1) → ETHEREUM

// Get canonical chain by provider's ID
getCanonicalChainByProviderId('dexscreener', 'ethereum') → ETHEREUM
getCanonicalChainByProviderId('lifi', 1) → ETHEREUM
```

**Step 3: Provider Uses Registry**
```typescript
// LiFi Provider wants to fetch tokens for Ethereum
const canonicalChain = getCanonicalChain(1);  // Get our canonical chain
const lifiChainId = canonicalChain.providerIds.lifi;  // Extract LiFi's ID: 1
await lifiAPI.getTokens(lifiChainId);  // Call LiFi with their ID
```

---

## Key Design Principles

### 1. Stable Internal IDs

**Our canonical IDs never change:**
- Ethereum = `1` (always)
- Solana = `7565164` (always)
- BSC = `56` (always)

**Why:** Frontend, database, and other systems can rely on these IDs being stable.

### 2. Explicit Provider Mappings

**Every provider ID is explicitly mapped:**
```typescript
providerIds: {
  lifi: 1,                    // Explicit
  dexscreener: 'ethereum',     // Explicit
  relay: 1,                   // Explicit
  squid: '1',                 // Explicit
}
```

**Why:** No magic conversions, no hashing, no guessing. Everything is traceable.

### 3. Nullable Provider IDs

**Not all providers support all chains:**
```typescript
const SOLANA: CanonicalChain = {
  id: 7565164,
  name: 'Solana',
  providerIds: {
    lifi: 1151111081099710,    // LiFi supports Solana
    dexscreener: 'solana',      // DexScreener supports Solana
    relay: 792703809,          // Relay supports Solana
    squid: 'solana-mainnet-beta', // Squid supports Solana
  },
};

const OSMOSIS: CanonicalChain = {
  id: 2,
  name: 'Osmosis',
  providerIds: {
    lifi: null,                // LiFi doesn't support Osmosis
    dexscreener: null,         // DexScreener doesn't support Osmosis
    relay: null,              // Relay doesn't support Osmosis
    squid: 'osmosis-1',        // Only Squid supports Osmosis
  },
};
```

**Why:** Providers can skip chains they don't support. No errors, just `null`.

---

## Real-World Example Flow

### Scenario: Fetch tokens for Ethereum from multiple providers

**Step 1: Frontend requests tokens for chain ID `1`**
```
GET /api/tokens?chainIds=1
```

**Step 2: Backend looks up canonical chain**
```typescript
const chain = getCanonicalChain(1);  // Returns ETHEREUM canonical chain
```

**Step 3: Backend extracts provider-specific IDs**
```typescript
const lifiChainId = chain.providerIds.lifi;        // → 1
const dexChainId = chain.providerIds.dexscreener;  // → "ethereum"
const relayChainId = chain.providerIds.relay;      // → 1
```

**Step 4: Backend calls each provider with their ID**
```typescript
// LiFi Provider
await lifiAPI.getTokens(1);  // Uses LiFi's ID: 1

// DexScreener Provider
await dexscreenerAPI.getTokens("ethereum");  // Uses DexScreener's ID: "ethereum"

// Relay Provider
await relayAPI.getTokens(1);  // Uses Relay's ID: 1
```

**Step 5: Backend normalizes all responses**
```typescript
// All tokens get normalized to use canonical chain ID: 1
normalizedToken.chainId = 1;  // Always our canonical ID, not provider's ID
```

**Step 6: Frontend receives unified response**
```json
{
  "tokens": [
    {
      "chainId": 1,  // Always canonical ID
      "address": "0x...",
      "symbol": "USDC",
      // ...
    }
  ]
}
```

---

## Why This Approach Works

### ✅ Extensibility
Adding a new provider is just adding a mapping:
```typescript
providerIds: {
  // ... existing providers
  newProvider: 'their-chain-id',  // Just add one line
}
```

### ✅ Maintainability
All chain identity logic is in one place (registry). No scattered mappings.

### ✅ Type Safety
TypeScript ensures provider ID types match provider expectations:
- LiFi: `number`
- DexScreener: `string`
- Relay: `number`

### ✅ Debuggability
When something breaks, you can trace:
1. Which canonical chain?
2. Which provider ID was used?
3. What did the provider return?

---

## Registry Structure (Minimal for Phase 1.0)

```typescript
// lib/chains/registry.ts

export interface CanonicalChain {
  id: number;                    // Our stable internal ID
  name: string;                  // Display name
  type: 'EVM' | 'Solana' | 'Cosmos' | 'Sui' | 'TON' | 'Bitcoin';
  logoURI?: string;
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
  
  // Provider-specific chain identifiers
  providerIds: {
    lifi?: number | string;      // LiFi chain ID
    dexscreener?: string;         // DexScreener chain slug
    relay?: number;              // Relay chain ID
    squid?: string;              // Squid chain key (future)
  };
}

// Registry array (single source of truth)
export const CHAIN_REGISTRY: CanonicalChain[] = [
  {
    id: 1,
    name: 'Ethereum',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {
      lifi: 1,
      dexscreener: 'ethereum',
      relay: 1,
    },
  },
  {
    id: 56,
    name: 'BNB Chain',
    type: 'EVM',
    nativeCurrency: { symbol: 'BNB', decimals: 18 },
    providerIds: {
      lifi: 56,
      dexscreener: 'bsc',
      relay: 56,
    },
  },
  // ... more chains
];

// Lookup functions
export function getCanonicalChain(chainId: number): CanonicalChain | null {
  return CHAIN_REGISTRY.find(chain => chain.id === chainId) || null;
}

export function getCanonicalChainByProviderId(
  provider: 'lifi' | 'dexscreener' | 'relay',
  providerChainId: string | number
): CanonicalChain | null {
  return CHAIN_REGISTRY.find(chain => {
    const providerId = chain.providerIds[provider];
    if (providerId === null || providerId === undefined) return false;
    return String(providerId) === String(providerChainId);
  }) || null;
}

export function getCanonicalChains(): CanonicalChain[] {
  return CHAIN_REGISTRY;
}
```

---

## Special Cases Handled

### 1. Solana's Special LiFi ID
```typescript
{
  id: 7565164,
  name: 'Solana',
  providerIds: {
    lifi: 1151111081099710,  // LiFi's special Solana ID (not standard)
    dexscreener: 'solana',
    relay: 792703809,
  },
}
```

**Why:** LiFi uses a non-standard ID for Solana. Registry handles this explicitly.

### 2. Cosmos Chains (Future)
```typescript
{
  id: 2,
  name: 'Osmosis',
  type: 'Cosmos',
  metadata: {
    chainId: 'osmosis-1',  // Native Cosmos chain ID
  },
  providerIds: {
    squid: 'osmosis-1',  // Squid uses native chain ID
    // Other providers: null (don't support)
  },
}
```

**Why:** Cosmos chains have native chain IDs (strings). Registry stores both our numeric ID and native ID.

### 3. Provider Doesn't Support Chain
```typescript
{
  id: 2,
  name: 'Osmosis',
  providerIds: {
    lifi: null,        // LiFi doesn't support Osmosis
    dexscreener: null, // DexScreener doesn't support Osmosis
    relay: null,       // Relay doesn't support Osmosis
    squid: 'osmosis-1', // Only Squid supports it
  },
}
```

**Why:** Provider can check `if (chain.providerIds.lifi === null) return []` - no errors, just skip.

---

## Benefits Summary

1. **Single Source of Truth:** All chain identity in one place
2. **Explicit Mappings:** No magic, everything traceable
3. **Type Safe:** TypeScript ensures correctness
4. **Extensible:** Add providers/chains easily
5. **Maintainable:** Changes in one place affect entire system
6. **Debuggable:** Easy to trace chain identity issues

---

## Questions?

Does this explanation clarify the chain registry logic? 

Key points:
- **Canonical ID** = Our stable internal ID (never changes)
- **Provider IDs** = Explicit mappings to each provider's format
- **Lookup functions** = Convert between canonical and provider IDs
- **Single source of truth** = All chain identity in registry

Ready to implement once you confirm this makes sense!

