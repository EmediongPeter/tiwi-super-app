/**
 * Base Router Interface
 * 
 * All swap routers must implement this interface.
 * This ensures consistent behavior across all routers.
 */

import type { RouterParams, RouterRoute } from './types';

/**
 * Base router interface that all routers must implement
 */
export interface SwapRouter {
  // Router identification
  name: string;                        // e.g., 'lifi', 'squid', 'jupiter'
  displayName: string;                 // e.g., 'LiFi', 'Squid', 'Jupiter'
  
  // Capability declaration
  /**
   * Get list of supported canonical chain IDs
   */
  getSupportedChains(): Promise<number[]>;
  
  /**
   * Check if router supports a specific chain
   */
  supportsChain(chainId: number): Promise<boolean>;
  
  /**
   * Check if router supports a specific token pair
   * This is optional - routers can return true if they want to try anyway
   */
  supportsTokenPair?(
    fromChainId: number,
    fromToken: string,
    toChainId: number,
    toToken: string
  ): Promise<boolean>;
  
  /**
   * Check if router supports cross-chain swaps
   */
  supportsCrossChain(): boolean;
  
  /**
   * Get route for a swap
   * Returns null if no route is available
   * Throws error if there's a problem (network, API, etc.)
   */
  getRoute(params: RouterParams): Promise<RouterRoute | null>;
  
  /**
   * Get router priority (lower = higher priority)
   * Used for router selection order
   */
  getPriority(): number;
  
  /**
   * Get maximum supported slippage
   * Some routers have limits (e.g., Jupiter max 50%)
   */
  getMaxSlippage?(): number;
  
  /**
   * Get minimum supported slippage
   */
  getMinSlippage?(): number;
}

/**
 * Base router class with common functionality
 * Routers can extend this for shared behavior
 */
export abstract class BaseRouter implements SwapRouter {
  abstract name: string;
  abstract displayName: string;
  
  abstract getSupportedChains(): Promise<number[]>;
  abstract supportsChain(chainId: number): Promise<boolean>;
  abstract supportsCrossChain(): boolean;
  abstract getRoute(params: RouterParams): Promise<RouterRoute | null>;
  
  getPriority(): number {
    // Default priority: 100 (low priority)
    // Override in subclasses for specific priority
    return 100;
  }
  
  /**
   * Default implementation: assume pair is supported
   * Override if router can check ahead of time
   */
  async supportsTokenPair?(
    fromChainId: number,
    fromToken: string,
    toChainId: number,
    toToken: string
  ): Promise<boolean> {
    return true;
  }
}

