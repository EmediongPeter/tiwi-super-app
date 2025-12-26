/**
 * Provider Registry
 * 
 * Central registry for managing token providers.
 * Handles provider registration, retrieval, and chain-specific provider selection.
 * 
 * Key Features:
 * - Provider registration and lookup
 * - Chain-specific primary provider selection
 * - Router provider identification (for enrichment)
 */

import { getCanonicalChain } from '@/lib/backend/registry/chains';
import type { BaseTokenProvider } from './base';

// ============================================================================
// Provider Registry
// ============================================================================

export class ProviderRegistry {
  private providers = new Map<string, BaseTokenProvider>();

  /**
   * Register a provider
   */
  register(provider: BaseTokenProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Get a provider by name
   */
  getProvider(name: string): BaseTokenProvider | null {
    return this.providers.get(name) || null;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): BaseTokenProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get primary providers for a specific chain
   * 
   * Primary providers are the main sources for token data:
   * - EVM chains: LiFi + Relay (both fetch in parallel)
   * - Solana: Jupiter (when implemented), LiFi as fallback
   * - Cosmos: Squid (when implemented)
   * - Default: LiFi
   */
  async getPrimaryProviders(chainId: number): Promise<BaseTokenProvider[]> {
    // Import chain resolver utilities
    const { isChainSupported, PRIORITY_EVM_CHAINS } = await import('@/lib/backend/registry/chain-resolver');
    
    // Try to get chain from static registry first
    let chain = getCanonicalChain(chainId);
    let chainType: string;
    
    if (chain) {
      // Chain exists in static registry
      chainType = chain.type;
    } else if (isChainSupported(chainId)) {
      // Chain is in priority list but not in static registry
      // For now, assume all priority chains are EVM (LiFi supports them as EVM)
      chainType = 'EVM';
    } else {
      // Chain is not supported
      return [];
    }

    const primaryProviders: BaseTokenProvider[] = [];

    switch (chainType) {
      case 'EVM':
        // EVM has two primary providers: LiFi and Relay (both fetch in parallel)
        const lifi = this.getProvider('lifi');
        const relay = this.getProvider('relay');
        if (lifi) primaryProviders.push(lifi);
        if (relay) primaryProviders.push(relay);
        break;

      case 'Solana':
        // Solana: Jupiter is primary (when implemented), LiFi as fallback
        const jupiter = this.getProvider('jupiter');
        const lifiSolana = this.getProvider('lifi');
        if (jupiter) {
          primaryProviders.push(jupiter);
        } else if (lifiSolana) {
          // LiFi supports Solana, use as fallback
          primaryProviders.push(lifiSolana);
        }
        break;

      case 'Cosmos':
      case 'CosmosAppChain':
        // Cosmos: Squid is primary (when implemented)
        const squid = this.getProvider('squid');
        if (squid) primaryProviders.push(squid);
        break;

      default:
        // Default fallback: LiFi
        const lifiDefault = this.getProvider('lifi');
        if (lifiDefault) primaryProviders.push(lifiDefault);
        break;
    }

    // Filter out providers that don't support this chain
    const supportedProviders: BaseTokenProvider[] = [];
    for (const provider of primaryProviders) {
      if (provider.supportsChain) {
        const supports = await provider.supportsChain(chainId);
        if (supports) {
          supportedProviders.push(provider);
        }
      } else {
        // If supportsChain not implemented, assume it supports all chains
        supportedProviders.push(provider);
      }
    }

    return supportedProviders;
  }

  /**
   * Get router providers (providers that are also routers)
   * 
   * Router providers are used for enrichment to get router-specific token formats.
   * These are: LiFi, Relay, Squid, Jupiter
   */
  getRouterProviders(): BaseTokenProvider[] {
    const routerProviderNames = ['lifi', 'relay', 'squid', 'jupiter'];
    const routerProviders: BaseTokenProvider[] = [];

    for (const name of routerProviderNames) {
      const provider = this.getProvider(name);
      if (provider) {
        routerProviders.push(provider);
      }
    }

    return routerProviders;
  }

  /**
   * Get count of registered providers
   */
  getProviderCount(): number {
    return this.providers.size;
  }

  /**
   * Check if a provider is registered
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let registryInstance: ProviderRegistry | null = null;

/**
 * Get singleton ProviderRegistry instance
 */
export function getProviderRegistry(): ProviderRegistry {
  if (!registryInstance) {
    registryInstance = new ProviderRegistry();
  }
  return registryInstance;
}

