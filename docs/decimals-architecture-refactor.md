# Decimals Architecture Refactor Plan

## Problem Statement

Currently, we're making redundant blockchain contract calls to fetch token decimals:
- TokenService enriches decimals from blockchain ✅
- RouteService fetches decimals again ❌
- PancakeSwap adapter fetches decimals again ❌
- Uniswap adapter fetches decimals again ❌

This is inefficient and slows down route fetching.

## Solution: Single Source of Truth

### Principle
**Fetch decimals once in TokenService, pass them down everywhere else.**

### Flow

```
1. TokenService → Fetches decimals from blockchain (once)
   ↓
2. Frontend → Receives tokens with decimals (required field)
   ↓
3. Frontend → Sends decimals in RouteRequest (always included)
   ↓
4. RouteService → Uses provided decimals (no contract call)
   ↓
5. RouterParams → Contains fromDecimals & toDecimals
   ↓
6. Adapters → Use provided decimals (no contract call)
```

## Implementation Steps

### Step 1: Make Decimals Required in Token Types

**File**: `lib/backend/types/backend-tokens.ts`
- Change `decimals: number` (already required) ✅
- Ensure frontend types also require decimals

**File**: `lib/frontend/types/tokens.ts`
- Verify `decimals: number` is required (not optional)

### Step 2: Update RouteRequest to Always Include Decimals

**File**: `lib/backend/routers/types.ts`
- Change `decimals?: number` to `decimals: number` in `RouteRequest.fromToken` and `RouteRequest.toToken`
- Make it required, not optional

### Step 3: Update RouteService to Use Provided Decimals

**File**: `lib/backend/services/route-service.ts`
- In `getRouteWithFixedSlippage()`:
  - First check if `request.fromToken.decimals` and `request.toToken.decimals` are provided
  - Only fetch from blockchain if missing (fallback for edge cases)
  - Pass decimals to `transformParams()`

### Step 4: Update transformParams to Pass Decimals

**File**: `lib/backend/services/route-service.ts`
- `transformParams()` already receives `fromDecimals` and `toDecimals`
- Ensure they're passed to `RouterParams.fromDecimals` and `RouterParams.toDecimals`

### Step 5: Update Adapters to Use Provided Decimals

**File**: `lib/backend/routers/adapters/pancakeswap-adapter.ts`
- Remove contract call for decimals
- Use `params.fromDecimals` and `params.toDecimals` directly

**File**: `lib/backend/routers/adapters/uniswap-adapter.ts`
- Remove contract call for decimals
- Use `params.fromDecimals` and `params.toDecimals` directly

### Step 6: Update Frontend to Always Send Decimals

**File**: `hooks/useSwapQuote.ts`
- Ensure `fromToken.decimals` and `toToken.decimals` are always included in RouteRequest
- These come from token data (already have decimals)

**File**: `app/api/v1/route/route.ts`
- Validate that decimals are provided in request
- Return 400 error if missing (shouldn't happen if frontend sends them)

### Step 7: Keep Fallback for Edge Cases

**File**: `lib/backend/services/route-service.ts`
- Keep `getTokenDecimals()` method as fallback
- Only use if decimals not provided in request (edge case: direct API calls)

## Benefits

1. **Performance**: No redundant contract calls
2. **Speed**: Route fetching is faster (no waiting for contract calls)
3. **Consistency**: Same decimals used everywhere
4. **Simplicity**: Single source of truth
5. **Caching**: Decimals cached at token level (24h), not route level

## Edge Cases

1. **Direct API calls without frontend**: Fallback to contract call
2. **Missing decimals in request**: Validate and return error (shouldn't happen)
3. **Invalid decimals**: Validate range (0-18)

## Testing

1. Test route fetching with decimals provided
2. Test route fetching without decimals (fallback)
3. Test with TWC token (non-18 decimals)
4. Verify no redundant contract calls in logs

