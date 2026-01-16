/**
 * Quote Aggregator
 * 
 * Aggregates quotes from multiple sources:
 * - Universal routing system (new)
 * - Existing routers (PancakeSwap, Uniswap, LiFi, Jupiter)
 * 
 * This service combines all routes and ranks them to find the best option.
 */

import type { Address } from 'viem';
import type { GraphBuilder } from '../graph-builder/graph-builder';
import type { Pathfinder } from '../pathfinder/pathfinder';
import type { UniversalRoute } from '../types';
import type { RouterRoute } from '@/lib/backend/routers/types';
import { getGraphBuilder } from '../graph-builder';
import { Pathfinder as PathfinderClass } from '../pathfinder';

/**
 * Quote source
 */
export type QuoteSource = 'universal' | 'pancakeswap' | 'uniswap' | 'lifi' | 'jupiter' | 'other';

/**
 * Aggregated quote
 */
export interface AggregatedQuote {
  route: RouterRoute | UniversalRoute;
  source: QuoteSource;
  score: number;
  outputAmount: string;
  outputAmountUSD: string;
  totalCostUSD: string;
  priceImpact: number;
  gasEstimate: bigint;
  gasUSD: string;
}

/**
 * Quote aggregation options
 */
export interface QuoteAggregationOptions {
  includeUniversalRouting?: boolean; // Include new universal routing
  includeExistingRouters?: boolean; // Include existing routers
  maxQuotes?: number; // Maximum quotes to return
  minLiquidityUSD?: number; // Minimum liquidity threshold
  gasPrice?: bigint; // Gas price for cost calculation
  inputTokenPriceUSD?: number;
  outputTokenPriceUSD?: number;
}

/**
 * Quote Aggregator Service
 * 
 * Aggregates quotes from multiple sources and ranks them.
 */
export class QuoteAggregator {
  private graphBuilder: GraphBuilder;
  
  constructor() {
    this.graphBuilder = getGraphBuilder();
  }
  
  /**
   * Aggregate quotes from all sources
   * 
   * @param fromToken Source token
   * @param toToken Target token
   * @param chainId Chain ID
   * @param amountIn Input amount
   * @param existingRoutes Routes from existing routers (optional)
   * @param options Aggregation options
   * @returns Array of aggregated quotes, sorted by score
   */
  async aggregateQuotes(
    fromToken: Address,
    toToken: Address,
    chainId: number,
    amountIn: bigint,
    existingRoutes: RouterRoute[] = [],
    options: QuoteAggregationOptions = {}
  ): Promise<AggregatedQuote[]> {
    const {
      includeUniversalRouting = true,
      includeExistingRouters = true,
      maxQuotes = 5,
      minLiquidityUSD = 0,
      gasPrice,
      inputTokenPriceUSD,
      outputTokenPriceUSD,
    } = options;
    
    const quotes: AggregatedQuote[] = [];
    
    // 1. Get quotes from universal routing (new system)
    if (includeUniversalRouting) {
      try {
        const universalQuotes = await this.getUniversalRoutes(
          fromToken,
          toToken,
          chainId,
          amountIn,
          {
            minLiquidityUSD,
            gasPrice,
            inputTokenPriceUSD,
            outputTokenPriceUSD,
          }
        );
        quotes.push(...universalQuotes);
      } catch (error) {
        console.warn('[QuoteAggregator] Universal routing failed:', error);
        // Continue with other sources
      }
    }
    
    // 2. Get quotes from existing routers
    if (includeExistingRouters && existingRoutes.length > 0) {
      const existingQuotes = this.convertExistingRoutes(
        existingRoutes,
        gasPrice,
        inputTokenPriceUSD,
        outputTokenPriceUSD
      );
      quotes.push(...existingQuotes);
    }
    
    // 3. Rank and sort quotes
    const rankedQuotes = this.rankQuotes(quotes);
    
    // 4. Return top N quotes
    return rankedQuotes.slice(0, maxQuotes);
  }
  
  /**
   * Get routes from universal routing system
   */
  private async getUniversalRoutes(
    fromToken: Address,
    toToken: Address,
    chainId: number,
    amountIn: bigint,
    options: {
      minLiquidityUSD: number;
      gasPrice?: bigint;
      inputTokenPriceUSD?: number;
      outputTokenPriceUSD?: number;
    }
  ): Promise<AggregatedQuote[]> {
    try {
      const graph = this.graphBuilder.getGraph(chainId);
      
      // Check if graph has data
      const stats = graph.getStats();
      if (stats.edgeCount === 0) {
        // Graph is empty, return empty array
        return [];
      }
      
      // Create pathfinder
      const pathfinder = new PathfinderClass(graph, options.minLiquidityUSD);
      
      // Find routes
      const routes = await pathfinder.findRoutes(
        {
          fromToken,
          toToken,
          chainId,
          amountIn,
          maxHops: 3,
          minLiquidityUSD: options.minLiquidityUSD,
        },
        {
          maxRoutes: 5,
          algorithm: 'auto',
          gasPrice: options.gasPrice,
          inputTokenPriceUSD: options.inputTokenPriceUSD,
          outputTokenPriceUSD: options.outputTokenPriceUSD,
        }
      );
      
      // Convert to aggregated quotes
      return routes.map(route => ({
        route: route as any, // UniversalRoute can be treated as RouterRoute for compatibility
        source: 'universal' as QuoteSource,
        score: route.score,
        outputAmount: route.toToken.amount,
        outputAmountUSD: route.toToken.amountUSD,
        totalCostUSD: route.fees.total,
        priceImpact: route.priceImpact,
        gasEstimate: route.gasEstimate,
        gasUSD: route.gasUSD,
      }));
    } catch (error) {
      console.warn('[QuoteAggregator] Error getting universal routes:', error);
      return [];
    }
  }
  
  /**
   * Convert existing router routes to aggregated quotes
   */
  private convertExistingRoutes(
    routes: RouterRoute[],
    gasPrice?: bigint,
    inputTokenPriceUSD?: number,
    outputTokenPriceUSD?: number
  ): AggregatedQuote[] {
    return routes.map(route => {
      // Calculate score for existing routes
      const score = this.calculateRouteScore(route, gasPrice, inputTokenPriceUSD, outputTokenPriceUSD);
      
      return {
        route,
        source: this.getRouteSource(route.router),
        score,
        outputAmount: route.toToken.amount,
        outputAmountUSD: route.toToken.amountUSD || '0.00',
        totalCostUSD: route.fees.total || '0.00',
        priceImpact: parseFloat(route.priceImpact?.toString() || '0'),
        gasEstimate: BigInt(route.fees.gas || '0'),
        gasUSD: route.fees.gasUSD || '0.00',
      };
    });
  }
  
  /**
   * Calculate score for an existing route
   */
  private calculateRouteScore(
    route: RouterRoute,
    gasPrice?: bigint,
    inputTokenPriceUSD?: number,
    outputTokenPriceUSD?: number
  ): number {
    // Extract values
    const outputAmount = parseFloat(route.toToken.amount || '0');
    const outputUSD = parseFloat(route.toToken.amountUSD || '0');
    const inputUSD = parseFloat(route.fromToken.amountUSD || '0');
    const gasUSD = parseFloat(route.fees.gasUSD || '0');
    const protocolFees = parseFloat(route.fees.protocol || '0');
    const priceImpact = parseFloat(route.priceImpact?.toString() || '0');
    
    // Calculate net value
    const totalCost = gasUSD + protocolFees + (inputUSD * priceImpact / 100);
    const netValue = outputUSD - inputUSD - totalCost;
    
    return netValue;
  }
  
  /**
   * Get quote source from router name
   */
  private getRouteSource(router: string): QuoteSource {
    const routerLower = router.toLowerCase();
    if (routerLower.includes('pancake')) return 'pancakeswap';
    if (routerLower.includes('uniswap')) return 'uniswap';
    if (routerLower.includes('lifi')) return 'lifi';
    if (routerLower.includes('jupiter')) return 'jupiter';
    if (routerLower.includes('universal')) return 'universal';
    return 'other';
  }
  
  /**
   * Rank quotes by score
   */
  private rankQuotes(quotes: AggregatedQuote[]): AggregatedQuote[] {
    return quotes.sort((a, b) => {
      // Primary: score (higher is better)
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      
      // Secondary: output amount (higher is better)
      const outputA = parseFloat(a.outputAmount);
      const outputB = parseFloat(b.outputAmount);
      if (outputB !== outputA) {
        return outputB - outputA;
      }
      
      // Tertiary: lower price impact is better
      return a.priceImpact - b.priceImpact;
    });
  }
  
  /**
   * Get best quote (highest score)
   */
  async getBestQuote(
    fromToken: Address,
    toToken: Address,
    chainId: number,
    amountIn: bigint,
    existingRoutes: RouterRoute[] = [],
    options: QuoteAggregationOptions = {}
  ): Promise<AggregatedQuote | null> {
    const quotes = await this.aggregateQuotes(
      fromToken,
      toToken,
      chainId,
      amountIn,
      existingRoutes,
      { ...options, maxQuotes: 1 }
    );
    
    return quotes.length > 0 ? quotes[0] : null;
  }
}

// Singleton instance
let quoteAggregatorInstance: QuoteAggregator | null = null;

/**
 * Get singleton QuoteAggregator instance
 */
export function getQuoteAggregator(): QuoteAggregator {
  if (!quoteAggregatorInstance) {
    quoteAggregatorInstance = new QuoteAggregator();
  }
  return quoteAggregatorInstance;
}

