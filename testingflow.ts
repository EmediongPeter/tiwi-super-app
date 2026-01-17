// utils/multi-hop/pancakeswap.ts
export async function findPancakeSwapRoute(
  fromToken: Address,
  toToken: Address,
  amountIn: bigint
): Promise<{path: Address[]; amountOut: bigint}> {
  
  // Hardcoded intermediaries for BSC (expand as needed)
  const intermediaries = [
    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
    '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
  ];
  
  // Try direct first
  const direct = await tryDirectSwap(fromToken, toToken, amountIn);
  if (direct) return direct;
  
  // Try 2-hop: A → Intermediary → B
  for (const mid of intermediaries) {
    const route1 = await tryDirectSwap(fromToken, mid, amountIn);
    if (!route1) continue;
    
    const route2 = await tryDirectSwap(mid, toToken, route1.amountOut);
    if (route2) {
      return {
        path: [fromToken, mid, toToken],
        amountOut: route2.amountOut
      };
    }
  }
  
  throw new Error('No route found');
}