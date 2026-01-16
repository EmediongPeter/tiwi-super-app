/**
 * Intermediary Selector
 * 
 * Intelligently selects intermediary tokens for multi-hop routes.
 * Prioritizes: Native tokens → Stablecoins → Blue-chips → Alts
 */

import type { Address } from 'viem';
import type { LiquidityGraph } from '../graph-builder/liquidity-graph';
import type { TokenNode } from '../types';

/**
 * Intermediary Selector
 * 
 * Selects best intermediary tokens for routing based on:
 * - Token category (native > stable > bluechip > alt)
 * - Liquidity (higher is better)
 * - Availability (must have pairs with both source and target)
 */
export class IntermediarySelector {
  private graph: LiquidityGraph;
  private minLiquidityUSD: number;
  
  constructor(graph: LiquidityGraph, minLiquidityUSD: number = 0) {
    this.graph = graph;
    this.minLiquidityUSD = minLiquidityUSD;
  }
  
  /**
   * Select best intermediaries for a route
   * 
   * @param fromToken Source token
   * @param toToken Target token
   * @param maxIntermediaries Maximum number to return (default: 10)
   * @returns Array of intermediary token addresses, sorted by priority
   */
  selectIntermediaries(
    fromToken: Address,
    toToken: Address,
    maxIntermediaries: number = 10
  ): Address[] {
    const candidates: Array<{ token: Address; score: number }> = [];
    
    // Get all nodes
    const allNodes = this.graph.getAllNodes();
    
    for (const node of allNodes) {
      // Skip if it's the source or target token
      if (
        node.address.toLowerCase() === fromToken.toLowerCase() ||
        node.address.toLowerCase() === toToken.toLowerCase()
      ) {
        continue;
      }
      
      // Check liquidity threshold
      if (this.minLiquidityUSD > 0 && node.liquidityUSD < this.minLiquidityUSD) {
        continue;
      }
      
      // Check if this token has pairs with both source and target
      const hasPairWithSource = this.graph.hasEdge(fromToken, node.address);
      const hasPairWithTarget = this.graph.hasEdge(node.address, toToken);
      
      if (!hasPairWithSource || !hasPairWithTarget) {
        continue;
      }
      
      // Calculate score
      const score = this.calculateScore(node, fromToken, toToken);
      candidates.push({ token: node.address, score });
    }
    
    // Sort by score (highest first) and return top N
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, maxIntermediaries)
      .map(c => c.token);
  }
  
  /**
   * Calculate score for an intermediary token
   * 
   * Scoring factors:
   * 1. Category priority (native > stable > bluechip > alt)
   * 2. Liquidity (higher is better)
   * 3. Edge liquidity (liquidity of pairs with source/target)
   */
  private calculateScore(
    node: TokenNode,
    fromToken: Address,
    toToken: Address
  ): number {
    let score = 0;
    
    // 1. Category priority (0-100 points)
    const categoryScores: Record<TokenNode['category'], number> = {
      native: 100,
      stable: 80,
      bluechip: 60,
      alt: 20,
    };
    score += categoryScores[node.category] || 0;
    
    // 2. Token liquidity (0-50 points, normalized)
    // $10M+ = 50 points, $1M = 25 points, $100K = 5 points
    const liquidityScore = Math.min(50, (node.liquidityUSD / 100000) * 0.5);
    score += liquidityScore;
    
    // 3. Edge liquidity (0-30 points)
    const edgeFrom = this.graph.getEdge(fromToken, node.address);
    const edgeTo = this.graph.getEdge(node.address, toToken);
    
    if (edgeFrom && edgeTo) {
      const avgEdgeLiquidity = (edgeFrom.liquidityUSD + edgeTo.liquidityUSD) / 2;
      const edgeScore = Math.min(30, (avgEdgeLiquidity / 1000000) * 30);
      score += edgeScore;
    }
    
    return score;
  }
  
  /**
   * Get intermediaries by category
   */
  getIntermediariesByCategory(
    category: TokenNode['category'],
    maxCount: number = 5
  ): Address[] {
    const allNodes = this.graph.getAllNodes();
    const nodes = allNodes.filter(node => node.category === category);
    
    return nodes
      .filter(node => {
        if (this.minLiquidityUSD > 0) {
          return node.liquidityUSD >= this.minLiquidityUSD;
        }
        return true;
      })
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
      .slice(0, maxCount)
      .map(node => node.address);
  }
  
  /**
   * Get high-liquidity intermediaries
   */
  getHighLiquidityIntermediaries(
    minLiquidityUSD: number,
    maxCount: number = 10
  ): Address[] {
    const allNodes = this.graph.getAllNodes();
    const nodes = allNodes.filter(node => node.liquidityUSD >= minLiquidityUSD);
    
    return nodes
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
      .slice(0, maxCount)
      .map(node => node.address);
  }
}

