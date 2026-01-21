# Complete Flow Analysis: Frontend → Universal Routing

## Request Flow (Step-by-Step)

### 1. Frontend Initiates Request

**User Action**: Enters TWC → ETH swap on BSC

**Frontend Code**: `app/swap/page.tsx` or `hooks/useSwapQuote.ts`
```typescript
POST /api/v1/route
{
  fromToken: { chainId: 56, address: "0xDA1060158F7D593667cCE0a15DB346BB3FfB3596" }, // TWC
  toToken: { chainId: 56, address: "0x0000000000000000000000000000000000000000" }, // ETH (native)
  fromAmount: "2.533366034",
  slippage: 0.5
}
```

### 2. API Route Handler

**File**: `app/api/v1/route/route.ts`

**What It Does**:
- Validates request
- Converts to `RouteRequest` format
- Calls `RouteService.getRoute()`

### 3. RouteService (Existing Routers First)

**File**: `lib/backend/services/route-service.ts`

**Flow**:
```typescript
RouteService.getRoute(request)
  ↓
Try Existing Routers (in parallel):
  ├─ PancakeSwap.getRoute() → null (no direct TWC/ETH pair)
  ├─ Uniswap.getRoute() → null (BSC not supported)
  ├─ LiFi.getRoute() → null (no route found)
  └─ Jupiter.getRoute() → null (Solana only)
  ↓
All Failed → Enhanced System Activates
```

**Code Location**: Line 183-216 in `route-service.ts`

### 4. RouteServiceEnhancer (Enhanced System)

**File**: `lib/backend/routing/integration/route-service-enhancer.ts`

**What It Does**:
1. **Converts Request Format**:
   ```typescript
   fromToken = getAddress(request.fromToken.address) // TWC
   toToken = getAddress(request.toToken.address) // ETH (0x0000...0000)
   amountIn = BigInt(toSmallestUnit(request.fromAmount, decimals))
   ```

2. **Calls QuoteAggregator**:
   ```typescript
   quoteAggregator.aggregateQuotes(
     fromToken, toToken, chainId, amountIn,
     existingRoutes, options
   )
   ```

### 5. QuoteAggregator (Route Collection)

**File**: `lib/backend/routing/quote-aggregator/quote-aggregator.ts`

**What It Does**:

#### Step 5.1: Native Token Conversion
```typescript
// Detects: toToken = 0x0000...0000 (native)
// Converts: routingToToken = WBNB (0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c)
// Sets: needsUnwrap = true
```

#### Step 5.2: Get Universal Routes
```typescript
getUniversalRoutes(routingFromToken, routingToToken, ...)
  ↓
Gets graph for chain 56
  ↓
Checks if graph has data
  ↓
If empty: Attempts to populate
```

### 6. Graph Builder (Data Population)

**File**: `lib/backend/routing/graph-builder/graph-builder.ts`

**What It Does**:

#### Step 6.1: Try TheGraph
```typescript
pairFetcher.fetchFromTheGraph(factoryAddress, 1000)
  ↓
POST to TheGraph subgraph
  ↓
Query: Get pairs with reserveUSD > 1000
  ↓
Transform response to PairEdge[]
```

**Current Issue**: Returns 0 pairs

#### Step 6.2: RPC Fallback (NEW)
```typescript
If TheGraph returns 0 pairs:
  For each common pair (TWC/WBNB, WBNB/BUSD, etc.):
    pairFetcher.fetchFromRPC(factory, tokenA, tokenB)
      ↓
    Uses existing utilities:
      - getPairAddress() → Gets pair from factory
      - getPairReserves() → Gets reserves
      - getTokenPrice() → Calculates liquidity USD
      ↓
    Returns PairEdge
```

**This should populate at least some pairs**

### 7. Pathfinder (Route Finding)

**File**: `lib/backend/routing/pathfinder/pathfinder.ts`

**What It Does** (if graph has data):

```typescript
pathfinder.findRoutes({
  fromToken: TWC,
  toToken: WBNB, // (converted from native)
  chainId: 56,
  amountIn: BigInt(...),
  maxHops: 3
})
  ↓
Select Algorithm (BFS or Dijkstra)
  ↓
Find Paths:
  - TWC → WBNB (direct, if pair exists)
  - TWC → USDT → WBNB (2-hop)
  - TWC → BUSD → USDT → WBNB (3-hop)
  ↓
Score Each Path:
  - Calculate output amount (AMM math)
  - Calculate price impact
  - Calculate gas cost
  - Calculate score
  ↓
Sort by Score (highest first)
  ↓
Return Top Routes
```

### 8. Route Conversion

**File**: `lib/backend/routing/integration/route-service-enhancer.ts`

**What It Does**:
```typescript
convertToRouterRoute(UniversalRoute)
  ↓
Converts to RouterRoute format:
  {
    router: 'universal',
    steps: [
      { type: 'swap', fromToken: TWC, toToken: WBNB, ... },
      { type: 'unwrap', fromToken: WBNB, toToken: BNB, ... } // If needsUnwrap
    ],
    ...
  }
```

### 9. Return to Frontend

**Response Format**:
```typescript
{
  route: {
    router: 'universal',
    fromToken: { address: TWC, ... },
    toToken: { address: ETH, ... }, // Original address
    steps: [
      { type: 'swap', TWC → WBNB },
      { type: 'unwrap', WBNB → BNB }
    ],
    toToken.amount: "0.099", // Estimated output
    ...
  },
  alternatives: [...],
  sources: ['universal'],
  universalRoutingEnabled: true
}
```

### 10. Frontend Display

**File**: `app/swap/page.tsx`

**What It Shows**:
- Route: TWC → WBNB → BNB
- Output amount
- Price impact
- Fees
- Steps breakdown

### 11. Execution (When User Confirms)

**File**: `lib/frontend/services/swap-executor/executors/multi-step-executor.ts`

**What It Does**:
```typescript
MultiStepExecutor.execute()
  ↓
For each step:
  Step 1: TWC → WBNB
    - Uses PancakeSwapExecutor
    - Executes swap on BSC
  Step 2: WBNB → BNB (unwrap)
    - Calls WETH contract withdraw()
    - Unwraps to native BNB
  ↓
Returns success with transaction hashes
```

## Current Blocking Issue

### TheGraph Returns 0 Pairs

**Why This Happens**:
1. **Subgraph URL might be wrong** - Need to verify
2. **Subgraph not synced** - TheGraph might be behind
3. **Query filter too strict** - `reserveUSD_gt: "1000"` might filter everything
4. **Network issues** - Request failing silently

**What We Fixed**:
1. ✅ Added detailed logging to see TheGraph response
2. ✅ Added RPC fallback for common pairs
3. ✅ Native token conversion (ETH → WBNB)
4. ✅ Better error messages

## What to Test Next

1. **Try swap again** - Check if RPC fallback works
2. **Check console logs** - See TheGraph response details
3. **Verify graph stats** - Is edgeCount > 0 after build?

## Expected Behavior After Fixes

**If RPC Fallback Works**:
- Graph gets at least 4 pairs (TWC/WBNB, WBNB/BUSD, etc.)
- Pathfinder finds route: TWC → WBNB
- Route returned with unwrap step
- Swap executes successfully

**If RPC Also Fails**:
- Need to investigate why pair fetching fails
- May need to seed graph manually
- Or use alternative data source (DexScreener)

---

**Status**: Fixes applied, ready for testing
**Next**: Test swap and share console output


