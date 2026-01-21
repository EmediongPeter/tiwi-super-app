# Swap Execution Flow Guide

## Overview
This document explains the complete flow of fetching routes and executing swaps, with special focus on how **out amounts** are handled for Uniswap and PancakeSwap.

---

## 🔄 Complete Flow Diagram

```
Frontend (Swap Page)
    ↓
useSwapQuote Hook
    ↓
API: POST /api/v1/route
    ↓
RouteService.getRoute()
    ↓
Router Adapter (UniswapAdapter / PancakeSwapAdapter)
    ↓
Router API (getAmountsOut on-chain call)
    ↓
Normalize Route (store raw.amountOut)
    ↓
Return to Frontend
    ↓
User Clicks "Swap"
    ↓
useSwapExecution Hook
    ↓
SwapExecutor.execute()
    ↓
UniswapExecutor / PancakeSwapExecutor
    ↓
EVM DEX Executor (uses route.raw.amountOut)
    ↓
Execute Transaction
```

---

## 📊 Step-by-Step Process

### 1. **Frontend Request** (`app/swap/page.tsx` → `hooks/useSwapQuote.ts`)

**Location:** `hooks/useSwapQuote.ts:100`

```typescript
const routeResponse = await fetchRoute({
  fromToken: { chainId, address, decimals },
  toToken: { chainId, address, decimals },
  fromAmount: "100.5", // Human-readable
  slippage: 0.5,
  slippageMode: 'fixed',
  order: 'RECOMMENDED',
  liquidityUSD: 1000000
});
```

**What happens:**
- User enters amount in swap interface
- Hook debounces input (500ms delay)
- Sends POST request to `/api/v1/route`

---

### 2. **API Endpoint** (`app/api/v1/route/route.ts`)

**Location:** `app/api/v1/route/route.ts:143-200`

**What happens:**
- Validates request body
- Calls `RouteService.getRoute()`
- Returns route response to frontend

---

### 3. **Route Service** (`lib/backend/services/route-service.ts`)

**Location:** `lib/backend/services/route-service.ts:46`

**What happens:**
- Enriches token data (symbols, decimals, prices)
- Tries routers in priority order:
  1. LiFi (cross-chain)
  2. Jupiter (Solana)
  3. Uniswap (EVM)
  4. PancakeSwap (EVM)
- Selects best route based on output amount
- Returns normalized route

---

### 4. **Router Adapter - Uniswap** (`lib/backend/routers/adapters/uniswap-adapter.ts`)

**Location:** `lib/backend/routers/adapters/uniswap-adapter.ts:96-220`

#### 4.1. Route Finding (`findBestRoute`)

**Location:** `uniswap-adapter.ts:288-385`

**What happens:**
1. Builds multiple paths:
   - Direct: `[tokenIn, tokenOut]`
   - 2-hop: `[tokenIn, WETH, tokenOut]`
   - 3-hop: `[tokenIn, WETH, USDC, tokenOut]`
2. Calls `getAmountsOut` for each path:
   ```typescript
   const amounts = await publicClient.readContract({
     address: routerAddress,
     abi: ROUTER_ABI,
     functionName: 'getAmountsOut',
     args: [amountIn, path], // amountIn in smallest units (BigInt)
   }) as bigint[];
   ```
3. Returns best route with highest output:
   ```typescript
   {
     path: Address[],
     expectedOutput: bigint, // ✅ RAW OUTPUT FROM ROUTER
     priceImpact: number
   }
   ```

#### 4.2. Normalization (`normalizeRoute`)

**Location:** `uniswap-adapter.ts:403-490`

**Key Point - Out Amount Storage:**

```typescript
const normalizedRoute = this.normalizeRoute(
  fromChainId,
  toChainId,
  params.fromToken,
  params.toToken,
  params.fromAmount,        // Human-readable input
  amountOut.toString(),      // ✅ RAW OUTPUT (BigInt as string, smallest units)
  fromDecimals,
  toDecimals,
  path,
  priceImpact,
  slippage,
  gasEstimate,
  gasUSD,
  routerAddress,
  params.fromToken,          // Original tokenIn
  params.toToken             // Original tokenOut
);
```

**Inside `normalizeRoute`:**

```typescript
// Line 422-423: Convert to human-readable for display
const fromAmountHuman = toHumanReadable(fromAmount, fromDecimals);
const toAmountHuman = toHumanReadable(toAmount, toDecimals);

// Line 487: ✅ STORE RAW OUTPUT IN raw.amountOut (NO FORMATTING)
raw: {
  path: path.map(addr => addr.toLowerCase()),
  routerAddress: routerAddress.toLowerCase(),
  tokenIn: getAddress(originalTokenIn).toLowerCase(),
  tokenOut: getAddress(originalTokenOut).toLowerCase(),
  amountOut: toAmount, // ✅ EXACTLY WHAT ROUTER RETURNED (smallest units, as string)
}
```

**Important:** 
- `route.toToken.amount` = human-readable (for display)
- `route.raw.amountOut` = **EXACT raw output from router** (smallest units, as string)

---

### 5. **Router Adapter - PancakeSwap** (`lib/backend/routers/adapters/pancakeswap-adapter.ts`)

**Location:** `lib/backend/routers/adapters/pancakeswap-adapter.ts:101-232`

**Same process as Uniswap:**
1. `findBestRoute()` calls `getAmountsOut` on-chain
2. Gets `expectedOutput` as `bigint` (raw router output)
3. `normalizeRoute()` stores it in `raw.amountOut` **without formatting**

**Location:** `pancakeswap-adapter.ts:525`
```typescript
raw: {
  path: path.map(addr => addr.toLowerCase()),
  routerAddress: routerAddress.toLowerCase(),
  tokenIn: getAddress(originalTokenIn).toLowerCase(),
  tokenOut: getAddress(originalTokenOut).toLowerCase(),
  amountOut: toAmount, // ✅ EXACTLY WHAT ROUTER RETURNED
}
```

---

### 6. **Frontend Receives Route** (`hooks/useSwapQuote.ts`)

**Location:** `hooks/useSwapQuote.ts:120-196`

**What happens:**
- Route stored in Zustand store
- `route.toToken.amount` displayed to user (human-readable)
- `route.raw.amountOut` kept for execution (raw value)

---

### 7. **User Clicks "Swap"** (`app/swap/page.tsx`)

**Location:** `app/swap/page.tsx:319-393`

**What happens:**
- Validates route exists and hasn't expired
- Calls `executeSwap()` from `useSwapExecution` hook

---

### 8. **Swap Execution Hook** (`hooks/useSwapExecution.ts`)

**Location:** `hooks/useSwapExecution.ts:45-88`

**What happens:**
- Calls `swapExecutor.execute()` with route
- Provides status updates during execution

---

### 9. **Swap Executor** (`lib/frontend/services/swap-executor/index.ts`)

**Location:** `lib/frontend/services/swap-executor/index.ts:40-58`

**What happens:**
- Finds appropriate executor (UniswapExecutor, PancakeSwapExecutor, etc.)
- Validates quote expiration
- Calls executor's `execute()` method

---

### 10. **EVM DEX Executor** (`lib/frontend/services/swap-executor/executors/evm-dex-executor.ts`)

**Location:** `evm-dex-executor.ts:181-873`

#### 10.1. Get Fresh Quote (Optional Verification)

**Location:** `evm-dex-executor.ts:266-334`

**What happens:**
1. Calls `getAmountsOut` on-chain again (for verification):
   ```typescript
   const amounts = await publicClient.readContract({
     address: routerAddress,
     abi: ROUTER_ABI,
     functionName: 'getAmountsOut',
     args: [BigInt(amountInSmallestUnit), path],
   }) as bigint[];
   
   actualAmountOut = amounts[amounts.length - 1];
   ```

2. **If on-chain call succeeds:** Uses fresh quote
3. **If on-chain call fails:** Falls back to `route.raw.amountOut`:

   **Location:** `evm-dex-executor.ts:320-324`
   ```typescript
   if (route.raw?.amountOut && route.raw.amountOut !== '0') {
     // ✅ USE EXACT RAW OUTPUT FROM BACKEND (NO FORMATTING)
     actualAmountOut = BigInt(route.raw.amountOut);
     console.log('[EVM DEX] Using route.raw.amountOut as fallback (from backend getAmountsOut):', actualAmountOut.toString());
   }
   ```

**Key Point:** `route.raw.amountOut` is used **exactly as-is** - it's the raw string from the router's `getAmountsOut` call, converted to `BigInt` for execution.

#### 10.2. Calculate Minimum Amount Out (with Slippage)

**Location:** `evm-dex-executor.ts:399-420`

```typescript
const slippageMultiplier = BigInt(Math.floor((100 - slippagePercent) * 100));
const amountOutMin = (actualAmountOut * slippageMultiplier) / BigInt(10000);
```

**What happens:**
- Uses `actualAmountOut` (from `route.raw.amountOut` or fresh quote)
- Applies slippage tolerance
- Calculates minimum acceptable output

#### 10.3. Build Swap Transaction

**Location:** `lib/frontend/services/swap-executor/executors/uniswap-executor.ts:151-240`

**What happens:**
- Uses `route.raw.path` (exact path from router)
- Uses `route.raw.tokenIn` / `route.raw.tokenOut` (original addresses)
- Calls appropriate swap function:
  - `swapExactTokensForTokens` (ERC20 → ERC20)
  - `swapExactETHForTokens` (Native → ERC20)
  - `swapExactTokensForETH` (ERC20 → Native)
  - `swapExactETHForETH` (Native → Native)

**Transaction Parameters:**
```typescript
{
  amountIn: BigInt(amountInSmallestUnit),
  amountOutMin: amountOutMin, // ✅ Calculated from route.raw.amountOut
  path: route.raw.path,        // ✅ Exact path from router
  to: recipientAddress,
  deadline: deadline
}
```

---

## ✅ Key Confirmation: Out Amount Handling

### For Uniswap and PancakeSwap:

1. **Backend (`getRoute`):**
   - Calls router's `getAmountsOut` → Returns `bigint` (smallest units)
   - Stores in `route.raw.amountOut` as **string** (no formatting)
   - Example: `"1500000000000000000"` (1.5 tokens with 18 decimals)

2. **Frontend Receives:**
   - `route.raw.amountOut` = `"1500000000000000000"` (raw string)
   - `route.toToken.amount` = `"1.5"` (human-readable, for display only)

3. **Execution:**
   - Uses `route.raw.amountOut` **exactly as-is**
   - Converts to `BigInt(route.raw.amountOut)` for calculations
   - **NO FORMATTING** - uses exact value from router

### Verification:

**Uniswap Adapter:**
- Line 158: `amountOut = bestRoute.expectedOutput` (from `getAmountsOut`)
- Line 195: `amountOut.toString()` passed to `normalizeRoute`
- Line 487: `amountOut: toAmount` stored in `raw.amountOut` (raw string)

**PancakeSwap Adapter:**
- Line 158: `amountOut = bestRoute.expectedOutput` (from `getAmountsOut`)
- Line 433: `amountOut.toString()` passed to `normalizeRoute`
- Line 525: `amountOut: toAmount` stored in `raw.amountOut` (raw string)

**EVM DEX Executor:**
- Line 320-324: Uses `BigInt(route.raw.amountOut)` directly (no conversion/formatting)

---

## 🔍 Summary

### Out Amount Flow:

```
Router's getAmountsOut()
    ↓
Returns: bigint (e.g., 1500000000000000000n)
    ↓
normalizeRoute() stores: "1500000000000000000" (as string)
    ↓
route.raw.amountOut = "1500000000000000000" ✅ EXACT VALUE
    ↓
Frontend receives route
    ↓
Execution uses: BigInt(route.raw.amountOut) ✅ NO FORMATTING
    ↓
Calculate slippage: amountOutMin = actualAmountOut * (100 - slippage) / 100
    ↓
Send to router contract
```

### Important Points:

1. ✅ **We send EXACTLY what Uniswap/PancakeSwap returns** - no formatting
2. ✅ `route.raw.amountOut` is the raw output in smallest units (as string)
3. ✅ During execution, we convert to `BigInt` and use directly
4. ✅ Only `route.toToken.amount` is formatted for display (human-readable)
5. ✅ The execution uses the raw value for all calculations

---

## 📝 Files Reference

- **Route Fetching:**
  - `app/api/v1/route/route.ts` - API endpoint
  - `lib/backend/services/route-service.ts` - Route service
  - `lib/backend/routers/adapters/uniswap-adapter.ts` - Uniswap adapter
  - `lib/backend/routers/adapters/pancakeswap-adapter.ts` - PancakeSwap adapter

- **Swap Execution:**
  - `app/swap/page.tsx` - Swap page UI
  - `hooks/useSwapExecution.ts` - Execution hook
  - `lib/frontend/services/swap-executor/index.ts` - Executor service
  - `lib/frontend/services/swap-executor/executors/evm-dex-executor.ts` - EVM executor
  - `lib/frontend/services/swap-executor/executors/uniswap-executor.ts` - Uniswap executor

---

## 🎯 Conclusion

**The out amount from Uniswap and PancakeSwap is sent to the frontend EXACTLY as returned by the router's `getAmountsOut` function - no formatting, no conversion, just the raw value in smallest units stored as a string in `route.raw.amountOut`.**

