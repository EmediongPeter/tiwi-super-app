/**
 * Router Exports
 * 
 * Central export point for all routers and router-related functionality.
 */

// Router base and types
export { BaseRouter } from './base';
export type { SwapRouter } from './base';
export type {
  RouterParams,
  RouterRoute,
  RouteRequest,
  RouteResponse,
  RouteStep,
  RouterError,
} from './types';

// Router registry
export { RouterRegistry, getRouterRegistry } from './registry';

// Router adapters
export { LiFiAdapter } from './adapters/lifi-adapter';

// Transformers
export {
  ChainTransformer,
  toSmallestUnit,
  toHumanReadable,
  isValidAmount,
  transformTokenAddress,
  isValidTokenAddress,
  transformSlippage,
  toBasisPoints,
  fromBasisPoints,
  isValidSlippage,
} from './transformers';

// Scoring
export { scoreRoute, selectBestRoute, sortRoutesByScore } from './scoring';

// Constants
export {
  SQUID_DEFAULT_ADDRESS,
  DEFAULT_SLIPPAGE,
  MAX_AUTO_SLIPPAGE,
  QUOTE_EXPIRATION_SECONDS,
  ROUTER_TIMEOUT_MS,
  MAX_RETRY_ATTEMPTS,
} from './constants';

