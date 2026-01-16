# Universal Routing System

## Overview

This is the **new** Universal Routing System implementation. It is built as a **separate module** that does **NOT interfere** with existing router functionality.

## Important: Backward Compatibility

✅ **This module does NOT affect existing swap functionality**
- Existing router adapters (PancakeSwap, Uniswap, LiFi, Jupiter) continue to work as-is
- Existing EVM DEX executors are not modified
- Existing route service continues to function normally
- This is an **additive** enhancement, not a replacement

## Architecture

```
lib/backend/routing/          ← NEW: Universal Routing System
├── graph-builder/            ← Phase 1: Liquidity Graph
├── pathfinder/               ← Phase 2: Pathfinding (TODO)
├── quote-aggregator/         ← Phase 2: Quote Aggregation (TODO)
└── simulator/                ← Phase 2: Route Simulation (TODO)

lib/backend/routers/          ← EXISTING: Router Adapters (UNCHANGED)
├── adapters/                 ← Existing adapters work as before
│   ├── pancakeswap-adapter.ts
│   ├── uniswap-adapter.ts
│   ├── lifi-adapter.ts
│   └── jupiter-adapter.ts
└── ...

lib/frontend/services/swap-executor/  ← EXISTING: Executors (UNCHANGED)
└── executors/
    ├── evm-dex-executor.ts   ← Not modified
    ├── pancakeswap-executor.ts
    └── uniswap-executor.ts
```

## Current Status

### ✅ Phase 1: Liquidity Graph Builder (COMPLETE)
- `LiquidityGraph` - Core graph data structure
- `CacheManager` - Tiered caching system
- `PairFetcher` - Data fetching utilities
- `GraphBuilder` - Graph construction service

### ✅ Phase 2: Pathfinding Engine (COMPLETE)
- `BFSPathfinder` - Breadth-first search algorithm
- `DijkstraPathfinder` - Dijkstra's algorithm for optimal paths
- `IntermediarySelector` - Smart intermediary token selection
- `RouteScorer` - Multi-factor route scoring
- `Pathfinder` - Main pathfinding service

### 🚧 Phase 3: Cross-Chain Integration (TODO)
- Bridge adapters
- Cross-chain route building

### 🚧 Phase 4: Execution Engine (TODO)
- Meta-transactions
- Multi-step execution

## Usage

### Current Usage (Existing System)
```typescript
// Existing code continues to work
import { getRouteService } from '@/lib/backend/services/route-service';
const route = await getRouteService().getRoute(request);
```

### New System (Opt-In)
```typescript
// New system is opt-in and doesn't affect existing code
import { getGraphBuilder, Pathfinder } from '@/lib/backend/routing';

// Get graph for a chain
const graphBuilder = getGraphBuilder();
const graph = graphBuilder.getGraph(chainId);

// Create pathfinder
const pathfinder = new Pathfinder(graph, 10000); // Min $10k liquidity

// Find routes
const routes = await pathfinder.findRoutes({
  fromToken: '0x...',
  toToken: '0x...',
  chainId: 56,
  amountIn: parseEther('1'),
  maxHops: 3,
}, {
  maxRoutes: 3,
  algorithm: 'auto',
});
```

## Integration Strategy

The new routing system will be integrated **gradually**:

1. **Phase 1** (Current): Build foundation - no integration yet
2. **Phase 2**: Add pathfinding - still opt-in
3. **Phase 3**: Integrate with RouteService as optional enhancement
4. **Phase 4**: Make it default (with fallback to existing system)

## Testing

All existing tests continue to pass. New tests are added for the new routing system without affecting existing test suites.

## Development Guidelines

When working on this module:

1. ✅ **DO**: Add new functionality in `lib/backend/routing/`
2. ✅ **DO**: Keep existing routers in `lib/backend/routers/` unchanged
3. ✅ **DO**: Test that existing swap functionality still works
4. ❌ **DON'T**: Modify existing router adapters
5. ❌ **DON'T**: Modify existing executors
6. ❌ **DON'T**: Break existing route service

## Next Steps

1. ✅ Phase 1: Liquidity Graph Builder (Complete)
2. ✅ Phase 2: Pathfinding Engine (Complete)
3. 🚧 Phase 3: Quote Aggregator & Integration (Next)
4. 🚧 Phase 4: Cross-Chain Integration
5. 🚧 Phase 5: Execution Engine
6. 🚧 Phase 6: User Experience

---

**Last Updated**: 2024  
**Status**: Phase 1 & 2 Complete, Phase 3 In Progress

