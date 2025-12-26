/**
 * Provider Initialization
 * 
 * Registers all token/chain providers with the ProviderRegistry.
 * This must be called before using the aggregation service.
 */

import { getProviderRegistry } from './registry';
import { LiFiProvider } from './lifi';
import { DexScreenerProvider } from './dexscreener';

/**
 * Initialize and register all providers
 */
export function initializeProviders(): void {
  const registry = getProviderRegistry();
  
  // Register LiFi provider
  const lifiProvider = new LiFiProvider();
  registry.register(lifiProvider);
  
  // Register DexScreener provider
  const dexscreenerProvider = new DexScreenerProvider();
  registry.register(dexscreenerProvider);
  
  // Future: Register Relay, Jupiter, Squid providers here
  // const relayProvider = new RelayProvider();
  // registry.register(relayProvider);
  
  console.log(`[ProviderInit] Registered ${registry.getProviderCount()} providers`);
}

// Auto-initialize on import (for convenience)
initializeProviders();


