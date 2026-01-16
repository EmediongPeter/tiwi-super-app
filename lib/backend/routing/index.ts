/**
 * Universal Routing System
 * 
 * Main entry point for the new Universal Routing System.
 * This module is separate from existing routers and does not interfere with them.
 * 
 * @see README.md for architecture and integration strategy
 */

// Graph Builder (Phase 1)
export {
  LiquidityGraph,
  CacheManager,
  PairFetcher,
  GraphBuilder,
  getGraphBuilder,
} from './graph-builder';

// Pathfinder (Phase 2)
export {
  BFSPathfinder,
  DijkstraPathfinder,
  IntermediarySelector,
  RouteScorer,
  Pathfinder,
} from './pathfinder';

// Quote Aggregator (Phase 3)
export {
  QuoteAggregator,
  getQuoteAggregator,
  RouteValidator,
  getRouteValidator,
} from './quote-aggregator';

// Integration (Phase 3)
export {
  RouteServiceEnhancer,
  getRouteServiceEnhancer,
} from './integration';

// Bridges (Phase 4)
export {
  BaseBridgeAdapter,
  StargateAdapter,
  SocketAdapter,
  BridgeRegistry,
  getBridgeRegistry,
  CrossChainRouteBuilder,
  getCrossChainRouteBuilder,
  BridgeComparator,
  getBridgeComparator,
  BridgeStatusTracker,
  getBridgeStatusTracker,
} from './bridges';

// Types
export type {
  TokenNode,
  PairEdge,
  UniversalRoute,
  RouteStep,
  GraphQueryParams,
  CacheTierConfig,
  GraphUpdateStatus,
  RouteScoringParams,
  RouteScore,
  PathfindingOptions,
  QuoteSource,
  AggregatedQuote,
  QuoteAggregationOptions,
  ValidationResult,
  EnhancedRouteResponse,
  BridgeQuote,
  BridgeExecutionResult,
  BridgeStatus,
  CrossChainRoute,
  BridgeAdapter,
  CrossChainRouteRequest,
  BridgeComparison,
} from './types';

/**
 * Initialize routing system
 * 
 * This is optional and doesn't affect existing functionality.
 * Call this when you want to enable the new routing system.
 */
export async function initializeRoutingSystem(): Promise<void> {
  console.log('[UniversalRouting] Initializing routing system...');
  
  // For now, this is a no-op
  // In future phases, this will:
  // 1. Initialize graph builders for supported chains
  // 2. Start background graph update tasks
  // 3. Set up caching infrastructure
  
  console.log('[UniversalRouting] Routing system initialized (Phase 1)');
}

