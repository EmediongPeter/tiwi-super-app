# Universal Routing System - Developer Quick Start

## Overview

This guide helps developers quickly understand and contribute to the Universal Routing System implementation.

## Prerequisites

- Node.js 18+
- TypeScript knowledge
- Understanding of DeFi protocols (Uniswap, PancakeSwap)
- Familiarity with graph algorithms (BFS, Dijkstra)

## Project Structure

```
lib/backend/routing/
├── graph-builder/      # Liquidity graph construction
├── pathfinder/         # Route finding algorithms
├── quote-aggregator/   # Multi-source quote collection
└── simulator/          # Route simulation
```

## Quick Start

### 1. Understanding the Graph

The liquidity graph is the foundation of the routing system:

```typescript
import { LiquidityGraph } from '@/lib/backend/routing/graph-builder/liquidity-graph';

// Initialize graph
const graph = new LiquidityGraph(chainId);

// Get neighbors (tokens that can be swapped to/from)
const neighbors = graph.getNeighbors(tokenAddress);

// Get edge (trading pair)
const edge = graph.getEdge(tokenA, tokenB);
```

### 2. Finding Routes

Use the pathfinder to find optimal routes:

```typescript
import { Pathfinder } from '@/lib/backend/routing/pathfinder/pathfinder';

const pathfinder = new Pathfinder(graph);

// Find routes
const routes = await pathfinder.findRoutes(
  fromToken,
  toToken,
  amountIn,
  { maxHops: 3 }
);

// Routes are sorted by score (best first)
const bestRoute = routes[0];
```

### 3. Adding a New Router

To add support for a new DEX/router:

1. **Create Adapter**:
```typescript
// lib/backend/routers/adapters/newdex-adapter.ts
import { BaseRouter } from '../base';

export class NewDexAdapter extends BaseRouter {
  name = 'newdex';
  displayName = 'NewDEX';
  
  async getRoute(params: RouterParams): Promise<RouterRoute | null> {
    // Implement route fetching logic
  }
}
```

2. **Register Router**:
```typescript
// lib/backend/routers/init.ts
import { NewDexAdapter } from './adapters/newdex-adapter';

export function initializeRouters() {
  const registry = getRouterRegistry();
  registry.register(new NewDexAdapter());
}
```

### 4. Adding a New Bridge

To add support for a new bridge:

1. **Create Bridge Adapter**:
```typescript
// lib/backend/bridges/newbridge/adapter.ts
export class NewBridgeAdapter {
  async getQuote(
    fromChain: number,
    toChain: number,
    token: Address,
    amount: bigint
  ): Promise<BridgeQuote | null> {
    // Implement bridge quote logic
  }
  
  async executeBridge(quote: BridgeQuote): Promise<string> {
    // Implement bridge execution
  }
}
```

2. **Integrate with Route Service**:
```typescript
// Update lib/backend/services/route-service.ts
// Add bridge selection logic
```

## Common Patterns

### Pattern 1: Graph Query with Caching

```typescript
async function getPairWithCache(
  tokenA: Address,
  tokenB: Address,
  chainId: number
): Promise<PairEdge | null> {
  // Check hot cache
  const cached = hotCache.get(`${tokenA}-${tokenB}`);
  if (cached) return cached;
  
  // Check warm cache (Redis)
  const warm = await redis.get(`pair:${chainId}:${tokenA}:${tokenB}`);
  if (warm) {
    hotCache.set(`${tokenA}-${tokenB}`, warm);
    return warm;
  }
  
  // Fetch from source
  const pair = await fetchPairFromSource(tokenA, tokenB, chainId);
  if (pair) {
    await redis.set(`pair:${chainId}:${tokenA}:${tokenB}`, pair, 'EX', 1800);
    hotCache.set(`${tokenA}-${tokenB}`, pair);
  }
  
  return pair;
}
```

### Pattern 2: Pathfinding with Early Termination

```typescript
async function findBestRoute(
  fromToken: Address,
  toToken: Address,
  amountIn: bigint,
  maxHops: number
): Promise<Route | null> {
  const queue = new PriorityQueue<Route>();
  const visited = new Set<string>();
  
  // Start with direct path
  queue.enqueue(await tryDirectPath(fromToken, toToken, amountIn));
  
  while (!queue.isEmpty()) {
    const route = queue.dequeue();
    
    // Early termination: if route is good enough, return it
    if (route.priceImpact < 0.5 && route.score > threshold) {
      return route;
    }
    
    // Explore further hops
    if (route.path.length < maxHops + 1) {
      const neighbors = graph.getNeighbors(route.path[route.path.length - 1]);
      for (const neighbor of neighbors) {
        const newRoute = await extendRoute(route, neighbor, toToken);
        if (newRoute && !visited.has(newRoute.routeId)) {
          visited.add(newRoute.routeId);
          queue.enqueue(newRoute);
        }
      }
    }
  }
  
  return queue.peek() || null;
}
```

### Pattern 3: Route Scoring

```typescript
function scoreRoute(route: Route): number {
  const outputValue = parseFloat(route.toToken.amountUSD);
  const inputValue = parseFloat(route.fromToken.amountUSD);
  const gasCost = parseFloat(route.fees.gasUSD);
  const protocolFees = parseFloat(route.fees.protocol);
  const priceImpactCost = inputValue * (route.priceImpact / 100);
  
  // Score = net value after all costs
  const score = outputValue - inputValue - gasCost - protocolFees - priceImpactCost;
  
  // Penalize long routes
  const hopPenalty = (route.path.length - 1) * 0.001 * inputValue;
  
  return score - hopPenalty;
}
```

## Testing

### Unit Test Example

```typescript
import { describe, it, expect } from '@jest/globals';
import { Pathfinder } from '@/lib/backend/routing/pathfinder/pathfinder';

describe('Pathfinder', () => {
  it('should find direct route', async () => {
    const pathfinder = new Pathfinder(mockGraph);
    const routes = await pathfinder.findRoutes(
      tokenA,
      tokenB,
      parseEther('1'),
      { maxHops: 1 }
    );
    
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toEqual([tokenA, tokenB]);
  });
  
  it('should find multi-hop route', async () => {
    const routes = await pathfinder.findRoutes(
      tokenA,
      tokenC,
      parseEther('1'),
      { maxHops: 3 }
    );
    
    expect(routes[0].path.length).toBeGreaterThan(2);
  });
});
```

### Integration Test Example

```typescript
describe('Route Service Integration', () => {
  it('should find cross-chain route', async () => {
    const routeService = getRouteService();
    const route = await routeService.getRoute({
      fromToken: { chainId: 1, address: usdc },
      toToken: { chainId: 56, address: busd },
      fromAmount: '1000',
    });
    
    expect(route.route).toBeDefined();
    expect(route.route.steps.length).toBeGreaterThan(1);
    expect(route.route.steps.some(s => s.type === 'bridge')).toBe(true);
  });
});
```

## Debugging

### Enable Debug Logging

```typescript
// Set environment variable
process.env.DEBUG = 'routing:*';

// Or in code
import { logger } from '@/lib/shared/utils/logger';
logger.level = 'debug';
```

### Common Issues

1. **Graph not updating**
   - Check TheGraph subgraph status
   - Verify RPC endpoints
   - Check cache TTL settings

2. **Routes not found**
   - Verify token addresses
   - Check liquidity thresholds
   - Increase maxHops parameter

3. **Slow pathfinding**
   - Reduce graph size (prune low-liquidity pairs)
   - Increase cache hit rate
   - Optimize algorithm (use A* instead of BFS)

## Performance Tips

1. **Use Caching**: Always check cache before fetching
2. **Parallel Queries**: Query multiple routers simultaneously
3. **Early Termination**: Stop searching when good route found
4. **Graph Pruning**: Remove low-liquidity pairs
5. **Batch Operations**: Use multicall for multiple checks

## Resources

- [Implementation Plan](./UNIVERSAL_ROUTING_IMPLEMENTATION.md)
- [Technical Architecture](./TECHNICAL_ARCHITECTURE.md)
- [API Documentation](../lib/backend/routers/types.ts)

## Getting Help

- Check existing code in `lib/backend/routers/adapters/` for examples
- Review test files for usage patterns
- Ask in team chat or create an issue

---

**Last Updated**: 2024


