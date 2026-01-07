/**
 * LiFi Swap Executor
 * 
 * Executes swaps using LiFi SDK for cross-chain and same-chain swaps.
 * Uses LiFi's executeRoute function which handles all complexity.
 */

import { executeRoute, convertQuoteToRoute, type RouteExtended, type LiFiStep } from '@lifi/sdk';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/lib/backend/routers/types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';

/**
 * LiFi executor implementation
 */
export class LiFiExecutor implements SwapRouterExecutor {
  /**
   * Check if this executor can handle the given route
   */
  canHandle(route: RouterRoute): boolean {
    return route.router === 'lifi';
  }

  /**
   * Execute a swap using LiFi
   */
  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, onStatusUpdate } = params;

    try {
      // Validate route
      if (route.router !== 'lifi') {
        throw new SwapExecutionError(
          'Route is not a LiFi route',
          SwapErrorCode.INVALID_ROUTE,
          'lifi'
        );
      }

      // Check if route has raw data (LiFi route object)
      if (!route.raw || typeof route.raw !== 'object') {
        throw new SwapExecutionError(
          'LiFi route missing raw data',
          SwapErrorCode.INVALID_ROUTE,
          'lifi'
        );
      }

      // Convert route to LiFi RouteExtended format
      const lifiRoute = this.convertToLiFiRoute(route.raw);

      // Update status
      onStatusUpdate?.({
        stage: 'preparing',
        message: 'Preparing LiFi swap...',
      });

      // Execute route using LiFi SDK
      onStatusUpdate?.({
        stage: 'signing',
        message: 'Please sign the transaction in your wallet...',
      });

      const executedRoute = await executeRoute(lifiRoute, {
        updateRouteHook: (updatedRoute: RouteExtended) => {
          // Extract status from route
          const latestStep = updatedRoute.steps[0];
          const latestProcess = latestStep?.execution?.process?.slice(-1)[0];

          if (latestProcess) {
            const status = latestProcess.status;
            const txHash = latestProcess.txHash;

            // Map LiFi status to our status
            let stage: 'preparing' | 'signing' | 'submitting' | 'confirming' | 'completed' | 'failed' = 'confirming';
            let message = `Status: ${status}`;

            if (status === 'PENDING' || status === 'STARTED') {
              stage = 'preparing';
              message = 'Preparing transaction...';
            } else if (status === 'ACTION_REQUIRED' || status === 'MESSAGE_REQUIRED' || status === 'RESET_REQUIRED') {
              stage = 'signing';
              message = 'Please sign the transaction in your wallet...';
            } else if (status === 'DONE') {
              stage = 'completed';
              message = 'Swap completed successfully!';
            } else if (status === 'FAILED' || status === 'CANCELLED') {
              stage = 'failed';
              message = 'Swap failed';
            }

            onStatusUpdate?.({
              stage,
              message: txHash ? `${message} - Tx: ${txHash.slice(0, 10)}...` : message,
              txHash,
            });
          }
        },
        acceptExchangeRateUpdateHook: async () => {
          // Ask user if they want to accept exchange rate update
          return confirm('Exchange rate has changed. Do you want to continue?');
        },
      });

      // Extract transaction hashes from executed route
      const txHashes: string[] = [];
      executedRoute.steps.forEach((step) => {
        step.execution?.process?.forEach((process) => {
          if (process.txHash) {
            txHashes.push(process.txHash);
          }
        });
      });

      if (txHashes.length === 0) {
        throw new SwapExecutionError(
          'No transaction hash found in executed route',
          SwapErrorCode.TRANSACTION_FAILED,
          'lifi'
        );
      }

      // Get primary transaction hash (first one)
      const primaryTxHash = txHashes[0];

      // Calculate actual output amount (if available)
      const actualToAmount = executedRoute.toAmount
        ? (BigInt(executedRoute.toAmount) / BigInt(10 ** params.toToken.decimals!)).toString()
        : undefined;

      onStatusUpdate?.({
        stage: 'completed',
        message: 'Swap completed successfully!',
        txHash: primaryTxHash,
      });

      return {
        success: true,
        txHash: primaryTxHash,
        txHashes: txHashes.length > 1 ? txHashes : undefined,
        receipt: executedRoute,
        actualToAmount,
      };
    } catch (error) {
      const swapError = createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'lifi');
      
      onStatusUpdate?.({
        stage: 'failed',
        message: formatErrorMessage(swapError),
        error: swapError,
      });

      throw swapError;
    }
  }

  /**
   * Convert RouterRoute to LiFi RouteExtended format
   */
  private convertToLiFiRoute(raw: any): RouteExtended {
    // If raw is already a RouteExtended (has steps array), return it
    if (raw.steps && Array.isArray(raw.steps) && raw.steps.length > 0) {
      return raw as RouteExtended;
    }

    // If raw is a quote (LiFiStep), convert it to route
    if (raw.action || raw.tool) {
      try {
        const route = convertQuoteToRoute(raw as LiFiStep);
        return route;
      } catch (error) {
        throw new SwapExecutionError(
          `Failed to convert LiFi quote to route: ${error instanceof Error ? error.message : 'Unknown error'}`,
          SwapErrorCode.INVALID_ROUTE,
          'lifi'
        );
      }
    }

    // Otherwise, route format is invalid
    throw new SwapExecutionError(
      'LiFi route format is invalid. Expected RouteExtended or LiFiStep.',
      SwapErrorCode.INVALID_ROUTE,
      'lifi'
    );
  }
}

