# Tiwi Protocol: Universal Token Routing System - Implementation Plan

## Executive Summary

This document outlines the comprehensive implementation plan to transform Tiwi Protocol into a universal token routing system capable of executing any token-to-token swap across any EVM chain, supporting both direct and multi-hop routes (including cross-chain swaps) through a single user transaction.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Architecture Design](#architecture-design)
3. [Implementation Phases](#implementation-phases)
4. [Technical Specifications](#technical-specifications)
5. [Resource List](#resource-list)
6. [Success Criteria](#success-criteria)

---

## Current State Analysis

### Existing Implementation

#### Strengths
1. **Router Adapter Pattern**: Clean separation with `BaseRouter` and specific adapters (PancakeSwap, Uniswap, LiFi, Jupiter)
2. **Basic Multi-Hop Support**: 
   - PancakeSwap adapter has graph-based routing (`findBestRoute`)
   - Uniswap adapter has multi-hop pathfinding with hardcoded intermediaries
   - Uses BFS-like algorithms to find paths up to 3 hops
3. **Cross-Chain Foundation**: LiFi adapter already supports cross-chain swaps
4. **Route Service**: Centralized `RouteService` orchestrates multiple routers
5. **Execution Engine**: `SwapExecutor` with router-specific executors

#### Gaps Identified

1. **Limited Intermediary Selection**
   - Hardcoded intermediary tokens (WETH, USDC, DAI, BUSD)
   - No dynamic discovery of best intermediaries
   - No liquidity-based intermediary ranking

2. **No Universal Liquidity Graph**
   - Each router builds its own graph on-demand
   - No shared, persistent liquidity graph across routers
   - No caching of pair data

3. **Inefficient Pathfinding**
   - Brute-force path testing (tries all combinations)
   - No Dijkstra/A* optimization
   - No price impact calculation during pathfinding

4. **Limited Cross-Chain Intelligence**
   - LiFi handles cross-chain but no optimization
   - No comparison of multiple bridge options
   - No gas cost optimization across chains

5. **No Route Aggregation**
   - Doesn't split routes across multiple DEXes
   - No partial route optimization
   - Single router per route

6. **Execution Limitations**
   - No meta-transaction support
   - No atomic multi-step execution
   - Limited fallback mechanisms

---

## Architecture Design

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  (Route Display, Confirmation, Progress Tracking)            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Route Service Layer                        │
│  (Route Request → Quote Aggregation → Best Route Selection)  │
└───────────┬──────────────────────────────┬──────────────────┘
            │                              │
┌───────────▼──────────┐      ┌───────────▼──────────┐
│  Liquidity Graph     │      │   Pathfinding        │
│  Builder             │      │   Engine             │
│  - Graph Builder    │      │  - BFS/Dijkstra     │
│  - Pair Fetcher      │      │  - Route Optimizer  │
│  - Cache Manager     │      │  - Price Impact     │
└───────────┬──────────┘      └───────────┬──────────┘
            │                              │
┌───────────▼──────────────────────────────▼──────────┐
│              Router Adapter Layer                      │
│  (PancakeSwap | Uniswap | LiFi | Jupiter | ...)      │
└───────────┬──────────────────────────────┬───────────┘
            │                              │
┌───────────▼──────────┐      ┌───────────▼──────────┐
│  Execution Engine    │      │   Bridge Layer       │
│  - Multi-hop Exec    │      │  - Stargate          │
│  - Gas Optimizer     │      │  - Socket.tech       │
│  - Status Tracker   │      │  - Li.FI             │
└──────────────────────┘      └──────────────────────┘
```

### Core Components

#### 1. Liquidity Graph Builder

**Purpose**: Build and maintain a real-time graph of all token pairs across supported DEXes.

**Key Features**:
- **Graph Structure**: 
  - Nodes: Token addresses
  - Edges: Trading pairs with liquidity data
  - Edge weights: Price impact, fees, liquidity depth

- **Data Sources**:
  - TheGraph subgraphs (Uniswap, PancakeSwap, etc.)
  - DexScreener API (real-time pair data)
  - Direct RPC calls (on-demand pair verification)
  - Factory contract events (new pair discovery)

- **Storage Strategy**:
  - **Tier 1 (Hot Cache)**: High-liquidity pairs (>$1M) - In-memory, updated every 5 minutes
  - **Tier 2 (Warm Cache)**: Medium-liquidity pairs ($100K-$1M) - Redis, updated every 15 minutes
  - **Tier 3 (Cold Storage)**: Low-liquidity pairs (<$100K) - Database, fetched on-demand

- **Graph Updates**:
  - Real-time updates via WebSocket subscriptions
  - Batch updates every 5 minutes for hot pairs
  - On-demand fetching for cold pairs

**Implementation Location**: `lib/backend/routing/graph-builder/`

#### 2. Pathfinding Engine

**Purpose**: Find optimal swap routes using graph algorithms.

**Algorithms**:
1. **BFS (Breadth-First Search)**: Fast discovery of all possible paths
2. **Dijkstra's Algorithm**: Optimal path based on cost (fees + price impact)
3. **A* Search**: Heuristic-based optimization for large graphs

**Route Optimization Criteria**:
1. **Output Amount** (primary): Maximize tokens received
2. **Price Impact**: Minimize slippage
3. **Gas Costs**: Minimize transaction fees
4. **Hop Count**: Prefer fewer hops (but not at expense of output)
5. **Liquidity Depth**: Prefer routes with higher liquidity

**Intermediary Selection Strategy**:
```
Priority Order:
1. Native tokens (ETH, BNB, MATIC) - highest liquidity
2. Major stablecoins (USDC, USDT, DAI) - price stability
3. Blue-chip tokens (WBTC, WETH) - high liquidity
4. Chain-specific tokens (BUSD on BSC, etc.)
5. Other tokens (by liquidity ranking)
```

**Implementation Location**: `lib/backend/routing/pathfinder/`

#### 3. Quote Aggregator

**Purpose**: Collect quotes from multiple sources and rank them.

**Sources**:
- Direct DEX quotes (Uniswap, PancakeSwap)
- Aggregator APIs (1inch, 0x)
- Cross-chain bridges (LiFi, Stargate, Socket)
- Internal pathfinding engine

**Ranking Algorithm**:
```typescript
score = (outputAmount * outputPrice) 
      - (gasCost * gasPrice) 
      - (priceImpact * inputAmount * inputPrice)
      - (protocolFees)
```

**Implementation Location**: `lib/backend/routing/quote-aggregator/`

#### 4. Cross-Chain Integration

**Purpose**: Enable seamless chain-to-chain swaps.

**Bridge Integration**:
1. **Li.FI SDK**: Primary cross-chain aggregator
2. **Stargate**: Native asset bridging
3. **Socket.tech**: Multi-bridge aggregation
4. **Direct Bridge APIs**: For specific chains

**Cross-Chain Route Structure**:
```
Source Chain:
  - Swap: TokenA → BridgeToken (via DEX)
  - Bridge: BridgeToken (Chain A) → BridgeToken (Chain B)
Destination Chain:
  - Swap: BridgeToken → TokenB (via DEX)
```

**Gas Management**:
- Estimate gas on both chains
- Handle native token requirements
- Support gasless bridging (where available)

**Implementation Location**: `lib/backend/bridges/`

#### 5. Execution Engine

**Purpose**: Execute complex routes atomically.

**Execution Strategies**:
1. **Single Transaction**: For same-chain multi-hop swaps
2. **Meta-Transactions**: For cross-chain (user signs once)
3. **Multi-Step Execution**: For complex cross-chain routes

**Fallback Logic**:
- If step 1 fails → retry with alternative route
- If bridge fails → try alternative bridge
- If destination swap fails → refund or hold in bridge token

**Gas Optimization**:
- Batch approvals
- Multicall for multiple swaps
- Gas estimation before execution

**Implementation Location**: `lib/frontend/services/swap-executor/executors/`

---

## Implementation Phases

### Phase 1: Liquidity Graph Builder (Weeks 1-3)

**Goals**:
- Build real-time liquidity graph
- Implement tiered caching
- Create graph update mechanisms

**Tasks**:
1. **Week 1**: Graph data structure and storage
   - Design graph schema (nodes, edges, weights)
   - Implement in-memory graph (hot cache)
   - Set up Redis for warm cache
   - Database schema for cold storage

2. **Week 2**: Data fetching and updates
   - Integrate TheGraph subgraphs
   - DexScreener API integration
   - Direct RPC pair fetching
   - Factory event listeners

3. **Week 3**: Graph maintenance and optimization
   - Update scheduling
   - Cache invalidation strategies
   - Graph pruning (remove low-liquidity pairs)
   - Performance optimization

**Deliverables**:
- `LiquidityGraph` class
- `GraphBuilder` service
- `PairFetcher` utilities
- Graph update scheduler

### Phase 2: Pathfinding Engine (Weeks 4-6)

**Goals**:
- Implement pathfinding algorithms
- Smart intermediary selection
- Route optimization

**Tasks**:
1. **Week 4**: Core pathfinding algorithms
   - BFS implementation
   - Dijkstra's algorithm
   - A* search (optional, for optimization)

2. **Week 5**: Route optimization
   - Price impact calculation
   - Gas cost estimation
   - Route scoring algorithm
   - Top-N route selection

3. **Week 6**: Intermediary intelligence
   - Dynamic intermediary discovery
   - Liquidity-based ranking
   - Token categorization (native, stable, bluechip, alt)

**Deliverables**:
- `Pathfinder` class
- `RouteOptimizer` service
- `IntermediarySelector` utility
- Route scoring algorithm

### Phase 3: Cross-Chain Integration (Weeks 7-9)

**Goals**:
- Integrate multiple bridge protocols
- Combine swaps with bridging
- Handle multi-chain gas

**Tasks**:
1. **Week 7**: Bridge protocol integration
   - Stargate integration
   - Socket.tech integration
   - Enhance LiFi integration
   - Bridge comparison logic

2. **Week 8**: Cross-chain route building
   - Source swap + bridge + destination swap
   - Gas estimation across chains
   - Bridge fee calculation
   - Route optimization for cross-chain

3. **Week 9**: Status tracking and error handling
   - Multi-chain transaction tracking
   - Bridge status polling
   - Error recovery mechanisms
   - Timeout handling

**Deliverables**:
- Bridge adapters (Stargate, Socket)
- Cross-chain route builder
- Multi-chain status tracker
- Error recovery system

### Phase 4: Execution Engine (Weeks 10-12)

**Goals**:
- Single-signature execution
- Atomic multi-step execution
- Fallback mechanisms

**Tasks**:
1. **Week 10**: Meta-transaction support
   - Aggregator contract integration
   - Single signature flow
   - Transaction batching

2. **Week 11**: Multi-step execution
   - Step-by-step execution
   - Intermediate state tracking
   - Rollback mechanisms

3. **Week 12**: Gas optimization and simulation
   - Gas estimation optimization
   - Transaction simulation
   - Pre-execution validation
   - Gas price optimization

**Deliverables**:
- Meta-transaction executor
- Multi-step execution engine
- Gas optimizer
- Transaction simulator

### Phase 5: User Experience (Weeks 13-14)

**Goals**:
- Clear route presentation
- Real-time progress tracking
- Error handling UI

**Tasks**:
1. **Week 13**: Route visualization
   - Route breakdown component
   - Step-by-step display
   - Fee breakdown
   - Price impact visualization

2. **Week 14**: Progress tracking and errors
   - Real-time status updates
   - Progress indicators
   - Error messages and recovery
   - Success confirmations

**Deliverables**:
- Route display components
- Progress tracking UI
- Error handling components
- Success/confirmation modals

### Phase 6: Testing and Deployment (Weeks 15-16)

**Goals**:
- Comprehensive testing
- Security audit preparation
- Production deployment

**Tasks**:
1. **Week 15**: Testing
   - Unit tests (80%+ coverage)
   - Integration tests
   - End-to-end tests
   - Performance testing

2. **Week 16**: Deployment
   - Testnet deployment
   - Security audit
   - Mainnet deployment
   - Monitoring setup

**Deliverables**:
- Test suite
- Testnet deployment
- Security audit report
- Production deployment
- Monitoring dashboard

---

## Technical Specifications

### Data Structures

#### Liquidity Graph
```typescript
interface LiquidityGraph {
  nodes: Map<Address, TokenNode>;
  edges: Map<string, PairEdge>;
}

interface TokenNode {
  address: Address;
  chainId: number;
  symbol: string;
  decimals: number;
  liquidityUSD: number;
  category: 'native' | 'stable' | 'bluechip' | 'alt';
}

interface PairEdge {
  tokenA: Address;
  tokenB: Address;
  chainId: number;
  dex: string;
  liquidityUSD: number;
  feeBps: number;
  reserve0: bigint;
  reserve1: bigint;
  lastUpdated: number;
}
```

#### Route
```typescript
interface Route {
  path: Address[];
  steps: RouteStep[];
  expectedOutput: bigint;
  priceImpact: number;
  gasEstimate: bigint;
  totalFees: {
    protocol: string;
    gas: string;
    bridge?: string;
  };
  score: number;
}

interface RouteStep {
  fromToken: Address;
  toToken: Address;
  dex: string;
  amountIn: bigint;
  amountOut: bigint;
  priceImpact: number;
  gasEstimate: bigint;
}
```

### Algorithms

#### Pathfinding (Dijkstra's)
```typescript
function findOptimalRoute(
  graph: LiquidityGraph,
  fromToken: Address,
  toToken: Address,
  amountIn: bigint,
  maxHops: number = 3
): Route[] {
  // Priority queue: [cost, path, currentToken]
  const queue = new PriorityQueue<[number, Address[], Address]>();
  const visited = new Set<string>();
  const routes: Route[] = [];
  
  queue.enqueue([0, [fromToken], fromToken]);
  
  while (!queue.isEmpty() && routes.length < 10) {
    const [cost, path, current] = queue.dequeue();
    
    if (current === toToken) {
      routes.push(buildRoute(path, amountIn));
      continue;
    }
    
    if (path.length > maxHops + 1) continue;
    
    const neighbors = graph.getNeighbors(current);
    for (const neighbor of neighbors) {
      const edge = graph.getEdge(current, neighbor);
      const newCost = cost + calculateEdgeCost(edge, amountIn);
      const pathKey = `${path.join('-')}-${neighbor}`;
      
      if (!visited.has(pathKey)) {
        visited.add(pathKey);
        queue.enqueue([newCost, [...path, neighbor], neighbor]);
      }
    }
  }
  
  return routes.sort((a, b) => b.score - a.score).slice(0, 3);
}
```

### API Endpoints

#### Get Route
```typescript
POST /api/route
{
  fromToken: { chainId: number, address: string },
  toToken: { chainId: number, address: string },
  fromAmount: string,
  slippage?: number,
  slippageMode?: 'auto' | 'fixed'
}

Response:
{
  route: Route,
  alternatives?: Route[],
  timestamp: number,
  expiresAt: number
}
```

---

## Resource List

### Documentation

#### Protocol Documentation
- **1inch Fusion API**: https://help.1inch.io/en/articles/6796085-what-is-1inch-fusion-and-how-does-it-work
- **0x Protocol RFQ**: https://0x.org/docs/0x-swap-api/advanced-topics/about-the-rfq-system
- **Li.FI SDK**: https://docs.li.fi/
- **Uniswap Universal Router**: https://docs.uniswap.org/protocol/reference/periphery/UniversalRouter
- **PancakeSwap Router**: https://docs.pancakeswap.finance/developers/smart-contracts/pancakeswap-exchange/v2-contracts/router-v2
- **Stargate Bridge**: https://stargate.finance/docs
- **Socket.tech**: https://docs.socket.tech/

#### Graph and Data Sources
- **TheGraph**: https://thegraph.com/docs/
- **DexScreener API**: https://docs.dexscreener.com/
- **Uniswap Subgraph**: https://thegraph.com/hosted-service/subgraph/uniswap/uniswap-v2
- **PancakeSwap Subgraph**: https://thegraph.com/hosted-service/subgraph/pancakeswap/pairs

### GitHub Repositories

#### Reference Implementations
- **1inch Interface**: https://github.com/1inch-community/interface
- **0x Protocol**: https://github.com/0xProject/0x-monorepo
- **Li.FI SDK**: https://github.com/lifinance/sdk
- **Uniswap Universal Router**: https://github.com/Uniswap/universal-router
- **PancakeSwap Router**: https://github.com/pancakeswap/pancake-frontend

#### Algorithm References
- **Graph Algorithms**: https://github.com/trekhleb/javascript-algorithms
- **Dijkstra Implementation**: https://github.com/mburst/dijkstras-algorithm

### Research Papers

#### Routing Algorithms
- **Dijkstra's Algorithm**: https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm
- **A* Search Algorithm**: https://en.wikipedia.org/wiki/A*_search_algorithm
- **Shortest Path Algorithms Survey**: Various academic papers on graph algorithms

#### DeFi Routing
- **Uniswap V2 Whitepaper**: https://uniswap.org/whitepaper.pdf
- **AMM Price Impact**: Research on constant product market makers

### Security Audits

#### Protocol Audits
- **1inch Security Audit**: https://blog.1inch.io/1inch-network-security-audit-2021-7c3e0e0a1f7e
- **0x Protocol Security**: https://0x.org/docs/security
- **Uniswap Audits**: https://uniswap.org/audit
- **Li.FI Security**: Check Li.FI documentation for audit reports

### Tools and Libraries

#### TypeScript/JavaScript
- **viem**: Ethereum library (already in use)
- **ethers.js**: Alternative Ethereum library
- **@lifi/sdk**: Li.FI SDK (already integrated)
- **graphql-request**: For TheGraph queries

#### Graph Libraries
- **graphology**: Graph data structure library
- **ngraph.graph**: Lightweight graph library

#### Testing
- **Jest**: Unit testing
- **Playwright**: E2E testing
- **Hardhat**: Smart contract testing

---

## Success Criteria

### Functional Requirements

- [ ] **Universal Routing**: Any token on Chain A → Any token on Chain B (with liquidity)
- [ ] **Single Transaction**: User signs once for entire route
- [ ] **Quote Speed**: <5 seconds for complex routes
- [ ] **Success Rate**: >99% for simulated routes
- [ ] **Route Display**: Clear UX showing total output amount

### Technical Requirements

- [ ] **Type Safety**: TypeScript throughout, no `any` types
- [ ] **Test Coverage**: >80% code coverage
- [ ] **Error Handling**: Comprehensive error boundaries
- [ ] **Gas Optimization**: Efficient gas usage
- [ ] **Scalability**: Supports 10k+ tokens

### Security Requirements

- [ ] **Price Manipulation**: No vulnerabilities
- [ ] **Slippage Protection**: Per-hop slippage protection
- [ ] **Bridge Security**: Secure bridge integrations
- [ ] **Audit Ready**: Code ready for security audit

### Performance Metrics

- [ ] **Graph Update**: <30 seconds for hot pairs
- [ ] **Pathfinding**: <2 seconds for 3-hop routes
- [ ] **Quote Aggregation**: <5 seconds for multi-source quotes
- [ ] **Execution**: <60 seconds for cross-chain swaps

---

## Code Structure

```
src/
├── lib/
│   ├── backend/
│   │   ├── routing/
│   │   │   ├── graph-builder/
│   │   │   │   ├── liquidity-graph.ts          # Main graph class
│   │   │   │   ├── graph-builder.ts            # Graph construction
│   │   │   │   ├── pair-fetcher.ts             # Pair data fetching
│   │   │   │   ├── cache-manager.ts            # Tiered caching
│   │   │   │   └── graph-updater.ts            # Update scheduler
│   │   │   ├── pathfinder/
│   │   │   │   ├── pathfinder.ts               # Main pathfinding
│   │   │   │   ├── dijkstra.ts                 # Dijkstra algorithm
│   │   │   │   ├── route-optimizer.ts          # Route optimization
│   │   │   │   ├── intermediary-selector.ts     # Smart intermediary selection
│   │   │   │   └── route-scorer.ts             # Route scoring
│   │   │   ├── quote-aggregator/
│   │   │   │   ├── quote-aggregator.ts         # Multi-source aggregation
│   │   │   │   ├── quote-ranker.ts             # Quote ranking
│   │   │   │   └── quote-validator.ts          # Quote validation
│   │   │   └── simulator/
│   │   │       ├── route-simulator.ts          # Route simulation
│   │   │       └── price-impact-calculator.ts   # Price impact
│   │   ├── bridges/
│   │   │   ├── stargate/
│   │   │   │   ├── stargate-adapter.ts         # Stargate integration
│   │   │   │   └── stargate-types.ts           # Type definitions
│   │   │   ├── socket/
│   │   │   │   ├── socket-adapter.ts           # Socket.tech integration
│   │   │   │   └── socket-types.ts             # Type definitions
│   │   │   └── lifi/
│   │   │       └── lifi-enhancer.ts            # Enhanced LiFi integration
│   │   └── routers/
│   │       └── adapters/
│   │           └── [existing adapters enhanced]
│   └── frontend/
│       ├── services/
│       │   └── swap-executor/
│       │       ├── executors/
│       │       │   ├── multi-hop-executor.ts   # Multi-hop execution
│       │       │   ├── gas-optimizer.ts        # Gas optimization
│       │       │   └── status-tracker.ts      # Status tracking
│       │       └── [existing executors]
│       └── components/
│           └── swap/
│               ├── route-display/
│               │   ├── route-breakdown.tsx     # Route visualization
│               │   └── route-steps.tsx         # Step-by-step display
│               ├── confirmation-modal/
│               │   └── route-confirmation.tsx  # Single transaction approval
│               └── progress-indicator/
│                   └── swap-progress.tsx       # Multi-step status
```

---

## Next Steps

1. **Review and Approve**: Review this plan with the team
2. **Set Up Infrastructure**: Set up Redis, database, monitoring
3. **Start Phase 1**: Begin Liquidity Graph Builder implementation
4. **Iterate**: Follow agile methodology, ship incrementally

---

## Appendix

### Mathematical Models

#### Price Impact Calculation
```
For constant product AMM (Uniswap V2 style):
priceImpact = (amountIn / reserveIn) * 100

For multi-hop:
totalImpact = 1 - ∏(1 - impact_i)
```

#### Route Scoring
```
score = (outputAmount * outputPrice) 
      - (gasCost * gasPrice) 
      - (priceImpact * inputAmount * inputPrice * 0.01)
      - (protocolFees)
```

### Error Handling Strategies

1. **No Route Found**: Try alternative intermediaries, suggest different amounts
2. **Insufficient Liquidity**: Suggest splitting swap, lower amount
3. **Bridge Failure**: Try alternative bridge, refund mechanism
4. **Gas Estimation Failure**: Use conservative estimates, warn user
5. **Transaction Revert**: Retry with higher slippage, alternative route

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: Tiwi Protocol Team


