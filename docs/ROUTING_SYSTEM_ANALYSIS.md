# Routing System Analysis

**Date:** 2024  
**Phase:** Swap Route & Quote System - Step 1  
**Status:** Analysis Complete

---

## Executive Summary

This document analyzes the current state of swap routing and quote systems, identifies requirements for a backend-driven multi-router architecture, and outlines the transformation challenges between different router formats.

---

## Current State Analysis

### Frontend Current Implementation

**Location:** `hooks/useSwapQuote.ts`, `lib/frontend/calculations/swap.ts`

**Current Behavior:**
- Uses dummy calculation: `calculateSwapQuote(amount, rate = 1.5e-6)`
- No real API calls
- No router selection
- No cross-chain support
- Fixed exchange rate

**Frontend State:**
- `fromToken: Token | null` - Frontend token type
- `toToken: Token | null` - Frontend token type
- `fromAmount: string` - User input
- `toAmount: string` - Calculated (dummy)
- `isQuoteLoading: boolean` - Loading state
- `quoteError: Error | null` - Error state

**What Frontend Should Send:**
```typescript
{
  fromToken: {
    id: string;           // e.g., "1-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    chainId: number;      // Canonical chain ID: 1
    address: string;      // Token address
    symbol: string;       // "USDC"
  },
  toToken: {
    id: string;
    chainId: number;
    address: string;
    symbol: string;
  },
  fromAmount: string;     // User input: "100.5"
  slippage?: number;      // Optional: 0.5 (0.5%)
  recipient?: string;     // Optional: user wallet address
}
```

---

## Router Requirements Analysis

### 1. LiFi Advanced Routes

**SDK:** `@lifi/sdk`

**Required Parameters:**
```typescript
{
  fromChain: number;        // LiFi chain ID (e.g., 1 for Ethereum)
  fromToken: string;        // Token address (e.g., "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
  fromAmount: string;       // Amount in wei/smallest unit (e.g., "100000000")
  toChain: number;          // LiFi chain ID
  toToken: string;          // Token address
  toAddress?: string;       // Recipient address
  order?: 'RECOMMENDED' | 'FASTEST' | 'CHEAPEST';
  slippage?: number;        // Slippage tolerance (0-100)
}
```

**Key Differences:**
- Uses LiFi-specific chain IDs (may differ from canonical)
- Requires amounts in smallest unit (wei, lamports, etc.)
- Supports cross-chain routing
- Returns `RouteExtended` with steps, fees, gas estimates

**Example from Reference:**
```typescript
const quoteResult = await getQuote({
  fromChain: 1,              // LiFi chain ID
  fromToken: "0xa0b8...",    // Token address
  fromAmount: "100000000",    // Amount in wei
  toChain: 137,              // LiFi chain ID
  toToken: "0x2791...",      // Token address
  order: 'RECOMMENDED',
  slippage: 0.5,
});
```

---

### 2. Squid Router

**API:** REST API (`@/app/lib/squid/api`)

**Required Parameters:**
```typescript
{
  fromAddress: string;       // User wallet address
  fromChain: string;         // Squid chain identifier (e.g., "ethereum", "56", "solana-mainnet-beta")
  fromToken: string;         // Token address or identifier
  fromAmount: string;        // Amount in smallest unit
  toChain: string;          // Squid chain identifier
  toToken: string;          // Token address or identifier
  toAddress: string;        // Recipient address
  slippage?: number;         // Slippage tolerance
}
```

**Key Differences:**
- Uses string-based chain identifiers (not numeric). Somehow. But for EVM chains, it recognizes their numeric chainid value. for example 1 is recognized also by squid as ethereum, 56==BSC. But for non evm chains including that of cosmos, they recognize, their string based chain id
- Requires both `fromAddress` and `toAddress`. And for most cases `fromAddress` can be a default address I found from squid. So even when a user doesn't connect their wallet, fetch is done successfully. Perform a search to find that address it starts with osmo..qqqq.....q
- Supports Cosmos chains (uses chain names like "osmosis-1")
- Different parameter naming (`fromChain` vs `chainId`)

**Example from Reference:**
```typescript
const { route, requestId } = await getSquidRoute({
  fromAddress: "0x123...",
  fromChain: "1",  // ethereum is 1 like i said above    // String identifier
  fromToken: "0xa0b8...",
  fromAmount: "100000000",
  toChain: "56",              // BSC as string
  toToken: "0x55d3...",
  toAddress: "0x123...",
});
```

---

### 3. Jupiter (Solana)

**API:** REST API (`https://api.jup.ag`)

**Required Parameters:**
```typescript
{
  inputMint: string;         // Solana token mint address
  outputMint: string;        // Solana token mint address
  amount: number;            // Amount in smallest unit (lamports)
  slippageBps?: number;      // Slippage in basis points (e.g., 50 = 0.5%)
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
}
```

**Key Differences:**
- Solana-specific (uses mint addresses, not EVM addresses)
- Amount as number (not string)
- Slippage in basis points (not percentage)
- Only supports same-chain Solana swaps
- Requires Solana-specific token account handling

**Example from Reference:**
```typescript
const quote = await fetch(
  `${JUPITER_QUOTE_API_BASE}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`
);
```

---

### 4. Uniswap / PancakeSwap (EVM DEXs)

**API:** Direct contract calls or subgraph

**Required Parameters:**
```typescript
{
  chainId: number;           // EVM chain ID (1, 56, 137, etc.)
  tokenIn: string;           // Token address
  tokenOut: string;          // Token address
  amountIn: string;          // Amount in wei
  recipient?: string;        // Recipient address
  slippage?: number;         // Slippage tolerance
}
```

**Key Differences:**
- EVM-only (no cross-chain)
- Direct DEX interaction
- Requires on-chain contract calls
- Different fee structures per DEX

---

## Transformation Requirements

### Parameter Normalization

**Challenge:** Each router requires different parameter formats.

**Transformation Points:**

1. **Chain ID Mapping**
   - Frontend sends: Canonical chain ID (e.g., `1`)
   - LiFi needs: LiFi chain ID (may be same, but must verify)
   - Squid needs: String identifier (e.g., `"ethereum"`, `"56"`)
   - Jupiter: Only Solana (chain ID `7565164`)

2. **Token Address Format**
   - Frontend sends: Token address (e.g., `"0xa0b8..."`)
   - LiFi needs: Same format
   - Squid needs: Same format (but may need Cosmos-style identifiers)
   - Jupiter: Solana mint address (different format). That's why we may need Jupiter's token list fetch logic applied also 

3. **Amount Format**
   - Frontend sends: Human-readable string (e.g., `"100.5"`)
   - All routers need: Smallest unit (wei, lamports, etc.)
   - Transformation: `amount * 10^decimals`

4. **Address Requirements**
   - Frontend may not send recipient initially
   - Squid requires both `fromAddress` and `toAddress`
   - LiFi optional `toAddress`
   - Jupiter: Solana wallet address format

---

## Failure Cases

### 1. Unsupported Token Pairs

**Scenario:** Router doesn't support the token pair
- **LiFi:** May not have liquidity for exotic pairs
- **Squid:** May not support certain Cosmos tokens
- **Jupiter:** Only Solana tokens
- **DEXs:** Only tokens on that specific chain

**Handling:**
- Try primary router first
- Fallback to secondary router
- Return clear error if no router supports pair

### 2. Unsupported Chains

**Scenario:** Router doesn't support the chain
- **LiFi:** Supports EVM + Solana, limited Cosmos
- **Squid:** Supports EVM + Solana + Cosmos
- **Jupiter:** Only Solana
- **DEXs:** Chain-specific
- And other chains like Sui, Aptos, Solana, Sei, TON

**Handling:**
- Check router capabilities before attempting
- Skip unsupported routers
- Return error if no router supports chain combination

### 3. Partial Route Availability

**Scenario:** Router supports chain but not the specific route
- **Example:** LiFi supports Ethereum → Polygon, but not for specific token pair
- **Example:** Squid supports Cosmos chains, but not all token pairs

**Handling:**
- Try route request
- Catch "no route found" errors
- Fallback to next router
- Aggregate all failures before returning error

### 4. Network/API Failures

**Scenario:** Router API is down or rate-limited
- **Handling:**
  - Timeout handling (e.g., 10s timeout)
  - Retry logic (max 1 retry)
  - Graceful degradation to next router
  - Return partial results if some routers succeed

### 5. Amount Too Small/Large

**Scenario:** Amount below minimum or above maximum
- **Handling:**
  - Validate amount before router calls
  - Return clear error message
  - Suggest minimum/maximum amounts

---

## Data Flow Requirements

### Request Flow

```
Frontend Request
    ↓
/api/v1/route (Backend)
    ↓
Route Service (Normalize parameters)
    ↓
Router Adapter (Transform to router format)
    ↓
Router API (LiFi, Squid, Jupiter, etc.)
    ↓
Router Adapter (Normalize response)
    ↓
Route Service (Select best route)
    ↓
/api/v1/route Response
    ↓
Frontend (Display quote)
```

### Response Format (Unified)

```typescript
{
  route: {
    id: string;                    // Unique route identifier
    provider: 'lifi' | 'squid' | 'jupiter' | 'uniswap' | 'pancakeswap';
    
    // Token information
    fromToken: {
      chainId: number;             // Canonical chain ID
      address: string;
      symbol: string;
      amount: string;              // Input amount
    };
    toToken: {
      chainId: number;
      address: string;
      symbol: string;
      amount: string;              // Output amount (estimated)
    };
    
    // Quote information
    exchangeRate: string;          // e.g., "1.5" (1 USDC = 1.5 USDT)
    priceImpact: string;           // e.g., "0.5" (0.5%)
    slippage: string;              // e.g., "0.5" (0.5%)
    
    // Cost information
    fees: {
      protocol: string;            // Protocol fee in USD
      gas: string;                 // Gas estimate in native token
      gasUSD: string;              // Gas estimate in USD
      total: string;               // Total fees in USD
    };
    
    // Route details
    steps: Array<{
      type: 'swap' | 'bridge' | 'wrap' | 'unwrap';
      chainId: number;
      fromToken: { address: string; amount: string; };
      toToken: { address: string; amount: string; };
      protocol?: string;           // e.g., "Uniswap V3", "Stargate"
    }>;
    
    // Execution metadata
    estimatedTime: number;          // Estimated time in seconds
    transactionData?: string;      // Encoded transaction (if available)
  };
  
  alternatives?: Array<Route>;     // Alternative routes (if available)
  
  // Metadata
  timestamp: number;               // Quote timestamp
  expiresAt: number;               // Quote expiration timestamp
}
```

---

## Architecture Insights from Reference

### What Worked in Reference Implementation

1. **Router Selection Logic**
   - Clear decision tree based on chain types
   - Fallback mechanism (LiFi → Squid)
   - Chain-specific routing (Jupiter for Solana)

2. **Error Handling**
   - Try primary router first
   - Catch specific errors (no route, unsupported)
   - Fallback to secondary router

3. **Parameter Transformation**
   - Chain ID mapping (canonical → provider-specific)
   - Amount conversion (human-readable → smallest unit)

### What Caused Complexity

1. **Frontend Router Selection**
   - Frontend decided which router to use
   - Multiple code paths in components
   - Hard to maintain and test

2. **Mixed Concerns**
   - Router logic mixed with UI logic
   - Hard to reuse for mobile
   - Difficult to add new routers

3. **Inconsistent Error Handling**
   - Different error formats per router
   - Inconsistent fallback logic
   - Hard to debug

4. **Parameter Duplication**
   - Same parameters transformed multiple times
   - Inconsistent parameter formats
   - Hard to maintain

---

## Key Design Constraints

1. **Backend Owns Routing Decisions**
   - Frontend should not know which router is used
   - Backend decides router selection and fallback
   - Frontend only sends swap intent

2. **One Request Format**
   - Frontend sends canonical format
   - Backend transforms to router-specific formats
   - Backend normalizes responses

3. **Explicit Transformations**
   - No implicit magic
   - Clear transformation functions
   - Documented parameter mappings

4. **Extensibility**
   - Easy to add new routers
   - Router registration system
   - Plugin-like architecture

---

## Next Steps

1. **Design Routing Architecture** (Step 2)
   - Unified request model
   - Router abstraction layer
   - Parameter transformation strategy
   - Route scoring/selection

2. **Wait for Approval**
   - Review architecture proposal
   - Get feedback
   - Refine design

3. **Implement Incrementally**
   - Start with `/api/v1/route` endpoint
   - Implement LiFi router first
   - Add fallback framework
   - Replace frontend dummy logic

---

## Questions to Resolve

1. **Slippage Default:** What should the default slippage be? (0.5%?)
2. **Quote Expiration:** How long should quotes be valid? (30s? 60s?)
3. **Alternative Routes:** Should we return multiple routes or just the best?
4. **Recipient Address:** Should frontend always send recipient, or can it be optional?
5. **Error Format:** Should errors be router-specific or normalized?

---

## Conclusion

The routing system requires:
- **Normalization layer** for parameters
- **Router abstraction** for extensibility
- **Fallback mechanism** for reliability
- **Unified response format** for frontend simplicity

The architecture must be backend-driven, with clear separation between routing logic and UI logic.

