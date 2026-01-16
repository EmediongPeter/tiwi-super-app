/**
 * Pair Fetcher
 * 
 * Fetches trading pair data from multiple sources:
 * - TheGraph subgraphs
 * - DexScreener API
 * - Direct RPC calls
 * 
 * This is a standalone module that doesn't interfere with existing routers.
 */

import type { Address } from 'viem';
import type { PairEdge, TokenNode } from '../types';
import { getAddress } from 'viem';

/**
 * Pair data from TheGraph
 */
interface TheGraphPair {
  id: string;
  token0: {
    id: string;
    symbol: string;
    decimals: string;
  };
  token1: {
    id: string;
    symbol: string;
    decimals: string;
  };
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  reserveUSD: string;
}

/**
 * Pair Fetcher
 * Fetches pair data from various sources
 */
export class PairFetcher {
  private chainId: number;
  
  constructor(chainId: number) {
    this.chainId = chainId;
  }
  
  /**
   * Fetch pairs from TheGraph subgraph
   * 
   * Fetches pairs from TheGraph subgraphs for supported chains.
   */
  async fetchFromTheGraph(
    factoryAddress: Address,
    first: number = 1000
  ): Promise<PairEdge[]> {
    const SUBGRAPH_URLS: Record<number, string> = {
      56: 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v2-bsc', // BSC PancakeSwap
      1: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', // Ethereum Uniswap V2
      137: 'https://api.thegraph.com/subgraphs/name/quickswap/quickswap', // Polygon QuickSwap
    };
    
    const subgraphUrl = SUBGRAPH_URLS[this.chainId];
    if (!subgraphUrl) {
      console.log(`[PairFetcher] No TheGraph subgraph available for chain ${this.chainId}`);
      return [];
    }
    
    try {
      const query = `
        query GetPairs($first: Int!, $skip: Int!) {
          pairs(
            first: $first
            skip: $skip
            orderBy: reserveUSD
            orderDirection: desc
            where: { reserveUSD_gt: "1000" }
          ) {
            id
            token0 {
              id
              symbol
              decimals
            }
            token1 {
              id
              symbol
              decimals
            }
            reserve0
            reserve1
            reserveUSD
            totalSupply
          }
        }
      `;
      
      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { first, skip: 0 },
        }),
      });
      
      if (!response.ok) {
        console.warn(`[PairFetcher] TheGraph error for chain ${this.chainId}: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      
      if (!data.data?.pairs || !Array.isArray(data.data.pairs)) {
        return [];
      }
      
      // Transform to PairEdge format
      const edges: PairEdge[] = [];
      
      for (const pair of data.data.pairs) {
        try {
          const tokenA = getAddress(pair.token0.id);
          const tokenB = getAddress(pair.token1.id);
          const dex = this.getDexForChain(this.chainId);
          
          edges.push({
            id: `${tokenA.toLowerCase()}-${tokenB.toLowerCase()}-${this.chainId}-thegraph`,
            tokenA,
            tokenB,
            chainId: this.chainId,
            dex,
            factory: factoryAddress,
            pairAddress: getAddress(pair.id),
            liquidityUSD: parseFloat(pair.reserveUSD || '0'),
            reserve0: BigInt(pair.reserve0 || '0'),
            reserve1: BigInt(pair.reserve1 || '0'),
            feeBps: this.getFeeBpsForDex(dex),
            lastUpdated: Date.now(),
          });
        } catch (error) {
          console.warn('[PairFetcher] Error transforming pair from TheGraph:', error);
          continue;
        }
      }
      
      console.log(`[PairFetcher] Fetched ${edges.length} pairs from TheGraph for chain ${this.chainId}`);
      return edges;
    } catch (error) {
      console.error(`[PairFetcher] Error fetching from TheGraph for chain ${this.chainId}:`, error);
      return [];
    }
  }
  
  /**
   * Fetch pairs from DexScreener API
   * 
   * Note: DexScreener API may have rate limits.
   * This is a placeholder that can be enhanced later.
   */
  async fetchFromDexScreener(
    chainId: number,
    limit: number = 100
  ): Promise<PairEdge[]> {
    try {
      // DexScreener API endpoint (placeholder - actual endpoint may differ)
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/pairs/${this.getDexScreenerChainName(chainId)}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        console.warn(`[PairFetcher] DexScreener API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      
      // Transform DexScreener data to PairEdge format
      // Note: Actual transformation depends on DexScreener API response format
      return this.transformDexScreenerData(data);
    } catch (error) {
      console.warn(`[PairFetcher] Error fetching from DexScreener:`, error);
      return [];
    }
  }
  
  /**
   * Fetch pair data via direct RPC call
   * 
   * This is used for on-demand fetching of specific pairs.
   * Uses existing utilities from pancakeswap-pairs.ts
   */
  async fetchFromRPC(
    factoryAddress: Address,
    tokenA: Address,
    tokenB: Address
  ): Promise<PairEdge | null> {
    try {
      // Use existing utilities
      const { getPairAddress, getPairReserves } = await import('@/lib/backend/utils/pancakeswap-pairs');
      const { getTokenPrice } = await import('@/lib/backend/providers/price-provider');
      
      // 1. Get pair address (using existing utility)
      const pairAddress = await getPairAddress(tokenA, tokenB, this.chainId);
      if (!pairAddress) {
        return null; // Pair doesn't exist
      }
      
      // 2. Get reserves (using existing utility)
      const reserves = await getPairReserves(tokenA, tokenB, this.chainId);
      if (!reserves) {
        return null;
      }
      
      // 3. Calculate liquidity in USD
      // Try to get token prices, but don't fail if unavailable
      let liquidityUSD = 0;
      try {
        const [priceA, priceB] = await Promise.all([
          getTokenPrice(tokenA, this.chainId, ''),
          getTokenPrice(tokenB, this.chainId, ''),
        ]);
        
        if (priceA && priceB) {
          const reserveAUSD = Number(reserves.reserve0) * parseFloat(priceA.priceUSD || '0') / 1e18;
          const reserveBUSD = Number(reserves.reserve1) * parseFloat(priceB.priceUSD || '0') / 1e18;
          liquidityUSD = reserveAUSD + reserveBUSD;
        }
      } catch (priceError) {
        // If price fetching fails, continue with 0 liquidity (will be updated later)
        console.warn(`[PairFetcher] Could not fetch prices for liquidity calculation:`, priceError);
      }
      
      // Determine DEX based on chain
      const dex = this.getDexForChain(this.chainId);
      
      return {
        id: `${tokenA.toLowerCase()}-${tokenB.toLowerCase()}-${this.chainId}-${dex}`,
        tokenA,
        tokenB,
        chainId: this.chainId,
        dex,
        factory: factoryAddress,
        pairAddress,
        liquidityUSD,
        reserve0: reserves.reserve0,
        reserve1: reserves.reserve1,
        feeBps: this.getFeeBpsForDex(dex),
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error(`[PairFetcher] Error fetching pair from RPC:`, error);
      return null;
    }
  }
  
  /**
   * Get DEX name for chain
   */
  private getDexForChain(chainId: number): string {
    const dexMap: Record<number, string> = {
      56: 'pancakeswap',
      1: 'uniswap',
      137: 'quickswap',
      42161: 'uniswap',
      10: 'uniswap',
      8453: 'uniswap',
    };
    return dexMap[chainId] || 'unknown';
  }
  
  /**
   * Get fee basis points for DEX
   */
  private getFeeBpsForDex(dex: string): number {
    const feeMap: Record<string, number> = {
      pancakeswap: 25, // 0.25%
      uniswap: 30, // 0.3%
      quickswap: 30,
    };
    return feeMap[dex] || 30;
  }
  
  /**
   * Get DexScreener chain name from chain ID
   */
  private getDexScreenerChainName(chainId: number): string {
    const chainMap: Record<number, string> = {
      1: 'ethereum',
      56: 'bsc',
      137: 'polygon',
      42161: 'arbitrum',
      10: 'optimism',
      8453: 'base',
    };
    
    return chainMap[chainId] || `chain-${chainId}`;
  }
  
  /**
   * Transform DexScreener API response to PairEdge format
   */
  private transformDexScreenerData(data: any): PairEdge[] {
    // Placeholder - actual transformation depends on DexScreener API format
    // This is a safe implementation that returns empty array
    if (!data || !Array.isArray(data.pairs)) {
      return [];
    }
    
    const edges: PairEdge[] = [];
    
    // TODO: Implement actual transformation once DexScreener API format is known
    // For now, return empty to avoid breaking existing functionality
    
    return edges;
  }
  
  /**
   * Categorize token based on address and symbol
   */
  categorizeToken(
    address: Address,
    symbol: string,
    liquidityUSD: number
  ): TokenNode['category'] {
    const addr = address.toLowerCase();
    
    // Native tokens
    const nativeTokens: Record<number, Address[]> = {
      1: ['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'], // WETH
      56: ['0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'], // WBNB
      137: ['0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'], // WMATIC
    };
    
    if (nativeTokens[this.chainId]?.includes(addr)) {
      return 'native';
    }
    
    // Stablecoins
    const stableSymbols = ['USDC', 'USDT', 'DAI', 'BUSD', 'FRAX', 'USDP'];
    if (stableSymbols.includes(symbol.toUpperCase())) {
      return 'stable';
    }
    
    // Blue-chip tokens
    const bluechipSymbols = ['WBTC', 'WETH', 'ETH', 'BTC'];
    if (bluechipSymbols.includes(symbol.toUpperCase())) {
      return 'bluechip';
    }
    
    // Default to alt
    return 'alt';
  }
}

