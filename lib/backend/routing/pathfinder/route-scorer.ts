/**
 * Route Scorer
 * 
 * Scores routes based on multiple factors:
 * - Output amount (primary)
 * - Price impact
 * - Gas costs
 * - Protocol fees
 * - Hop count
 */

import type { Address } from 'viem';
import type { LiquidityGraph } from '../graph-builder/liquidity-graph';
import type { PairEdge } from '../types';

/**
 * Route scoring parameters
 */
export interface RouteScoringParams {
  path: Address[];
  amountIn: bigint;
  expectedOutput?: bigint; // If known, use this; otherwise calculate
  gasPrice?: bigint; // Gas price in wei
  inputTokenPriceUSD?: number; // For USD calculations
  outputTokenPriceUSD?: number; // For USD calculations
}

/**
 * Route Score Result
 */
export interface RouteScore {
  score: number; // Overall score (higher is better)
  outputValue: number; // Expected output value in USD
  totalCost: number; // Total cost in USD (gas + fees + price impact)
  netValue: number; // Net value after costs
  breakdown: {
    outputAmount: number;
    priceImpact: number;
    gasCost: number;
    protocolFees: number;
    hopPenalty: number;
  };
}

/**
 * Route Scorer
 * 
 * Calculates scores for routes to determine the best option.
 */
export class RouteScorer {
  private graph: LiquidityGraph;
  
  constructor(graph: LiquidityGraph) {
    this.graph = graph;
  }
  
  /**
   * Score a route
   * 
   * Scoring formula:
   * score = (outputValue) - (totalCost) - (hopPenalty)
   * 
   * Where:
   * - outputValue = expectedOutput * outputTokenPrice
   * - totalCost = gasCost + protocolFees + priceImpactCost
   * - hopPenalty = (hopCount - 1) * penaltyFactor
   */
  scoreRoute(params: RouteScoringParams): RouteScore {
    const { path, amountIn, expectedOutput, gasPrice, inputTokenPriceUSD, outputTokenPriceUSD } = params;
    
    // Calculate expected output if not provided
    const calculatedOutput = expectedOutput || this.calculateExpectedOutput(path, amountIn);
    
    // Calculate price impact
    const priceImpact = this.calculatePriceImpact(path, amountIn);
    
    // Calculate gas cost
    const gasCost = this.calculateGasCost(path, gasPrice);
    
    // Calculate protocol fees
    const protocolFees = this.calculateProtocolFees(path, amountIn);
    
    // Calculate hop penalty
    const hopPenalty = this.calculateHopPenalty(path.length, inputTokenPriceUSD || 0);
    
    // Calculate USD values
    const inputValueUSD = inputTokenPriceUSD 
      ? Number(amountIn) * inputTokenPriceUSD / 1e18 
      : 0;
    const outputValueUSD = outputTokenPriceUSD 
      ? Number(calculatedOutput) * outputTokenPriceUSD / 1e18 
      : 0;
    
    // Total cost in USD
    const totalCostUSD = gasCost + protocolFees + (inputValueUSD * priceImpact / 100) + hopPenalty;
    
    // Net value (output - input - costs)
    const netValue = outputValueUSD - inputValueUSD - totalCostUSD;
    
    // Overall score (net value, higher is better)
    const score = netValue;
    
    return {
      score,
      outputValue: outputValueUSD,
      totalCost: totalCostUSD,
      netValue,
      breakdown: {
        outputAmount: Number(calculatedOutput),
        priceImpact,
        gasCost,
        protocolFees,
        hopPenalty,
      },
    };
  }
  
  /**
   * Calculate expected output for a path
   * 
   * This is a simplified calculation. In production, you'd want to:
   * 1. Query router contracts for exact amounts
   * 2. Account for price impact at each hop
   * 3. Handle fee-on-transfer tokens
   */
  private calculateExpectedOutput(path: Address[], amountIn: bigint): bigint {
    if (path.length < 2) {
      return amountIn;
    }
    
    let currentAmount = amountIn;
    
    // Simulate swap through each hop
    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.graph.getEdge(path[i], path[i + 1]);
      if (!edge) {
        // If edge doesn't exist, return 0
        return BigInt(0);
      }
      
      // Simple constant product formula: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
      // This is simplified - actual AMMs have fees
      const reserveIn = edge.reserve0;
      const reserveOut = edge.reserve1;
      
      // Apply fee (e.g., 0.3% = 997/1000)
      const feeMultiplier = BigInt(997); // 0.3% fee
      const feeDivisor = BigInt(1000);
      
      const amountInAfterFee = (currentAmount * feeMultiplier) / feeDivisor;
      const numerator = amountInAfterFee * reserveOut;
      const denominator = reserveIn + amountInAfterFee;
      
      if (denominator === BigInt(0)) {
        return BigInt(0);
      }
      
      currentAmount = numerator / denominator;
    }
    
    return currentAmount;
  }
  
  /**
   * Calculate total price impact for a route
   */
  private calculatePriceImpact(path: Address[], amountIn: bigint): number {
    if (path.length < 2) {
      return 0;
    }
    
    let totalImpact = 0;
    let currentAmount = amountIn;
    
    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.graph.getEdge(path[i], path[i + 1]);
      if (!edge) {
        continue;
      }
      
      // Calculate price impact for this hop
      const reserveIn = edge.reserve0;
      const impact = reserveIn > BigInt(0)
        ? Number((currentAmount * BigInt(10000)) / reserveIn) / 100 // Percentage
        : 100; // 100% impact if no reserves
      
      // Compound impact: (1 + impact1) * (1 + impact2) - 1
      totalImpact = totalImpact + impact - (totalImpact * impact / 100);
      
      // Update current amount for next hop
      const feeMultiplier = BigInt(997);
      const feeDivisor = BigInt(1000);
      currentAmount = (currentAmount * feeMultiplier) / feeDivisor;
    }
    
    return Math.min(100, totalImpact); // Cap at 100%
  }
  
  /**
   * Calculate gas cost for a route
   */
  private calculateGasCost(path: Address[], gasPrice?: bigint): number {
    if (!gasPrice) {
      return 0; // Can't calculate without gas price
    }
    
    // Estimate gas per hop
    const gasPerHop = BigInt(150000); // Approximate gas per swap
    const totalGas = gasPerHop * BigInt(path.length - 1);
    const gasCostWei = totalGas * gasPrice;
    
    // Convert to USD (assuming ETH price, this is simplified)
    // In production, you'd get actual gas token price
    const ethPriceUSD = 2000; // Placeholder
    const gasCostUSD = Number(gasCostWei) / 1e18 * ethPriceUSD;
    
    return gasCostUSD;
  }
  
  /**
   * Calculate total protocol fees for a route
   */
  private calculateProtocolFees(path: Address[], amountIn: bigint): number {
    if (path.length < 2) {
      return 0;
    }
    
    let totalFees = 0;
    let currentAmount = amountIn;
    
    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.graph.getEdge(path[i], path[i + 1]);
      if (!edge) {
        continue;
      }
      
      // Fee in bps (e.g., 30 bps = 0.3%)
      const feeBps = edge.feeBps;
      const fee = Number(currentAmount) * (feeBps / 10000);
      totalFees += fee;
      
      // Update current amount
      const feeMultiplier = BigInt(10000 - feeBps);
      const feeDivisor = BigInt(10000);
      currentAmount = (currentAmount * feeMultiplier) / feeDivisor;
    }
    
    // Convert to USD (simplified - would need token price)
    return totalFees / 1e18; // Assuming 18 decimals
  }
  
  /**
   * Calculate penalty for number of hops
   */
  private calculateHopPenalty(hopCount: number, inputValueUSD: number): number {
    if (hopCount <= 1) {
      return 0;
    }
    
    // Penalty: 0.1% of input value per additional hop
    const penaltyRate = 0.001;
    const additionalHops = hopCount - 1;
    return inputValueUSD * penaltyRate * additionalHops;
  }
}

