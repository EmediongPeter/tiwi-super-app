# Route Finding Analysis & Fixes

## Critical Issues Identified

### 1. **RPC URL Issue** ❌
- **Problem**: Using default public RPCs (`bsc-dataseed.binance.org`) which are unreliable
- **Fix**: Use project's RPC config (`lib/backend/utils/rpc-config.ts`) with Alchemy URLs

### 2. **Pair Verification Issue** ❌
- **Problem**: Building routes without verifying pairs exist
- **Example**: TWC → USDT → BUSD → WBNB, but TWC/USDT pair doesn't exist
- **Fix**: Verify pairs exist in DexScreener BEFORE building routes

### 3. **Route Building Logic** ❌
- **Problem**: Not finding common tokens between fromToken and toToken pairs
- **Fix**: 
  1. Search DexScreener for all pairs of fromToken
  2. Search DexScreener for all pairs of toToken
  3. Find common tokens (tokens that appear in both lists)
  4. Build routes only using pairs that actually exist

### 4. **Performance Issue** ❌
- **Problem**: Verifying routes that don't exist (wasting time)
- **Fix**: Verify pairs exist BEFORE route verification

## Correct Flow

### Same-Chain Route Finding:

```
1. Search DexScreener for fromToken pairs
   → Get: [TWC/WBNB, TWC/USDT, ...]

2. Search DexScreener for toToken pairs  
   → Get: [ETH/WBNB, ETH/USDT, ...]

3. Find common tokens
   → Common: [WBNB, USDT, ...]

4. Build routes using common tokens
   → TWC → WBNB → ETH (both pairs exist!)

5. Verify route with router.getAmountsOut
   → Only verify routes with existing pairs
```

### Cross-Chain Route Finding:

```
1. Source Chain (BSC):
   - Find route: TWC → Bridgeable Token (WBNB, USDT, USDC)
   - Verify pairs exist before building route

2. Bridge:
   - Bridge bridgeable token to destination chain
   - Use LiFi for bridging

3. Destination Chain (Ethereum):
   - Find route: Bridgeable Token → ETH
   - Verify pairs exist before building route
```

## Key Insights

1. **Most tokens have pairs with wrapped native** (WBNB, WETH, etc.)
   - This is our guaranteed fallback
   - Should be checked first for reliability

2. **Verify pairs exist BEFORE route verification**
   - Don't waste time verifying routes with non-existent pairs
   - Use DexScreener to check pair existence

3. **Find common tokens between pair sets**
   - fromToken pairs: [TWC/WBNB, TWC/USDT]
   - toToken pairs: [ETH/WBNB, ETH/USDC]
   - Common: WBNB → Build route: TWC → WBNB → ETH

4. **Use symbols for better search**
   - DexScreener search by symbols is more reliable
   - Can find pairs even if addresses differ slightly

## Implementation Plan

### Fix 1: Use Custom RPC Config
- Import `getRpcUrl` from `lib/backend/utils/rpc-config.ts`
- Use Alchemy RPCs instead of default public RPCs

### Fix 2: Verify Pairs Before Building Routes
- Before building a route, check if each pair exists in DexScreener
- Only build routes with verified pairs

### Fix 3: Find Common Tokens
- Search all pairs for fromToken
- Search all pairs for toToken
- Find tokens that appear in both lists
- Build routes through common tokens

### Fix 4: Optimize Route Verification
- Only verify routes after confirming pairs exist
- Cache pair existence checks
- Parallel verification where possible

