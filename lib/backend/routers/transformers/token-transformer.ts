/**
 * Token Address Transformer
 * 
 * Transforms canonical token addresses to router-specific formats.
 * Most routers use the same address format, but some need special handling.
 */

/**
 * Transform canonical token address to router-specific token identifier
 * @param canonicalAddress - Canonical token address
 * @param chainId - Canonical chain ID
 * @param routerName - Router name
 * @returns Router-specific token identifier
 */
export function transformTokenAddress(
  canonicalAddress: string,
  chainId: number,
  routerName: string
): string {
  // Most routers use the same address format
  if (routerName === 'lifi' || routerName === 'squid' || routerName === 'uniswap' || routerName === 'pancakeswap') {
    return canonicalAddress;
  }
  
  // Jupiter uses Solana mint addresses (same format, but different context)
  if (routerName === 'jupiter') {
    // Verify it's a Solana address format (32-44 characters, base58)
    // Note: This is a basic check - full validation would require base58 decoding
    if (canonicalAddress.length >= 32 && canonicalAddress.length <= 44) {
      return canonicalAddress;
    }
    throw new Error(`Invalid Solana token address for Jupiter: ${canonicalAddress}`);
  }
  
  // Default: return as-is
  return canonicalAddress;
}

/**
 * Validate token address format for a specific router
 * @param address - Token address
 * @param chainId - Canonical chain ID
 * @param routerName - Router name
 * @returns true if valid, false otherwise
 */
export function isValidTokenAddress(
  address: string,
  chainId: number,
  routerName: string
): boolean {
  if (!address || address.trim() === '') {
    return false;
  }
  
  // EVM address format (0x followed by 40 hex characters)
  const evmAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  
  // Solana address format (base58, 32-44 characters)
  const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  
  if (routerName === 'jupiter') {
    // Jupiter only supports Solana
    return solanaAddressRegex.test(address);
  }
  
  // For EVM-based routers, check EVM address format
  if (routerName === 'lifi' || routerName === 'squid' || routerName === 'uniswap' || routerName === 'pancakeswap') {
    // Check if it's an EVM chain (most common chains are EVM)
    // For now, assume EVM format - can be enhanced with chain type checking
    return evmAddressRegex.test(address);
  }
  
  // Default: accept both formats
  return evmAddressRegex.test(address) || solanaAddressRegex.test(address);
}

