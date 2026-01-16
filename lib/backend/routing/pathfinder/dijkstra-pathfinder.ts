/**
 * Dijkstra's Algorithm Pathfinder
 * 
 * Finds optimal path based on cost (fees + price impact).
 * Best for finding the single best route when cost matters.
 */

import type { Address } from 'viem';
import type { LiquidityGraph } from '../graph-builder/liquidity-graph';
import type { PairEdge } from '../types';

/**
 * Node in Dijkstra's algorithm
 */
interface DijkstraNode {
  token: Address;
  cost: number; // Cumulative cost
  path: Address[]; // Path to reach this node
  previous?: Address;
}

/**
 * Dijkstra Pathfinder
 * 
 * Finds optimal path using Dijkstra's algorithm with cost-based optimization.
 */
export class DijkstraPathfinder {
  private graph: LiquidityGraph;
  private minLiquidityUSD: number;
  
  constructor(graph: LiquidityGraph, minLiquidityUSD: number = 0) {
    this.graph = graph;
    this.minLiquidityUSD = minLiquidityUSD;
  }
  
  /**
   * Find optimal path using Dijkstra's algorithm
   * 
   * @param fromToken Starting token address
   * @param toToken Target token address
   * @param amountIn Input amount (for cost calculation)
   * @param maxHops Maximum number of hops
   * @returns Optimal path or null if not found
   */
  findOptimalPath(
    fromToken: Address,
    toToken: Address,
    amountIn: bigint,
    maxHops: number = 3
  ): Address[] | null {
    const fromKey = this.getTokenKey(fromToken);
    const toKey = this.getTokenKey(toToken);
    
    // Distance map: token -> { cost, path }
    const distances = new Map<string, DijkstraNode>();
    const unvisited = new Set<string>();
    const visited = new Set<string>();
    
    // Initialize
    distances.set(fromKey, {
      token: fromToken,
      cost: 0,
      path: [fromToken],
    });
    unvisited.add(fromKey);
    
    // Add all nodes to unvisited set
    const allNodes = this.graph.getAllNodes();
    for (const node of allNodes) {
      const key = this.getTokenKey(node.address);
      if (!distances.has(key)) {
        distances.set(key, {
          token: node.address,
          cost: Infinity,
          path: [],
        });
      }
      unvisited.add(key);
    }
    
    // Main algorithm
    while (unvisited.size > 0) {
      // Find unvisited node with minimum cost
      let currentKey: string | null = null;
      let minCost = Infinity;
      
      for (const key of unvisited) {
        const node = distances.get(key)!;
        if (node.cost < minCost) {
          minCost = node.cost;
          currentKey = key;
        }
      }
      
      if (currentKey === null || minCost === Infinity) {
        break; // No path found
      }
      
      // Stop if we reached the target
      if (currentKey === toKey) {
        const targetNode = distances.get(toKey)!;
        return targetNode.path.length > 0 ? targetNode.path : null;
      }
      
      // Stop if path is too long
      const currentNode = distances.get(currentKey)!;
      if (currentNode.path.length > maxHops + 1) {
        unvisited.delete(currentKey);
        visited.add(currentKey);
        continue;
      }
      
      // Move current node from unvisited to visited
      unvisited.delete(currentKey);
      visited.add(currentKey);
      
      // Explore neighbors
      const neighbors = this.graph.getNeighbors(currentNode.token);
      
      for (const neighbor of neighbors) {
        const neighborKey = this.getTokenKey(neighbor);
        
        // Skip if already visited
        if (visited.has(neighborKey)) {
          continue;
        }
        
        // Get edge and calculate cost
        const edge = this.graph.getEdge(currentNode.token, neighbor);
        if (!edge) {
          continue;
        }
        
        // Check liquidity threshold
        if (this.minLiquidityUSD > 0 && edge.liquidityUSD < this.minLiquidityUSD) {
          continue;
        }
        
        // Calculate edge cost
        const edgeCost = this.calculateEdgeCost(edge, amountIn);
        const newCost = currentNode.cost + edgeCost;
        
        // Update if we found a better path
        const neighborNode = distances.get(neighborKey)!;
        if (newCost < neighborNode.cost) {
          neighborNode.cost = newCost;
          neighborNode.path = [...currentNode.path, neighbor];
          neighborNode.previous = currentNode.token;
        }
      }
    }
    
    // Check if we found a path to target
    const targetNode = distances.get(toKey);
    if (targetNode && targetNode.path.length > 0 && targetNode.cost < Infinity) {
      return targetNode.path;
    }
    
    return null;
  }
  
  /**
   * Calculate cost of traversing an edge
   * 
   * Cost factors:
   * - Fee (protocol fee)
   * - Price impact (estimated)
   * - Liquidity (lower liquidity = higher cost)
   */
  private calculateEdgeCost(edge: PairEdge, amountIn: bigint): number {
    // Base cost: protocol fee (in bps, converted to cost)
    let cost = edge.feeBps / 10000; // e.g., 30 bps = 0.003
    
    // Price impact cost (estimated)
    // Simple estimation: higher liquidity = lower impact
    if (edge.liquidityUSD > 0) {
      const liquidityFactor = Math.min(1, 1000000 / edge.liquidityUSD); // $1M = factor 1
      cost += liquidityFactor * 0.01; // Add up to 1% cost for low liquidity
    }
    
    // Inverse liquidity cost (lower liquidity = higher cost)
    if (edge.liquidityUSD > 0) {
      const liquidityPenalty = Math.max(0, (1000000 - edge.liquidityUSD) / 1000000);
      cost += liquidityPenalty * 0.005; // Up to 0.5% penalty
    }
    
    return cost;
  }
  
  /**
   * Get token key for internal tracking
   */
  private getTokenKey(address: Address): string {
    return address.toLowerCase();
  }
}

