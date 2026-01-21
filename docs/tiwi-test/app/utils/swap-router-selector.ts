// Utility to determine which swap router to use (LI.FI, Jupiter, DEX)

import { ChainId } from '@lifi/sdk';
import { SOLANA_CHAIN_ID } from './jupiter';

export type SwapRouter = 'lifi' | 'jupiter' | 'pancakeswap' | 'uniswap';

export interface SwapRouteDecision {
  router: SwapRouter;
  reason: string;
}

/**
 * Determine which swap router to use based on chain and token pair
 * 
 * Routing rules:
 * - PancakeSwap: BSC (chain ID 56) same-chain only
 * - Uniswap: Other EVM chains same-chain only
 * - Jupiter: Solana same-chain only
 * - LI.FI: All cross-chain swaps and same-chain swaps on other chains
 */
export function selectSwapRouter(
  fromChain: number,
  toChain: number,
  fromToken?: string,
  toToken?: string
): SwapRouteDecision {
  const isSameChain = fromChain === toChain;
  const isSolanaSwap = fromChain === SOLANA_CHAIN_ID && toChain === SOLANA_CHAIN_ID;
  const isBSCSwap = fromChain === 56 && toChain === 56;
  const isOtherEVMSwap = isSameChain && fromChain !== SOLANA_CHAIN_ID && fromChain !== 56;

  // Same-chain Solana: Use Jupiter
  if (isSolanaSwap) {
    return {
      router: 'jupiter',
      reason: 'Same-chain Solana swap - Using Jupiter',
    };
  }

  // Same-chain BSC: Use PancakeSwap
  if (isBSCSwap) {
    return {
      router: 'pancakeswap',
      reason: 'Same-chain BSC swap - Using PancakeSwap',
    };
  }

  // Same-chain other EVM: Use Uniswap
  if (isOtherEVMSwap) {
    return {
      router: 'uniswap',
      reason: 'Same-chain EVM swap - Using Uniswap',
    };
  }

  // All cross-chain swaps and other same-chain swaps: Use LI.FI
  return {
    router: 'lifi',
    reason: 'Cross-chain swap or non-EVM/non-Solana same-chain - Using LI.FI',
  };
}


