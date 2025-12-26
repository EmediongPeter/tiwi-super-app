/**
 * Slippage Transformer
 * 
 * Transforms slippage values between different formats.
 * Some routers use percentage (0-100), others use basis points (0-10000).
 */

/**
 * Transform slippage percentage to basis points
 * @param slippagePercent - Slippage as percentage (e.g., 0.5 for 0.5%)
 * @returns Slippage in basis points (e.g., 50 for 0.5%)
 */
export function toBasisPoints(slippagePercent: number): number {
  return Math.round(slippagePercent * 100);
}

/**
 * Transform basis points to slippage percentage
 * @param basisPoints - Slippage in basis points (e.g., 50 for 0.5%)
 * @returns Slippage as percentage (e.g., 0.5 for 0.5%)
 */
export function fromBasisPoints(basisPoints: number): number {
  return basisPoints / 100;
}

/**
 * Transform slippage to router-specific format
 * @param slippagePercent - Slippage as percentage (e.g., 0.5 for 0.5%)
 * @param routerName - Router name
 * @returns Router-specific slippage value
 */
export function transformSlippage(slippagePercent: number, routerName: string): number {
  switch (routerName) {
    case 'jupiter':
      // Jupiter uses basis points
      return toBasisPoints(slippagePercent);
    case 'lifi':
    case 'squid':
    case 'uniswap':
    case 'pancakeswap':
      // Most routers use percentage (0-100)
      return slippagePercent;
    default:
      // Default: percentage
      return slippagePercent;
  }
}

/**
 * Validate slippage value
 * @param slippagePercent - Slippage as percentage
 * @param minSlippage - Minimum allowed slippage (default: 0)
 * @param maxSlippage - Maximum allowed slippage (default: 100)
 * @returns true if valid, false otherwise
 */
export function isValidSlippage(
  slippagePercent: number,
  minSlippage: number = 0,
  maxSlippage: number = 100
): boolean {
  return slippagePercent >= minSlippage && slippagePercent <= maxSlippage;
}

