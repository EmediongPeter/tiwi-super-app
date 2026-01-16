/**
 * LiFi Swap Executor
 * 
 * Executes swaps using LiFi SDK for cross-chain and same-chain swaps.
 * Uses LiFi's executeRoute function which handles all complexity.
 */

import { executeRoute, convertQuoteToRoute, type RouteExtended, type LiFiStep, config, ChainType } from '@lifi/sdk';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/lib/backend/routers/types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';
import { getWalletClient, switchChain } from '@wagmi/core';
import { EVM } from '@lifi/sdk';
import { getWagmiConfigForLiFi } from '@/lib/frontend/providers/lifi-sdk-provider';

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
    const { route, userAddress, recipientAddress, onStatusUpdate } = params;

    try {
      // Validate route
      if (route.router !== 'lifi') {
        throw new SwapExecutionError(
          'Route is not a LiFi route',
          SwapErrorCode.INVALID_ROUTE,
          'lifi'
        );
      }

      // Validate user address
      if (!userAddress) {
        throw new SwapExecutionError(
          'User address is required for swap execution',
          SwapErrorCode.WALLET_NOT_CONNECTED,
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

      // Determine recipient address (for cross-chain swaps)
      // Use recipientAddress if provided, otherwise use userAddress
      const toAddress = recipientAddress || userAddress;

      // CRITICAL FIX: Set fromAddress and toAddress in all route steps
      // LiFi SDK requires action.fromAddress and action.toAddress to be set for each step
      // This is especially important for cross-chain swaps
      if (lifiRoute.steps && Array.isArray(lifiRoute.steps)) {
        lifiRoute.steps.forEach((step, index) => {
          // Set addresses in the main action
          if (step.action && typeof step.action === 'object') {
            const action = step.action as any;
            
            // Always set fromAddress (user's wallet address)
            // This is required by LiFi SDK for all actions
            action.fromAddress = userAddress;
            
            // Set toAddress for cross-chain swaps (recipient address)
            // For same-chain swaps, toAddress can be the same as fromAddress
            // For cross-chain swaps, toAddress should be the recipient on the destination chain
            // If not set, use recipientAddress or fallback to userAddress
            if (!action.toAddress) {
              action.toAddress = toAddress;
            }
            
            // Validate that addresses are set
            if (!action.fromAddress) {
              throw new SwapExecutionError(
                `Step ${index + 1}: fromAddress is required but not set`,
                SwapErrorCode.INVALID_ROUTE,
                'lifi'
              );
            }
          } else {
            // If step doesn't have an action, that's unusual but we'll log a warning
            console.warn(`[LiFiExecutor] Step ${index + 1} does not have an action object`);
          }
          
          // Also check for nested actions (some routes have multiple actions)
          if (step.includedSteps && Array.isArray(step.includedSteps)) {
            step.includedSteps.forEach((includedStep: any, includedIndex: number) => {
              if (includedStep.action && typeof includedStep.action === 'object') {
                const action = includedStep.action as any;
                action.fromAddress = userAddress;
                if (!action.toAddress) {
                  action.toAddress = toAddress;
                }
                
                // Validate nested action addresses
                if (!action.fromAddress) {
                  throw new SwapExecutionError(
                    `Step ${index + 1}, included step ${includedIndex + 1}: fromAddress is required but not set`,
                    SwapErrorCode.INVALID_ROUTE,
                    'lifi'
                  );
                }
              }
            });
          }
        });
      } else {
        throw new SwapExecutionError(
          'LiFi route has no steps',
          SwapErrorCode.INVALID_ROUTE,
          'lifi'
        );
      }
      
      // Also set route-level addresses if they exist
      if (lifiRoute.fromAddress !== userAddress) {
        lifiRoute.fromAddress = userAddress;
      }
      if (!lifiRoute.toAddress) {
        lifiRoute.toAddress = toAddress;
      }

      // CRITICAL: Ensure LiFi SDK providers are configured before execution
      // This is a safety check in case the provider component hasn't run yet
      await this.ensureProvidersConfigured();

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
      console.log('lifiRoute', lifiRoute);
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
   * Ensure LiFi SDK providers are configured
   * This is a fallback in case the provider component hasn't configured them yet
   */
  private async ensureProvidersConfigured(): Promise<void> {
    try {
      // Check if EVM provider is already configured
      const existingProvider = config.getProvider(ChainType.EVM);
      
      if (existingProvider) {
        console.log('[LiFiExecutor] EVM provider already configured');
        return;
      }

      console.log('[LiFiExecutor] Providers not configured, configuring now...');

      if (typeof window === 'undefined') {
        throw new Error('Cannot configure providers on server side');
      }

      // Get wagmi config from global reference
      const wagmiConfig = getWagmiConfigForLiFi();
      
      if (!wagmiConfig) {
        throw new SwapExecutionError(
          'Wagmi config not found. Please ensure wallet is connected and LiFiSDKProvider is mounted.',
          SwapErrorCode.WALLET_NOT_CONNECTED,
          'lifi'
        );
      }

      // Configure EVM provider
      const newEvmProvider = EVM({
        getWalletClient: async (chainId?: number) => {
          const walletClient = await getWalletClient(wagmiConfig, chainId ? { chainId } : undefined);
          if (!walletClient) {
            throw new Error('Failed to get wallet client');
          }
          return walletClient;
        },
        switchChain: async (targetChainId: number) => {
          const chain = await switchChain(wagmiConfig, { chainId: targetChainId });
          const walletClient = await getWalletClient(wagmiConfig, { chainId: chain.id });
          if (!walletClient) {
            throw new Error(`Failed to get wallet client for chain ${targetChainId}`);
          }
          return walletClient;
        },
      });

      config.setProviders([newEvmProvider]);
      console.log("🚀 ~ LiFiExecutor ~ ensureProvidersConfigured ~ newEvmProvider:", newEvmProvider)
      console.log('[LiFiExecutor] Providers configured successfully');
    } catch (error) {
      console.error('[LiFiExecutor] Error ensuring providers configured:', error);
      throw new SwapExecutionError(
        `Failed to configure LiFi SDK providers: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure your wallet is connected.`,
        SwapErrorCode.WALLET_NOT_CONNECTED,
        'lifi'
      );
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

