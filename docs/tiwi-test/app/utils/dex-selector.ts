// Helper utilities to determine which DEX to use based on chain

import { SOLANA_CHAIN_ID } from './jupiter';

/**
 * Determines which DEX to use based on chain ID
 * @param chainId - The chain ID
 * @returns 'pancakeswap' for BSC, 'uniswap' for other EVM chains, or null if unsupported
 * 
 * Note: This is only for same-chain swaps. Cross-chain swaps use LI.FI.
 */
export const getDexForChain = (chainId: number): 'pancakeswap' | 'uniswap' | null => {
  // BSC uses PancakeSwap (same-chain only)
  if (chainId === 56) {
    return 'pancakeswap';
  }
  
  // Other EVM chains use Uniswap (same-chain only)
  // Common EVM chains: Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche, etc.
  // We check if it's a reasonable EVM chain ID (not Solana, not BSC)
  if (chainId !== SOLANA_CHAIN_ID && chainId !== 56) {
    // Assume it's an EVM chain if it's not Solana or BSC
    // This covers: 1 (Ethereum), 42161 (Arbitrum), 10 (Optimism), 137 (Polygon), 
    // 8453 (Base), 43114 (Avalanche), and other EVM chains
    return 'uniswap';
  }
  
  return null;
};

/**
 * Check if chain is BSC
 */
export const isBSCChain = (chainId: number): boolean => {
  return chainId === 56;
};

/**
 * Check if chain is ETH-based (Ethereum, Arbitrum, Optimism, Polygon, Base)
 */
export const isETHChain = (chainId: number): boolean => {
  return [1, 42161, 10, 137, 8453].includes(chainId);
};

