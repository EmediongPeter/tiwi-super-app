/**
 * Swap Executor Service
 * 
 * Main service for executing swaps across different routers.
 * Orchestrates router-specific executors and provides a unified interface.
 */

import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from './types';
import { LiFiExecutor } from './executors/lifi-executor';
import { JupiterExecutor } from './executors/jupiter-executor';
import { PancakeSwapExecutor } from './executors/pancakeswap-executor';
import { UniswapExecutor } from './executors/uniswap-executor';
import { SwapExecutionError, SwapErrorCode } from './types';

/**
 * Swap Executor Service
 * 
 * Main entry point for executing swaps.
 * Automatically selects the appropriate router executor based on the route.
 */
export class SwapExecutor {
  private executors: SwapRouterExecutor[];

  constructor() {
    // Initialize all router executors
    this.executors = [
      new LiFiExecutor(),
      new JupiterExecutor(),
      new PancakeSwapExecutor(),
      new UniswapExecutor(),
    ];
  }

  /**
   * Execute a swap
   * 
   * @param params - Swap execution parameters
   * @returns Swap execution result
   */
  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route } = params;

    // Find executor that can handle this route
    const executor = this.executors.find((exec) => exec.canHandle(route));

    if (!executor) {
      throw new SwapExecutionError(
        `No executor found for router: ${route.router}`,
        SwapErrorCode.UNSUPPORTED_ROUTER,
        route.router
      );
    }

    // Validate quote expiration
    this.validateQuoteExpiration(route);

    // Execute swap
    return executor.execute(params);
  }

  /**
   * Validate that quote hasn't expired
   */
  private validateQuoteExpiration(route: any): void {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = route.expiresAt || route.raw?.expireAt;

    if (expiresAt && now >= expiresAt) {
      throw new SwapExecutionError(
        'Quote has expired. Please get a new quote and try again.',
        SwapErrorCode.QUOTE_EXPIRED
      );
    }
  }

  /**
   * Register a custom executor
   */
  registerExecutor(executor: SwapRouterExecutor): void {
    this.executors.push(executor);
  }
}

// Export singleton instance
export const swapExecutor = new SwapExecutor();

// Export types
export type {
  SwapExecutionParams,
  SwapExecutionResult,
  SwapExecutionStatus,
  SwapStage,
} from './types';

// Export error types
export { SwapExecutionError, SwapErrorCode } from './types';

