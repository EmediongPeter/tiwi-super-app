/**
 * BFS (Breadth-First Search) Pathfinder
 * 
 * Fast pathfinding algorithm for discovering all possible routes.
 * Best for small to medium graphs and when you need multiple route options.
 */

import type { Address } from 'viem';
import type { LiquidityGraph } from '../graph-builder/liquidity-graph';
import type { PairEdge } from '../types';

/**
 * Path exploration state
 */
interface PathState {
  path: Address[];
  visited: Set<string>;
  cost: number; // Cumulative cost (for optimization)
}

/**
 * BFS Pathfinder
 * 
 * Finds all possible paths between two tokens using breadth-first search.
 */
export class BFSPathfinder {
  private graph: LiquidityGraph;
  private minLiquidityUSD: number;
  
  constructor(graph: LiquidityGraph, minLiquidityUSD: number = 0) {
    this.graph = graph;
    this.minLiquidityUSD = minLiquidityUSD;
  }
  
  /**
   * Find all paths between two tokens
   * 
   * @param fromToken Starting token address
   * @param toToken Target token address
   * @param maxHops Maximum number of hops (default: 3)
   * @param maxPaths Maximum number of paths to return (default: 50)
   * @returns Array of paths (each path is an array of token addresses)
   */
  findAllPaths(
    fromToken: Address,
    toToken: Address,
    maxHops: number = 3,
    maxPaths: number = 50
  ): Address[][] {
    const paths: Address[][] = [];
    const queue: PathState[] = [
      {
        path: [fromToken],
        visited: new Set([this.getTokenKey(fromToken)]),
        cost: 0,
      },
    ];
    
    const fromKey = this.getTokenKey(fromToken);
    const toKey = this.getTokenKey(toToken);
    
    while (queue.length > 0 && paths.length < maxPaths) {
      const current = queue.shift()!;
      const currentToken = current.path[current.path.length - 1];
      const currentKey = this.getTokenKey(currentToken);
      
      // Check if we reached the target
      if (currentKey === toKey) {
        paths.push([...current.path]);
        continue;
      }
      
      // Stop if max hops reached
      if (current.path.length >= maxHops + 1) {
        continue;
      }
      
      // Explore neighbors
      const neighbors = this.graph.getNeighbors(currentToken);
      
      for (const neighbor of neighbors) {
        const neighborKey = this.getTokenKey(neighbor);
        
        // Skip if already visited in this path
        if (current.visited.has(neighborKey)) {
          continue;
        }
        
        // Check edge liquidity if threshold is set
        if (this.minLiquidityUSD > 0) {
          const edge = this.graph.getEdge(currentToken, neighbor);
          if (!edge || edge.liquidityUSD < this.minLiquidityUSD) {
            continue;
          }
        }
        
        // Add to queue
        queue.push({
          path: [...current.path, neighbor],
          visited: new Set([...current.visited, neighborKey]),
          cost: current.cost + 1, // Simple cost: number of hops
        });
      }
    }
    
    return paths;
  }
  
  /**
   * Find shortest path (fewest hops)
   */
  findShortestPath(
    fromToken: Address,
    toToken: Address,
    maxHops: number = 3
  ): Address[] | null {
    const paths = this.findAllPaths(fromToken, toToken, maxHops, 1);
    return paths.length > 0 ? paths[0] : null;
  }
  
  /**
   * Get token key for internal tracking
   */
  private getTokenKey(address: Address): string {
    return address.toLowerCase();
  }
}

