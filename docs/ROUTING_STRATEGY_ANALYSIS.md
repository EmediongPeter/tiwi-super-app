# Routing Strategy: Deep Analysis & Planning

## Critical Issues Identified

### 1. **LiFi Bridge Token Confusion** ❌
**Current Problem**: When we find route TWC → WBNB → ETH (on BSC), we're using the wrong token for bridging.

**Correct Flow**:
```
1. Same-chain route: TWC → WBNB → ETH (BSC)
   Output: ETH on BSC (0x2170Ed0880ac9A755fd29B2688956BD959F933F8)

2. Bridge: ETH (BSC) → ETH (Ethereum)
   Source: 0x2170Ed0880ac9A755fd29B2688956BD959F933F8 (ETH on BSC)
   Destination: 0x0000000000000000000000000000000000000000 (native ETH) OR WETH
   
3. Destination route: ETH (Ethereum) → Final token (if needed)
```

**Fix**: Extract the actual output token address from the route, use that for bridging.

---

### 2. **DexScreener Search Strategy** ❌
**Current Problem**: We're only querying by token address, missing the search endpoint.

**Better Approach**: Use DexScreener search endpoint:
- `https://api.dexscreener.com/latest/dex/search?q=wbnb/eth`
- Returns multiple pairs across DEXes
- We can filter by supported DEXes and choose best by liquidity/volume

**Strategy**:
1. Search for pairs by symbols: "twc/wbnb", "wbnb/eth"
2. Filter by supported DEXes (PancakeSwap, Uniswap, etc.)
3. Rank by liquidity, volume, price impact
4. Combine pairs into routes
5. Verify with router.getAmountsOut

---

### 3. **Route Finding Logic** ❓
**Question**: Should we:
- A) Only use intermediaries (WBNB, USDT, USDC)?
- B) Search DexScreener for any pairs and combine them?
- C) Hybrid: Try intermediaries first, then search DexScreener?

**Recommendation**: **Hybrid Approach (C)**

**Algorithm**:
```
1. Try direct pair (search DexScreener: "fromToken/toToken")
2. Try intermediaries (WBNB, USDT, USDC):
   - Search: "fromToken/wbnb", "wbnb/toToken"
   - Combine if both exist
3. Try DexScreener search for any pairs:
   - Search: "fromToken/*" (all pairs with fromToken)
   - Find common tokens between fromToken and toToken pairs
   - Build routes through common tokens
4. Guaranteed fallback: Use wrapped native
```

---

### 4. **Fallback Strategy** ❓
**Question**: What if LiFi, PancakeSwap, Uniswap all fail?

**Answer**: **Always find a route using our on-demand finder**

**Flow**:
```
1. Try existing routers (PancakeSwap, Uniswap, LiFi)
   ↓ All fail
2. Use on-demand route finder:
   a. Same-chain: Find route using DexScreener + intermediaries
   b. Cross-chain: Find route on source → Bridge via LiFi → Find route on dest
   ↓ Still fails
3. Guaranteed route:
   - Use wrapped native as intermediary (most tokens have pairs with it)
   - Even if verification fails, return route (execution will handle errors)
```

**Key**: Never return "no route" - always return something, even if it might fail during execution.

---

### 5. **Execution Strategy** ❓
**Question**: Single transaction (multicall) or multiple transactions?

**Analysis**:

**Option A: Multicall (Single Transaction)**
- ✅ Better UX (one signature)
- ✅ Atomic (all or nothing)
- ❌ Limited to same chain
- ❌ Can't handle cross-chain in one transaction

**Option B: Multiple Transactions**
- ✅ Works for cross-chain
- ✅ More flexible
- ❌ Multiple signatures
- ❌ Not atomic (can fail partway)

**Recommendation**: **Hybrid**

**Same-Chain Multi-Hop**:
- Use router's built-in multi-hop support (e.g., PancakeSwap router handles TWC → WBNB → ETH in one call)
- Single transaction, single signature
- Router handles all hops internally

**Cross-Chain**:
- Multiple transactions (can't be avoided)
- Transaction 1: Source chain swap (TWC → WBNB → ETH on BSC)
- Transaction 2: Bridge (ETH BSC → ETH Ethereum via LiFi)
- Transaction 3: Destination swap (if needed)

**Approvals**:
- Check allowance before each swap
- Request approval if needed
- Can batch approval + swap in multicall (same chain)

---

## Revised Architecture

### Phase 1: Enhanced DexScreener Client

**New Functions**:
```typescript
// Search by pair symbols
searchPairsBySymbol(symbol1: string, symbol2: string, chainId: number)

// Search all pairs for a token
searchAllPairsForToken(tokenSymbol: string, chainId: number)

// Find best pair (by liquidity, volume, DEX support)
findBestPair(tokenA: Address, tokenB: Address, chainId: number)
```

**Strategy**:
1. Search DexScreener for pairs: "twc/wbnb", "wbnb/eth"
2. Filter by supported DEXes
3. Rank by: liquidity > volume > DEX preference
4. Return best pairs

---

### Phase 2: Smart Route Builder

**Algorithm**:
```typescript
async findRoute(fromToken, toToken, chainId, amountIn) {
  // 1. Try direct pair (search DexScreener)
  const directPair = await searchPairsBySymbol(fromSymbol, toSymbol, chainId);
  if (directPair) {
    const route = await verifyRoute([fromToken, toToken], ...);
    if (route) return route;
  }
  
  // 2. Try intermediaries (WBNB, USDT, USDC)
  for (const intermediary of intermediaries) {
    const pair1 = await searchPairsBySymbol(fromSymbol, intermediary.symbol, chainId);
    const pair2 = await searchPairsBySymbol(intermediary.symbol, toSymbol, chainId);
    
    if (pair1 && pair2) {
      // Choose best DEX (prefer same DEX for both hops)
      const dexId = chooseBestDEX([pair1, pair2]);
      const route = await verifyRoute([fromToken, intermediary.address, toToken], ...);
      if (route) return route;
    }
  }
  
  // 3. Search DexScreener for any pairs
  const fromPairs = await searchAllPairsForToken(fromSymbol, chainId);
  const toPairs = await searchAllPairsForToken(toSymbol, chainId);
  
  // Find common tokens (tokens that appear in both lists)
  const commonTokens = findCommonTokens(fromPairs, toPairs);
  
  for (const commonToken of commonTokens) {
    const route = await verifyRoute([fromToken, commonToken.address, toToken], ...);
    if (route) return route;
  }
  
  // 4. Guaranteed fallback
  return findGuaranteedRoute(fromToken, toToken, chainId, amountIn);
}
```

---

### Phase 3: Cross-Chain Route Fix

**Correct Flow**:
```typescript
async findCrossChainRoute(fromToken, toToken, fromChain, toChain, amountIn) {
  // 1. Find route on source chain
  const sourceRoute = await findRoute(fromToken, bridgeToken, fromChain, amountIn);
  
  // 2. Extract actual output token from route
  // This is the token we actually get after the swap
  const actualBridgeToken = sourceRoute.path[sourceRoute.path.length - 1];
  
  // 3. Find corresponding token on destination chain
  const destBridgeToken = findCorrespondingToken(actualBridgeToken, fromChain, toChain);
  
  // 4. Bridge via LiFi
  const bridgeQuote = await getLiFiQuote(
    actualBridgeToken,  // Use actual token from route
    destBridgeToken,    // Corresponding on destination
    fromChain,
    toChain,
    sourceRoute.outputAmount
  );
  
  // 5. Find route on destination chain
  const destRoute = await findRoute(destBridgeToken, toToken, toChain, bridgeQuote.amountOut);
  
  return { sourceRoute, bridge, destRoute };
}
```

---

### Phase 4: Execution Strategy

**Same-Chain Multi-Hop**:
```typescript
// Router handles multi-hop internally
await router.swapExactTokensForTokens(
  amountIn,
  amountOutMin,
  [fromToken, intermediary, toToken],  // Path
  recipient,
  deadline
);
// Single transaction, single signature
```

**Cross-Chain**:
```typescript
// Step 1: Source chain swap
const tx1 = await executeSwap(sourceRoute);

// Step 2: Bridge (LiFi handles this)
const tx2 = await executeBridge(bridgeQuote);

// Step 3: Destination swap (if needed)
const tx3 = await executeSwap(destRoute);
// Multiple transactions, multiple signatures
```

---

## Implementation Plan

### Step 1: Fix DexScreener Client
- Add `searchPairsBySymbol()` function
- Use search endpoint: `https://api.dexscreener.com/latest/dex/search?q=symbol1/symbol2`
- Filter by supported DEXes
- Rank by liquidity/volume

### Step 2: Fix Route Finding
- Use DexScreener search for pairs
- Try intermediaries
- Find common tokens
- Always return a route

### Step 3: Fix Cross-Chain
- Extract actual output token from route
- Use that for bridging
- Handle native tokens correctly

### Step 4: Execution
- Same-chain: Use router's multi-hop (single transaction)
- Cross-chain: Multiple transactions (unavoidable)
- Handle approvals properly

---

## Key Principles

1. **Never return "no route"** - Always find something, even if it might fail during execution
2. **Use DexScreener search** - Not just token address queries
3. **Extract actual tokens** - From route outputs, not assumptions
4. **Best practices** - Use supported endpoints, verify routes, handle errors gracefully
5. **Test thoroughly** - Test with known pairs, test fallbacks, test edge cases

---

## Questions to Answer

1. **DEX Selection**: When we find multiple pairs (e.g., WBNB/ETH on PancakeSwap and Uniswap), how do we choose?
   - Answer: Prefer same DEX for multi-hop, then liquidity, then volume

2. **Native Token Handling**: How do we handle native ETH (0x0000...0000) vs WETH?
   - Answer: Convert to wrapped for routing, unwrap at end if needed

3. **Route Verification**: Should we verify all routes or trust DexScreener?
   - Answer: Always verify with router.getAmountsOut - DexScreener data might be stale

4. **Execution Atomicity**: Can we make cross-chain atomic?
   - Answer: No, but we can provide clear status updates and handle failures gracefully

---

**Next Steps**: Implement fixes based on this analysis.

