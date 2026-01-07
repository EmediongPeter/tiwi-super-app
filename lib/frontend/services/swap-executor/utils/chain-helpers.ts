/**
 * Chain Helper Utilities
 * 
 * Utilities for working with different blockchain networks.
 */

/**
 * Check if a chain ID is an EVM chain
 */
export function isEVMChain(chainId: number): boolean {
  // Common EVM chain IDs
  const EVM_CHAINS = [
    1,    // Ethereum Mainnet
    5,    // Goerli
    137,  // Polygon
    42161, // Arbitrum
    10,   // Optimism
    8453, // Base
    56,   // BSC
    43114, // Avalanche
    250,  // Fantom
    42220, // Celo
  ];
  
  return EVM_CHAINS.includes(chainId);
}

/**
 * Check if a chain ID is Solana
 */
export function isSolanaChain(chainId: number): boolean {
  // Solana mainnet (and testnet/devnet use different IDs, but we'll check for mainnet)
  return chainId === 1399811149 || chainId === 501 || chainId === 103; // Mainnet, Testnet, Devnet
}

/**
 * Get chain type from chain ID
 */
export function getChainType(chainId: number): 'evm' | 'solana' | 'unknown' {
  if (isEVMChain(chainId)) {
    return 'evm';
  }
  if (isSolanaChain(chainId)) {
    return 'solana';
  }
  return 'unknown';
}

/**
 * Check if a token is a native token for a given chain
 */
export function isNativeToken(tokenAddress: string, chainId: number): boolean {
  // EVM native tokens
  if (isEVMChain(chainId)) {
    return (
      tokenAddress === '0x0000000000000000000000000000000000000000' ||
      tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    );
  }
  
  // Solana native SOL
  if (isSolanaChain(chainId)) {
    return (
      tokenAddress === '11111111111111111111111111111111' ||
      tokenAddress === 'So11111111111111111111111111111111111111112'
    );
  }
  
  return false;
}

/**
 * Get native token address for a chain
 */
export function getNativeTokenAddress(chainId: number): string {
  if (isEVMChain(chainId)) {
    return '0x0000000000000000000000000000000000000000';
  }
  if (isSolanaChain(chainId)) {
    return 'So11111111111111111111111111111111111111112';
  }
  throw new Error(`Unknown chain type for chain ID: ${chainId}`);
}

