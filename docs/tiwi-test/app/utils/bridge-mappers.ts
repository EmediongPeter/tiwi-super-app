// Mapping helpers for talking to different routers (LI.FI, etc.)
// Keeps our internal chainIds/token addresses decoupled from each provider's expectations.

import { ChainId } from '@lifi/sdk';
import { getAddress, zeroAddress } from 'viem';
import { SOLANA_CHAIN_ID, NATIVE_SOL_MINT } from './jupiter';

// LI.FI's special Solana chain id (from their playground payload)
export const LIFI_SOLANA_CHAIN_ID = 1151111081099710;

const LIFI_SOLANA_NATIVE_TOKEN = '11111111111111111111111111111111';

/**
 * Detect if a token is the native asset for a given chain in our UI model.
 */
export function isNativeTokenForChain(chainId: number, tokenAddress: string): boolean {
  const addr = tokenAddress.toLowerCase();

  // Solana native SOL (Jupiter mint)
  if (chainId === SOLANA_CHAIN_ID) {
    return addr === NATIVE_SOL_MINT.toLowerCase();
  }

  // EVM native tokens
  if (addr === zeroAddress.toLowerCase()) return true;
  if (addr === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') return true;

  return false;
}

/**
 * Map our internal chain id to the LI.FI chain id.
 * For most chains, the chain ID is the same.
 * Solana uses a special LI.FI chain ID.
 */
export function toLifiChainId(chainId: number): number {
  // Solana uses a special chain ID in LI.FI
  if (chainId === SOLANA_CHAIN_ID) {
    return LIFI_SOLANA_CHAIN_ID;
  }
  
  // For all other chains, use the chain ID as-is
  // LI.FI supports many chains and uses their native chain IDs
  return chainId;
}

/**
 * Map our token address representation to what LI.FI expects.
 * Supports EVM (hex addresses), Solana chains, and other LI.FI supported chains.
 */
export function toLifiTokenAddress(
  chainId: number,
  tokenAddress: string,
  isNative: boolean,
): string {
  // Solana: LI.FI expects special "1111...." for native SOL
  if (chainId === SOLANA_CHAIN_ID) {
    if (isNative) {
      return LIFI_SOLANA_NATIVE_TOKEN;
    }
    // SPL tokens use their mint address directly
    return tokenAddress;
  }

  // For native tokens on non-Solana chains, use zero address (LI.FI standard)
  if (isNative) {
    return zeroAddress;
  }

  // EVM chains: validate and format hex addresses
  if (tokenAddress.startsWith('0x')) {
    try {
      return getAddress(tokenAddress);
    } catch (error) {
      throw new Error(`Invalid EVM address format: ${tokenAddress}`);
    }
  }

  // For non-EVM, non-Solana chains, pass through the address as-is
  // LI.FI SDK will handle validation for other chain types
  // This allows support for future chain types that LI.FI adds
  return tokenAddress;
}

/**
 * Reverse mapping: Convert LI.FI chain ID back to our internal chain ID.
 * This is useful when normalizing routes from getRoutes.
 */
export function fromLifiChainId(lifiChainId: number): number {
  // LI.FI's Solana chain ID maps back to our internal Solana chain ID
  if (lifiChainId === LIFI_SOLANA_CHAIN_ID) {
    return SOLANA_CHAIN_ID;
  }
  
  // For all other chains, the chain ID is the same
  return lifiChainId;
}

/**
 * Normalize a route's chain IDs to ensure they match what executeRoute expects.
 * This is needed because routes from getRoutes might have chain IDs from Jupiter (7565164)
 * that need to be converted to LI.FI's format (1151111081099710).
 */
export function normalizeRouteChainIds(route: any): any {
  if (!route) return route;
  
  // Create a deep copy to avoid mutating the original
  const normalizedRoute = JSON.parse(JSON.stringify(route));
  
  // Helper function to normalize a chain ID
  const normalizeChainId = (chainId: number | undefined): number | undefined => {
    if (!chainId) return chainId;
    // If it's our internal Solana ID (from Jupiter), convert to LI.FI ID
    if (chainId === SOLANA_CHAIN_ID) {
      return LIFI_SOLANA_CHAIN_ID;
    }
    // If it's already LI.FI's Solana ID, keep it
    if (chainId === LIFI_SOLANA_CHAIN_ID) {
      return LIFI_SOLANA_CHAIN_ID;
    }
    // For all other chains, keep as-is
    return chainId;
  };
  
  // Normalize top-level chain IDs if they exist
  if (normalizedRoute.fromChainId !== undefined) {
    normalizedRoute.fromChainId = normalizeChainId(normalizedRoute.fromChainId);
  }
  
  if (normalizedRoute.toChainId !== undefined) {
    normalizedRoute.toChainId = normalizeChainId(normalizedRoute.toChainId);
  }
  
  // Normalize chain IDs in steps
  if (normalizedRoute.steps && Array.isArray(normalizedRoute.steps)) {
    normalizedRoute.steps = normalizedRoute.steps.map((step: any) => {
      if (step.action) {
        // Normalize fromChainId in action
        if (step.action.fromChainId !== undefined) {
          step.action.fromChainId = normalizeChainId(step.action.fromChainId);
        }
        // Normalize toChainId in action
        if (step.action.toChainId !== undefined) {
          step.action.toChainId = normalizeChainId(step.action.toChainId);
        }
        // Normalize chainId in action if it exists
        if (step.action.chainId !== undefined) {
          step.action.chainId = normalizeChainId(step.action.chainId);
        }
      }
      
      // Also check for chain IDs in other step properties
      if (step.fromChainId !== undefined) {
        step.fromChainId = normalizeChainId(step.fromChainId);
      }
      if (step.toChainId !== undefined) {
        step.toChainId = normalizeChainId(step.toChainId);
      }
      if (step.chainId !== undefined) {
        step.chainId = normalizeChainId(step.chainId);
      }
      
      return step;
    });
  }
  
  return normalizedRoute;
}



