/**
 * Route Scoring
 * 
 * Simple scoring algorithm to select the best route.
 * Future: Can be enhanced with advanced optimization.
 */

import type { RouterRoute } from './types';

/**
 * Score a route based on multiple factors
 * Higher score = better route
 * 
 * Scoring factors (industry best practices):
 * 1. Output amount (primary) - higher is better (weight: 1000)
 * 2. Price impact (secondary) - lower is better (weight: -100)
 * 3. Total fees (tertiary) - lower is better (weight: -10)
 * 4. Estimated time (quaternary) - faster is better (weight: -0.1)
 * 
 * Price impact is critical for large swaps and low liquidity pairs.
 * Industry standard: prefer routes with < 1% price impact when possible.
 * 
 * @param route - Route to score
 * @returns Score (higher is better)
 */
export function scoreRoute(route: RouterRoute): number {
  if (!route) return 0;
  
  try {
    // Parse values
    const outputAmount = parseFloat(route.toToken.amount) || 0;
    const priceImpact = parseFloat(route.priceImpact) || 0;
    const totalFees = parseFloat(route.fees.total) || 0;
    const estimatedTime = route.estimatedTime || 0;
    
    // Primary factor: output amount (multiply by 1000 for weight)
    // This is the most important - user gets more tokens
    const amountScore = outputAmount * 1000;
    
    // Secondary factor: price impact (negative, so lower impact = higher score)
    // Price impact > 5% is considered high, > 10% is very high
    // Penalize high price impact significantly
    const priceImpactPenalty = priceImpact > 10 ? priceImpact * 50 : // Very high impact: heavy penalty
                               priceImpact > 5 ? priceImpact * 20 :  // High impact: moderate penalty
                               priceImpact * 10;                       // Normal impact: light penalty
    const priceImpactScore = -priceImpactPenalty;
    
    // Tertiary factor: fees (negative, so lower fees = higher score)
    const feeScore = -totalFees * 10;
    
    // Quaternary factor: time (negative, so faster = higher score)
    const timeScore = -estimatedTime * 0.1;
    
    // Combine scores
    return amountScore + priceImpactScore + feeScore + timeScore;
  } catch (error) {
    console.error('[RouteScoring] Error scoring route:', error);
    return 0;
  }
}

/**
 * Select the best route from multiple routes
 * @param routes - Array of routes to choose from
 * @returns Best route or null if no routes
 */
export function selectBestRoute(routes: RouterRoute[]): RouterRoute | null {
  if (routes.length === 0) return null;
  
  // Score all routes
  const scored = routes.map(route => ({
    route,
    score: scoreRoute(route),
  }));
  
  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);
  
  // Return best route
  return scored[0].route;
}

/**
 * Sort routes by score (best first)
 * @param routes - Array of routes to sort
 * @returns Sorted array of routes
 */
export function sortRoutesByScore(routes: RouterRoute[]): RouterRoute[] {
  const scored = routes.map(route => ({
    route,
    score: scoreRoute(route),
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.map(item => item.route);
}

