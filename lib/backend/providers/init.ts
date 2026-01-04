/**
 * Provider Initialization
 * 
 * Registers all token/chain providers with the ProviderRegistry.
 * This must be called before using the aggregation service.
 */

import { getProviderRegistry } from './registry';
import { LiFiProvider } from './lifi';
import { DexScreenerProvider } from './dexscreener';
import { JupiterTokenProvider } from './jupiter';

/**
 * Initialize and register all providers
 */
export function initializeProviders(): void {
  const registry = getProviderRegistry();
  
  // Register LiFi provider (for EVM and cross-chain)
  const lifiProvider = new LiFiProvider();
  registry.register(lifiProvider);
  
  // Register Jupiter provider (for Solana - primary)
  const jupiterProvider = new JupiterTokenProvider();
  registry.register(jupiterProvider);
  
  // Register DexScreener provider (fallback)
  const dexscreenerProvider = new DexScreenerProvider();
  registry.register(dexscreenerProvider);
  
  // Future: Register Relay, Squid providers here
  // const relayProvider = new RelayProvider();
  // registry.register(relayProvider);
  
  console.log(`[ProviderInit] Registered ${registry.getProviderCount()} providers`);
}

// Auto-initialize on import (for convenience)
initializeProviders();


