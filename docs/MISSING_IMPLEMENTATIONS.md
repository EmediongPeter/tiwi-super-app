# Missing Implementations - What Needs to Be Built

## Overview

This document lists **exactly what's missing** and **how to implement it** using your existing codebase.

---

## 1. Graph Data Population (CRITICAL)

### Current Status
- ❌ TheGraph integration: Placeholder
- ❌ DexScreener integration: Placeholder  
- ❌ RPC pair fetching: Placeholder

### What You Already Have
✅ `lib/backend/utils/pancakeswap-pairs.ts`:
- `getPairAddress()` - Gets pair from factory
- `getPairReserves()` - Gets reserves
- `verifySwapPath()` - Verifies path

### Implementation Needed

#### File: `lib/backend/routing/graph-builder/pair-fetcher.ts`

**Replace `fetchFromRPC()` method**:

```typescript
async fetchFromRPC(
  factoryAddress: Address,
  tokenA: Address,
  tokenB: Address
): Promise<PairEdge | null> {
  // USE EXISTING UTILITY
  const { getPairAddress, getPairReserves } = await import('@/lib/backend/utils/pancakeswap-pairs');
  const { getTokenPrice } = await import('@/lib/backend/providers/price-provider');
  
  // 1. Get pair address (using existing utility)
  const pairAddress = await getPairAddress(tokenA, tokenB, this.chainId);
  if (!pairAddress) return null;
  
  // 2. Get reserves (using existing utility)
  const reserves = await getPairReserves(tokenA, tokenB, this.chainId);
  if (!reserves) return null;
  
  // 3. Calculate liquidity USD
  const [priceA, priceB] = await Promise.all([
    getTokenPrice(tokenA, this.chainId, ''),
    getTokenPrice(tokenB, this.chainId, ''),
  ]);
  
  const reserveAUSD = Number(reserves.reserve0) * parseFloat(priceA?.priceUSD || '0') / 1e18;
  const reserveBUSD = Number(reserves.reserve1) * parseFloat(priceB?.priceUSD || '0') / 1e18;
  const liquidityUSD = reserveAUSD + reserveBUSD;
  
  return {
    id: `${tokenA.toLowerCase()}-${tokenB.toLowerCase()}-${this.chainId}-pancakeswap`,
    tokenA,
    tokenB,
    chainId: this.chainId,
    dex: 'pancakeswap',
    factory: factoryAddress,
    pairAddress,
    liquidityUSD,
    reserve0: reserves.reserve0,
    reserve1: reserves.reserve1,
    feeBps: 25, // 0.25% for PancakeSwap
    lastUpdated: Date.now(),
  };
}
```

**Implement `fetchFromTheGraph()` method** (see PRODUCTION_IMPLEMENTATION_PLAN.md for full code).

---

## 2. Multi-Step Executor (CRITICAL)

### Current Status
- ❌ `MultiStepExecutor` class doesn't exist
- ❌ No step-by-step execution logic
- ❌ No bridge execution integration

### Implementation Needed

#### File: `lib/frontend/services/swap-executor/executors/multi-step-executor.ts` (CREATE NEW)

**Full implementation** provided in `PRODUCTION_IMPLEMENTATION_PLAN.md` Section 3.

**Key Points**:
- Uses existing `PancakeSwapExecutor` and `UniswapExecutor` for swap steps
- Handles chain switching between steps
- Passes amounts between steps
- Integrates with bridge system

#### File: `lib/frontend/services/swap-executor/index.ts` (MODIFY)

**Add to constructor**:
```typescript
import { MultiStepExecutor } from './executors/multi-step-executor';

constructor() {
  this.executors = [
    new LiFiExecutor(),
    new JupiterExecutor(),
    new PancakeSwapExecutor(),
    new UniswapExecutor(),
    new MultiStepExecutor(), // ADD THIS LINE
  ];
}
```

---

## 3. Bridge API Integration (IMPORTANT)

### Current Status
- ❌ Stargate API: Placeholder
- ❌ Socket.tech API: Placeholder

### Implementation Needed

#### File: `lib/backend/routing/bridges/stargate-adapter.ts`

**Replace `getQuote()` method**:

```typescript
async getQuote(...): Promise<BridgeQuote | null> {
  try {
    // Stargate API endpoint
    const response = await fetch('https://api.stargate.finance/v1/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromChain: fromChain,
        toChain: toChain,
        fromToken: fromToken,
        toToken: toToken,
        amountIn: amountIn.toString(),
        slippage: slippage,
      }),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    return {
      bridgeId: 'stargate',
      bridgeName: 'Stargate',
      fromChain,
      toChain,
      fromToken,
      toToken,
      amountIn,
      amountOut: BigInt(data.amountOut),
      fees: {
        bridge: data.feeUSD || '0.00',
        gas: data.gasUSD || '0.00',
        total: data.totalFeeUSD || '0.00',
      },
      estimatedTime: data.estimatedTime || 300,
      minAmountOut: BigInt(data.minAmountOut),
      slippage,
      expiresAt: Date.now() + 60000,
      transactionData: data.transactionData,
      raw: data,
    };
  } catch (error) {
    console.error('[StargateAdapter] Error:', error);
    return null;
  }
}
```

**Note**: Check Stargate API documentation for actual endpoint and format.

---

## 4. RouteService Fallback (IMPORTANT)

### Current Status
- ❌ RouteService doesn't use enhanced system as fallback

### Implementation Needed

#### File: `lib/backend/services/route-service.ts`

**Modify `getRouteWithFixedSlippage()` method** (around line 181):

```typescript
// After selecting best route (line 181)
const bestRoute = selectBestRoute(routes);

if (!bestRoute) {
  // TRY ENHANCED SYSTEM AS FALLBACK
  try {
    const { getRouteServiceEnhancer } = await import('@/lib/backend/routing/integration');
    const enhancer = getRouteServiceEnhancer();
    
    const enhancedResponse = await enhancer.enhanceRoute(
      request,
      {
        route: null,
        alternatives: undefined,
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
      },
      {
        enableUniversalRouting: true,
        preferUniversalRouting: false,
      }
    );
    
    if (enhancedResponse.route) {
      // Use enhanced route
      const enrichedRoute = await this.enrichRouteWithUSD(enhancedResponse.route, request);
      return {
        route: enrichedRoute,
        alternatives: enhancedResponse.alternatives,
        timestamp: Date.now(),
        expiresAt: Date.now() + (QUOTE_EXPIRATION_SECONDS * 1000),
      };
    }
  } catch (error) {
    console.warn('[RouteService] Enhanced routing fallback failed:', error);
    // Continue with existing error handling
  }
  
  // Existing error handling (if enhanced system also fails)
  const routerNames = eligibleRouters.map(r => r.displayName || r.name).join(', ');
  // ... rest of error handling
}
```

---

## 5. Unwrap Logic (MEDIUM PRIORITY)

### Current Status
- ❌ No unwrap executor

### Implementation Needed

**Already included in MultiStepExecutor** (see `executeUnwrapStep()` method in PRODUCTION_IMPLEMENTATION_PLAN.md).

**Or create separate file**: `lib/frontend/services/swap-executor/executors/unwrap-executor.ts`

---

## 6. Graph Update Scheduler (MEDIUM PRIORITY)

### Current Status
- ❌ No background job to update graph

### Implementation Needed

#### File: `lib/backend/routing/graph-builder/graph-updater.ts` (CREATE NEW)

```typescript
import { getGraphBuilder } from './graph-builder';

export class GraphUpdater {
  private updateInterval: NodeJS.Timeout | null = null;
  
  start(intervalMinutes: number = 5) {
    // Update immediately
    this.updateAllGraphs();
    
    // Then update periodically
    this.updateInterval = setInterval(() => {
      this.updateAllGraphs();
    }, intervalMinutes * 60 * 1000);
  }
  
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  private async updateAllGraphs() {
    const chains = [1, 56, 137, 42161, 10, 8453]; // Supported chains
    const graphBuilder = getGraphBuilder();
    
    for (const chainId of chains) {
      try {
        await graphBuilder.buildGraph(chainId);
        console.log(`[GraphUpdater] Updated graph for chain ${chainId}`);
      } catch (error) {
        console.error(`[GraphUpdater] Error updating chain ${chainId}:`, error);
      }
    }
  }
}

// Start updater (call this on app startup)
export function startGraphUpdater() {
  const updater = new GraphUpdater();
  updater.start(5); // Update every 5 minutes
  return updater;
}
```

---

## Implementation Priority

### Must Have (Week 1)
1. ✅ Graph data population (TheGraph + RPC)
2. ✅ RouteService fallback logic
3. ✅ Test pathfinding with real data

### Must Have (Week 2)
1. ✅ Multi-step executor
2. ✅ Register in SwapExecutor
3. ✅ Test simple multi-hop execution

### Should Have (Week 3)
1. ✅ Bridge API integration
2. ✅ Bridge execution
3. ✅ Test cross-chain routes

### Nice to Have (Week 4)
1. ✅ Graph update scheduler
2. ✅ Unwrap executor (if separate)
3. ✅ Gas optimization

---

## Testing Checklist

### Phase 1: Graph Data
- [ ] Graph populates with real pairs
- [ ] Pathfinding finds routes
- [ ] Routes are accurate

### Phase 2: Execution
- [ ] Multi-hop swap executes
- [ ] Chain switching works
- [ ] Error handling works

### Phase 3: Cross-Chain
- [ ] Bridge execution works
- [ ] Status tracking works
- [ ] End-to-end flow works

---

**Status**: Implementation Guide Complete  
**Next**: Start with Graph Data Population


