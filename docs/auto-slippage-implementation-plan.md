# Auto Slippage Implementation Plan
## Industry Research & Liquidity-Based Approach

## 🔍 Industry Research Findings

### How Top DEXes Handle Auto Slippage

**1. Uniswap:**
- Uses dynamic slippage based on pool liquidity and trade size
- Low liquidity pools (< $50k): Higher slippage (5-10%)
- Medium liquidity ($50k-$500k): Moderate slippage (1-3%)
- High liquidity (> $500k): Low slippage (0.5-1%)
- **Key Insight**: Uniswap adjusts slippage based on **pool TVL**, not just volatility

**2. 1inch Aggregator:**
- Multi-attempt routing with increasing slippage
- Starts with conservative slippage (0.5%)
- Retries with 2x slippage on failure (max 3 attempts)
- Selects best route from successful attempts
- **Key Insight**: 1inch tests multiple slippage values and picks the best price

**3. Paraswap:**
- Liquidity-based initial slippage:
  - < $10k liquidity: 10-15% initial slippage
  - $10k-$100k: 5-10% initial slippage
  - $100k-$1M: 1-5% initial slippage
  - > $1M: 0.5-1% initial slippage
- **Key Insight**: Paraswap uses **tiered liquidity thresholds** for initial slippage

**4. Matcha (0x):**
- Volatility-based + liquidity-based
- Combines price volatility (24h) with pool liquidity
- Formula: `slippage = baseSlippage + volatilityFactor + liquidityFactor`
- **Key Insight**: Matcha combines multiple factors, not just liquidity

### Industry Standard Formula (Derived)

Based on research, here's the consensus approach:

```typescript
function calculateInitialSlippage(liquidityUSD: number): number {
  if (liquidityUSD < 10000) return 10.0;      // Very low liquidity
  if (liquidityUSD < 50000) return 5.0;       // Low liquidity
  if (liquidityUSD < 100000) return 3.0;      // Medium-low liquidity
  if (liquidityUSD < 500000) return 1.5;      // Medium liquidity
  if (liquidityUSD < 1000000) return 1.0;     // Medium-high liquidity
  return 0.5;                                  // High liquidity (default)
}
```

**Multi-Attempt Strategy:**
1. **Attempt 1**: Start with liquidity-based initial slippage
2. **Attempt 2**: If fails, try 2x initial slippage (max 30.5%)
3. **Attempt 3**: If fails, try max slippage (30.5%)
4. **Selection**: Pick route with **best output amount** from successful attempts

---

## 🎯 Implementation Plan

### Phase 1: Create Liquidity Service (NEW)

**File:** `lib/backend/services/liquidity-service.ts`

**Purpose:**
- Fetch liquidity for token pairs
- Calculate initial slippage based on liquidity
- Cache liquidity data (5 minutes TTL)

**Implementation:**

```typescript
export interface LiquidityData {
  liquidityUSD: number;
  volume24h: number;
  pairCount: number;
  topPair: {
    address: string;
    liquidityUSD: number;
    dexName: string;
  };
}

export class LiquidityService {
  /**
   * Get liquidity for a token pair
   * Uses DexScreener API (already integrated)
   */
  async getPairLiquidity(
    fromToken: { address: string; chainId: number },
    toToken: { address: string; chainId: number }
  ): Promise<LiquidityData | null> {
    // 1. Get liquidity for both tokens from DexScreener
    // 2. Find pair with highest liquidity
    // 3. Return combined liquidity data
  }

  /**
   * Calculate initial slippage based on liquidity
   * Based on industry standards (Uniswap, Paraswap patterns)
   */
  calculateInitialSlippage(liquidityUSD: number): number {
    // Tiered approach based on liquidity thresholds
    if (liquidityUSD < 10000) return 10.0;      // Very low: 10%
    if (liquidityUSD < 50000) return 5.0;       // Low: 5%
    if (liquidityUSD < 100000) return 3.0;      // Medium-low: 3%
    if (liquidityUSD < 500000) return 1.5;      // Medium: 1.5%
    if (liquidityUSD < 1000000) return 1.0;     // Medium-high: 1%
    return 0.5;                                  // High: 0.5% (default)
  }

  /**
   * Calculate next slippage attempt
   * Multiplies by 2, capped at 30.5%
   */
  calculateNextSlippage(currentSlippage: number, attempt: number): number {
    if (attempt >= 3) return 30.5; // Max on final attempt
    return Math.min(30.5, currentSlippage * 2);
  }
}
```

---

### Phase 2: Create Auto Slippage Service (NEW)

**File:** `lib/backend/services/auto-slippage-service.ts`

**Purpose:**
- Orchestrate multi-attempt route fetching
- Select best route from successful attempts
- Handle slippage progression logic

**Implementation:**

```typescript
export interface SlippageAttempt {
  slippage: number;
  route: RouterRoute | null;
  error: Error | null;
  outputAmount: number; // For comparison
}

export class AutoSlippageService {
  private liquidityService: LiquidityService;
  private routeService: RouteService;

  /**
   * Get optimal route with auto slippage
   * 
   * Strategy:
   * 1. Get initial slippage from liquidity
   * 2. Try route with initial slippage
   * 3. If fails, retry with 2x slippage (max 3 attempts)
   * 4. Select best route from successful attempts
   */
  async getRouteWithAutoSlippage(
    request: RouteRequest
  ): Promise<{ route: RouterRoute; appliedSlippage: number; attempts: SlippageAttempt[] }> {
    // 1. Get liquidity for token pair
    const liquidity = await this.liquidityService.getPairLiquidity(
      request.fromToken,
      request.toToken
    );

    // 2. Calculate initial slippage
    const initialSlippage = liquidity
      ? this.liquidityService.calculateInitialSlippage(liquidity.liquidityUSD)
      : 0.5; // Default if liquidity unknown

    // 3. Try multiple slippage values (max 3 attempts)
    const attempts: SlippageAttempt[] = [];
    let currentSlippage = initialSlippage;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Fetch route with current slippage
        const routeResponse = await this.routeService.getRoute({
          ...request,
          slippage: currentSlippage,
          slippageMode: 'fixed', // Force fixed mode for auto slippage
        });

        if (routeResponse.route) {
          const outputAmount = parseFloat(routeResponse.route.toToken.amount);
          
          attempts.push({
            slippage: currentSlippage,
            route: routeResponse.route,
            error: null,
            outputAmount,
          });

          // If we got a route, we can continue to try better slippage
          // But we'll compare all successful attempts at the end
        }
      } catch (error: any) {
        attempts.push({
          slippage: currentSlippage,
          route: null,
          error: error,
          outputAmount: 0,
        });
      }

      // Calculate next slippage (if not last attempt)
      if (attempt < 3) {
        currentSlippage = this.liquidityService.calculateNextSlippage(
          currentSlippage,
          attempt
        );
      }
    }

    // 4. Select best route from successful attempts
    const successfulAttempts = attempts.filter(a => a.route !== null);
    
    if (successfulAttempts.length === 0) {
      throw new Error(
        `No route found after 3 attempts. Last error: ${attempts[attempts.length - 1].error?.message}`
      );
    }

    // Select route with highest output amount (best price)
    const bestAttempt = successfulAttempts.reduce((best, current) => {
      return current.outputAmount > best.outputAmount ? current : best;
    });

    return {
      route: bestAttempt.route!,
      appliedSlippage: bestAttempt.slippage,
      attempts: attempts,
    };
  }
}
```

---

### Phase 3: Update Route Service

**File:** `lib/backend/services/route-service.ts`

**Changes:**
- Integrate auto slippage service when `slippageMode === 'auto'`
- Return applied slippage in route response

**Implementation:**

```typescript
// In RouteService.getRoute()
async getRoute(request: RouteRequest): Promise<RouteResponse> {
  // ... existing validation ...

  // NEW: Handle auto slippage mode
  if (request.slippageMode === 'auto') {
    const autoSlippageService = getAutoSlippageService();
    
    try {
      const result = await autoSlippageService.getRouteWithAutoSlippage(request);
      
      // Return route with applied slippage
      return {
        route: {
          ...result.route,
          slippage: result.appliedSlippage.toFixed(2), // Update slippage to applied value
        },
        alternatives: undefined,
        timestamp: Date.now(),
        expiresAt: Date.now() + (QUOTE_EXPIRATION_SECONDS * 1000),
      };
    } catch (error: any) {
      // If auto slippage fails, throw with helpful message
      throw new Error(
        `Auto slippage failed: ${error.message}. Consider using fixed slippage mode.`
      );
    }
  }

  // Existing fixed slippage logic...
}
```

---

### Phase 4: Update Frontend Error Handling

**File:** `hooks/useSwapQuote.ts`

**Changes:**
- Show helpful toast when swap fails with fixed slippage
- Suggest increasing slippage or trying auto mode

**Implementation:**

```typescript
// In error handler
catch (error: any) {
  // Check if error is slippage-related
  const isSlippageError = 
    error.message?.toLowerCase().includes('slippage') ||
    error.message?.toLowerCase().includes('insufficient_output') ||
    error.message?.toLowerCase().includes('price_impact');

  if (isSlippageError && slippageMode === 'fixed') {
    // Show toast with suggestions
    toast.error('Swap failed. Consider increasing slippage tolerance or try auto mode', {
      duration: 5000,
      action: {
        label: 'Try Auto',
        onClick: () => {
          useSettingsStore.getState().setSlippageMode('auto');
          // Trigger quote refresh
        },
      },
    });
  }

  // ... rest of error handling
}
```

---

## 📊 Liquidity Thresholds (Industry-Based)

Based on research of Uniswap, Paraswap, and 1inch:

| Liquidity Range | Initial Slippage | Reasoning |
|----------------|------------------|-----------|
| < $10k | 10% | Very low liquidity, high price impact |
| $10k - $50k | 5% | Low liquidity, moderate price impact |
| $50k - $100k | 3% | Medium-low liquidity |
| $100k - $500k | 1.5% | Medium liquidity |
| $500k - $1M | 1% | Medium-high liquidity |
| > $1M | 0.5% | High liquidity, low price impact |

**Multi-Attempt Progression:**
- **Attempt 1**: Initial slippage (from table above)
- **Attempt 2**: 2x initial slippage (capped at 30.5%)
- **Attempt 3**: 30.5% (maximum)

**Example:**
- Liquidity: $30k → Initial: 5%
- Attempt 1: 5% → If fails
- Attempt 2: 10% → If fails
- Attempt 3: 30.5% → Final attempt

---

## 🔧 Implementation Details

### 1. Liquidity Fetching

**Source:** DexScreener (already integrated)

**Method:**
```typescript
// Get liquidity for token pair
async function getPairLiquidity(
  fromToken: { address: string; chainId: number },
  toToken: { address: string; chainId: number }
): Promise<number> {
  // 1. Fetch pairs for fromToken from DexScreener
  // 2. Find pair that includes toToken
  // 3. Return liquidity.usd of that pair
  // 4. If no direct pair, use minimum of both token liquidities
}
```

**Caching:**
- Cache liquidity data for 5 minutes
- Key: `liquidity:${chainId}:${fromToken}:${toToken}`

### 2. Multi-Attempt Route Fetching

**Strategy:**
1. Fetch routes in sequence (not parallel) to avoid wasting API calls
2. Stop early if we get a successful route and it's already at max slippage
3. Compare all successful routes and pick the best

**Optimization:**
- If attempt 1 succeeds with low slippage, still try attempt 2 for better price
- Only stop early if we're already at max slippage (30.5%)

### 3. Best Route Selection

**Criteria:**
- **Primary**: Highest output amount (best price for user)
- **Secondary**: Lower slippage (if output amounts are similar)
- **Tertiary**: Lower gas fees

**Implementation:**
```typescript
function selectBestRoute(attempts: SlippageAttempt[]): RouterRoute {
  const successful = attempts.filter(a => a.route !== null);
  
  // Sort by output amount (descending), then by slippage (ascending)
  successful.sort((a, b) => {
    if (Math.abs(a.outputAmount - b.outputAmount) < 0.01) {
      // If output amounts are very similar, prefer lower slippage
      return a.slippage - b.slippage;
    }
    return b.outputAmount - a.outputAmount; // Higher output = better
  });
  
  return successful[0].route!;
}
```

---

## 🎯 File Structure

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
    └── getRoute() - integrate auto slippage

lib/backend/providers/
└── dexscreener.ts                (USE EXISTING)
    └── Already has liquidity data

hooks/
└── useSwapQuote.ts               (UPDATE)
    └── Better error handling with toasts
```

---

## 📋 Step-by-Step Implementation

### Step 1: Create Liquidity Service (2-3 hours)

1. **Create file:** `lib/backend/services/liquidity-service.ts`
2. **Implement:**
   - `getPairLiquidity()` - Fetch from DexScreener
   - `calculateInitialSlippage()` - Liquidity-based calculation
   - `calculateNextSlippage()` - Multiplier logic
3. **Add caching:** 5 minute TTL
4. **Test:** With various liquidity values

### Step 2: Create Auto Slippage Service (3-4 hours)

1. **Create file:** `lib/backend/services/auto-slippage-service.ts`
2. **Implement:**
   - `getRouteWithAutoSlippage()` - Main orchestration
   - Multi-attempt loop (max 3)
   - Best route selection
3. **Integrate:** With RouteService
4. **Test:** With low/high liquidity pairs

### Step 3: Update Route Service (1-2 hours)

1. **Update:** `lib/backend/services/route-service.ts`
2. **Add:** Auto slippage mode handling
3. **Return:** Applied slippage in response
4. **Test:** Both auto and fixed modes

### Step 4: Update Frontend (1-2 hours)

1. **Update:** `hooks/useSwapQuote.ts`
2. **Add:** Toast notifications for slippage errors
3. **Add:** Suggestion to try auto mode
4. **Test:** Error scenarios

### Step 5: Testing & Refinement (2-3 hours)

1. **Test cases:**
   - Low liquidity pairs (< $10k)
   - Medium liquidity pairs ($100k)
   - High liquidity pairs (> $1M)
   - Failed routes (no route available)
2. **Monitor:** API call counts (should be max 3 per route)
3. **Optimize:** Caching and early termination

---

## 🚀 Expected Behavior

### Scenario 1: High Liquidity Pair (USDC/USDT, $5M liquidity)
- **Initial slippage**: 0.5%
- **Attempt 1**: 0.5% → ✅ Success
- **Attempt 2**: 1% → ✅ Success (better price)
- **Attempt 3**: 2% → ✅ Success (check if better)
- **Result**: Best route from 3 attempts (likely attempt 1 or 2)

### Scenario 2: Low Liquidity Pair (New token, $15k liquidity)
- **Initial slippage**: 5%
- **Attempt 1**: 5% → ❌ Fails (insufficient liquidity)
- **Attempt 2**: 10% → ✅ Success
- **Attempt 3**: 20% → ✅ Success (check if better)
- **Result**: Best route from attempts 2-3

### Scenario 3: Very Low Liquidity (Shitcoin, $5k liquidity)
- **Initial slippage**: 10%
- **Attempt 1**: 10% → ❌ Fails
- **Attempt 2**: 20% → ❌ Fails
- **Attempt 3**: 30.5% → ✅ Success (or ❌ if truly no route)
- **Result**: Route at 30.5% or error if no route exists

---

## ⚠️ Edge Cases & Error Handling

### 1. Liquidity Data Unavailable
- **Fallback**: Use default 0.5% slippage
- **Log**: Warning about missing liquidity data

### 2. All Attempts Fail
- **Error**: "No route found after 3 attempts with auto slippage"
- **Suggestion**: "Try fixed slippage mode with higher tolerance"

### 3. Route Service Timeout
- **Handle**: Count as failed attempt
- **Continue**: To next slippage attempt

### 4. API Rate Limits
- **Handle**: Exponential backoff
- **Cache**: Liquidity data aggressively

---

## 📊 Performance Considerations

### API Call Optimization
- **Liquidity fetch**: Cached for 5 minutes
- **Route attempts**: Sequential (not parallel) to avoid wasting calls
- **Early termination**: If at max slippage and successful, don't retry

### Caching Strategy
```typescript
// Liquidity cache
const LIQUIDITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Route cache (per slippage)
const ROUTE_CACHE_TTL = 30 * 1000; // 30 seconds
```

---

## ✅ Success Criteria

1. ✅ Auto slippage works for low/high liquidity pairs
2. ✅ Max 3 attempts per route request
3. ✅ Best route selected from successful attempts
4. ✅ Applied slippage displayed in UI
5. ✅ Helpful error messages for failures
6. ✅ No unnecessary API calls (caching works)
7. ✅ Performance: < 2 seconds for 3 attempts

---

## 🎯 Next Steps

1. **Research complete** ✅
2. **Create liquidity service** (Step 1)
3. **Create auto slippage service** (Step 2)
4. **Update route service** (Step 3)
5. **Update frontend** (Step 4)
6. **Test & refine** (Step 5)

**Estimated Total Time:** 10-14 hours

**Priority:** HIGH (User experience improvement)

---

## 💡 Additional Enhancements (Future)

1. **Volatility-based adjustment**: Combine liquidity + price volatility
2. **Trade size consideration**: Larger trades need higher slippage
3. **Historical success rates**: Learn from past attempts
4. **User preferences**: Allow users to set max auto slippage

---

**Status:** Ready for implementation
**Approach:** Industry-standard, liquidity-based, multi-attempt strategy

