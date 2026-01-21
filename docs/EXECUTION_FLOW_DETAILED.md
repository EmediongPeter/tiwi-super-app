# Detailed Execution Flow: TWC → ETH Example

## Complete Execution Flow Breakdown

### Route: TWC → WBNB → WETH (BSC) → Bridge → WETH (Ethereum) → ETH

## Step-by-Step Execution

### Step 1: Route Discovery

```typescript
// User enters: TWC → ETH
// System tries existing routers first

RouteService.getRoute({
  fromToken: { chainId: 56, address: TWC },
  toToken: { chainId: 1, address: ETH },
  fromAmount: "1000",
})
  ↓
Try PancakeSwap: null (cross-chain not supported)
Try Uniswap: null (cross-chain not supported)
Try LiFi: null (no route found)
  ↓
Enhanced System Activates
  ↓
RouteServiceEnhancer.enhanceRoute()
  ↓
QuoteAggregator finds:
  - Universal route: TWC → WBNB → WETH (BSC)
  - Cross-chain: WETH (BSC) → WETH (Ethereum)
  - Universal route: WETH → ETH (Ethereum, unwrap)
  ↓
Returns combined route
```

### Step 2: Route Structure

```typescript
Route {
  router: 'universal',
  path: [TWC, WBNB, WETH, WETH, ETH], // Token addresses
  steps: [
    {
      stepId: 'step-1',
      type: 'swap',
      chainId: 56,
      fromToken: TWC,
      toToken: WBNB,
      dex: 'pancakeswap',
      amountIn: "1000",
      amountOut: "50", // Estimated
    },
    {
      stepId: 'step-2',
      type: 'swap',
      chainId: 56,
      fromToken: WBNB,
      toToken: WETH,
      dex: 'pancakeswap',
      amountIn: "50", // From step 1
      amountOut: "0.1", // Estimated
    },
    {
      stepId: 'step-3',
      type: 'bridge',
      fromChain: 56,
      toChain: 1,
      fromToken: WETH,
      toToken: WETH,
      bridge: 'stargate',
      amountIn: "0.1",
      amountOut: "0.099", // After bridge fee
    },
    {
      stepId: 'step-4',
      type: 'unwrap',
      chainId: 1,
      fromToken: WETH,
      toToken: ETH,
      amountIn: "0.099",
      amountOut: "0.099", // 1:1 unwrap
    },
  ],
}
```

### Step 3: Execution (What Needs to Be Built)

#### Current State: ❌ MultiStepExecutor doesn't exist

#### What Needs to Be Built:

```typescript
// lib/frontend/services/swap-executor/executors/multi-step-executor.ts

export class MultiStepExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    return route.router === 'universal' || route.steps.length > 1;
  }
  
  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, userAddress, onStatusUpdate } = params;
    
    try {
      // Execute each step sequentially
      let currentAmount = BigInt(params.fromAmount);
      let currentChain = params.fromToken.chainId!;
      
      for (let i = 0; i < route.steps.length; i++) {
        const step = route.steps[i];
        
        // Update status
        onStatusUpdate?.({
          stage: this.getStageForStep(step),
          message: this.getMessageForStep(step, i + 1, route.steps.length),
        });
        
        // Switch chain if needed
        if (step.chainId !== currentChain) {
          await ensureCorrectChain(step.chainId);
          currentChain = step.chainId;
        }
        
        // Execute step
        const stepResult = await this.executeStep(step, currentAmount, userAddress);
        
        if (!stepResult.success) {
          throw new Error(`Step ${i + 1} failed: ${stepResult.error}`);
        }
        
        // Update amount for next step
        currentAmount = stepResult.amountOut;
      }
      
      return {
        success: true,
        txHash: 'final-tx-hash', // Last transaction hash
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  private async executeStep(
    step: RouteStep,
    amountIn: bigint,
    userAddress: string
  ): Promise<{ success: boolean; amountOut: bigint; txHash?: string; error?: string }> {
    switch (step.type) {
      case 'swap':
        return await this.executeSwap(step, amountIn, userAddress);
      case 'bridge':
        return await this.executeBridge(step, amountIn, userAddress);
      case 'unwrap':
        return await this.executeUnwrap(step, amountIn, userAddress);
      default:
        return { success: false, error: 'Unknown step type' };
    }
  }
  
  private async executeSwap(
    step: RouteStep,
    amountIn: bigint,
    userAddress: string
  ) {
    // Use existing EVMDEXExecutor for swaps
    const executor = new PancakeSwapExecutor(); // or UniswapExecutor
    // ... execute swap
  }
  
  private async executeBridge(
    step: RouteStep,
    amountIn: bigint,
    userAddress: string
  ) {
    // Use bridge adapter
    const bridgeRegistry = getBridgeRegistry();
    const bridge = bridgeRegistry.getBridge(step.bridgeId);
    // ... execute bridge
  }
  
  private async executeUnwrap(
    step: RouteStep,
    amountIn: bigint,
    userAddress: string
  ) {
    // Unwrap WETH to ETH
    // ... execute unwrap
  }
}
```

### Step 4: Actual Transaction Flow

#### Transaction 1: Approval (BSC)
```
Chain: BSC (56)
Contract: TWC Token
Function: approve(routerAddress, amount)
Gas: ~46,000
User Signs: ✅ Signature #1
```

#### Transaction 2: Multi-Hop Swap (BSC)
```
Chain: BSC (56)
Contract: PancakeSwap Router
Function: swapExactTokensForTokens(
  amountIn,
  amountOutMin,
  [TWC, WBNB, WETH], // Path
  recipient,
  deadline
)
Gas: ~150,000
User Signs: ✅ Signature #2
Result: User receives WETH on BSC
```

**Alternative** (if router doesn't support multi-hop):
```
Transaction 2a: TWC → WBNB
Transaction 2b: WBNB → WETH (uses output from 2a)
User Signs: ✅ Signature #2, ✅ Signature #3
```

#### Transaction 3: Bridge (BSC → Ethereum)
```
Chain: BSC (56)
Contract: Stargate Bridge
Function: swap(
  chainId,
  srcPoolId,
  dstPoolId,
  amountLD,
  amountLDMin,
  lzTxParams
)
Gas: ~200,000
User Signs: ✅ Signature #3 (or #4)
Result: Bridge initiated, WETH locked
```

#### Transaction 4: Bridge Completion (Automatic)
```
Chain: Ethereum (1)
Contract: Stargate Bridge
Function: (automatic, no user signature)
Result: WETH arrives on Ethereum
Time: ~5-10 minutes
```

#### Transaction 5: Unwrap WETH (Ethereum)
```
Chain: Ethereum (1)
Contract: WETH Contract
Function: withdraw(amount)
Gas: ~35,000
User Signs: ✅ Signature #4 (or #5)
Result: User receives ETH
```

---

## What's Missing - Detailed Breakdown

### 1. Graph Data Population

**File**: `lib/backend/routing/graph-builder/pair-fetcher.ts`

**Current**: Placeholder returns empty array

**Needed**:
```typescript
// Real TheGraph implementation
async fetchFromTheGraph(factoryAddress: Address): Promise<PairEdge[]> {
  // 1. Query TheGraph subgraph
  // 2. Get all pairs with liquidity > threshold
  // 3. Transform to PairEdge format
  // 4. Return edges
}

// Real DexScreener implementation
async fetchFromDexScreener(chainId: number): Promise<PairEdge[]> {
  // 1. Call DexScreener API
  // 2. Get pairs for chain
  // 3. Transform to PairEdge format
  // 4. Return edges
}

// Real RPC implementation
async fetchFromRPC(factory, tokenA, tokenB): Promise<PairEdge | null> {
  // 1. Get pair address from factory
  // 2. Get reserves from pair
  // 3. Calculate liquidity
  // 4. Return edge
}
```

### 2. Multi-Step Executor

**File**: `lib/frontend/services/swap-executor/executors/multi-step-executor.ts` (NEW)

**Needed**:
- Step-by-step execution logic
- Chain switching between steps
- Amount passing between steps
- Error handling and recovery
- Status updates for each step

### 3. Bridge Execution

**Files**: 
- `lib/backend/routing/bridges/stargate-adapter.ts`
- `lib/backend/routing/bridges/socket-adapter.ts`

**Current**: Placeholder implementations

**Needed**:
- Real API calls to Stargate/Socket
- Transaction building
- Status polling
- Error handling

### 4. Unwrap Logic

**File**: `lib/frontend/services/swap-executor/executors/unwrap-executor.ts` (NEW)

**Needed**:
- WETH contract interaction
- Unwrap transaction building
- Native token handling

### 5. Route Quote Accuracy

**File**: `lib/backend/routing/pathfinder/route-scorer.ts`

**Current**: Simplified AMM calculations

**Needed**:
- Real router contract calls (`getAmountsOut`)
- Accurate price impact
- Real fee calculations

---

## Implementation Checklist

### Phase 1: Graph Data (Week 1)
- [ ] Implement TheGraph integration for BSC
- [ ] Implement TheGraph integration for Ethereum
- [ ] Implement DexScreener integration
- [ ] Implement direct RPC pair fetching
- [ ] Test graph population
- [ ] Verify pathfinding works with real data

### Phase 2: Execution (Week 2)
- [ ] Create MultiStepExecutor class
- [ ] Implement step-by-step execution
- [ ] Add chain switching logic
- [ ] Add error handling
- [ ] Test with simple multi-hop route

### Phase 3: Bridges (Week 3)
- [ ] Implement Stargate API integration
- [ ] Implement Socket.tech API integration
- [ ] Add bridge execution logic
- [ ] Add bridge status tracking
- [ ] Test bridge execution

### Phase 4: Polish (Week 4)
- [ ] Add unwrap logic
- [ ] Improve quote accuracy
- [ ] Add gas optimization
- [ ] Add comprehensive error handling
- [ ] End-to-end testing

---

**Status**: Ready for Implementation  
**Next**: Start with Phase 1 (Graph Data)


