# Swap Quote Path Analysis: tiwi-test vs Current Implementation

## Executive Summary

The simulation is failing because **we're not preserving the exact swap path** from the router's quote response. In `tiwi-test`, the quote function returns the raw `path` array directly, which is then used for simulation. In our implementation, we're trying to reconstruct the path from `route.steps`, which may not match the exact path the router calculated.

## Key Finding: Path Extraction Issue

### Problem
When simulating a swap, we need the **exact path array** that the router used to calculate the quote. However, our current implementation:
1. Gets a quote from the router (which includes a `path` array)
2. Normalizes it to a `RouterRoute` with `steps`
3. Tries to extract the path back from `steps` for simulation
4. **This reconstructed path may not match the original router path**

### Root Cause
The `path` array from the router is the **source of truth** for simulation. We need to preserve it in the `RouterRoute` structure.

---

## Step-by-Step Comparison

### 1. Quote Fetching Flow

#### tiwi-test: `fetchQuote` in `SwapInterface.tsx` (lines 1073-1576)

**For PancakeSwap (BSC same-chain, lines 1309-1338):**
```typescript
// Direct call to getPancakeSwapV2Quote
const dexQuote = await getPancakeSwapV2Quote(
  fromToken.address as `0x${string}`,
  toToken.address as `0x${string}`,
  amountInSmallestUnit,
  fromChain
);

// Quote is stored directly
setPancakeSwapQuote(dexQuote);
setUsePancakeSwap(true);
```

**Quote Structure Returned (`PancakeSwapV2Quote`):**
```typescript
{
  amountOut: string,              // Output amount in smallest units
  path: Address[],                 // ✅ THE EXACT PATH ARRAY FROM ROUTER
  routerAddress: Address,          // Router contract address
  factoryAddress: Address,         // Factory contract address
  tokenIn: Address,                // Original input token (not WETH)
  tokenOut: Address,               // Original output token (not WETH)
  needsPairCreation: boolean,
  missingPairs?: Array<...>,
  priceImpact?: number,
  isFeeOnTransfer?: boolean,
  slippage?: number
}
```

**Key Point:** The `path` array is **directly accessible** from the quote object.

#### Current Implementation: Backend Route Service

**Flow:**
1. Frontend calls `/api/routes` endpoint
2. `RouteService.getRoutes()` orchestrates router selection
3. `PancakeSwapAdapter.getRoute()` fetches quote
4. Quote is normalized to `RouterRoute` format
5. `RouterRoute` is returned to frontend

**PancakeSwapAdapter.getRoute() (lines 101-229):**
```typescript
// Gets quote from router
const amounts = await publicClient.readContract({
  address: routerAddress,
  abi: ROUTER_ABI,
  functionName: 'getAmountsOut',
  args: [amountIn, path],  // path is built here
});

// Normalizes to RouterRoute
const normalizedRoute = this.normalizeRoute(
  fromChainId,
  toChainId,
  params.fromToken,
  params.toToken,
  params.fromAmount,
  amountOutString,
  fromDecimals,
  toDecimals,
  path,  // ✅ path is passed here
  priceImpact,
  params.slippage || 0.5,
  gasEstimate,
  gasUSD
);
```

**normalizeRoute() (lines 286-376):**
```typescript
// Build route steps from path
const steps: RouteStep[] = [];
for (let i = 0; i < path.length - 1; i++) {
  steps.push({
    type: 'swap',
    chainId: fromChainId,
    fromToken: {
      address: path[i],      // ✅ Path addresses are in steps
      amount: i === 0 ? fromAmountHuman : '0',
    },
    toToken: {
      address: path[i + 1],  // ✅ Path addresses are in steps
      amount: i === path.length - 2 ? toAmountHuman : '0',
    },
    // ...
  });
}

return {
  router: this.name,
  // ...
  steps,  // ✅ Path is embedded in steps
  // ❌ BUT: The raw path array is NOT stored directly!
};
```

**Problem:** The `path` array is converted to `steps`, but the **raw path array is not preserved** in the `RouterRoute`.

---

### 2. Path Extraction for Simulation

#### tiwi-test: `handleSwap` for PancakeSwap (lines 1983-2897)

**Path Usage (line 2212):**
```typescript
// Path is directly from quote object
const routerAddress = latestQuote.routerAddress;
const path = latestQuote.path;  // ✅ Direct access to path array

// Used for getAmountsOut verification (line 2221)
const amounts = await publicClient.readContract({
  address: routerAddress,
  abi: ROUTER_ABI,
  functionName: 'getAmountsOut',
  args: [BigInt(amountInSmallestUnit), path],  // ✅ Exact path from quote
});
```

**Simulation (line 2477):**
```typescript
let simulation = await simulateSwap(
  {
    path: latestQuote.path,  // ✅ Direct path from quote
    pairs: [],
    expectedOutput: actualAmountOut,
    priceImpact: pancakeSwapQuote.priceImpact || 0,
    liquidity: BigInt(0),
  },
  BigInt(amountInSmallestUnit),
  amountOutMin,
  fromChain,
  validWalletAddress as Address,
  publicClient,
  true
);
```

**Key Point:** The path used for simulation is **exactly the same** as the path used for the quote.

#### Current Implementation: EVM DEX Executor

**Path Extraction (evm-dex-executor.ts, lines 282-290):**
```typescript
protected extractPathFromRoute(route: RouterRoute): string[] | null {
  // Try to extract path from route steps
  if (route.steps && route.steps.length > 0) {
    const path: string[] = [];
    
    // Add from token
    path.push(route.fromToken.address);
    
    // Add intermediate tokens from steps
    route.steps.forEach((step) => {
      if ('toToken' in step && step.toToken.address) {
        if (!path.includes(step.toToken.address)) {
          path.push(step.toToken.address);
        }
      }
    });
    
    // Ensure to token is at the end
    if (!path.includes(route.toToken.address)) {
      path.push(route.toToken.address);
    });
    
    return path.length >= 2 ? path : null;
  }
  
  // Fallback: simple two-token path
  return [route.fromToken.address, route.toToken.address];
}
```

**Problem:**
1. This reconstruction may not match the exact path the router used
2. If steps are missing or incomplete, the path will be wrong
3. The order of tokens in steps may not match the router's path order
4. Multi-hop paths may be incorrectly reconstructed

**Simulation Usage (evm-dex-executor.ts, lines 440-450):**
```typescript
// Extract path from route steps
const path = this.extractPathFromRoute(route) || [
  route.fromToken.address,
  route.toToken.address,
];
const pathAddresses = path.map((addr) => getAddress(addr)) as readonly `0x${string}`[];

// ❌ This path may not match the router's original path!
```

---

### 3. Data Flow Comparison

#### tiwi-test Flow:
```
getPancakeSwapV2Quote()
  ↓
Returns: { path: Address[], routerAddress, amountOut, ... }
  ↓
Stored in: pancakeSwapQuote state
  ↓
handleSwap() uses: pancakeSwapQuote.path (direct access)
  ↓
simulateSwap() receives: { path: latestQuote.path }
  ↓
✅ Path is exact match to router's calculation
```

#### Current Implementation Flow:
```
PancakeSwapAdapter.getRoute()
  ↓
Builds path: [tokenA, tokenB] or [tokenA, WETH, tokenB]
  ↓
Gets quote from router using this path
  ↓
normalizeRoute() converts path to steps
  ↓
RouterRoute returned: { steps: [...], ... } (path NOT stored)
  ↓
Frontend receives RouterRoute
  ↓
extractPathFromRoute() tries to reconstruct path from steps
  ↓
❌ Reconstructed path may not match original router path
```

---

## The Solution

### Option 1: Store Raw Path in RouterRoute (Recommended)

**Good News:** `RouterRoute` already has a `raw?: any` field (line 89 in `types.ts`)!

We can use this field to store the raw router response, including the path. However, for easier access, we should also add a `rawPath` field:

```typescript
// In RouterRoute type (lib/backend/routers/types.ts)
interface RouterRoute {
  // ... existing fields
  rawPath?: Address[];  // ✅ Store the exact path from router (for easy access)
  routerAddress?: Address;  // ✅ Store router address (needed for simulation)
  factoryAddress?: Address;  // ✅ Store factory address (for pair validation)
  raw?: any;  // ✅ Already exists - store entire raw response here
}
```

**In PancakeSwapAdapter.normalizeRoute():**
```typescript
return {
  router: this.name,
  // ... existing fields
  steps,
  rawPath: path,  // ✅ Preserve the exact path
  rawRouterResponse: {
    path,
    routerAddress,
    factoryAddress,
    // ... other raw data
  },
};
```

**In EVM DEX Executor:**
```typescript
protected extractPathFromRoute(route: RouterRoute): string[] | null {
  // ✅ Use rawPath if available (exact match to router)
  if (route.rawPath && route.rawPath.length >= 2) {
    return route.rawPath.map(addr => addr.toLowerCase());
  }
  
  // Fallback to reconstruction from steps
  // ... existing logic
}
```

### Option 2: Return Raw Quote Response

Modify the backend to return both the normalized `RouterRoute` AND the raw quote response:

```typescript
// API response structure
{
  route: RouterRoute,  // Normalized route
  rawQuote: {
    path: Address[],
    routerAddress: Address,
    // ... other raw fields
  }
}
```

**Frontend Usage:**
```typescript
// Use rawQuote.path for simulation
const path = rawQuote.path;
```

---

## What We're Missing

### 1. Raw Path Preservation
- ❌ Current: Path is converted to steps, original path is lost
- ✅ Needed: Store the exact path array from router

### 2. Router Address in Route
- ❌ Current: Router address is not in RouterRoute
- ✅ Needed: Store router address for simulation

### 3. Factory Address
- ❌ Current: Factory address is not in RouterRoute
- ✅ Needed: May be needed for pair validation

### 4. Original Token Addresses
- ❌ Current: May be converted to WETH in steps
- ✅ Needed: Store original token addresses (before WETH conversion)

### 5. Raw Router Response
- ❌ Current: Only normalized data is returned
- ✅ Needed: Store entire raw response for debugging and future features

---

## Implementation Plan

### Phase 1: Update RouterRoute Type
1. Add `rawPath?: Address[]` to `RouterRoute`
2. Add `rawRouterResponse?: any` to `RouterRoute`
3. Add `routerAddress?: Address` to `RouterRoute`

### Phase 2: Update Adapters
1. Update `PancakeSwapAdapter.normalizeRoute()` to store `rawPath`
2. Update `UniswapAdapter.normalizeRoute()` to store `rawPath`
3. Store `routerAddress` and `factoryAddress` in route

### Phase 3: Update Executors
1. Update `extractPathFromRoute()` to use `rawPath` first
2. Fallback to step reconstruction only if `rawPath` is missing
3. Use `routerAddress` from route instead of hardcoded lookup

### Phase 4: Testing
1. Verify path matches between quote and simulation
2. Test multi-hop paths (e.g., TokenA → WETH → TokenB)
3. Test direct paths (TokenA → TokenB)
4. Verify simulation succeeds with correct path

---

## Questions to Answer

1. **Should we store the entire raw router response?**
   - Pros: Complete data preservation, future-proof
   - Cons: Larger payload size
   - **Recommendation:** Yes, store it in `rawRouterResponse`

2. **Should we modify the API response structure?**
   - Option A: Add fields to `RouterRoute` (backward compatible)
   - Option B: Return separate `rawQuote` object (breaking change)
   - **Recommendation:** Option A (add to RouterRoute)

3. **How do we handle backward compatibility?**
   - Make new fields optional
   - Fallback to step reconstruction if `rawPath` is missing
   - **Recommendation:** Both approaches (optional fields + fallback)

---

## Next Steps

1. **Review this analysis** - Confirm understanding of the issue
2. **Decide on approach** - Option 1 (store in RouterRoute) vs Option 2 (separate response)
3. **Update types** - Add `rawPath`, `routerAddress`, `rawRouterResponse` to `RouterRoute`
4. **Update adapters** - Preserve raw path in `normalizeRoute()`
5. **Update executors** - Use `rawPath` for simulation
6. **Test** - Verify simulation works with correct path

---

## References

- `tiwi-test/app/components/SwapInterface.tsx` (lines 1073-1576): Quote fetching
- `tiwi-test/app/components/SwapInterface.tsx` (lines 1983-2897): PancakeSwap swap execution
- `tiwi-test/app/utils/pancakeswapv2.ts` (lines 999-1515): `getPancakeSwapV2Quote` function
- `tiwi-test/app/utils/pancakeswap-router.ts` (lines 618-745): `simulateSwap` function
- `lib/backend/routers/adapters/pancakeswap-adapter.ts`: Current adapter implementation
- `lib/frontend/services/swap-executor/executors/evm-dex-executor.ts`: Current executor implementation

