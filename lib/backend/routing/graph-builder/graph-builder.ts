/**
 * Graph Builder
 * 
 * Constructs and maintains the liquidity graph.
 * This is a standalone service that doesn't interfere with existing routers.
 */

import type { Address } from 'viem';
import { LiquidityGraph } from './liquidity-graph';
import { CacheManager } from './cache-manager';
import { PairFetcher } from './pair-fetcher';
import type { PairEdge, TokenNode, GraphUpdateStatus } from '../types';

/**
 * Graph Builder Service
 * 
 * Builds and maintains liquidity graphs for each chain.
 */
export class GraphBuilder {
  private graphs: Map<number, LiquidityGraph> = new Map();
  private cacheManagers: Map<number, CacheManager> = new Map();
  private pairFetchers: Map<number, PairFetcher> = new Map();
  
  /**
   * Get or create graph for a chain
   */
  getGraph(chainId: number): LiquidityGraph {
    if (!this.graphs.has(chainId)) {
      this.graphs.set(chainId, new LiquidityGraph(chainId));
    }
    return this.graphs.get(chainId)!;
  }
  
  /**
   * Get cache manager for a chain
   */
  getCacheManager(chainId: number): CacheManager {
    if (!this.cacheManagers.has(chainId)) {
      this.cacheManagers.set(chainId, new CacheManager());
    }
    return this.cacheManagers.get(chainId)!;
  }
  
  /**
   * Get pair fetcher for a chain
   */
  getPairFetcher(chainId: number): PairFetcher {
    if (!this.pairFetchers.has(chainId)) {
      this.pairFetchers.set(chainId, new PairFetcher(chainId));
    }
    return this.pairFetchers.get(chainId)!;
  }
  
  /**
   * Build graph for a chain
   * 
   * This is the main entry point for building the graph.
   * It fetches pairs from various sources and constructs the graph.
   */
  async buildGraph(chainId: number): Promise<GraphUpdateStatus> {
    const startTime = Date.now();
    const errors: string[] = [];
    let pairsUpdated = 0;
    
    try {
      const graph = this.getGraph(chainId);
      const cacheManager = this.getCacheManager(chainId);
      const pairFetcher = this.getPairFetcher(chainId);
      
      // Get factory address for chain
      const factoryAddress = this.getFactoryAddress(chainId);
      if (!factoryAddress) {
        errors.push(`No factory address configured for chain ${chainId}`);
        const duration = Date.now() - startTime;
        return {
          chainId,
          lastUpdate: Date.now(),
          pairsUpdated: 0,
          pairsTotal: graph.getAllEdges().length,
          updateDuration: duration,
          errors,
        };
      }
      
      console.log(`[GraphBuilder] Building graph for chain ${chainId}...`);
      
      // 1. Fetch pairs from TheGraph (bulk)
      try {
        const theGraphPairs = await pairFetcher.fetchFromTheGraph(factoryAddress, 1000);
        pairsUpdated += theGraphPairs.length;
        
        // Update graph with TheGraph pairs
        await this.updateGraph(chainId, theGraphPairs);
        console.log(`[GraphBuilder] Added ${theGraphPairs.length} pairs from TheGraph`);
      } catch (error: any) {
        errors.push(`TheGraph fetch failed: ${error.message}`);
        console.warn(`[GraphBuilder] TheGraph fetch failed for chain ${chainId}:`, error);
      }
      
      // 2. For high-liquidity pairs, verify via RPC (for accuracy)
      // Limit to top 100 for performance
      const highLiquidityPairs = graph.getAllEdges()
        .filter(e => e.liquidityUSD > 100000)
        .slice(0, 100);
      
      let rpcVerified = 0;
      for (const pair of highLiquidityPairs) {
        try {
          const rpcPair = await pairFetcher.fetchFromRPC(
            factoryAddress,
            pair.tokenA,
            pair.tokenB
          );
          if (rpcPair) {
            // Update with RPC data (more accurate)
            await this.updateGraph(chainId, [rpcPair]);
            rpcVerified++;
          }
        } catch (error) {
          // Continue if RPC fetch fails
        }
      }
      
      if (rpcVerified > 0) {
        console.log(`[GraphBuilder] Verified ${rpcVerified} pairs via RPC`);
      }
      
      const duration = Date.now() - startTime;
      
      return {
        chainId,
        lastUpdate: Date.now(),
        pairsUpdated,
        pairsTotal: graph.getAllEdges().length,
        updateDuration: duration,
        errors,
      };
    } catch (error: any) {
      errors.push(error.message || 'Unknown error');
      const duration = Date.now() - startTime;
      
      return {
        chainId,
        lastUpdate: Date.now(),
        pairsUpdated: 0,
        pairsTotal: 0,
        updateDuration: duration,
        errors,
      };
    }
  }
  
  /**
   * Get factory address for a chain
   */
  private getFactoryAddress(chainId: number): Address | null {
    const factories: Record<number, Address> = {
      56: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address, // PancakeSwap BSC
      1: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' as Address, // Uniswap V2 Ethereum
      137: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32' as Address, // QuickSwap Polygon
    };
    return factories[chainId] || null;
  }
  
  /**
   * Update graph with new pair data
   */
  async updateGraph(chainId: number, edges: PairEdge[]): Promise<void> {
    const graph = this.getGraph(chainId);
    const cacheManager = this.getCacheManager(chainId);
    
    for (const edge of edges) {
      // Add edge to graph
      graph.addEdge(edge);
      
      // Cache the edge
      cacheManager.setHot(edge.id, edge);
      
      // Add token nodes if they don't exist
      let tokenA = graph.getNode(edge.tokenA);
      if (!tokenA) {
        // Create placeholder token node
        // In real implementation, this would fetch token metadata
        tokenA = {
          address: edge.tokenA,
          chainId,
          symbol: 'UNKNOWN',
          decimals: 18,
          liquidityUSD: 0,
          category: 'alt',
          lastUpdated: Date.now(),
        };
        graph.addNode(tokenA);
      }
      
      let tokenB = graph.getNode(edge.tokenB);
      if (!tokenB) {
        tokenB = {
          address: edge.tokenB,
          chainId,
          symbol: 'UNKNOWN',
          decimals: 18,
          liquidityUSD: 0,
          category: 'alt',
          lastUpdated: Date.now(),
        };
        graph.addNode(tokenB);
      }
    }
  }
  
  /**
   * Get pair from cache or fetch on-demand
   */
  async getPair(
    chainId: number,
    tokenA: Address,
    tokenB: Address
  ): Promise<PairEdge | null> {
    const graph = this.getGraph(chainId);
    const cacheManager = this.getCacheManager(chainId);
    const pairFetcher = this.getPairFetcher(chainId);
    
    // Check cache first
    const edgeId = this.getEdgeId(chainId, tokenA, tokenB);
    const cached = cacheManager.getHot(edgeId);
    if (cached && 'tokenA' in cached) {
      return cached as PairEdge;
    }
    
    // Check graph
    const edge = graph.getEdge(tokenA, tokenB);
    if (edge) {
      return edge;
    }
    
    // Fetch on-demand via RPC (using existing utilities)
    const factoryAddress = this.getFactoryAddress(chainId);
    if (!factoryAddress) {
      return null;
    }
    
    try {
      const pair = await pairFetcher.fetchFromRPC(factoryAddress, tokenA, tokenB);
      
      if (pair) {
        // Add to graph and cache
        await this.updateGraph(chainId, [pair]);
        return pair;
      }
    } catch (error) {
      console.warn(`[GraphBuilder] Error fetching pair on-demand:`, error);
    }
    
    return null;
  }
  
  /**
   * Get factory address for a chain (helper method)
   */
  private getFactoryAddress(chainId: number): Address | null {
    const factories: Record<number, Address> = {
      56: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address, // PancakeSwap BSC
      1: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' as Address, // Uniswap V2 Ethereum
      137: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32' as Address, // QuickSwap Polygon
    };
    return factories[chainId] || null;
  }
  
  /**
   * Prune low-liquidity pairs from graph
   */
  pruneGraph(chainId: number, minLiquidityUSD: number): number {
    const graph = this.getGraph(chainId);
    return graph.prune(minLiquidityUSD);
  }
  
  /**
   * Get graph statistics
   */
  getGraphStats(chainId: number) {
    const graph = this.getGraph(chainId);
    const cacheManager = this.getCacheManager(chainId);
    
    return {
      graph: graph.getStats(),
      cache: cacheManager.getStats(),
    };
  }
  
  /**
   * Get edge ID
   */
  private getEdgeId(chainId: number, tokenA: Address, tokenB: Address): string {
    const addrA = tokenA.toLowerCase();
    const addrB = tokenB.toLowerCase();
    const sorted = addrA < addrB ? `${addrA}-${addrB}` : `${addrB}-${addrA}`;
    return `${sorted}-${chainId}`;
  }
}

// Singleton instance
let graphBuilderInstance: GraphBuilder | null = null;

/**
 * Get singleton GraphBuilder instance
 */
export function getGraphBuilder(): GraphBuilder {
  if (!graphBuilderInstance) {
    graphBuilderInstance = new GraphBuilder();
  }
  return graphBuilderInstance;
}

