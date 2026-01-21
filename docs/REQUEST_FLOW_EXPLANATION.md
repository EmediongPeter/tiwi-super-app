# Request Flow: Frontend → Universal Routing

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND: User enters TWC → ETH swap                        │
│  - fromToken: TWC (0xDA1060158F7D593667cCE0a15DB346BB3FfB3596)│
│  - toToken: ETH (0x0000000000000000000000000000000000000000) │
│  - chainId: 56 (BSC)                                          │
│  - amount: 2.533366034 BNB                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ POST /api/v1/route
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  API ROUTE: app/api/v1/route/route.ts                        │
│  - Validates request                                          │
│  - Converts to RouteRequest format                            │
│  - Calls RouteService.getRoute()                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  ROUTE SERVICE: lib/backend/services/route-service.ts       │
│                                                               │
│  Step 1: Try Existing Routers                                │
│  ├─ PancakeSwap: getRoute() → null (no direct TWC/ETH pair) │
│  ├─ Uniswap: getRoute() → null (BSC not supported)          │
│  ├─ LiFi: getRoute() → null (no route found)                │
│  └─ Jupiter: getRoute() → null (Solana only)                 │
│                                                               │
│  Step 2: All Routers Failed → Enhanced System Activates      │
│  └─ Calls RouteServiceEnhancer.enhanceRoute()                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  ROUTE SERVICE ENHANCER:                                     │
│  lib/backend/routing/integration/route-service-enhancer.ts  │
│                                                               │
│  Step 1: Prepare Parameters                                  │
│  ├─ Convert fromToken address to Address type                │
│  ├─ Convert toToken address to Address type                 │
│  ├─ Convert fromAmount to smallest unit (BigInt)             │
│  └─ Extract chainId                                          │
│                                                               │
│  Step 2: Call QuoteAggregator                                │
│  └─ quoteAggregator.aggregateQuotes(                         │
│       fromToken, toToken, chainId, amountIn,                 │
│       existingRoutes, options                                │
│     )                                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  QUOTE AGGREGATOR:                                           │
│  lib/backend/routing/quote-aggregator/quote-aggregator.ts   │
│                                                               │
│  Step 1: Handle Native Tokens                                │
│  ├─ Check if toToken is native (0x0000...0000)              │
│  ├─ Convert to wrapped token (WBNB for BSC)                  │
│  └─ Set needsUnwrap flag                                      │
│                                                               │
│  Step 2: Get Universal Routes                                │
│  └─ getUniversalRoutes(routingFromToken, routingToToken, ...)│
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  GET UNIVERSAL ROUTES (QuoteAggregator)                      │
│                                                               │
│  Step 1: Get Graph for Chain                                 │
│  └─ graphBuilder.getGraph(chainId)                          │
│                                                               │
│  Step 2: Check Graph State                                    │
│  ├─ Get graph stats (nodeCount, edgeCount)                   │
│  └─ If empty (edgeCount === 0):                             │
│     └─ Attempt to populate: graphBuilder.buildGraph()        │
│                                                               │
│  Step 3: Create Pathfinder                                   │
│  └─ new Pathfinder(graph, minLiquidityUSD)                   │
│                                                               │
│  Step 4: Find Routes                                          │
│  └─ pathfinder.findRoutes({                                  │
│       fromToken: routingFromToken (TWC),                    │
│       toToken: routingToToken (WBNB),                        │
│       chainId: 56,                                           │
│       amountIn: BigInt,                                      │
│       maxHops: 3                                             │
│     })                                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  PATHFINDER: lib/backend/routing/pathfinder/pathfinder.ts   │
│                                                               │
│  Step 1: Select Algorithm                                    │
│  └─ auto → chooses BFS or Dijkstra based on graph size      │
│                                                               │
│  Step 2: Find Paths                                          │
│  ├─ BFS: Finds all paths up to maxHops                       │
│  └─ Dijkstra: Finds optimal single path                      │
│                                                               │
│  Step 3: Score Routes                                        │
│  ├─ For each path found:                                     │
│  │  ├─ Calculate output amount (AMM math)                   │
│  │  ├─ Calculate price impact                                │
│  │  ├─ Calculate gas cost                                     │
│  │  └─ Calculate score                                        │
│  └─ Sort by score (highest first)                             │
│                                                               │
│  Step 4: Build Route Objects                                 │
│  └─ Convert paths to UniversalRoute format                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  BACK TO QUOTE AGGREGATOR                                    │
│                                                               │
│  Step 1: Convert Routes to AggregatedQuotes                  │
│  ├─ Map UniversalRoute → AggregatedQuote                    │
│  └─ Add source: 'universal'                                  │
│                                                               │
│  Step 2: Add Unwrap Step (if needed)                         │
│  └─ If needsUnwrap: Add unwrap step to route                 │
│                                                               │
│  Step 3: Rank All Quotes                                     │
│  ├─ Combine universal routes + existing routes               │
│  └─ Sort by score                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  BACK TO ROUTE SERVICE ENHANCER                              │
│                                                               │
│  Step 1: Get Best Quote                                      │
│  └─ aggregatedQuotes[0] (highest score)                     │
│                                                               │
│  Step 2: Validate Route                                      │
│  └─ routeValidator.validateRoute()                          │
│                                                               │
│  Step 3: Convert to RouterRoute                              │
│  └─ convertToRouterRoute(UniversalRoute)                    │
│                                                               │
│  Step 4: Return Enhanced Response                            │
│  └─ { route, alternatives, sources, universalRoutingEnabled }│
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  BACK TO ROUTE SERVICE                                       │
│                                                               │
│  Step 1: Check if Enhanced Route Found                       │
│  └─ If yes: Use enhanced route                               │
│  └─ If no: Continue with error handling                      │
│                                                               │
│  Step 2: Enrich Route with USD Values                        │
│  └─ enrichRouteWithUSD()                                     │
│                                                               │
│  Step 3: Return RouteResponse                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ JSON Response
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND: Receives Route                                    │
│  - Displays route to user                                    │
│  - Shows output amount, price impact, fees                   │
│  - User confirms → Executes swap                             │
└─────────────────────────────────────────────────────────────┘
```

## Current Issue: Why Graph is Empty

### What's Happening

1. **Request comes in**: TWC → ETH (native) on BSC
2. **QuoteAggregator converts**: ETH → WBNB (wrapped)
3. **Graph check**: Graph is empty (0 edges)
4. **Build attempt**: Calls `graphBuilder.buildGraph(56)`
5. **TheGraph fetch**: Returns 0 pairs
6. **Result**: No routes found

### Why TheGraph Returns 0 Pairs

**Possible reasons**:
1. **Subgraph URL might be wrong** - Need to verify PancakeSwap V2 subgraph URL
2. **Subgraph not synced** - TheGraph might be behind
3. **Query filter too strict** - `reserveUSD_gt: "1000"` might filter out all pairs
4. **Network issues** - Request might be failing silently

### What We Need to Fix

1. **Better error logging** - See what TheGraph actually returns
2. **Verify subgraph URL** - Check if PancakeSwap V2 subgraph exists
3. **Fallback to RPC** - If TheGraph fails, try direct RPC calls
4. **Handle empty graph gracefully** - Don't fail completely if graph is empty

## Next Steps

1. **Check TheGraph response** - Add logging to see actual response
2. **Verify subgraph URL** - Test if URL is correct
3. **Add RPC fallback** - Use direct pair fetching if TheGraph fails
4. **Test with known pairs** - Try TWC → WBNB first (should have pair)

---

**Status**: Flow documented, debugging TheGraph issue


