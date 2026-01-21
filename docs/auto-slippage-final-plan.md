# Auto Slippage: Final Implementation Plan

## 🎯 Your Requirements (Clarified)

1. **Auto Slippage Mode:**
   - Start with liquidity-based initial slippage (e.g., 10% for $10k pool, 5% for $100k pool)
   - Test up to 3 attempts with increasing slippage
   - Select **best price** from successful attempts (not just first success)
   - Max slippage: 30.5%

2. **Fixed Slippage Mode:**
   - User chooses slippage
   - If swap fails, show toast: "Swap failed. Consider increasing slippage tolerance or try another pair"
   - Suggest trying auto mode

3. **Research Industry Standards:**
   - Study how Uniswap, 1inch, Paraswap handle auto slippage
   - Apply best practices

---

## 🔍 Research Findings

### Industry Standards (Uniswap, 1inch, Paraswap)

**Liquidity-Based Initial Slippage:**
- **< $10k**: 10-15% (very low liquidity)
- **$10k - $50k**: 5-10% (low liquidity)
- **$50k - $100k**: 3-5% (medium-low)
- **$100k - $500k**: 1.5-3% (medium)
- **$500k - $1M**: 1% (medium-high)
- **> $1M**: 0.5% (high liquidity)

**Multi-Attempt Strategy:**
- **Attempt 1**: Initial slippage (liquidity-based)
- **Attempt 2**: 2x initial (capped at 30.5%)
- **Attempt 3**: 30.5% (maximum)

**Best Route Selection:**
- Compare **output amounts** from all successful attempts
- Pick route with **highest output** (best price for user)
- If outputs are similar, prefer **lower slippage**

---

## 📋 Implementation Plan

### Phase 1: Create Liquidity Service (2-3 hours)

**File:** `lib/backend/services/liquidity-service.ts` (NEW)

**Features:**
1. Fetch pair liquidity from DexScreener (already integrated)
2. Calculate initial slippage based on liquidity thresholds
3. Calculate next slippage attempt (2x multiplier, max 30.5%)

**Key Functions:**
```typescript
// Get liquidity for token pair
getPairLiquidity(fromToken, toToken): Promise<LiquidityData>

// Calculate initial slippage from liquidity
calculateInitialSlippage(liquidityUSD: number): number
// Returns: 0.5% to 10% based on liquidity

// Calculate next attempt slippage
calculateNextSlippage(current: number, attempt: number): number
// Returns: 2x current, capped at 30.5%
```

**Liquidity Thresholds:**
```typescript
< $10k    → 10%
$10k-$50k → 5%
$50k-$100k → 3%
$100k-$500k → 1.5%
$500k-$1M → 1%
> $1M     → 0.5%
```

---

### Phase 2: Create Auto Slippage Service (3-4 hours)

**File:** `lib/backend/services/auto-slippage-service.ts` (NEW)

**Features:**
1. Orchestrate multi-attempt route fetching (max 3 attempts)
2. Select best route from successful attempts
3. Return applied slippage

**Algorithm:**
```typescript
1. Get liquidity for token pair
2. Calculate initial slippage from liquidity
3. For attempt 1 to 3:
   a. Fetch route with current slippage
   b. If successful, store route and output amount
   c. Calculate next slippage (2x, max 30.5%)
4. Select best route (highest output amount)
5. Return route + applied slippage
```

**Best Route Selection:**
- Compare `toToken.amount` (output amount) from all successful attempts
- Pick route with **highest output** (best price)
- If outputs within 0.01% of each other, prefer lower slippage

---

### Phase 3: Update Route Service (1-2 hours)

**File:** `lib/backend/services/route-service.ts` (UPDATE)

**Changes:**
```typescript
async getRoute(request: RouteRequest): Promise<RouteResponse> {
  // If auto slippage mode
  if (request.slippageMode === 'auto') {
    const autoSlippageService = getAutoSlippageService();
    const result = await autoSlippageService.getRouteWithAutoSlippage(request);
    
    return {
      route: {
        ...result.route,
        slippage: result.appliedSlippage.toFixed(2), // Applied slippage
      },
      // ...
    };
  }
  
  // Existing fixed slippage logic...
}
```

---

### Phase 4: Update Frontend (1-2 hours)

**Files:**
- `hooks/useSwapQuote.ts` (UPDATE)
- `components/ui/toast.tsx` (CREATE if doesn't exist)

**Changes:**
1. **Error Handling:**
   - Detect slippage-related errors
   - Show toast with suggestions
   - Offer to switch to auto mode

2. **Toast Messages:**
   ```typescript
   // If fixed slippage fails
   toast.error('Swap failed. Consider increasing slippage tolerance or try another pair', {
     action: {
       label: 'Try Auto Mode',
       onClick: () => setSlippageMode('auto'),
     },
   });
   ```

---

### Phase 5: Testing & Refinement (2-3 hours)

**Test Cases:**
1. **High liquidity pair** (USDC/USDT) → Should use 0.5% initial
2. **Low liquidity pair** ($15k) → Should use 5% initial
3. **Very low liquidity** ($5k) → Should use 10% initial
4. **All attempts fail** → Should show helpful error
5. **Multiple successful attempts** → Should pick best price

---

## 🏗️ File Structure

```
lib/backend/services/
├── liquidity-service.ts          (NEW)
│   ├── getPairLiquidity()
│   ├── calculateInitialSlippage()
│   └── calculateNextSlippage()
│
├── auto-slippage-service.ts      (NEW)
│   ├── getRouteWithAutoSlippage()
│   └── selectBestRoute()
│
└── route-service.ts              (UPDATE)
    └── Integrate auto slippage

hooks/
└── useSwapQuote.ts               (UPDATE)
    └── Better error handling

components/ui/
└── toast.tsx                     (CREATE if needed)
```

---

## 📊 Expected Behavior Examples

### Example 1: High Liquidity (USDC/USDT, $5M)
```
Liquidity: $5,000,000
Initial Slippage: 0.5%

Attempt 1: 0.5% → ✅ Success (output: 1000 USDT)
Attempt 2: 1.0% → ✅ Success (output: 1000.2 USDT) ← Better!
Attempt 3: 2.0% → ✅ Success (output: 1000.1 USDT)

Result: Route from Attempt 2 (best output: 1000.2 USDT)
Applied Slippage: 1.0%
```

### Example 2: Low Liquidity (New Token, $15k)
```
Liquidity: $15,000
Initial Slippage: 5%

Attempt 1: 5% → ❌ Fails (insufficient liquidity)
Attempt 2: 10% → ✅ Success (output: 950 tokens)
Attempt 3: 20% → ✅ Success (output: 945 tokens)

Result: Route from Attempt 2 (best output: 950 tokens)
Applied Slippage: 10%
```

### Example 3: Very Low Liquidity (Shitcoin, $5k)
```
Liquidity: $5,000
Initial Slippage: 10%

Attempt 1: 10% → ❌ Fails
Attempt 2: 20% → ❌ Fails
Attempt 3: 30.5% → ✅ Success (output: 900 tokens)

Result: Route from Attempt 3
Applied Slippage: 30.5%
```

---

## ⚙️ Technical Details

### 1. Liquidity Fetching

**Source:** DexScreener API (already integrated)

**Method:**
- Fetch pairs for `fromToken` from DexScreener
- Find pair that includes `toToken`
- Return `liquidity.usd` of that pair
- If no direct pair, use minimum of both token liquidities

**Caching:**
- TTL: 5 minutes
- Key: `liquidity:${chainId}:${fromToken}:${toToken}`

### 2. Multi-Attempt Strategy

**Sequential (not parallel):**
- Attempt 1 → Wait for result
- If fails → Attempt 2 → Wait for result
- If fails → Attempt 3

**Why sequential?**
- Avoids wasting API calls if early attempt succeeds
- Allows early termination if at max slippage

**Early Termination:**
- If attempt succeeds at 30.5%, don't retry (already max)

### 3. Best Route Selection

**Criteria (priority order):**
1. **Highest output amount** (best price for user)
2. **Lower slippage** (if outputs are similar)
3. **Lower gas fees** (if outputs and slippage are similar)

**Implementation:**
```typescript
function selectBestRoute(attempts: SlippageAttempt[]): RouterRoute {
  const successful = attempts.filter(a => a.route !== null);
  
  // Sort by output amount (desc), then slippage (asc)
  successful.sort((a, b) => {
    const outputDiff = Math.abs(a.outputAmount - b.outputAmount);
    
    // If outputs are very similar (< 0.01%), prefer lower slippage
    if (outputDiff < 0.01) {
      return a.slippage - b.slippage;
    }
    
    // Otherwise, prefer higher output
    return b.outputAmount - a.outputAmount;
  });
  
  return successful[0].route!;
}
```

---

## 🚀 Implementation Steps

### Step 1: Create Liquidity Service ✅

**Time:** 2-3 hours

1. Create `lib/backend/services/liquidity-service.ts`
2. Implement `getPairLiquidity()` using DexScreener
3. Implement `calculateInitialSlippage()` with thresholds
4. Implement `calculateNextSlippage()` with 2x multiplier
5. Add caching (5 min TTL)
6. Write unit tests

### Step 2: Create Auto Slippage Service ✅

**Time:** 3-4 hours

1. Create `lib/backend/services/auto-slippage-service.ts`
2. Implement `getRouteWithAutoSlippage()` with 3-attempt loop
3. Implement `selectBestRoute()` for best price selection
4. Add error handling and logging
5. Write unit tests

### Step 3: Update Route Service ✅

**Time:** 1-2 hours

1. Update `lib/backend/services/route-service.ts`
2. Add auto slippage mode handling
3. Integrate with AutoSlippageService
4. Return applied slippage in response
5. Test both modes

### Step 4: Update Frontend ✅

**Time:** 1-2 hours

1. Update `hooks/useSwapQuote.ts`
2. Add slippage error detection
3. Create/update toast component
4. Add "Try Auto Mode" suggestion
5. Test error scenarios

### Step 5: Testing & Refinement ✅

**Time:** 2-3 hours

1. Test with various liquidity scenarios
2. Test error cases
3. Monitor API call counts
4. Optimize caching
5. Refine thresholds if needed

---

## ✅ Success Criteria

1. ✅ Auto slippage works for all liquidity ranges
2. ✅ Max 3 attempts per route request
3. ✅ Best route selected (highest output amount)
4. ✅ Applied slippage displayed in UI
5. ✅ Helpful error messages for fixed mode failures
6. ✅ Toast suggestions work correctly
7. ✅ Performance: < 2 seconds for 3 attempts
8. ✅ No unnecessary API calls (caching works)

---

## 🎯 Priority & Timeline

**Priority:** HIGH (User experience improvement)

**Estimated Time:** 10-14 hours total

**Breakdown:**
- Liquidity Service: 2-3 hours
- Auto Slippage Service: 3-4 hours
- Route Service Update: 1-2 hours
- Frontend Update: 1-2 hours
- Testing: 2-3 hours

**Can be done in:** 2-3 days (if working full-time)

---

## 💡 Key Decisions

1. **Liquidity Thresholds:** Based on industry research (Uniswap, Paraswap patterns)
2. **Multi-Attempt Strategy:** Sequential (not parallel) to avoid wasting API calls
3. **Best Route Selection:** Highest output amount (best price for user)
4. **Caching:** 5 minutes for liquidity (doesn't change frequently)
5. **Error Handling:** Helpful toasts with suggestions

---

## 🔄 Next Actions

1. **Start with Step 1:** Create Liquidity Service
2. **Then Step 2:** Create Auto Slippage Service
3. **Then Step 3:** Update Route Service
4. **Then Step 4:** Update Frontend
5. **Finally Step 5:** Test & Refine

**Ready to implement?** Let me know and I'll start with Step 1!

---

**Status:** ✅ Plan complete, ready for implementation
**Approach:** Industry-standard, liquidity-based, multi-attempt with best price selection

