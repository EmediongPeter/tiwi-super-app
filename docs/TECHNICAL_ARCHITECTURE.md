# Universal Routing System - Technical Architecture

## System Architecture Overview

### High-Level Flow

```
User Request
    ↓
Route Service (orchestration)
    ↓
┌─────────────────────────────────────┐
│  Quote Aggregation Layer            │
│  - Liquidity Graph Query            │
│  - Pathfinding Engine               │
│  - Router Adapters (parallel)      │
│  - Bridge Adapters (if cross-chain) │
└─────────────────────────────────────┘
    ↓
Route Selection & Scoring
    ↓
Route Response (with alternatives)
    ↓
User Approval
    ↓
Execution Engine
    ↓
Transaction Execution
```

## Component Details

### 1. Liquidity Graph Builder

#### Architecture

```typescript
class LiquidityGraph {
  private nodes: Map<string, TokenNode>;
  private edges: Map<string, PairEdge>;
  private cache: GraphCache;
  
  // Hot cache: In-memory, updated every 5min
  // Warm cache: Redis, updated every 15min
  // Cold cache: Database, on-demand
}
```

#### Data Flow

```
1. Graph Initialization
   ├─ Fetch high-liquidity pairs from TheGraph
   ├─ Store in hot cache (in-memory)
   └─ Index by token address

2. Real-time Updates
   ├─ WebSocket subscriptions (high-liquidity pairs)
   ├─ Batch updates (medium-liquidity pairs)
   └─ On-demand fetching (low-liquidity pairs)

3. Graph Query
   ├─ Check hot cache first
   ├─ Fallback to warm cache (Redis)
   ├─ Fallback to cold cache (Database)
   └─ Last resort: Direct RPC call
```

#### Key Classes

**LiquidityGraph**
- Main graph data structure
- Provides neighbor queries
- Handles graph updates

**GraphBuilder**
- Constructs graph from multiple sources
- Handles graph merging
- Manages graph versioning

**PairFetcher**
- Fetches pairs from TheGraph
- Fetches pairs from DexScreener
- Fetches pairs via direct RPC

**CacheManager**
- Manages tiered caching
- Handles cache invalidation
- Optimizes cache hits

### 2. Pathfinding Engine

#### Algorithm Selection

**For Small Graphs (<1000 nodes)**: BFS
- Fast discovery
- Simple implementation
- Good for direct/2-hop routes

**For Medium Graphs (1000-10000 nodes)**: Dijkstra
- Optimal path finding
- Cost-based optimization
- Good for 3-hop routes

**For Large Graphs (>10000 nodes)**: A*
- Heuristic-based optimization
- Faster than Dijkstra
- Good for complex routes

#### Pathfinding Flow

```
1. Graph Query
   ├─ Get neighbors of fromToken
   ├─ Filter by liquidity threshold
   └─ Rank by liquidity/category

2. Path Exploration
   ├─ BFS: Explore all paths up to maxHops
   ├─ Dijkstra: Find optimal path
   └─ A*: Find optimal path with heuristics

3. Route Validation
   ├─ Check pair existence
   ├─ Verify reserves
   ├─ Calculate price impact
   └─ Estimate gas costs

4. Route Scoring
   ├─ Calculate output amount
   ├─ Calculate total fees
   ├─ Calculate price impact
   └─ Generate score

5. Route Selection
   ├─ Sort by score
   ├─ Filter by constraints
   └─ Return top N routes
```

#### Intermediary Selection Logic

```typescript
function selectIntermediaries(
  fromToken: TokenNode,
  toToken: TokenNode,
  graph: LiquidityGraph
): Address[] {
  const candidates: TokenNode[] = [];
  
  // Priority 1: Native tokens
  const nativeTokens = graph.getTokensByCategory('native');
  candidates.push(...nativeTokens);
  
  // Priority 2: Stablecoins
  const stables = graph.getTokensByCategory('stable');
  candidates.push(...stables);
  
  // Priority 3: Blue-chip tokens
  const bluechips = graph.getTokensByCategory('bluechip');
  candidates.push(...bluechips);
  
  // Priority 4: High-liquidity tokens
  const highLiquidity = graph.getTokensByLiquidity(1_000_000); // $1M+
  candidates.push(...highLiquidity);
  
  // Filter and rank
  return candidates
    .filter(t => t.address !== fromToken.address && t.address !== toToken.address)
    .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
    .slice(0, 10) // Top 10 candidates
    .map(t => t.address);
}
```

### 3. Cross-Chain Integration

#### Bridge Selection Strategy

```typescript
async function selectBestBridge(
  fromChain: number,
  toChain: number,
  token: Address,
  amount: bigint
): Promise<BridgeQuote[]> {
  const bridges = [
    await getLiFiQuote(fromChain, toChain, token, amount),
    await getStargateQuote(fromChain, toChain, token, amount),
    await getSocketQuote(fromChain, toChain, token, amount),
  ];
  
  // Filter valid quotes
  const valid = bridges.filter(q => q !== null);
  
  // Rank by:
  // 1. Output amount (highest)
  // 2. Bridge time (fastest)
  // 3. Bridge fees (lowest)
  return valid.sort((a, b) => {
    if (a.outputAmount !== b.outputAmount) {
      return b.outputAmount - a.outputAmount;
    }
    if (a.estimatedTime !== b.estimatedTime) {
      return a.estimatedTime - b.estimatedTime;
    }
    return a.fees - b.fees;
  });
}
```

#### Cross-Chain Route Structure

```typescript
interface CrossChainRoute {
  sourceSwap: RouteStep;      // TokenA → BridgeToken (Chain A)
  bridge: BridgeStep;          // BridgeToken (Chain A) → BridgeToken (Chain B)
  destinationSwap: RouteStep; // BridgeToken → TokenB (Chain B)
  
  totalGas: {
    source: bigint;
    destination: bigint;
  };
  
  estimatedTime: number; // seconds
  bridgeFees: string;
}
```

### 4. Execution Engine

#### Execution Strategies

**Same-Chain Multi-Hop**:
```typescript
// Single transaction with path
router.swapExactTokensForTokens(
  amountIn,
  amountOutMin,
  path, // [tokenA, tokenB, tokenC]
  recipient,
  deadline
);
```

**Cross-Chain**:
```typescript
// Step 1: Source swap
await executeSwap(sourceSwap);

// Step 2: Bridge (user signs once via meta-transaction)
await executeBridge(bridgeStep);

// Step 3: Destination swap (after bridge completes)
await executeSwap(destinationSwap);
```

#### Gas Optimization

```typescript
class GasOptimizer {
  // Batch approvals
  async batchApprove(tokens: Address[], spender: Address): Promise<void> {
    const calls = tokens.map(token => ({
      to: token,
      data: encodeApprove(spender, MAX_UINT256),
    }));
    await multicall(calls);
  }
  
  // Optimize gas price
  async optimizeGasPrice(): Promise<bigint> {
    const current = await getGasPrice();
    const fast = await getFastGasPrice();
    // Use fast if within 20% of current
    return fast <= current * 120n / 100n ? fast : current;
  }
}
```

## Data Models

### Graph Data Model

```typescript
// Token Node
interface TokenNode {
  address: Address;
  chainId: number;
  symbol: string;
  decimals: number;
  liquidityUSD: number;
  category: 'native' | 'stable' | 'bluechip' | 'alt';
  lastUpdated: number;
}

// Pair Edge
interface PairEdge {
  id: string; // `${tokenA}-${tokenB}-${chainId}-${dex}`
  tokenA: Address;
  tokenB: Address;
  chainId: number;
  dex: string;
  factory: Address;
  pairAddress: Address;
  liquidityUSD: number;
  reserve0: bigint;
  reserve1: bigint;
  feeBps: number; // 30 = 0.3%
  lastUpdated: number;
  // Computed properties
  priceImpact: number; // For given amount
}
```

### Route Data Model

```typescript
interface Route {
  routeId: string;
  path: Address[];
  steps: RouteStep[];
  
  fromToken: {
    address: Address;
    chainId: number;
    amount: string;
    amountUSD: string;
  };
  
  toToken: {
    address: Address;
    chainId: number;
    amount: string;
    amountUSD: string;
  };
  
  // Metrics
  priceImpact: number; // Total price impact %
  gasEstimate: bigint;
  gasUSD: string;
  
  // Fees
  fees: {
    protocol: string; // DEX fees
    gas: string;
    bridge?: string; // If cross-chain
    tiwiProtocolFeeUSD: string;
    total: string;
  };
  
  // Scoring
  score: number;
  
  // Metadata
  router: string;
  expiresAt: number;
  raw?: any; // Router-specific data
}

interface RouteStep {
  stepId: string;
  fromToken: Address;
  toToken: Address;
  dex: string;
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  gasEstimate: bigint;
}
```

## API Design

### Route Request

```typescript
interface RouteRequest {
  fromToken: {
    chainId: number;
    address: string;
    symbol: string;
    decimals?: number;
  };
  toToken: {
    chainId: number;
    address: string;
    symbol: string;
    decimals?: number;
  };
  fromAmount: string;
  slippage?: number; // 0-100
  slippageMode?: 'auto' | 'fixed';
  order?: 'RECOMMENDED' | 'FASTEST' | 'CHEAPEST';
  liquidityUSD?: number; // Hint for auto slippage
  recipient?: string;
}
```

### Route Response

```typescript
interface RouteResponse {
  route: Route;
  alternatives?: Route[]; // Top 3 alternatives
  timestamp: number;
  expiresAt: number;
  error?: string;
}
```

## Performance Considerations

### Caching Strategy

1. **Hot Cache (In-Memory)**
   - High-liquidity pairs (>$1M)
   - Updated every 5 minutes
   - Size: ~10MB for major chains

2. **Warm Cache (Redis)**
   - Medium-liquidity pairs ($100K-$1M)
   - Updated every 15 minutes
   - TTL: 30 minutes
   - Size: ~100MB per chain

3. **Cold Cache (Database)**
   - Low-liquidity pairs (<$100K)
   - Updated on-demand
   - Persisted for 24 hours
   - Size: ~1GB per chain

### Optimization Techniques

1. **Parallel Queries**: Query multiple routers simultaneously
2. **Early Termination**: Stop pathfinding when good route found
3. **Graph Pruning**: Remove low-liquidity pairs from active graph
4. **Batch Operations**: Use multicall for multiple pair checks
5. **Lazy Loading**: Load graph data on-demand

## Error Handling

### Error Categories

1. **No Route Found**
   - Try alternative intermediaries
   - Suggest different amount
   - Suggest different token

2. **Insufficient Liquidity**
   - Split swap into smaller amounts
   - Suggest alternative route
   - Warn about high price impact

3. **Bridge Failure**
   - Try alternative bridge
   - Implement refund mechanism
   - Provide status updates

4. **Gas Estimation Failure**
   - Use conservative estimates
   - Warn user about uncertainty
   - Allow manual gas override

5. **Transaction Revert**
   - Retry with higher slippage
   - Try alternative route
   - Provide clear error message

## Security Considerations

1. **Price Manipulation Protection**
   - Validate reserves before execution
   - Use TWAP (Time-Weighted Average Price) where possible
   - Implement maximum price impact limits

2. **Slippage Protection**
   - Per-hop slippage limits
   - Total route slippage limits
   - Dynamic slippage adjustment

3. **Bridge Security**
   - Verify bridge contract addresses
   - Validate bridge quotes
   - Monitor bridge status

4. **Gas Optimization**
   - Prevent gas griefing
   - Set maximum gas limits
   - Optimize transaction batching

## Monitoring and Observability

### Key Metrics

1. **Performance**
   - Route query time (p50, p95, p99)
   - Pathfinding time
   - Graph update latency

2. **Success Rates**
   - Route found rate
   - Execution success rate
   - Bridge success rate

3. **User Experience**
   - Quote accuracy
   - Price impact accuracy
   - Gas estimation accuracy

### Logging

```typescript
// Structured logging
logger.info('Route found', {
  fromToken: route.fromToken.address,
  toToken: route.toToken.address,
  pathLength: route.path.length,
  priceImpact: route.priceImpact,
  executionTime: duration,
});
```

## Testing Strategy

### Unit Tests
- Graph building
- Pathfinding algorithms
- Route scoring
- Intermediary selection

### Integration Tests
- End-to-end route finding
- Cross-chain routing
- Execution flow

### Simulation Tests
- Route simulation
- Price impact calculation
- Gas estimation

### Load Tests
- Graph update performance
- Concurrent route queries
- Cache hit rates

---

**Document Version**: 1.0  
**Last Updated**: 2024


