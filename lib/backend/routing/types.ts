/**
 * Universal Routing System - Type Definitions
 * 
 * These types are used by the new routing system and are separate from
 * existing router types to ensure no interference with current functionality.
 */

import type { Address } from 'viem';

/**
 * Token node in the liquidity graph
 */
export interface TokenNode {
  address: Address;
  chainId: number;
  symbol: string;
  decimals: number;
  liquidityUSD: number;
  category: 'native' | 'stable' | 'bluechip' | 'alt';
  lastUpdated: number;
}

/**
 * Pair edge in the liquidity graph
 */
export interface PairEdge {
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
  // Computed properties (optional, calculated on-demand)
  priceImpact?: number; // For given amount
}

/**
 * Route found by pathfinding engine
 */
export interface UniversalRoute {
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
  router: string; // Which router this route uses
  expiresAt: number;
  raw?: any; // Router-specific data
}

/**
 * Single step in a route
 */
export interface RouteStep {
  stepId: string;
  fromToken: Address;
  toToken: Address;
  dex: string;
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  gasEstimate: bigint;
}

/**
 * Graph query parameters
 */
export interface GraphQueryParams {
  fromToken: Address;
  toToken: Address;
  chainId: number;
  amountIn: bigint;
  maxHops?: number;
  minLiquidityUSD?: number;
}

/**
 * Cache tier configuration
 */
export interface CacheTierConfig {
  hot: {
    enabled: boolean;
    ttl: number; // seconds
    maxSize: number; // max number of pairs
  };
  warm: {
    enabled: boolean;
    ttl: number; // seconds
    provider: 'redis' | 'memory'; // For now, we'll use memory if Redis not available
  };
  cold: {
    enabled: boolean;
    ttl: number; // seconds
    provider: 'database' | 'memory';
  };
}

/**
 * Graph update status
 */
export interface GraphUpdateStatus {
  chainId: number;
  lastUpdate: number;
  pairsUpdated: number;
  pairsTotal: number;
  updateDuration: number; // milliseconds
  errors: string[];
}

/**
 * Route scoring parameters
 */
export interface RouteScoringParams {
  path: Address[];
  amountIn: bigint;
  expectedOutput?: bigint; // If known, use this; otherwise calculate
  gasPrice?: bigint; // Gas price in wei
  inputTokenPriceUSD?: number; // For USD calculations
  outputTokenPriceUSD?: number; // For USD calculations
}

/**
 * Route score result
 */
export interface RouteScore {
  score: number; // Overall score (higher is better)
  outputValue: number; // Expected output value in USD
  totalCost: number; // Total cost in USD (gas + fees + price impact)
  netValue: number; // Net value after costs
  breakdown: {
    outputAmount: number;
    priceImpact: number;
    gasCost: number;
    protocolFees: number;
    hopPenalty: number;
  };
}

/**
 * Pathfinding options
 */
export interface PathfindingOptions {
  maxHops?: number;
  maxRoutes?: number;
  minLiquidityUSD?: number;
  algorithm?: 'bfs' | 'dijkstra' | 'auto';
  gasPrice?: bigint;
  inputTokenPriceUSD?: number;
  outputTokenPriceUSD?: number;
}

/**
 * Quote source
 */
export type QuoteSource = 'universal' | 'pancakeswap' | 'uniswap' | 'lifi' | 'jupiter' | 'other';

/**
 * Aggregated quote
 */
export interface AggregatedQuote {
  route: any; // RouterRoute | UniversalRoute
  source: QuoteSource;
  score: number;
  outputAmount: string;
  outputAmountUSD: string;
  totalCostUSD: string;
  priceImpact: number;
  gasEstimate: bigint;
  gasUSD: string;
}

/**
 * Quote aggregation options
 */
export interface QuoteAggregationOptions {
  includeUniversalRouting?: boolean;
  includeExistingRouters?: boolean;
  maxQuotes?: number;
  minLiquidityUSD?: number;
  gasPrice?: bigint;
  inputTokenPriceUSD?: number;
  outputTokenPriceUSD?: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Enhanced route response
 */
export interface EnhancedRouteResponse {
  route: any; // RouterRoute
  alternatives?: any[]; // RouterRoute[]
  timestamp: number;
  expiresAt: number;
  sources?: string[];
  universalRoutingEnabled?: boolean;
}

// Bridge types are defined in bridges/types.ts and exported from bridges/index.ts
// Import them directly from bridges module when needed

