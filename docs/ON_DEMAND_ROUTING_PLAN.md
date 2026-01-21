# On-Demand Routing Implementation Plan

## Overview
Replace graph-based routing with on-demand route finding using DexScreener and popular intermediaries. Always find routes, never return "no route".

## Key Principles
1. **On-Demand Discovery**: Query DexScreener when needed, no pre-population
2. **Popular Intermediaries**: Use WBNB/WETH/USDT/USDC as intermediaries
3. **Route Verification**: Use router.getAmountsOut to verify routes work
4. **LiFi for Cross-Chain**: Use LiFi for all bridging (they handle multiple bridges)
5. **Testable Phases**: Each phase can be tested independently

---

## Phase 1: Cleanup & Foundation ✅
**Goal**: Remove old graph implementation, set up new structure

**Tasks**:
1. Delete graph-based files:
   - `lib/backend/routing/graph-builder/` (entire directory)
   - `lib/backend/routing/pathfinder/` (entire directory)
   - Update imports in `quote-aggregator.ts`

2. Create new structure:
   - `lib/backend/routing/dex-registry.ts` - DEX configurations
   - `lib/backend/routing/intermediaries.ts` - Popular tokens per chain
   - `lib/backend/routing/on-demand-finder.ts` - Main route finder

**Test**: Verify old code removed, new files created

---

## Phase 2: DEX Registry ✅
**Goal**: Define supported DEXes with router addresses

**Tasks**:
1. Create `dex-registry.ts` with:
   - Router addresses per chain (PancakeSwap, Uniswap, etc.)
   - Factory addresses
   - DexScreener dexId mapping
   - Helper functions to get DEX config

2. Support chains:
   - BSC (56): PancakeSwap
   - Ethereum (1): Uniswap, SushiSwap
   - Polygon (137): QuickSwap
   - Optimism (10): Uniswap
   - Arbitrum (42161): Uniswap
   - Base (8453): Uniswap

**Test**: 
```typescript
const dex = findDEXByDexId(56, 'pancakeswap');
console.log(dex.routerAddress); // Should return PancakeSwap router
```

---

## Phase 3: Popular Intermediaries ✅
**Goal**: Define intermediary tokens per chain

**Tasks**:
1. Create `intermediaries.ts` with:
   - Popular tokens per chain (WBNB, WETH, USDT, USDC, etc.)
   - Priority order (native > stable > bluechip)
   - Helper functions

2. Define for each chain:
   - Native wrapped token (WBNB, WETH, WMATIC)
   - Stablecoins (USDT, USDC, BUSD, DAI)
   - Blue-chip tokens (ETH on BSC, etc.)

**Test**:
```typescript
const intermediaries = getIntermediaries(56);
console.log(intermediaries); // Should return [WBNB, USDT, BUSD, USDC, ETH]
```

---

## Phase 4: DexScreener Integration ✅
**Goal**: Query DexScreener for token pairs

**Tasks**:
1. Create `dexscreener-client.ts`:
   - Function to get pairs for a token: `getTokenPairs(tokenAddress, chainId)`
   - Filter by chain and supported DEXes
   - Return pair data with liquidity, DEX info

2. Handle DexScreener API:
   - Endpoint: `https://api.dexscreener.com/latest/dex/tokens/{tokenAddress}`
   - Filter by chainId (bsc, ethereum, polygon, etc.)
   - Filter by supported dexId

**Test**:
```typescript
const pairs = await getTokenPairs('0xDA1060158F7D593667cCE0a15DB346BB3FfB3596', 56);
console.log(pairs); // Should return TWC pairs on BSC
```

---

## Phase 5: Route Verification ✅
**Goal**: Verify routes work using router.getAmountsOut

**Tasks**:
1. Create `route-verifier.ts`:
   - Function: `verifyRoute(path, chainId, dexId, amountIn)`
   - Call router.getAmountsOut
   - Return route if valid, null if invalid

2. Handle errors gracefully:
   - If router call fails, route doesn't work
   - Return null for invalid routes

**Test**:
```typescript
const route = await verifyRoute(
  ['0xDA1060158F7D593667cCE0a15DB346BB3FfB3596', '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'],
  56,
  'pancakeswap',
  BigInt('1000000000000000000')
);
console.log(route); // Should return route with output amount
```

---

## Phase 6: Same-Chain Route Finder ✅
**Goal**: Find routes on same chain using intermediaries

**Tasks**:
1. Create `same-chain-finder.ts`:
   - Try direct pair first
   - Try 2-hop with intermediaries
   - Try 3-hop if needed
   - Always return a route (use wrapped native as fallback)

2. Algorithm:
   ```
   1. Query DexScreener for fromToken pairs
   2. Check if direct pair exists with toToken
   3. If yes, verify and return
   4. If no, try each intermediary:
      a. Check fromToken → intermediary pair
      b. Check intermediary → toToken pair
      c. Verify 2-hop route
   5. If still no route, use wrapped native as guaranteed intermediary
   ```

**Test**:
```typescript
const route = await findSameChainRoute(
  '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596', // TWC
  '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // ETH on BSC
  56,
  BigInt('1000000000000000000')
);
console.log(route.path); // Should return [TWC, WBNB, ETH] or similar
```

---

## Phase 7: Cross-Chain Route Finder ✅
**Goal**: Find routes across chains using LiFi

**Tasks**:
1. Create `cross-chain-finder.ts`:
   - Find route on source chain to bridgeable token
   - Get LiFi quote for bridging
   - Find route on destination chain to final token
   - Combine into complete route

2. Bridgeable tokens (priority):
   - WETH/ETH (most common)
   - USDT
   - USDC

3. Integration with LiFi:
   - Use existing LiFi executor/adapter
   - Get quote for bridge
   - Return complete cross-chain route

**Test**:
```typescript
const route = await findCrossChainRoute(
  '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596', // TWC on BSC
  '0x0000000000000000000000000000000000000000', // ETH on Optimism
  56, // BSC
  10, // Optimism
  BigInt('1000000000000000000')
);
console.log(route); // Should return: [TWC→WBNB→ETH on BSC, Bridge ETH, ETH on Optimism]
```

---

## Phase 8: Integration with RouteService ✅
**Goal**: Integrate new finder with existing RouteService

**Tasks**:
1. Update `RouteService`:
   - Remove graph-based fallback
   - Add on-demand finder as fallback
   - Keep existing routers (PancakeSwap, Uniswap, LiFi) as primary

2. Flow:
   ```
   1. Try existing routers (PancakeSwap, Uniswap, LiFi)
   2. If all fail, use on-demand finder
   3. On-demand finder always returns a route
   ```

**Test**: Try TWC → ETH swap, should always get a route

---

## Phase 9: Execution Integration ✅
**Goal**: Execute routes found by on-demand finder

**Tasks**:
1. Update `MultiStepExecutor`:
   - Handle routes from on-demand finder
   - Execute swaps using router addresses from DEX registry
   - Handle cross-chain with LiFi

2. Route format:
   ```typescript
   {
     path: Address[],
     dexId: string,
     chainId: number,
     steps: RouteStep[]
   }
   ```

**Test**: Execute a route end-to-end

---

## Phase 10: Testing & Optimization ✅
**Goal**: Test all scenarios, optimize performance

**Tasks**:
1. Test scenarios:
   - Same-chain direct pair
   - Same-chain with intermediaries
   - Cross-chain swaps
   - Edge cases (low liquidity, etc.)

2. Optimize:
   - Cache DexScreener responses
   - Parallel route verification
   - Early exit for direct pairs

**Test**: Comprehensive testing of all scenarios

---

## File Structure (After Implementation)

```
lib/backend/routing/
├── dex-registry.ts          # DEX configurations
├── intermediaries.ts        # Popular tokens per chain
├── dexscreener-client.ts    # DexScreener API client
├── route-verifier.ts        # Route verification
├── same-chain-finder.ts     # Same-chain route finding
├── cross-chain-finder.ts   # Cross-chain route finding
├── on-demand-finder.ts     # Main orchestrator
├── types.ts                 # Type definitions
└── index.ts                 # Exports

lib/backend/routing/bridges/
└── (keep existing LiFi integration)

lib/backend/routing/quote-aggregator/
└── (update to use on-demand finder)
```

---

## Success Criteria

✅ **Phase 1**: Old code removed, new structure created
✅ **Phase 2**: DEX registry works for all chains
✅ **Phase 3**: Intermediaries defined for all chains
✅ **Phase 4**: DexScreener queries return pairs
✅ **Phase 5**: Route verification works
✅ **Phase 6**: Same-chain routes found (TWC → ETH on BSC)
✅ **Phase 7**: Cross-chain routes found (TWC on BSC → ETH on Optimism)
✅ **Phase 8**: Integrated with RouteService
✅ **Phase 9**: Routes execute successfully
✅ **Phase 10**: All scenarios tested

---

## Next Steps

1. Start with Phase 1: Cleanup
2. Implement each phase sequentially
3. Test after each phase
4. Move to next phase only after current phase works

