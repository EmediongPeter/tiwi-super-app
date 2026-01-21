# How To Use Universal Routing System

## Quick Start

### Option 1: Use Existing System (No Changes)

**Current behavior**: Your swap system works as-is. No changes needed.

```typescript
// This continues to work exactly as before
import { getRouteService } from '@/lib/backend/services/route-service';

const routeService = getRouteService();
const route = await routeService.getRoute(request);
// Returns route from existing routers (PancakeSwap, Uniswap, LiFi, Jupiter)
```

### Option 2: Enable Universal Routing (Optional Enhancement)

**Add this to your API route handler**:

```typescript
// app/api/route/route.ts (or wherever your route API is)
import { getRouteService } from '@/lib/backend/services/route-service';
import { getRouteServiceEnhancer } from '@/lib/backend/routing/integration';

export async function POST(request: Request) {
  const routeRequest = await request.json();
  
  // 1. Get route from existing system (as before)
  const routeService = getRouteService();
  const existingRoute = await routeService.getRoute(routeRequest);
  
  // 2. Optionally enhance with universal routing
  const enhancer = getRouteServiceEnhancer();
  const enhancedRoute = await enhancer.enhanceRoute(
    routeRequest,
    existingRoute,
    {
      enableUniversalRouting: true, // Enable universal routing
      preferUniversalRouting: false, // Use existing if better
    }
  );
  
  // 3. Return enhanced route (or existing if better)
  return Response.json(enhancedRoute);
}
```

## Detailed Usage

### Step 1: Initialize Graph (One-Time Setup)

Before using universal routing, you need to populate the liquidity graph:

```typescript
import { getGraphBuilder } from '@/lib/backend/routing';

// Build graph for a chain (e.g., BSC = 56)
const graphBuilder = getGraphBuilder();
await graphBuilder.buildGraph(56); // This fetches pair data

// Check graph status
const stats = graphBuilder.getGraphStats(56);
console.log('Graph stats:', stats);
// { graph: { nodeCount: 1000, edgeCount: 5000, ... }, cache: { ... } }
```

**Note**: Graph building is a background process. In production, you'd run this periodically (every 5-15 minutes).

### Step 2: Use RouteServiceEnhancer

```typescript
import { getRouteService } from '@/lib/backend/services/route-service';
import { getRouteServiceEnhancer } from '@/lib/backend/routing/integration';

// Your existing route request
const routeRequest = {
  fromToken: {
    chainId: 56,
    address: '0x...',
    symbol: 'USDT',
    decimals: 18,
  },
  toToken: {
    chainId: 56,
    address: '0x...',
    symbol: 'BUSD',
    decimals: 18,
  },
  fromAmount: '100',
  slippageMode: 'fixed',
  slippage: 0.5,
};

// Get route (existing system)
const routeService = getRouteService();
const existingRoute = await routeService.getRoute(routeRequest);

// Enhance with universal routing
const enhancer = getRouteServiceEnhancer();
const enhancedRoute = await enhancer.enhanceRoute(
  routeRequest,
  existingRoute,
  {
    enableUniversalRouting: true,
    preferUniversalRouting: false, // false = use existing if better
    gasPrice: parseGwei('20'),
    inputTokenPriceUSD: 1.0,
    outputTokenPriceUSD: 1.0,
  }
);

// enhancedRoute.route is the best route (from all sources)
// enhancedRoute.sources shows which sources provided routes
// enhancedRoute.universalRoutingEnabled shows if universal routing was used
```

### Step 3: Use Quote Aggregator Directly (Advanced)

If you want more control:

```typescript
import { getQuoteAggregator } from '@/lib/backend/routing';
import { getAddress } from 'viem';

const aggregator = getQuoteAggregator();

// Get quotes from all sources
const quotes = await aggregator.aggregateQuotes(
  getAddress('0x...'), // fromToken
  getAddress('0x...'), // toToken
  56, // chainId
  parseEther('100'), // amountIn
  existingRoutes, // Routes from existing routers
  {
    includeUniversalRouting: true,
    includeExistingRouters: true,
    maxQuotes: 5,
    minLiquidityUSD: 10000,
  }
);

// quotes[0] is the best quote
// quotes are sorted by score (highest first)
```

### Step 4: Use Pathfinder Directly (Advanced)

If you want to find routes using just the universal routing system:

```typescript
import { getGraphBuilder, Pathfinder } from '@/lib/backend/routing';
import { parseEther } from 'viem';

const graphBuilder = getGraphBuilder();
const graph = graphBuilder.getGraph(56); // BSC

const pathfinder = new Pathfinder(graph, 10000); // Min $10k liquidity

const routes = await pathfinder.findRoutes(
  {
    fromToken: getAddress('0x...'),
    toToken: getAddress('0x...'),
    chainId: 56,
    amountIn: parseEther('100'),
    maxHops: 3,
  },
  {
    maxRoutes: 3,
    algorithm: 'auto', // 'bfs' | 'dijkstra' | 'auto'
    gasPrice: parseGwei('20'),
  }
);

// routes[0] is the best route
```

## Configuration

### Enable/Disable Universal Routing

```typescript
// In your API route handler or service
const USE_UNIVERSAL_ROUTING = process.env.ENABLE_UNIVERSAL_ROUTING === 'true';

if (USE_UNIVERSAL_ROUTING) {
  // Use enhanced route
  const enhancedRoute = await enhancer.enhanceRoute(...);
  return enhancedRoute;
} else {
  // Use existing route
  const route = await routeService.getRoute(...);
  return route;
}
```

### Configure Graph Building

```typescript
import { getGraphBuilder } from '@/lib/backend/routing';

const graphBuilder = getGraphBuilder();

// Build graph for multiple chains
const chains = [1, 56, 137, 42161]; // Ethereum, BSC, Polygon, Arbitrum

for (const chainId of chains) {
  await graphBuilder.buildGraph(chainId);
}

// Set up periodic updates (in production)
setInterval(async () => {
  for (const chainId of chains) {
    await graphBuilder.buildGraph(chainId);
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

## Frontend Usage (No Changes Needed)

The frontend doesn't need any changes! It continues to work as before:

```typescript
// hooks/useSwapQuote.ts (unchanged)
const routeResponse = await fetchRoute({
  fromToken: { ... },
  toToken: { ... },
  fromAmount: '100',
});

// routeResponse.route is the best route (from all sources)
// Frontend doesn't know or care if it's from universal routing or existing routers
```

## Execution (No Changes Needed)

Swap execution works with routes from any source:

```typescript
// hooks/useSwapExecution.ts (unchanged)
const { execute } = useSwapExecution();

await execute({
  route: routeResponse.route, // Works with any RouterRoute
  fromToken,
  toToken,
  fromAmount,
  // ...
});

// Executor automatically uses the right executor based on route.router
// - 'pancakeswap' → PancakeSwapExecutor
// - 'uniswap' → UniswapExecutor
// - 'universal' → Can use EVMDEXExecutor (converted format)
```

## Monitoring

### Check Graph Status

```typescript
import { getGraphBuilder } from '@/lib/backend/routing';

const graphBuilder = getGraphBuilder();
const stats = graphBuilder.getGraphStats(56);

console.log('Graph stats:', {
  nodes: stats.graph.nodeCount,
  edges: stats.graph.edgeCount,
  totalLiquidity: stats.graph.totalLiquidityUSD,
  cacheSize: stats.cache.hotSize,
});
```

### Check Route Sources

```typescript
const enhancedRoute = await enhancer.enhanceRoute(...);

console.log('Route sources:', enhancedRoute.sources);
// ['pancakeswap', 'universal', 'uniswap']

console.log('Universal routing used:', enhancedRoute.universalRoutingEnabled);
// true or false
```

## Troubleshooting

### Graph is Empty

**Problem**: Universal routing returns no routes.

**Solution**: Build the graph first:
```typescript
await graphBuilder.buildGraph(chainId);
```

### Routes Not Better

**Problem**: Universal routing routes aren't better than existing routes.

**Solution**: This is expected! The system uses the best route from all sources. If existing routers are better, it uses those.

### Graph Building Fails

**Problem**: `buildGraph()` fails or returns empty graph.

**Solution**: 
1. Check TheGraph subgraph availability
2. Check DexScreener API access
3. Check RPC endpoints
4. Graph building is a placeholder - implement data fetching in Phase 1

## Best Practices

1. **Start with existing system**: Don't enable universal routing until graph is populated
2. **Monitor performance**: Check graph stats regularly
3. **Fallback to existing**: Always keep existing routers as fallback
4. **Gradual rollout**: Enable for specific chains first
5. **Monitor costs**: Graph building uses API calls (TheGraph, DexScreener)

---

**Status**: Ready to Use  
**Next Steps**: Populate graph data, then enable universal routing

