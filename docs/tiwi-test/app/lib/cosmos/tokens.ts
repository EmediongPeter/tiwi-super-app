// Cosmos token fetching utilities
// Fetches tokens from Cosmos Hub, Osmosis, and other Cosmos app chains
// Similar pattern to getJupiterTokens for Solana

export interface CosmosToken {
  address: string; // Denom (e.g., "uatom", "uosmo", IBC denom)
  chainId: number; // Numeric chain ID for Cosmos chains
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  priceUSD?: string;
  balance?: string;
  balanceFormatted?: string;
}

// Cosmos chain identifiers
// Squid uses numeric chain IDs for Cosmos chains
export const COSMOS_CHAIN_IDS: Record<string, number> = {
  'cosmoshub-4': 1, // Cosmos Hub (approximate mapping - Squid may use different IDs)
  'osmosis-1': 2,
  'juno-1': 3,
  'axelar-dojo-1': 4,
  'stargaze-1': 5,
  'secret-4': 6,
  'kujira-1': 7,
  'terra2': 8,
  'injective-1': 9,
  'neutron-1': 10,
};

// Common Cosmos tokens (denoms)
const COMMON_COSMOS_TOKENS: Record<string, CosmosToken> = {
  // Cosmos Hub
  'uatom': {
    address: 'uatom',
    chainId: 1,
    symbol: 'ATOM',
    name: 'Cosmos',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png',
  },
  // Osmosis
  'uosmo': {
    address: 'uosmo',
    chainId: 2,
    symbol: 'OSMO',
    name: 'Osmosis',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png',
  },
  // Juno
  'ujuno': {
    address: 'ujuno',
    chainId: 3,
    symbol: 'JUNO',
    name: 'Juno',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/juno/images/juno.png',
  },
  // Axelar
  'uaxl': {
    address: 'uaxl',
    chainId: 4,
    symbol: 'AXL',
    name: 'Axelar',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/axelar/images/axl.png',
  },
  // Stargaze
  'ustars': {
    address: 'ustars',
    chainId: 5,
    symbol: 'STARS',
    name: 'Stargaze',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/stargaze/images/stars.png',
  },
};

/**
 * Get tokens for a Cosmos chain
 * Uses Cosmos Chain Registry as the primary source
 * Falls back to common tokens list if registry is unavailable
 */
export const getCosmosTokens = async (
  chainId: number,
  limit: number = 1000
): Promise<CosmosToken[]> => {
  try {
    // Map numeric chain ID to chain registry name
    const chainRegistryMap: Record<number, string> = {
      1: 'cosmoshub',
      2: 'osmosis',
      3: 'juno',
      4: 'axelar',
      5: 'stargaze',
      6: 'secretnetwork',
      7: 'kujira',
      8: 'terra',
      9: 'injective',
      10: 'neutron',
    };

    const chainName = chainRegistryMap[chainId];
    if (!chainName) {
      console.warn(`[Cosmos] Unknown chain ID ${chainId}, using common tokens only`);
      return Object.values(COMMON_COSMOS_TOKENS).filter(t => t.chainId === chainId);
    }

    const tokens: CosmosToken[] = [];
    const tokenMap = new Map<string, CosmosToken>();

    // Try to fetch from Cosmos Chain Registry
    try {
      const registryUrl = `https://raw.githubusercontent.com/cosmos/chain-registry/master/${chainName}/assetlist.json`;
      const response = await fetch(registryUrl, {
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data?.assets && Array.isArray(data.assets)) {
          for (const asset of data.assets) {
            const denom = asset.base || asset.denom_units?.[0]?.denom;
            if (!denom) continue;

            const decimals = asset.denom_units?.find((u: any) => u.denom === denom)?.exponent || 
                           asset.denom_units?.[asset.denom_units.length - 1]?.exponent || 6;

            const tokenKey = denom.toLowerCase();
            if (tokenMap.has(tokenKey)) continue;

            tokenMap.set(tokenKey, {
              address: denom,
              chainId,
              symbol: asset.symbol || denom.toUpperCase(),
              name: asset.name || asset.symbol || denom,
              decimals,
              logoURI: asset.logo_URIs?.png || asset.logo_URIs?.svg || '',
            });
          }
        }
      }
    } catch (registryError) {
      console.warn(`[Cosmos] Failed to fetch from chain registry for ${chainName}, using common tokens:`, registryError);
    }

    // Always include common tokens for the chain
    for (const [denom, token] of Object.entries(COMMON_COSMOS_TOKENS)) {
      if (token.chainId === chainId) {
        const tokenKey = denom.toLowerCase();
        if (!tokenMap.has(tokenKey)) {
          tokenMap.set(tokenKey, token);
        }
      }
    }

    // Convert map to array and sort
    const allTokens = Array.from(tokenMap.values());
    
    // Sort: native token first, then by symbol
    allTokens.sort((a, b) => {
      // Native tokens first (uatom, uosmo, etc.)
      const aIsNative = a.address.startsWith('u') && a.address.length <= 10;
      const bIsNative = b.address.startsWith('u') && b.address.length <= 10;
      if (aIsNative !== bIsNative) {
        return aIsNative ? -1 : 1;
      }
      return a.symbol.localeCompare(b.symbol);
    });

    return allTokens.slice(0, limit);
  } catch (error) {
    console.error(`[Cosmos] Error fetching tokens for chain ${chainId}:`, error);
    // Return common tokens as fallback
    return Object.values(COMMON_COSMOS_TOKENS).filter(t => t.chainId === chainId);
  }
};

/**
 * Check if a chain ID is a Cosmos chain
 */
export const isCosmosChain = (chainId: number): boolean => {
  return Object.values(COSMOS_CHAIN_IDS).includes(chainId) || 
         chainId >= 1 && chainId <= 100; // Rough range for Cosmos chains
};

/**
 * Get native token for a Cosmos chain
 */
export const getCosmosNativeToken = (chainId: number): CosmosToken | null => {
  const nativeTokens: Record<number, CosmosToken> = {
    1: COMMON_COSMOS_TOKENS['uatom'],
    2: COMMON_COSMOS_TOKENS['uosmo'],
    3: COMMON_COSMOS_TOKENS['ujuno'],
    4: COMMON_COSMOS_TOKENS['uaxl'],
    5: COMMON_COSMOS_TOKENS['ustars'],
  };
  return nativeTokens[chainId] || null;
};

/**
 * Get the canonical Cosmos chain key (e.g. "cosmoshub-4", "osmosis-1") for a numeric Cosmos chain ID.
 * This is primarily used when talking to external services like Squid that expect the string key.
 */
export const getCosmosChainKey = (chainId: number): string | undefined => {
  const entry = Object.entries(COSMOS_CHAIN_IDS).find(([, id]) => id === chainId);
  return entry ? entry[0] : undefined;
};

