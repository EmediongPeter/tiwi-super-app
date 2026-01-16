/**
 * Pathfinder
 * 
 * Main pathfinding service that orchestrates different algorithms
 * and returns the best routes for a token pair.
 */

import type { Address } from 'viem';
import type { LiquidityGraph } from '../graph-builder/liquidity-graph';
import { BFSPathfinder } from './bfs-pathfinder';
import { DijkstraPathfinder } from './dijkstra-pathfinder';
import { IntermediarySelector } from './intermediary-selector';
import { RouteScorer } from './route-scorer';
import type { GraphQueryParams, UniversalRoute, RouteStep } from '../types';

/**
 * Pathfinding options
 */
export interface PathfindingOptions {
  maxHops?: number;
  maxRoutes?: number;
  minLiquidityUSD?: number;
  algorithm?: 'bfs' | 'dijkstra' | 'auto';
  gasPrice?: bigint;
  inputTokenPriceUSD?: number;
  outputTokenPriceUSD?: number;
}

/**
 * Pathfinder Service
 * 
 * Main service for finding optimal swap routes.
 */
export class Pathfinder {
  private graph: LiquidityGraph;
  private bfsPathfinder: BFSPathfinder;
  private dijkstraPathfinder: DijkstraPathfinder;
  private intermediarySelector: IntermediarySelector;
  private routeScorer: RouteScorer;
  
  constructor(graph: LiquidityGraph, minLiquidityUSD: number = 0) {
    this.graph = graph;
    this.bfsPathfinder = new BFSPathfinder(graph, minLiquidityUSD);
    this.dijkstraPathfinder = new DijkstraPathfinder(graph, minLiquidityUSD);
    this.intermediarySelector = new IntermediarySelector(graph, minLiquidityUSD);
    this.routeScorer = new RouteScorer(graph);
  }
  
  /**
   * Find routes between two tokens
   * 
   * @param params Query parameters
   * @param options Pathfinding options
   * @returns Array of routes, sorted by score (best first)
   */
  async findRoutes(
    params: GraphQueryParams,
    options: PathfindingOptions = {}
  ): Promise<UniversalRoute[]> {
    const {
      fromToken,
      toToken,
      amountIn,
      maxHops = 3,
      minLiquidityUSD = 0,
    } = params;
    
    const {
      maxRoutes = 3,
      algorithm = 'auto',
      gasPrice,
      inputTokenPriceUSD,
      outputTokenPriceUSD,
    } = options;
    
    // Select algorithm
    const useAlgorithm = algorithm === 'auto' 
      ? this.selectAlgorithm(maxHops)
      : algorithm;
    
    // Find paths
    let paths: Address[][];
    
    if (useAlgorithm === 'dijkstra') {
      // Dijkstra finds optimal path
      const optimalPath = this.dijkstraPathfinder.findOptimalPath(
        fromToken,
        toToken,
        amountIn,
        maxHops
      );
      paths = optimalPath ? [optimalPath] : [];
    } else {
      // BFS finds all paths
      paths = this.bfsPathfinder.findAllPaths(
        fromToken,
        toToken,
        maxHops,
        maxRoutes * 3 // Get more paths than needed, then score and filter
      );
    }
    
    if (paths.length === 0) {
      return [];
    }
    
    // Score all paths
    const scoredRoutes: Array<{ path: Address[]; score: number; route: UniversalRoute }> = [];
    
    for (const path of paths) {
      try {
        // Score the route
        const scoreResult = this.routeScorer.scoreRoute({
          path,
          amountIn,
          gasPrice,
          inputTokenPriceUSD,
          outputTokenPriceUSD,
        });
        
        // Build route object
        const route = this.buildRoute(
          path,
          amountIn,
          scoreResult,
          params.chainId
        );
        
        scoredRoutes.push({
          path,
          score: scoreResult.score,
          route,
        });
      } catch (error) {
        // Skip routes that fail to score
        console.warn(`[Pathfinder] Failed to score route:`, error);
        continue;
      }
    }
    
    // Sort by score (highest first) and return top N
    return scoredRoutes
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRoutes)
      .map(sr => sr.route);
  }
  
  /**
   * Select best algorithm based on graph size and requirements
   */
  private selectAlgorithm(maxHops: number): 'bfs' | 'dijkstra' {
    const stats = this.graph.getStats();
    
    // Use Dijkstra for small graphs or when we want optimal path
    if (stats.nodeCount < 1000 || maxHops <= 2) {
      return 'dijkstra';
    }
    
    // Use BFS for larger graphs or when we want multiple options
    return 'bfs';
  }
  
  /**
   * Build route object from path and score
   */
  private buildRoute(
    path: Address[],
    amountIn: bigint,
    scoreResult: any,
    chainId: number
  ): UniversalRoute {
    const fromToken = path[0];
    const toToken = path[path.length - 1];
    
    // Build steps
    const steps: RouteStep[] = [];
    let currentAmount = amountIn;
    
    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.graph.getEdge(path[i], path[i + 1]);
      if (!edge) {
        continue;
      }
      
      // Calculate output for this step (simplified)
      const feeMultiplier = BigInt(10000 - edge.feeBps);
      const feeDivisor = BigInt(10000);
      const amountAfterFee = (currentAmount * feeMultiplier) / feeDivisor;
      
      // Simple AMM calculation
      const reserveIn = edge.reserve0;
      const reserveOut = edge.reserve1;
      const amountOut = reserveIn > BigInt(0)
        ? (amountAfterFee * reserveOut) / (reserveIn + amountAfterFee)
        : BigInt(0);
      
      steps.push({
        stepId: `step-${i}`,
        fromToken: path[i],
        toToken: path[i + 1],
        dex: edge.dex,
        amountIn: currentAmount.toString(),
        amountOut: amountOut.toString(),
        priceImpact: 0, // Would be calculated per step
        gasEstimate: BigInt(150000), // Estimated gas per step
      });
      
      currentAmount = amountOut;
    }
    
    return {
      routeId: `route-${Date.now()}-${Math.random()}`,
      path,
      steps,
      fromToken: {
        address: fromToken,
        chainId,
        amount: amountIn.toString(),
        amountUSD: inputTokenPriceUSD 
          ? (Number(amountIn) * inputTokenPriceUSD / 1e18).toFixed(2)
          : '0.00',
      },
      toToken: {
        address: toToken,
        chainId,
        amount: currentAmount.toString(),
        amountUSD: outputTokenPriceUSD
          ? (Number(currentAmount) * outputTokenPriceUSD / 1e18).toFixed(2)
          : '0.00',
      },
      priceImpact: scoreResult.breakdown.priceImpact,
      gasEstimate: BigInt(steps.length * 150000),
      gasUSD: scoreResult.breakdown.gasCost.toFixed(2),
      fees: {
        protocol: scoreResult.breakdown.protocolFees.toFixed(2),
        gas: scoreResult.breakdown.gasCost.toFixed(2),
        tiwiProtocolFeeUSD: '0.00', // Would be calculated
        total: scoreResult.totalCost.toFixed(2),
      },
      score: scoreResult.score,
      router: 'universal', // Mark as universal routing
      expiresAt: Date.now() + 60000, // 1 minute expiration
    };
  }
  
  /**
   * Get intermediary selector
   */
  getIntermediarySelector(): IntermediarySelector {
    return this.intermediarySelector;
  }
  
  /**
   * Get route scorer
   */
  getRouteScorer(): RouteScorer {
    return this.routeScorer;
  }
}

