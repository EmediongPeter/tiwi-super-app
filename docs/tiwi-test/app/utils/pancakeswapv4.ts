// PancakeSwap V4 integration as fallback when V2 fails
// Documentation: https://docs.pancakeswap.finance/developers/smart-contracts/pancakeswap-v4
// V4 uses a singleton PoolManager contract instead of factory/router pattern

import { createPublicClient, http, type Address, type Chain, getAddress, encodeFunctionData } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, bsc } from 'viem/chains';

// PancakeSwap V4 PoolManager addresses (singleton contract)
// Note: These addresses need to be verified for each chain
const PANCAKESWAP_V4_POOL_MANAGER: Record<number, Address> = {
  1: getAddress('0x0000000000000000000000000000000000000000'), // Ethereum Mainnet - TBD
  42161: getAddress('0x0000000000000000000000000000000000000000'), // Arbitrum - TBD
  10: getAddress('0x0000000000000000000000000000000000000000'), // Optimism - TBD
  137: getAddress('0x0000000000000000000000000000000000000000'), // Polygon - TBD
  8453: getAddress('0x0000000000000000000000000000000000000000'), // Base - TBD
  56: getAddress('0x5FbDB2315678afecb367f032d93F642f64180aa3'), // BSC - Placeholder, needs actual address
};

// PancakeSwap V4 Router addresses (if separate from PoolManager)
const PANCAKESWAP_V4_ROUTER: Record<number, Address> = {
  1: getAddress('0x0000000000000000000000000000000000000000'), // Ethereum Mainnet - TBD
  42161: getAddress('0x0000000000000000000000000000000000000000'), // Arbitrum - TBD
  10: getAddress('0x0000000000000000000000000000000000000000'), // Optimism - TBD
  137: getAddress('0x0000000000000000000000000000000000000000'), // Polygon - TBD
  8453: getAddress('0x0000000000000000000000000000000000000000'), // Base - TBD
  56: getAddress('0x0000000000000000000000000000000000000000'), // BSC - TBD
};

// WETH addresses (reuse from V2)
export const WETH_ADDRESSES_V4: Record<number, Address> = {
  1: getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'), // Ethereum WETH
  42161: getAddress('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'), // Arbitrum WETH
  10: getAddress('0x4200000000000000000000000000000000000006'), // Optimism WETH
  137: getAddress('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'), // Polygon WMATIC
  8453: getAddress('0x4200000000000000000000000000000000000006'), // Base WETH
  56: getAddress('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'), // BSC WBNB
};

// ERC20 ABI for approvals
const ERC20_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// PoolManager ABI (V4 uses a different structure)
// Note: This is a simplified ABI - actual V4 contracts may have different function signatures
const POOL_MANAGER_ABI = [
  {
    inputs: [
      { internalType: 'bytes32', name: 'poolId', type: 'bytes32' },
      { internalType: 'bool', name: 'zeroForOne', type: 'bool' },
      { internalType: 'int256', name: 'amountSpecified', type: 'int256' },
      { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'swap',
    outputs: [
      { internalType: 'int256', name: 'amount0', type: 'int256' },
      { internalType: 'int256', name: 'amount1', type: 'int256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'currency0', type: 'address' },
      { internalType: 'address', name: 'currency1', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'int24', name: 'tickSpacing', type: 'int24' },
    ],
    name: 'getPoolId',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'poolId', type: 'bytes32' }],
    name: 'getSlot0',
    outputs: [
      { internalType: 'uint160', name: 'sqrtPriceX96', type: 'uint160' },
      { internalType: 'int24', name: 'tick', type: 'int24' },
      { internalType: 'uint24', name: 'protocolFee', type: 'uint24' },
      { internalType: 'uint24', name: 'lpFee', type: 'uint24' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Router ABI (if V4 uses a router wrapper)
const ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'poolId', type: 'bytes32' },
          { internalType: 'bool', name: 'zeroForOne', type: 'bool' },
          { internalType: 'int256', name: 'amountSpecified', type: 'int256' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        internalType: 'struct IPoolManager.SwapParams',
        name: 'params',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'address', name: 'currency0', type: 'address' },
          { internalType: 'address', name: 'currency1', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'int24', name: 'tickSpacing', type: 'int24' },
        ],
        internalType: 'struct PoolKey',
        name: 'poolKey',
        type: 'tuple',
      },
    ],
    name: 'swap',
    outputs: [
      { internalType: 'int256', name: 'amount0', type: 'int256' },
      { internalType: 'int256', name: 'amount1', type: 'int256' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

// Get chain config for viem
const getChainConfig = (chainId: number): Chain | null => {
  const chainMap: Record<number, Chain> = {
    1: mainnet,
    42161: arbitrum,
    10: optimism,
    137: polygon,
    8453: base,
    56: bsc,
  };
  return chainMap[chainId] || null;
};

// Convert native token to WETH address
export const convertToWETHV4 = (tokenAddress: string, chainId: number): Address => {
  if (
    tokenAddress === '0x0000000000000000000000000000000000000000' ||
    tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  ) {
    return WETH_ADDRESSES_V4[chainId] || getAddress(tokenAddress);
  }
  return getAddress(tokenAddress);
};

// Get pool ID for a token pair (V4 uses pool IDs instead of pair addresses)
export const getPoolId = async (
  tokenA: Address,
  tokenB: Address,
  fee: number, // Fee tier (e.g., 500 for 0.05%, 3000 for 0.3%, 10000 for 1%)
  tickSpacing: number, // Tick spacing (typically 60 for 0.05%, 200 for 0.3%, etc.)
  chainId: number
): Promise<`0x${string}` | null> => {
  try {
    const poolManagerAddress = PANCAKESWAP_V4_POOL_MANAGER[chainId];
    if (!poolManagerAddress || poolManagerAddress === '0x0000000000000000000000000000000000000000') {
      console.warn(`Chain ${chainId} not supported by PancakeSwap V4`);
      return null;
    }

    const chain = getChainConfig(chainId);
    if (!chain) {
      console.warn(`Chain ${chainId} not configured`);
      return null;
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    // Ensure addresses are properly checksummed and ordered (token0 < token1)
    const checksummedTokenA = getAddress(tokenA);
    const checksummedTokenB = getAddress(tokenB);
    const [token0, token1] = checksummedTokenA < checksummedTokenB 
      ? [checksummedTokenA, checksummedTokenB] 
      : [checksummedTokenB, checksummedTokenA];

    try {
      const poolId = await publicClient.readContract({
        address: poolManagerAddress,
        abi: POOL_MANAGER_ABI,
        functionName: 'getPoolId',
        args: [token0, token1, fee, tickSpacing],
      });

      return poolId as `0x${string}`;
    } catch (error: any) {
      // If pool doesn't exist, return null
      if (error?.message?.includes('POOL_NOT_FOUND') || 
          error?.message?.includes('pool does not exist')) {
        return null;
      }
      console.error('Error getting pool ID:', error);
      return null;
    }
  } catch (error) {
    console.error('Error getting pool ID:', error);
    return null;
  }
};

// Get quote from PancakeSwap V4
export interface PancakeSwapV4Quote {
  amountOut: string;
  poolId: `0x${string}`;
  poolManagerAddress: Address;
  routerAddress?: Address;
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  tickSpacing: number;
  zeroForOne: boolean; // true if swapping token0 -> token1
}

// Common fee tiers for V4 (similar to V3)
const FEE_TIERS = [100, 500, 2500, 10000]; // 0.01%, 0.05%, 0.25%, 1%
const TICK_SPACINGS: Record<number, number> = {
  100: 1,
  500: 10,
  2500: 50,
  10000: 200,
};

export const getPancakeSwapV4Quote = async (
  tokenIn: Address,
  tokenOut: Address,
  amountIn: string,
  chainId: number
): Promise<PancakeSwapV4Quote | null> => {
  try {
    console.log('[getPancakeSwapV4Quote] Starting quote request:', {
      tokenIn,
      tokenOut,
      amountIn,
      chainId
    });

    // Always use V2 for checking pools/pairs first
    const { getPairAddress, PANCAKESWAP_V2_ROUTER, convertToWETH } = await import('./pancakeswapv2');
    
    const chain = getChainConfig(chainId);
    if (!chain) {
      console.warn(`[getPancakeSwapV4Quote] Chain ${chainId} not configured`);
      return null;
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    // Convert native tokens to WETH
    const tokenInWETH = convertToWETH(tokenIn, chainId);
    const tokenOutWETH = convertToWETH(tokenOut, chainId);

    // Use V2 to check if pairs exist
    console.log('[getPancakeSwapV4Quote] Checking V2 pairs for liquidity...');
    
    // Check direct pair first
    let directPair = await getPairAddress(tokenInWETH, tokenOutWETH, chainId);
    
    // If direct pair doesn't exist, check WETH routing
    let wethPair1: Address | null = null;
    let wethPair2: Address | null = null;
    const wethAddress = WETH_ADDRESSES_V4[chainId];
    
    if (!directPair && wethAddress) {
      const isTokenInWETH = tokenInWETH.toLowerCase() === wethAddress.toLowerCase();
      const isTokenOutWETH = tokenOutWETH.toLowerCase() === wethAddress.toLowerCase();
      
      if (!isTokenInWETH && !isTokenOutWETH) {
        wethPair1 = await getPairAddress(tokenInWETH, wethAddress, chainId);
        wethPair2 = await getPairAddress(wethAddress, tokenOutWETH, chainId);
      }
    }

    // Determine the best path based on V2 pairs
    let path: Address[];
    if (directPair) {
      path = [tokenInWETH, tokenOutWETH];
      console.log('[getPancakeSwapV4Quote] Direct V2 pair exists');
    } else if (wethPair1 && wethPair2) {
      path = [tokenInWETH, wethAddress, tokenOutWETH];
      console.log('[getPancakeSwapV4Quote] WETH routing available via V2 pairs');
    } else {
      console.log('[getPancakeSwapV4Quote] No V2 pairs found for this token pair');
      return null;
    }

    // STEP 2: Use V4 router (or V2 router if V4 not available) for quote estimation
    console.log('[getPancakeSwapV4Quote] Step 2: Getting quote from router...');
    
    const v4RouterAddress = PANCAKESWAP_V4_ROUTER[chainId];
    const v2RouterAddress = PANCAKESWAP_V2_ROUTER[chainId];
    
    // Prefer V4 router if available, otherwise use V2 router
    let routerAddress: Address | null = null;
    let useV4Router = false;
    
    if (v4RouterAddress && v4RouterAddress !== '0x0000000000000000000000000000000000000000') {
      routerAddress = v4RouterAddress;
      useV4Router = true;
      console.log('[getPancakeSwapV4Quote] Using V4 router for estimation');
    } else if (v2RouterAddress) {
      routerAddress = v2RouterAddress;
      useV4Router = false;
      console.log('[getPancakeSwapV4Quote] V4 router not available, using V2 router for estimation');
    } else {
      console.warn('[getPancakeSwapV4Quote] No router available');
      return null;
    }

    // Get quote from router (V4 or V2)
    const ROUTER_ABI = [
      {
        inputs: [
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'address[]', name: 'path', type: 'address[]' },
        ],
        name: 'getAmountsOut',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const;

    let amounts: bigint[] | null = null;
    
    try {
      amounts = await publicClient.readContract({
        address: routerAddress,
        abi: ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [BigInt(amountIn), path],
      }) as bigint[];
    } catch (routerError) {
      console.warn('[getPancakeSwapV4Quote] Router getAmountsOut failed, trying alternative path...', routerError);
      
      // Try alternative path if first path fails
      if (path.length === 2 && wethAddress) {
        const altPath = [tokenInWETH, wethAddress, tokenOutWETH];
        try {
          amounts = await publicClient.readContract({
            address: routerAddress,
            abi: ROUTER_ABI,
            functionName: 'getAmountsOut',
            args: [BigInt(amountIn), altPath],
          }) as bigint[];
          if (amounts && amounts.length > 0) {
            path = altPath;
            console.log('[getPancakeSwapV4Quote] Using alternative path through WETH');
          }
        } catch {
          // Both paths failed
          amounts = null;
        }
      }
    }

    if (!amounts || amounts.length === 0 || amounts[amounts.length - 1] === BigInt(0)) {
      console.warn('[getPancakeSwapV4Quote] Router returned invalid amounts');
      return null;
    }

    const amountOut = amounts[amounts.length - 1];
    const originalTokenIn = getAddress(tokenIn);
    const originalTokenOut = getAddress(tokenOut);
    const zeroForOne = tokenInWETH < tokenOutWETH;

    // Create synthetic pool ID (all zeros) to indicate we're using V2 pairs with V4/V2 router
    const syntheticPoolId = `0x${'0'.repeat(64)}` as `0x${string}`;

    console.log('[getPancakeSwapV4Quote] Quote successful:', {
      tokenIn: originalTokenIn,
      tokenOut: originalTokenOut,
      amountOut: amountOut.toString(),
      path: path.map(addr => `${addr.slice(0, 6)}...${addr.slice(-4)}`).join(' -> '),
      router: useV4Router ? 'V4' : 'V2',
      routerAddress: routerAddress.slice(0, 10) + '...'
    });

    return {
      amountOut: amountOut.toString(),
      poolId: syntheticPoolId,
      poolManagerAddress: routerAddress, // Router address (V4 or V2)
      routerAddress: routerAddress,
      tokenIn: originalTokenIn,
      tokenOut: originalTokenOut,
      fee: 500, // Default fee tier (not used when using V2 pairs)
      tickSpacing: 10, // Default tick spacing (not used when using V2 pairs)
      zeroForOne,
    };
  } catch (error) {
    console.error('[getPancakeSwapV4Quote] Error getting quote:', error);
    // Try one more time with V2 router as last resort
    try {
      console.log('[getPancakeSwapV4Quote] Attempting V2 router fallback after error...');
      const { PANCAKESWAP_V2_ROUTER } = await import('./pancakeswapv2');
      const routerAddress = PANCAKESWAP_V2_ROUTER[chainId];
      
      if (routerAddress) {
        const chain = getChainConfig(chainId);
        if (chain) {
          const publicClient = createPublicClient({
            chain,
            transport: http(),
          });

          const tokenInWETH = convertToWETHV4(tokenIn, chainId);
          const tokenOutWETH = convertToWETHV4(tokenOut, chainId);
          const path = [tokenInWETH, tokenOutWETH];

          const ROUTER_ABI = [
            {
              inputs: [
                { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
                { internalType: 'address[]', name: 'path', type: 'address[]' },
              ],
              name: 'getAmountsOut',
              outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
              stateMutability: 'view',
              type: 'function',
            },
          ] as const;

          const amounts = await publicClient.readContract({
            address: routerAddress,
            abi: ROUTER_ABI,
            functionName: 'getAmountsOut',
            args: [BigInt(amountIn), path],
          }) as bigint[];

          if (amounts && amounts.length > 0 && amounts[amounts.length - 1] > BigInt(0)) {
            const originalTokenIn = getAddress(tokenIn);
            const originalTokenOut = getAddress(tokenOut);
            const syntheticPoolId = `0x${'0'.repeat(64)}` as `0x${string}`;

            console.log('[getPancakeSwapV4Quote] V2 router fallback succeeded');

            return {
              amountOut: amounts[amounts.length - 1].toString(),
              poolId: syntheticPoolId,
              poolManagerAddress: routerAddress,
              routerAddress: routerAddress,
              tokenIn: originalTokenIn,
              tokenOut: originalTokenOut,
              fee: 500,
              tickSpacing: 10,
              zeroForOne: tokenInWETH < tokenOutWETH,
            };
          }
        }
      }
    } catch (fallbackError) {
      console.error('[getPancakeSwapV4Quote] V2 fallback also failed:', fallbackError);
    }

    return null;
  }
};

// Get swap transaction data for V4
export const getPancakeSwapV4SwapData = (
  quote: PancakeSwapV4Quote,
  amountIn: string,
  amountOutMin: string,
  to: Address,
  deadline: number = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes
) => {
  // Check if we're using V2 router as fallback (when poolId is all zeros)
  const isV2Fallback = quote.poolId === `0x${'0'.repeat(64)}`;
  
  if (isV2Fallback) {
    // Use V2 swap functions when V4 pool doesn't exist
    console.log('[getPancakeSwapV4SwapData] Using V2 router as fallback for V4 swap');
    
    const tokenInLower = quote.tokenIn.toLowerCase();
    const tokenOutLower = quote.tokenOut.toLowerCase();
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const nativeAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    
    const isNativeTokenIn = tokenInLower === zeroAddress || tokenInLower === nativeAddress;
    const isNativeTokenOut = tokenOutLower === zeroAddress || tokenOutLower === nativeAddress;

    // Find chain ID by checking V2 router addresses
    let chainId: number | undefined;
    try {
      const { PANCAKESWAP_V2_ROUTER } = require('./pancakeswapv2');
      for (const [id, routerAddr] of Object.entries(PANCAKESWAP_V2_ROUTER)) {
        if (routerAddr === quote.routerAddress || routerAddr === quote.poolManagerAddress) {
          chainId = Number(id);
          break;
        }
      }
    } catch {
      // If we can't find chain ID, try to determine from poolManagerAddress
      chainId = Object.keys(PANCAKESWAP_V4_POOL_MANAGER).find(
        (id) => PANCAKESWAP_V4_POOL_MANAGER[Number(id)] === quote.poolManagerAddress
      ) as number | undefined;
    }

    if (chainId) {
      // Import V2 utilities
      const { convertToWETH, WETH_ADDRESSES } = require('./pancakeswapv2');
      const wethAddress = WETH_ADDRESSES[chainId];
      
      // Build path using WETH conversion
      const tokenInWETH = convertToWETH(quote.tokenIn, chainId);
      const tokenOutWETH = convertToWETH(quote.tokenOut, chainId);
      
      // Use direct path (V2 router will handle routing)
      const path = [tokenInWETH, tokenOutWETH];

      const V2_ROUTER_ABI = [
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
      ] as const;

      const swapAddress = quote.routerAddress || quote.poolManagerAddress;

      if (isNativeTokenIn && !isNativeTokenOut) {
        // swapExactETHForTokens
        const data = encodeFunctionData({
          abi: V2_ROUTER_ABI,
          functionName: 'swapExactETHForTokens',
          args: [BigInt(amountOutMin), path, to, BigInt(deadline)],
        });
        return {
          to: swapAddress,
          value: BigInt(amountIn),
          data,
        };
      } else if (!isNativeTokenIn && isNativeTokenOut) {
        // swapExactTokensForETH
        const data = encodeFunctionData({
          abi: V2_ROUTER_ABI,
          functionName: 'swapExactTokensForETH',
          args: [BigInt(amountIn), BigInt(amountOutMin), path, to, BigInt(deadline)],
        });
        return {
          to: swapAddress,
          value: BigInt(0),
          data,
        };
      } else {
        // swapExactTokensForTokens
        const data = encodeFunctionData({
          abi: V2_ROUTER_ABI,
          functionName: 'swapExactTokensForTokens',
          args: [BigInt(amountIn), BigInt(amountOutMin), path, to, BigInt(deadline)],
        });
        return {
          to: swapAddress,
          value: BigInt(0),
          data,
        };
      }
    }
  }

  // Original V4 swap logic (when actual V4 pool exists)
  const tokenInLower = quote.tokenIn.toLowerCase();
  const tokenOutLower = quote.tokenOut.toLowerCase();
  const zeroAddress = '0x0000000000000000000000000000000000000000';
  const nativeAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  
  const isNativeTokenIn = tokenInLower === zeroAddress || tokenInLower === nativeAddress;
  const isNativeTokenOut = tokenOutLower === zeroAddress || tokenOutLower === nativeAddress;

  // V4 uses PoolManager.swap directly or through a router
  const routerAddress = quote.routerAddress || quote.poolManagerAddress;
  
  // For V4, use a simplified swap call
  const amountSpecified = isNativeTokenIn 
    ? BigInt(amountIn) 
    : -BigInt(amountIn); // Negative for exact input
  
  // sqrtPriceLimitX96: 0 means no limit
  const sqrtPriceLimitX96 = BigInt(0);

  // If router exists, use router; otherwise use PoolManager directly
  const swapAddress = quote.routerAddress && quote.routerAddress !== '0x0000000000000000000000000000000000000000'
    ? quote.routerAddress
    : quote.poolManagerAddress;

  // Note: This is a simplified implementation
  // Actual V4 swap might require different parameters or a router wrapper
  const data = encodeFunctionData({
    abi: ROUTER_ABI.length > 0 ? ROUTER_ABI : POOL_MANAGER_ABI,
    functionName: 'swap',
    args: quote.routerAddress ? [
      {
        poolId: quote.poolId,
        zeroForOne: quote.zeroForOne,
        amountSpecified,
        sqrtPriceLimitX96,
      },
      {
        currency0: quote.zeroForOne ? quote.tokenIn : quote.tokenOut,
        currency1: quote.zeroForOne ? quote.tokenOut : quote.tokenIn,
        fee: quote.fee,
        tickSpacing: quote.tickSpacing,
      },
    ] : [
      quote.poolId,
      quote.zeroForOne,
      amountSpecified,
      sqrtPriceLimitX96,
      '0x', // empty data for hooks
    ],
  });

  return {
    to: swapAddress,
    value: isNativeTokenIn ? BigInt(amountIn) : BigInt(0),
    data,
  };
};

// Check token allowance for V4
export const checkTokenAllowanceV4 = async (
  tokenAddress: Address,
  ownerAddress: Address,
  chainId: number,
  requiredAmount: bigint
): Promise<{ needsApproval: boolean; currentAllowance: bigint }> => {
  try {
    const poolManagerAddress = PANCAKESWAP_V4_POOL_MANAGER[chainId];
    if (!poolManagerAddress || poolManagerAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error(`PoolManager address not found for chain ${chainId}`);
    }

    // V4 might use PoolManager directly or a router for approvals
    const spenderAddress = PANCAKESWAP_V4_ROUTER[chainId] && 
      PANCAKESWAP_V4_ROUTER[chainId] !== '0x0000000000000000000000000000000000000000'
      ? PANCAKESWAP_V4_ROUTER[chainId]
      : poolManagerAddress;

    const chain = getChainConfig(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    const currentAllowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [ownerAddress, spenderAddress],
    });

    return {
      needsApproval: currentAllowance < requiredAmount,
      currentAllowance: currentAllowance as bigint,
    };
  } catch (error) {
    console.error('Error checking token allowance for V4:', error);
    throw error;
  }
};

// Approve token for V4
export const approveTokenV4 = async (
  tokenAddress: Address,
  chainId: number,
  walletClient: any,
  amount?: bigint
): Promise<`0x${string}`> => {
  try {
    const poolManagerAddress = PANCAKESWAP_V4_POOL_MANAGER[chainId];
    if (!poolManagerAddress || poolManagerAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error(`PoolManager address not found for chain ${chainId}`);
    }

    const spenderAddress = PANCAKESWAP_V4_ROUTER[chainId] && 
      PANCAKESWAP_V4_ROUTER[chainId] !== '0x0000000000000000000000000000000000000000'
      ? PANCAKESWAP_V4_ROUTER[chainId]
      : poolManagerAddress;

    const chain = getChainConfig(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    const approveAmount = amount ?? BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    console.log(`[APPROVAL V4] Approving ${tokenAddress} for ${spenderAddress}, amount: ${approveAmount.toString()}`);

    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spenderAddress, approveAmount],
      chain,
    });

    console.log(`[APPROVAL V4] Approval transaction sent: ${hash}`);
    return hash;
  } catch (error) {
    console.error('Error approving token for V4:', error);
    throw error;
  }
};

// Ensure token approval for V4
export const ensureTokenApprovalV4 = async (
  tokenAddress: Address,
  ownerAddress: Address,
  chainId: number,
  walletClient: any,
  requiredAmount: bigint
): Promise<boolean> => {
  const nativeAddresses = Object.values(WETH_ADDRESSES_V4);
  if (nativeAddresses.includes(tokenAddress) || 
      tokenAddress === '0x0000000000000000000000000000000000000000' ||
      tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
    return false; // No approval needed for native tokens
  }

  try {
    const { needsApproval } = await checkTokenAllowanceV4(
      tokenAddress,
      ownerAddress,
      chainId,
      requiredAmount
    );

    if (needsApproval) {
      console.log(`[APPROVAL V4] Token needs approval`);
      const approvalHash = await approveTokenV4(tokenAddress, chainId, walletClient);
      
      const { createPublicClient, http } = await import('viem');
      const chain = getChainConfig(chainId);
      if (!chain) {
        throw new Error(`Chain ${chainId} not supported`);
      }
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      console.log(`[APPROVAL V4] Waiting for approval transaction confirmation...`);
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: approvalHash,
        timeout: 60000
      });

      if (receipt.status === 'reverted') {
        throw new Error('Approval transaction was reverted on-chain');
      }

      console.log(`[APPROVAL V4] Approval transaction confirmed in block ${receipt.blockNumber}`);
      return true;
    }

    return false; // Approval not needed
  } catch (error) {
    console.error('Error ensuring token approval for V4:', error);
    throw error;
  }
};

