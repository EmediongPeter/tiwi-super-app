/**
 * Gas Estimation Service
 * 
 * Estimates gas costs for Uniswap V2 / PancakeSwap V2 swaps.
 * Uses eth_estimateGas for accuracy with caching and fallback mechanisms.
 */

import { createPublicClient, http, type Address, getAddress, encodeFunctionData, type Chain } from 'viem';
import { 
  mainnet, 
  arbitrum, 
  optimism, 
  polygon, 
  base, 
  bsc 
} from 'viem/chains';
import { getCache, CACHE_TTL } from '@/lib/backend/utils/cache';
import { getRpcUrl, RPC_TRANSPORT_OPTIONS } from '@/lib/backend/utils/rpc-config';
import { getTokenPrice } from '@/lib/backend/providers/price-provider';

// ============================================================================
// Chain Configuration
// ============================================================================

const CHAIN_CONFIGS: Record<number, Chain> = {
  1: mainnet,
  56: bsc,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  8453: base,
};

// ============================================================================
// Native Token Addresses
// ============================================================================

const NATIVE_TOKEN_ADDRESSES: Record<number, Address> = {
  1: getAddress('0x0000000000000000000000000000000000000000'), // ETH
  56: getAddress('0x0000000000000000000000000000000000000000'), // BNB
  137: getAddress('0x0000000000000000000000000000000000001010'), // POL (Polygon)
  42161: getAddress('0x0000000000000000000000000000000000000000'), // ETH (Arbitrum)
  10: getAddress('0x0000000000000000000000000000000000000000'), // ETH (Optimism)
  8453: getAddress('0x0000000000000000000000000000000000000000'), // ETH (Base)
};

// ============================================================================
// Average Gas Costs (Fallback)
// ============================================================================

const AVERAGE_GAS_LIMITS: Record<number, bigint> = {
  1: BigInt(150000),      // Ethereum
  56: BigInt(200000),     // BSC
  137: BigInt(200000),    // Polygon
  42161: BigInt(150000),  // Arbitrum
  10: BigInt(150000),     // Optimism
  8453: BigInt(150000),   // Base
};

// Average gas prices (in wei/gwei) - updated periodically
const AVERAGE_GAS_PRICES: Record<number, bigint> = {
  1: BigInt(20000000000),    // 20 gwei (Ethereum)
  56: BigInt(3000000000),    // 3 gwei (BSC)
  137: BigInt(30000000000),  // 30 gwei (Polygon)
  42161: BigInt(100000000),  // 0.1 gwei (Arbitrum)
  10: BigInt(1000000),       // 0.001 gwei (Optimism)
  8453: BigInt(1000000),     // 0.001 gwei (Base)
};

// ============================================================================
// Router ABI (Uniswap V2 Router02 / PancakeSwap V2 Router02)
// ============================================================================

const ROUTER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactETHForTokens',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForETH',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ============================================================================
// Gas Estimation Service
// ============================================================================

interface GasEstimate {
  gasEstimate: string;  // Gas limit (in wei units)
  gasUSD: string;        // Gas cost in USD
}

interface EstimateGasParams {
  chainId: number;
  routerAddress: Address;
  fromToken: Address;
  toToken: Address;
  amountIn: bigint;
  path: Address[];
  recipient?: Address;  // Optional recipient address (defaults to router for estimation)
}

export class GasEstimationService {
  private cache = getCache();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute
  private readonly ESTIMATION_TIMEOUT = 10000; // 10 seconds

  /**
   * Estimate gas cost for a swap transaction
   * 
   * @param params - Gas estimation parameters
   * @returns Gas estimate and USD cost
   */
  async estimateSwapGas(params: EstimateGasParams): Promise<GasEstimate> {
    const { chainId, routerAddress, fromToken, toToken, amountIn, path, recipient } = params;

    // Check cache first
    const cacheKey = this.getCacheKey(chainId, routerAddress, fromToken, toToken, amountIn);
    const cached = this.cache.get<GasEstimate>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get chain config
      const chainConfig = CHAIN_CONFIGS[chainId];
      if (!chainConfig) {
        console.warn(`[GasEstimationService] Chain ${chainId} not supported, using fallback`);
        return this.getFallbackEstimate(chainId);
      }

      // Create public client with custom RPC
      const customRpcUrl = getRpcUrl(chainId);
      const transport = customRpcUrl
        ? http(customRpcUrl, RPC_TRANSPORT_OPTIONS)
        : http();
      
      const publicClient = createPublicClient({
        chain: chainConfig,
        transport,
      });

      // Determine swap function and encode transaction
      const isFromNative = this.isNativeToken(fromToken, chainId);
      const isToNative = this.isNativeToken(toToken, chainId);
      
      let encodedData: `0x${string}`;
      let value: bigint | undefined;

      if (isFromNative && !isToNative) {
        // Native → ERC20: swapExactETHForTokens
        const amountOutMin = BigInt(0); // Minimum output (0 for estimation)
        const to = recipient || routerAddress;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes from now
        
        encodedData = encodeFunctionData({
          abi: ROUTER_ABI,
          functionName: 'swapExactETHForTokens',
          args: [amountOutMin, path, to, deadline],
        });
        value = amountIn; // ETH/BNB value to send
      } else if (!isFromNative && isToNative) {
        // ERC20 → Native: swapExactTokensForETH
        const amountOutMin = BigInt(0);
        const to = recipient || routerAddress;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
        
        encodedData = encodeFunctionData({
          abi: ROUTER_ABI,
          functionName: 'swapExactTokensForETH',
          args: [amountIn, amountOutMin, path, to, deadline],
        });
        value = undefined;
      } else {
        // ERC20 → ERC20: swapExactTokensForTokens
        const amountOutMin = BigInt(0);
        const to = recipient || routerAddress;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
        
        encodedData = encodeFunctionData({
          abi: ROUTER_ABI,
          functionName: 'swapExactTokensForTokens',
          args: [amountIn, amountOutMin, path, to, deadline],
        });
        value = undefined;
      }

      // Estimate gas with timeout
      // Use a dummy address for estimation (any valid address works for estimation)
      const dummyAccount = getAddress('0x0000000000000000000000000000000000000001');
      
      const gasEstimatePromise = publicClient.estimateGas({
        account: dummyAccount,
        to: routerAddress,
        data: encodedData,
        value,
      });

      const timeoutPromise = new Promise<bigint>((_, reject) =>
        setTimeout(() => reject(new Error('Gas estimation timeout')), this.ESTIMATION_TIMEOUT)
      );

      const gasEstimate = await Promise.race([gasEstimatePromise, timeoutPromise]);

      // Get current gas price
      const gasPrice = await publicClient.getGasPrice();

      // Calculate gas cost in native token
      const gasCostNative = gasEstimate * gasPrice;

      // Convert to USD
      const nativeTokenAddress = NATIVE_TOKEN_ADDRESSES[chainId];
      const nativePrice = await getTokenPrice(nativeTokenAddress, chainId);
      
      let gasUSD = '0.00';
      if (nativePrice && nativePrice.priceUSD) {
        const gasCostNativeNum = Number(gasCostNative) / 1e18; // Convert from wei
        const nativePriceNum = parseFloat(nativePrice.priceUSD);
        gasUSD = (gasCostNativeNum * nativePriceNum).toFixed(2);
      }

      const result: GasEstimate = {
        gasEstimate: gasEstimate.toString(),
        gasUSD,
      };

      // Cache result
      this.cache.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error: any) {
      console.warn(`[GasEstimationService] Gas estimation failed for chain ${chainId}:`, error);
      // Fallback to average gas costs
      return this.getFallbackEstimate(chainId);
    }
  }

  /**
   * Get fallback gas estimate using average values
   * Note: Returns '0.00' for gasUSD as price fetch is async and we want fast fallback
   */
  private getFallbackEstimate(chainId: number): GasEstimate {
    const averageGasLimit = AVERAGE_GAS_LIMITS[chainId] || BigInt(150000);
    
    // Return fallback estimate (gas USDwill be '0.00' - acceptable for fallback)
    return {
      gasEstimate: averageGasLimit.toString(),
      gasUSD: '0.00', // Price fetch is async, so we return '0.00' for fast fallback
    };
  }

  /**
   * Check if address is native token
   */
  private isNativeToken(address: Address, chainId: number): boolean {
    const nativeAddress = NATIVE_TOKEN_ADDRESSES[chainId];
    if (!nativeAddress) return false;
    return address.toLowerCase() === nativeAddress.toLowerCase();
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    chainId: number,
    routerAddress: Address,
    fromToken: Address,
    toToken: Address,
    amountIn: bigint
  ): string {
    // Use rounded amount for cache key (to avoid too many cache entries)
    // Round to nearest 1% to group similar amounts
    const roundedAmount = (Number(amountIn) / 1e18).toFixed(2);
    return `gas-estimate:${chainId}:${routerAddress.toLowerCase()}:${fromToken.toLowerCase()}:${toToken.toLowerCase()}:${roundedAmount}`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let gasEstimationServiceInstance: GasEstimationService | null = null;

/**
 * Get singleton GasEstimationService instance
 */
export function getGasEstimationService(): GasEstimationService {
  if (!gasEstimationServiceInstance) {
    gasEstimationServiceInstance = new GasEstimationService();
  }
  return gasEstimationServiceInstance;
}

