/**
 * Route Service Enhancer
 * 
 * Optional enhancement to RouteService that adds universal routing.
 * This is opt-in and doesn't modify the existing RouteService.
 */

import type { RouteRequest, RouteResponse } from '@/lib/backend/routers/types';
import { getQuoteAggregator } from '../quote-aggregator/quote-aggregator';
import { getRouteValidator } from '../quote-aggregator/route-validator';
import type { Address } from 'viem';
import { getAddress } from 'viem';

/**
 * Enhanced route response with universal routing
 */
export interface EnhancedRouteResponse extends RouteResponse {
  sources?: string[]; // Which sources provided routes
  universalRoutingEnabled?: boolean; // Whether universal routing was used
}

/**
 * Route Service Enhancer
 * 
 * Enhances existing RouteService with universal routing capabilities.
 * This is a wrapper that can be used optionally.
 */
export class RouteServiceEnhancer {
  private quoteAggregator = getQuoteAggregator();
  private routeValidator = getRouteValidator();
  
  /**
   * Get enhanced route with universal routing
   * 
   * This method:
   * 1. Gets routes from existing RouteService (existing routers)
   * 2. Gets routes from universal routing system
   * 3. Aggregates and ranks all routes
   * 4. Returns the best route
   * 
   * @param request Route request
   * @param existingRouteResponse Response from existing RouteService
   * @param options Enhancement options
   * @returns Enhanced route response
   */
  async enhanceRoute(
    request: RouteRequest,
    existingRouteResponse: RouteResponse,
    options: {
      enableUniversalRouting?: boolean;
      preferUniversalRouting?: boolean; // Prefer universal routing over existing
      gasPrice?: bigint;
      inputTokenPriceUSD?: number;
      outputTokenPriceUSD?: number;
    } = {}
  ): Promise<EnhancedRouteResponse> {
    const {
      enableUniversalRouting = true,
      preferUniversalRouting = false,
      gasPrice,
      inputTokenPriceUSD,
      outputTokenPriceUSD,
    } = options;
    
    // If universal routing is disabled, return existing response as-is
    if (!enableUniversalRouting) {
      return {
        ...existingRouteResponse,
        sources: [existingRouteResponse.route.router],
        universalRoutingEnabled: false,
      };
    }
    
    try {
      // Prepare parameters for quote aggregation
      const fromToken = getAddress(request.fromToken.address);
      const toToken = getAddress(request.toToken.address);
      const chainId = request.fromToken.chainId;
      const amountIn = BigInt(request.fromAmount);
      
      // Get existing routes
      const existingRoutes = existingRouteResponse.route
        ? [existingRouteResponse.route]
        : [];
      
      if (existingRouteResponse.alternatives) {
        existingRoutes.push(...existingRouteResponse.alternatives);
      }
      
      // Aggregate quotes
      const aggregatedQuotes = await this.quoteAggregator.aggregateQuotes(
        fromToken,
        toToken,
        chainId,
        amountIn,
        existingRoutes,
        {
          includeUniversalRouting: true,
          includeExistingRouters: true,
          maxQuotes: 5,
          gasPrice,
          inputTokenPriceUSD,
          outputTokenPriceUSD,
        }
      );
      
      if (aggregatedQuotes.length === 0) {
        // No quotes found, return existing response
        return {
          ...existingRouteResponse,
          sources: existingRoutes.map(r => r.router),
          universalRoutingEnabled: false,
        };
      }
      
      // Get best quote
      const bestQuote = aggregatedQuotes[0];
      
      // Validate the route
      const validation = this.routeValidator.validateRoute(bestQuote.route);
      
      if (!validation.isValid) {
        console.warn('[RouteServiceEnhancer] Best route failed validation:', validation.errors);
        
        // Try next best route
        for (let i = 1; i < aggregatedQuotes.length; i++) {
          const quote = aggregatedQuotes[i];
          const quoteValidation = this.routeValidator.validateRoute(quote.route);
          if (quoteValidation.isValid) {
            return this.buildEnhancedResponse(quote, aggregatedQuotes, existingRouteResponse);
          }
        }
        
        // All routes invalid, return existing response
        return {
          ...existingRouteResponse,
          sources: existingRoutes.map(r => r.router),
          universalRoutingEnabled: false,
        };
      }
      
      // Check if we should prefer universal routing
      if (preferUniversalRouting && bestQuote.source === 'universal') {
        return this.buildEnhancedResponse(bestQuote, aggregatedQuotes, existingRouteResponse);
      }
      
      // Compare with existing route
      const existingRoute = existingRouteResponse.route;
      if (existingRoute) {
        const existingOutput = parseFloat(existingRoute.toToken.amount || '0');
        const newOutput = parseFloat(bestQuote.outputAmount);
        
        // Use new route if it's better (higher output)
        if (newOutput > existingOutput * 1.01) {
          // New route is at least 1% better
          return this.buildEnhancedResponse(bestQuote, aggregatedQuotes, existingRouteResponse);
        }
      }
      
      // Use existing route if it's better or similar
      return {
        ...existingRouteResponse,
        sources: aggregatedQuotes.map(q => q.source),
        universalRoutingEnabled: bestQuote.source === 'universal',
      };
    } catch (error) {
      console.error('[RouteServiceEnhancer] Error enhancing route:', error);
      
      // On error, return existing response
      return {
        ...existingRouteResponse,
        sources: [existingRouteResponse.route?.router || 'unknown'],
        universalRoutingEnabled: false,
      };
    }
  }
  
  /**
   * Build enhanced response from aggregated quote
   */
  private buildEnhancedResponse(
    bestQuote: any,
    allQuotes: any[],
    existingResponse: RouteResponse
  ): EnhancedRouteResponse {
    // Convert UniversalRoute to RouterRoute format if needed
    const route = this.convertToRouterRoute(bestQuote.route);
    
    // Build alternatives from other quotes
    const alternatives = allQuotes
      .slice(1, 4) // Top 3 alternatives
      .map(q => this.convertToRouterRoute(q.route))
      .filter(r => r !== null);
    
    return {
      route,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
      timestamp: Date.now(),
      expiresAt: bestQuote.route.expiresAt || Date.now() + 60000,
      sources: allQuotes.map(q => q.source),
      universalRoutingEnabled: bestQuote.source === 'universal',
    };
  }
  
  /**
   * Convert UniversalRoute to RouterRoute format
   */
  private convertToRouterRoute(route: any): any {
    // If it's already a RouterRoute, return as-is
    if (route.router && route.fromToken && route.toToken) {
      return route;
    }
    
    // Convert UniversalRoute to RouterRoute
    return {
      router: 'universal',
      routeId: route.routeId || `universal-${Date.now()}`,
      fromToken: route.fromToken,
      toToken: route.toToken,
      priceImpact: route.priceImpact,
      gasEstimate: route.gasEstimate,
      fees: route.fees,
      steps: route.steps || [],
      slippage: '0.5', // Default slippage
      expiresAt: route.expiresAt,
      raw: route,
    };
  }
}

// Singleton instance
let routeServiceEnhancerInstance: RouteServiceEnhancer | null = null;

/**
 * Get singleton RouteServiceEnhancer instance
 */
export function getRouteServiceEnhancer(): RouteServiceEnhancer {
  if (!routeServiceEnhancerInstance) {
    routeServiceEnhancerInstance = new RouteServiceEnhancer();
  }
  return routeServiceEnhancerInstance;
}

