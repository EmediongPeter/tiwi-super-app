# Routing Architecture Proposal

**Date:** 2024  
**Phase:** Swap Route & Quote System - Step 2  
**Status:** ⏳ Awaiting Approval

---

## Executive Summary

This proposal outlines a backend-driven, multi-router swap routing architecture that normalizes requests, abstracts router differences, and provides a unified API for both web and mobile clients.

**Key Principles:**
- Backend owns all routing decisions
- One unified request format
- Explicit parameter transformations
- Extensible router architecture
- Simple first, extensible always

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Web/Mobile)                    │
│  Sends: { fromToken, toToken, fromAmount, slippage? }      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP POST /api/v1/route
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              /api/v1/route (Backend API Route)              │
│  - Validates request                                         │
│  - Calls RouteService                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  RouteService (Orchestrator)                │
│  - Normalizes request parameters                            │
│  - Selects eligible routers                                  │
│  - Calls routers in priority order                          │
│  - Scores and selects best route                            │
│  - Returns unified response                                 │
└───────┬───────────────────────────────────┬─────────────────┘
        │                                   │
        ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐
│  Router Adapters │              │  Router Adapters │
│  (Transformers)  │              │  (Transformers) │
└───────┬──────────┘              └───────┬──────────┘
        │                                   │
        ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐
│   LiFi Router    │              │  Squid Router    │
│   (Provider)     │              │   (Provider)     │
└──────────────────┘              └──────────────────┘
```

---

## 1. Unified Route Request Model

### Request Format (Canonical)

**Endpoint:** `POST /api/v1/route`

**Request Body:**
```typescript
interface RouteRequest {
  // Token information (canonical format)
  fromToken: {
    chainId: number;        // Canonical chain ID (e.g., 1 for Ethereum)
    address: string;        // Token address (e.g., "0xa0b8...")
  };
  toToken: {
    chainId: number;
    address: string;
  };
  
  // Amount
  fromAmount: string;       // Human-readable amount (e.g., "100.5")
  
  // Optional parameters
  slippage?: number;        // Slippage tolerance (0-100, default: 0.5)
  recipient?: string;       // Recipient address (optional, for cross-chain)
  order?: 'RECOMMENDED' | 'FASTEST' | 'CHEAPEST';  // Route preference
}
```

**Key Design Decisions:**
- ✅ Uses canonical chain IDs (from our registry)
- ✅ Uses human-readable amounts (backend converts to smallest unit)
- ✅ Token addresses in native format (backend handles transformations)
- ✅ Optional recipient (backend can use default if not provided)
- ✅ Simple, chain-agnostic format

---

## 2. Router Abstraction Layer

### Router Interface

**Location:** `lib/backend/routers/base.ts`

```typescript
/**
 * Base router interface that all routers must implement
 */
export interface SwapRouter {
  // Router identification
  name: string;                    // e.g., 'lifi', 'squid', 'jupiter'
  displayName: string;             // e.g., 'LiFi', 'Squid', 'Jupiter'
  
  // Capability declaration
  getSupportedChains(): Promise<number[]>;  // Canonical chain IDs
  supportsChain(chainId: number): Promise<boolean>;
  supportsTokenPair(
    fromChainId: number,
    fromToken: string,
    toChainId: number,
    toToken: string
  ): Promise<boolean>;
  
  // Cross-chain capability
  supportsCrossChain(): boolean;   // Can this router do cross-chain?
  
  // Route fetching
  getRoute(params: RouterParams): Promise<RouterRoute | null>;
  
  // Priority (for router selection)
  getPriority(): number;            // Lower = higher priority (0 = highest)
}

/**
 * Normalized router parameters (after transformation)
 */
export interface RouterParams {
  fromChainId: number;              // Provider-specific chain ID
  fromToken: string;                // Provider-specific token identifier
  fromAmount: string;               // Amount in smallest unit
  toChainId: number;
  toToken: string;
  recipient?: string;               // Provider-specific address format
  slippage?: number;                // Provider-specific slippage format
  order?: string;                   // Provider-specific order preference
}

/**
 * Normalized router response
 */
export interface RouterRoute {
  // Route identification
  router: string;                   // Router name
  routeId: string;                  // Unique route identifier
  
  // Token information
  fromToken: {
    chainId: number;                 // Canonical chain ID
    address: string;                 // Canonical token address
    amount: string;                  // Input amount (human-readable)
  };
  toToken: {
    chainId: number;
    address: string;
    amount: string;                  // Output amount (human-readable)
  };
  
  // Quote information
  exchangeRate: string;               // e.g., "1.5"
  priceImpact: string;               // e.g., "0.5" (percentage)
  slippage: string;                  // Applied slippage
  
  // Cost information
  fees: {
    protocol: string;                // Protocol fee in USD
    gas: string;                     // Gas estimate (native token)
    gasUSD: string;                  // Gas estimate in USD
    total: string;                   // Total fees in USD
  };
  
  // Route steps
  steps: RouteStep[];
  
  // Execution metadata
  estimatedTime: number;             // Estimated time in seconds
  expiresAt: number;                  // Quote expiration timestamp
  transactionData?: string;          // Encoded transaction (if available)
}

export interface RouteStep {
  type: 'swap' | 'bridge' | 'wrap' | 'unwrap';
  chainId: number;                   // Canonical chain ID
  fromToken: {
    address: string;
    amount: string;
  };
  toToken: {
    address: string;
    amount: string;
  };
  protocol?: string;                  // e.g., "Uniswap V3", "Stargate"
  description?: string;              // Human-readable step description
}
```

### Router Registration

**Location:** `lib/backend/routers/registry.ts`

```typescript
/**
 * Router registry - manages all available routers
 */
export class RouterRegistry {
  private routers: Map<string, SwapRouter> = new Map();
  
  /**
   * Register a router
   */
  register(router: SwapRouter): void {
    this.routers.set(router.name, router);
  }
  
  /**
   * Get router by name
   */
  getRouter(name: string): SwapRouter | null {
    return this.routers.get(name) || null;
  }
  
  /**
   * Get all routers, sorted by priority
   */
  getAllRouters(): SwapRouter[] {
    return Array.from(this.routers.values())
      .sort((a, b) => a.getPriority() - b.getPriority());
  }
  
  /**
   * Get routers that support a chain combination
   */
  async getEligibleRouters(
    fromChainId: number,
    toChainId: number
  ): Promise<SwapRouter[]> {
    const routers = this.getAllRouters();
    const eligible: SwapRouter[] = [];
    
    for (const router of routers) {
      const supportsFrom = await router.supportsChain(fromChainId);
      const supportsTo = await router.supportsChain(toChainId);
      
      if (supportsFrom && supportsTo) {
        // Check cross-chain capability
        if (fromChainId === toChainId || router.supportsCrossChain()) {
          eligible.push(router);
        }
      }
    }
    
    return eligible;
  }
}
```

---

## 3. Parameter Transformation Strategy

### Transformation Layer

**Location:** `lib/backend/routers/transformers/`

**Purpose:** Transform canonical request format to router-specific formats

### Chain ID Transformation

**Location:** `lib/backend/routers/transformers/chain-transformer.ts`

```typescript
/**
 * Transform canonical chain ID to router-specific chain identifier
 */
export class ChainTransformer {
  /**
   * Transform to LiFi chain ID
   */
  static toLiFi(canonicalChainId: number): number | null {
    const chain = getCanonicalChain(canonicalChainId);
    if (!chain) return null;
    const lifiId = chain.providerIds.lifi;
    return typeof lifiId === 'number' ? lifiId : null;
  }
  
  /**
   * Transform to Squid chain identifier
   */
  static toSquid(canonicalChainId: number): string | null {
    const chain = getCanonicalChain(canonicalChainId);
    if (!chain) return null;
    
    // Squid uses string identifiers
    // Try providerIds.squid first, fallback to chain name
    if (chain.providerIds.squid) {
      return String(chain.providerIds.squid);
    }
    
    // Map common chains to Squid identifiers
    const squidMap: Record<number, string> = {
      1: 'ethereum',
      56: '56',  // BSC
      137: '137', // Polygon
      7565164: 'solana-mainnet-beta', // Solana
    };
    
    return squidMap[canonicalChainId] || null;
  }
  
  /**
   * Transform to Jupiter (only Solana)
   */
  static toJupiter(canonicalChainId: number): boolean {
    return canonicalChainId === 7565164; // Solana canonical ID
  }
}
```

### Token Address Transformation

**Location:** `lib/backend/routers/transformers/token-transformer.ts`

```typescript
/**
 * Transform canonical token address to router-specific format
 */
export class TokenTransformer {
  /**
   * Transform to router-specific token identifier
   * Most routers use the same address format, but some need special handling
   */
  static transform(
    canonicalAddress: string,
    chainId: number,
    router: string
  ): string {
    // Most routers use the same address format
    if (router === 'lifi' || router === 'squid' || router === 'uniswap') {
      return canonicalAddress;
    }
    
    // Jupiter uses Solana mint addresses (same format, but different context)
    if (router === 'jupiter') {
      // Verify it's a Solana address format
      if (canonicalAddress.length >= 32 && canonicalAddress.length <= 44) {
        return canonicalAddress;
      }
      throw new Error('Invalid Solana token address for Jupiter');
    }
    
    return canonicalAddress;
  }
}
```

### Amount Transformation

**Location:** `lib/backend/routers/transformers/amount-transformer.ts`

```typescript
/**
 * Transform human-readable amount to smallest unit
 */
export class AmountTransformer {
  /**
   * Convert human-readable amount to smallest unit
   * @param amount - Human-readable amount (e.g., "100.5")
   * @param decimals - Token decimals (e.g., 18 for ETH, 6 for USDC)
   * @returns Amount in smallest unit as string (e.g., "100500000")
   */
  static toSmallestUnit(amount: string, decimals: number): string {
    const [integerPart, decimalPart = ''] = amount.split('.');
    const paddedDecimal = decimalPart.padEnd(decimals, '0').slice(0, decimals);
    return integerPart + paddedDecimal;
  }
  
  /**
   * Convert smallest unit to human-readable amount
   * @param amount - Amount in smallest unit (e.g., "100500000")
   * @param decimals - Token decimals
   * @returns Human-readable amount (e.g., "100.5")
   */
  static toHumanReadable(amount: string, decimals: number): string {
    const padded = amount.padStart(decimals + 1, '0');
    const integerPart = padded.slice(0, -decimals);
    const decimalPart = padded.slice(-decimals);
    const trimmedDecimal = decimalPart.replace(/0+$/, '');
    return trimmedDecimal ? `${integerPart}.${trimmedDecimal}` : integerPart;
  }
}
```

### Router-Specific Adapters

**Location:** `lib/backend/routers/adapters/`

Each router has an adapter that:
1. Implements `SwapRouter` interface
2. Transforms canonical parameters to router-specific format
3. Calls router API
4. Normalizes router response to `RouterRoute` format

**Example:** `lib/backend/routers/adapters/lifi-adapter.ts`

```typescript
export class LiFiAdapter implements SwapRouter {
  name = 'lifi';
  displayName = 'LiFi';
  
  async getRoute(params: RouterParams): Promise<RouterRoute | null> {
    try {
      // Transform to LiFi format
      const lifiParams = {
        fromChain: params.fromChainId,  // Already LiFi chain ID
        fromToken: params.fromToken,
        fromAmount: params.fromAmount,
        toChain: params.toChainId,
        toToken: params.toToken,
        toAddress: params.recipient,
        order: params.order || 'RECOMMENDED',
        slippage: params.slippage || 0.5,
      };
      
      // Call LiFi SDK
      const quote = await getQuote(lifiParams);
      
      // Normalize response
      return this.normalizeRoute(quote);
    } catch (error) {
      console.error('[LiFiAdapter] Error fetching route:', error);
      return null;
    }
  }
  
  private normalizeRoute(quote: LiFiQuote): RouterRoute {
    // Transform LiFi quote to RouterRoute format
    // ... normalization logic
  }
}
```

---

## 4. Route Scoring / Selection

### Simple Scoring (Initial)

**Location:** `lib/backend/services/route-service.ts`

**Scoring Criteria (Simple First):**

1. **Availability** (Highest Priority)
   - Route exists: +100 points
   - No route: 0 points

2. **Output Amount** (Primary Factor)
   - Higher output amount = better route
   - Score = outputAmount (normalized)

3. **Total Fees** (Secondary Factor)
   - Lower fees = better route
   - Score = -totalFeesUSD (negative, so lower is better)

4. **Estimated Time** (Tertiary Factor)
   - Faster = better route
   - Score = -estimatedTime (negative)

**Scoring Formula (Simple):**
```typescript
function scoreRoute(route: RouterRoute): number {
  if (!route) return 0;
  
  const outputAmount = parseFloat(route.toToken.amount);
  const totalFees = parseFloat(route.fees.total);
  const estimatedTime = route.estimatedTime;
  
  // Simple weighted scoring
  const amountScore = outputAmount * 1000;        // Primary factor
  const feeScore = -totalFees * 10;               // Secondary factor
  const timeScore = -estimatedTime * 0.1;         // Tertiary factor
  
  return amountScore + feeScore + timeScore;
}
```

**Selection Logic:**
```typescript
async function selectBestRoute(routes: RouterRoute[]): Promise<RouterRoute | null> {
  if (routes.length === 0) return null;
  
  // Score all routes
  const scored = routes.map(route => ({
    route,
    score: scoreRoute(route),
  }));
  
  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);
  
  // Return best route
  return scored[0].route;
}
```

**Future Enhancements (Explicitly Deferred):**
- Advanced optimization algorithms
- User preference weighting
- Historical success rates
- Gas price predictions
- Slippage risk analysis

---

## 5. Route Service (Orchestrator)

**Location:** `lib/backend/services/route-service.ts`

```typescript
export class RouteService {
  private routerRegistry: RouterRegistry;
  
  constructor() {
    this.routerRegistry = new RouterRegistry();
    // Register routers
    this.routerRegistry.register(new LiFiAdapter());
    // Future: this.routerRegistry.register(new SquidAdapter());
    // Future: this.routerRegistry.register(new JupiterAdapter());
  }
  
  /**
   * Get best route for a swap
   */
  async getRoute(request: RouteRequest): Promise<RouteResponse> {
    // 1. Validate request
    this.validateRequest(request);
    
    // 2. Get token decimals (needed for amount transformation)
    const fromDecimals = await this.getTokenDecimals(
      request.fromToken.chainId,
      request.fromToken.address
    );
    const toDecimals = await this.getTokenDecimals(
      request.toToken.chainId,
      request.toToken.address
    );
    
    // 3. Transform amount to smallest unit
    const fromAmountSmallest = AmountTransformer.toSmallestUnit(
      request.fromAmount,
      fromDecimals
    );
    
    // 4. Get eligible routers
    const eligibleRouters = await this.routerRegistry.getEligibleRouters(
      request.fromToken.chainId,
      request.toToken.chainId
    );
    
    if (eligibleRouters.length === 0) {
      throw new Error('No routers support this chain combination');
    }
    
    // 5. Try routers in priority order
    const routes: RouterRoute[] = [];
    const errors: Array<{ router: string; error: string }> = [];
    
    for (const router of eligibleRouters) {
      try {
        // Transform parameters for this router
        const routerParams = await this.transformParams(
          request,
          router,
          fromAmountSmallest
        );
        
        // Get route from router
        const route = await router.getRoute(routerParams);
        
        if (route) {
          routes.push(route);
        }
      } catch (error: any) {
        errors.push({
          router: router.name,
          error: error.message || 'Unknown error',
        });
        // Continue to next router
      }
    }
    
    // 6. Select best route
    const bestRoute = await this.selectBestRoute(routes);
    
    if (!bestRoute) {
      throw new Error(
        `No route found. Tried: ${eligibleRouters.map(r => r.name).join(', ')}. ` +
        `Errors: ${errors.map(e => `${e.router}: ${e.error}`).join('; ')}`
      );
    }
    
    // 7. Return response
    return {
      route: bestRoute,
      alternatives: routes.filter(r => r.routeId !== bestRoute.routeId),
      timestamp: Date.now(),
    };
  }
  
  private async transformParams(
    request: RouteRequest,
    router: SwapRouter,
    fromAmountSmallest: string
  ): Promise<RouterParams> {
    // Transform chain IDs
    const fromChainId = await this.transformChainId(
      request.fromToken.chainId,
      router.name
    );
    const toChainId = await this.transformChainId(
      request.toToken.chainId,
      router.name
    );
    
    // Transform token addresses
    const fromToken = TokenTransformer.transform(
      request.fromToken.address,
      request.fromToken.chainId,
      router.name
    );
    const toToken = TokenTransformer.transform(
      request.toToken.address,
      request.toToken.chainId,
      router.name
    );
    
    return {
      fromChainId,
      fromToken,
      fromAmount: fromAmountSmallest,
      toChainId,
      toToken,
      recipient: request.recipient,
      slippage: request.slippage,
      order: request.order,
    };
  }
}
```

---

## 6. API Endpoint

**Location:** `app/api/v1/route/route.ts`

```typescript
export async function POST(req: NextRequest) {
  try {
    const body: RouteRequest = await req.json();
    
    // Validate request
    if (!body.fromToken || !body.toToken || !body.fromAmount) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Get route service
    const routeService = getRouteService();
    
    // Get route
    const response = await routeService.getRoute(body);
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] /api/v1/route error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get route' },
      { status: 500 }
    );
  }
}
```

---

## 7. Response Format (Unified)

```typescript
interface RouteResponse {
  route: RouterRoute;                    // Best route
  alternatives?: RouterRoute[];          // Alternative routes (if available)
  timestamp: number;                     // Response timestamp
}
```

---

## Implementation Plan

### Phase 1: Foundation
1. Create router abstraction (`lib/backend/routers/base.ts`)
2. Create router registry (`lib/backend/routers/registry.ts`)
3. Create transformation utilities (`lib/backend/routers/transformers/`)
4. Create route service (`lib/backend/services/route-service.ts`)

### Phase 2: LiFi Integration
1. Create LiFi adapter (`lib/backend/routers/adapters/lifi-adapter.ts`)
2. Implement LiFi route fetching
3. Implement LiFi response normalization
4. Register LiFi router

### Phase 3: API Endpoint
1. Create `/api/v1/route` endpoint
2. Implement request validation
3. Wire up route service
4. Test with real requests

### Phase 4: Frontend Integration
1. Create frontend API client (`lib/frontend/api/routes.ts`)
2. Update `useSwapQuote` hook
3. Replace dummy calculations
4. Handle loading/error states

### Phase 5: Fallback Framework (Scaffolding)
1. Create Squid adapter skeleton
2. Create Jupiter adapter skeleton
3. Create Uniswap adapter skeleton
4. Ensure architecture supports them

---

## Design Decisions

### ✅ DO

1. **Backend owns routing decisions**
   - Frontend doesn't know which router is used
   - Backend handles all router selection and fallback

2. **Explicit transformations**
   - Clear transformation functions
   - No implicit magic
   - Documented parameter mappings

3. **Simple scoring first**
   - Start with basic scoring
   - Explicitly defer advanced optimization
   - Easy to understand and debug

4. **Extensible architecture**
   - Router registration system
   - Plugin-like adapters
   - Easy to add new routers

### ❌ DON'T

1. **Don't hard-code router assumptions**
   - No LiFi-specific logic in frontend
   - No router-specific code paths

2. **Don't couple frontend to routers**
   - Frontend only knows about unified format
   - Router details hidden in backend

3. **Don't optimize prematurely**
   - Simple scoring first
   - Add complexity only when needed

---

## Decisions (Confirmed)

1. **Default Slippage:** 0.5% default, user can increase. Auto-slippage mode can increase up to 30.5% for low liquidity pairs.
2. **Quote Expiration:** 60 seconds, with user option to refresh (like LiFi).
3. **Routes:** Return best route based on user preference (cheapest, fastest, recommended). LiFi supports all 3 types.
4. **Error Format:** Normalized for frontend, but include router-specific details for backend debugging.
5. **Recipient Address:** Optional, but required for cross-chain swaps to different wallets (e.g., Phantom to Keplr).

## Additional Requirements

- **Squid Chain IDs:** Accepts numeric chain IDs for EVM chains (1, 56, etc.), but string IDs for non-EVM chains (e.g., "osmosis-1").
- **Squid Default Address:** Use default address (starts with "osmo...qqqq...q") when user hasn't connected wallet.
- **Jupiter Token List:** Need Jupiter token list fetch logic for Solana mint address mapping.
- **Additional Chains:** Support Sui, Aptos, Solana, Sei, TON chains.

---

## Approval Required

⛔ **STOP - Awaiting Approval**

This architecture proposal must be reviewed and approved before implementation begins.

**Review Checklist:**
- [ ] Unified request model is appropriate
- [ ] Router abstraction is extensible
- [ ] Transformation strategy is clear
- [ ] Scoring/selection logic is acceptable
- [ ] Implementation plan is feasible

**Next Steps After Approval:**
- Begin Phase 1: Foundation
- Implement incrementally
- Test after each phase
- Pause for review at each stage

