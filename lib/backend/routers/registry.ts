/**
 * Router Registry
 * 
 * Manages all available swap routers.
 * Provides router selection and capability checking.
 */

import type { SwapRouter } from './base';

/**
 * Router registry - manages all available routers
 */
export class RouterRegistry {
  private routers: Map<string, SwapRouter> = new Map();
  
  /**
   * Register a router
   */
  register(router: SwapRouter): void {
    if (this.routers.has(router.name)) {
      console.warn(`[RouterRegistry] Router ${router.name} is already registered. Overwriting.`);
    }
    this.routers.set(router.name, router);
  }
  
  /**
   * Unregister a router
   */
  unregister(name: string): void {
    this.routers.delete(name);
  }
  
  /**
   * Get router by name
   */
  getRouter(name: string): SwapRouter | null {
    return this.routers.get(name) || null;
  }
  
  /**
   * Get all routers, sorted by priority (lower = higher priority)
   */
  getAllRouters(): SwapRouter[] {
    return Array.from(this.routers.values())
      .sort((a, b) => a.getPriority() - b.getPriority());
  }
  
  /**
   * Get routers that support a chain combination
   */
  async getEligibleRouters(
    fromChainId: number,
    toChainId: number
  ): Promise<SwapRouter[]> {
    const routers = this.getAllRouters();
    const eligible: SwapRouter[] = [];
    
    for (const router of routers) {
      try {
        const supportsFrom = await router.supportsChain(fromChainId);
        const supportsTo = await router.supportsChain(toChainId);
        
        if (supportsFrom && supportsTo) {
          // Check cross-chain capability
          const isSameChain = fromChainId === toChainId;
          if (isSameChain || router.supportsCrossChain()) {
            eligible.push(router);
          }
        }
      } catch (error) {
        // If capability check fails, skip this router
        console.warn(`[RouterRegistry] Error checking router ${router.name} capabilities:`, error);
      }
    }
    
    return eligible;
  }
  
  /**
   * Get router count
   */
  getRouterCount(): number {
    return this.routers.size;
  }
  
  /**
   * Check if router is registered
   */
  hasRouter(name: string): boolean {
    return this.routers.has(name);
  }
}

// Singleton instance
let routerRegistryInstance: RouterRegistry | null = null;

/**
 * Get singleton RouterRegistry instance
 */
export function getRouterRegistry(): RouterRegistry {
  if (!routerRegistryInstance) {
    routerRegistryInstance = new RouterRegistry();
  }
  return routerRegistryInstance;
}

