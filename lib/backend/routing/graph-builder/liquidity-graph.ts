/**
 * Liquidity Graph
 * 
 * Core data structure representing the liquidity graph.
 * This is a standalone module that doesn't interfere with existing routers.
 */

import type { Address } from 'viem';
import type { TokenNode, PairEdge } from '../types';

/**
 * Liquidity Graph
 * 
 * Represents a graph where:
 * - Nodes are tokens
 * - Edges are trading pairs with liquidity data
 */
export class LiquidityGraph {
  private nodes: Map<string, TokenNode> = new Map();
  private edges: Map<string, PairEdge> = new Map();
  private chainId: number;
  
  // Adjacency list for fast neighbor queries
  private adjacencyList: Map<string, Set<string>> = new Map();
  
  constructor(chainId: number) {
    this.chainId = chainId;
  }
  
  /**
   * Get chain ID this graph represents
   */
  getChainId(): number {
    return this.chainId;
  }
  
  /**
   * Add or update a token node
   */
  addNode(node: TokenNode): void {
    const key = this.getNodeKey(node.address);
    this.nodes.set(key, node);
    
    // Initialize adjacency list if needed
    if (!this.adjacencyList.has(key)) {
      this.adjacencyList.set(key, new Set());
    }
  }
  
  /**
   * Get a token node
   */
  getNode(tokenAddress: Address): TokenNode | undefined {
    const key = this.getNodeKey(tokenAddress);
    return this.nodes.get(key);
  }
  
  /**
   * Add or update a pair edge
   */
  addEdge(edge: PairEdge): void {
    this.edges.set(edge.id, edge);
    
    // Update adjacency list
    const keyA = this.getNodeKey(edge.tokenA);
    const keyB = this.getNodeKey(edge.tokenB);
    
    if (!this.adjacencyList.has(keyA)) {
      this.adjacencyList.set(keyA, new Set());
    }
    if (!this.adjacencyList.has(keyB)) {
      this.adjacencyList.set(keyB, new Set());
    }
    
    this.adjacencyList.get(keyA)!.add(keyB);
    this.adjacencyList.get(keyB)!.add(keyA);
  }
  
  /**
   * Get a pair edge
   */
  getEdge(tokenA: Address, tokenB: Address, dex?: string): PairEdge | undefined {
    // Try both directions
    const id1 = this.getEdgeId(tokenA, tokenB, dex);
    const id2 = this.getEdgeId(tokenB, tokenA, dex);
    
    return this.edges.get(id1) || this.edges.get(id2);
  }
  
  /**
   * Get all neighbors of a token (tokens that can be swapped to/from)
   */
  getNeighbors(tokenAddress: Address): Address[] {
    const key = this.getNodeKey(tokenAddress);
    const neighbors = this.adjacencyList.get(key);
    
    if (!neighbors) {
      return [];
    }
    
    return Array.from(neighbors).map(key => {
      // Extract address from key (format: `${chainId}:${address}`)
      return key.split(':')[1] as Address;
    });
  }
  
  /**
   * Get all edges connected to a token
   */
  getEdgesForToken(tokenAddress: Address): PairEdge[] {
    const neighbors = this.getNeighbors(tokenAddress);
    const edges: PairEdge[] = [];
    
    for (const neighbor of neighbors) {
      const edge = this.getEdge(tokenAddress, neighbor);
      if (edge) {
        edges.push(edge);
      }
    }
    
    return edges;
  }
  
  /**
   * Get all nodes
   */
  getAllNodes(): TokenNode[] {
    return Array.from(this.nodes.values());
  }
  
  /**
   * Get all edges
   */
  getAllEdges(): PairEdge[] {
    return Array.from(this.edges.values());
  }
  
  /**
   * Get nodes by category
   */
  getNodesByCategory(category: TokenNode['category']): TokenNode[] {
    return Array.from(this.nodes.values()).filter(node => node.category === category);
  }
  
  /**
   * Get nodes with minimum liquidity
   */
  getNodesByLiquidity(minLiquidityUSD: number): TokenNode[] {
    return Array.from(this.nodes.values())
      .filter(node => node.liquidityUSD >= minLiquidityUSD)
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD);
  }
  
  /**
   * Get edges with minimum liquidity
   */
  getEdgesByLiquidity(minLiquidityUSD: number): PairEdge[] {
    return Array.from(this.edges.values())
      .filter(edge => edge.liquidityUSD >= minLiquidityUSD)
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD);
  }
  
  /**
   * Check if graph has a specific token
   */
  hasNode(tokenAddress: Address): boolean {
    const key = this.getNodeKey(tokenAddress);
    return this.nodes.has(key);
  }
  
  /**
   * Check if graph has a specific pair
   */
  hasEdge(tokenA: Address, tokenB: Address, dex?: string): boolean {
    return this.getEdge(tokenA, tokenB, dex) !== undefined;
  }
  
  /**
   * Get graph statistics
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    totalLiquidityUSD: number;
    avgLiquidityPerEdge: number;
  } {
    const edges = Array.from(this.edges.values());
    const totalLiquidity = edges.reduce((sum, edge) => sum + edge.liquidityUSD, 0);
    
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      totalLiquidityUSD: totalLiquidity,
      avgLiquidityPerEdge: edges.length > 0 ? totalLiquidity / edges.length : 0,
    };
  }
  
  /**
   * Prune low-liquidity pairs
   * Removes edges below the threshold
   */
  prune(minLiquidityUSD: number): number {
    let pruned = 0;
    const edgesToRemove: string[] = [];
    
    for (const [id, edge] of this.edges.entries()) {
      if (edge.liquidityUSD < minLiquidityUSD) {
        edgesToRemove.push(id);
        pruned++;
      }
    }
    
    // Remove edges
    for (const id of edgesToRemove) {
      const edge = this.edges.get(id);
      if (edge) {
        // Remove from adjacency list
        const keyA = this.getNodeKey(edge.tokenA);
        const keyB = this.getNodeKey(edge.tokenB);
        this.adjacencyList.get(keyA)?.delete(keyB);
        this.adjacencyList.get(keyB)?.delete(keyA);
        
        // Remove edge
        this.edges.delete(id);
      }
    }
    
    return pruned;
  }
  
  /**
   * Clear the graph
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacencyList.clear();
  }
  
  /**
   * Get node key for internal storage
   */
  private getNodeKey(address: Address): string {
    return `${this.chainId}:${address.toLowerCase()}`;
  }
  
  /**
   * Get edge ID
   */
  private getEdgeId(tokenA: Address, tokenB: Address, dex?: string): string {
    const addrA = tokenA.toLowerCase();
    const addrB = tokenB.toLowerCase();
    const sorted = addrA < addrB ? `${addrA}-${addrB}` : `${addrB}-${addrA}`;
    const dexPart = dex ? `-${dex}` : '';
    return `${sorted}-${this.chainId}${dexPart}`;
  }
}

