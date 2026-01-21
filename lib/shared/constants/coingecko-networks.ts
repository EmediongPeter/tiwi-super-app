/**
 * CoinGecko Network mapping and constants.
 * This links our canonical Chain IDs (from LiFi/registry) to CoinGecko's onchain network IDs.
 */

export interface CoinGeckoNetwork {
  id: string; // CoinGecko Network ID used in API (e.g. 'eth', 'bsc', 'solana')
  name: string;
}

/**
 * Master mapping: Chain ID -> CoinGecko Network ID
 * Based on the supported chains from LiFi and CoinGecko's onchain API IDs.
 */
export const CHAIN_ID_TO_COINGECKO_ID: Record<number, string> = {
  // Major Networks
  1: 'eth',            // Ethereum
  56: 'bsc',           // BNB Chain
  137: 'polygon_pos',  // Polygon (Standard POS)
  42161: 'arbitrum',   // Arbitrum
  10: 'optimism',      // Optimism
  8453: 'base',        // Base
  43114: 'avax',       // Avalanche
  7565164: 'solana',   // Solana
  
  // Additional Networks
  100: 'xdai',         // Gnosis
  1088: 'metis',       // Metis
  1329: 'sei-network', // Sei
  2020: 'ronin',       // Ronin
  25: 'cro',           // Cronos
  288: 'boba',         // Boba
  324: 'zksync',       // zkSync
  34443: 'mode',       // Mode
  42220: 'celo',       // Celo
  5000: 'mantle',      // Mantle
  534352: 'scroll',    // Scroll
  59144: 'linea',      // Linea
  250: 'ftm',          // Fantom
  1285: 'movr',        // Moonriver
  1284: 'glmr',        // Moonbeam
  2222: 'kava',        // Kava
  1101: 'polygon-zkevm', // Polygon zkEVM
  1001: 'kaia',        // Kaia
  42170: 'arbitrum_nova', // Arbitrum Nova
};

/**
 * Reverse mapping with Aliases for robustness.
 * Helps when CoinGecko uses slightly different slugs in IDs vs Endpoints.
 */
export const COINGECKO_ID_TO_CHAIN_ID: Record<string, number> = {
  'eth': 1,
  'ethereum': 1,
  'bsc': 56,
  'binance-smart-chain': 56,
  'polygon_pos': 137,
  'polygon': 137, // Alias
  'arbitrum': 42161,
  'arbitrum-one': 42161,
  'optimism': 10,
  'optimistic-ethereum': 10,
  'base': 8453,
  'avax': 43114,
  'avalanche': 43114,
  'solana': 7565164,
  'ftm': 250,
  'fantom': 250,
  'zksync': 324,
  'linea': 59144,
  'scroll': 534352,
  'mantle': 5000,
  'sei-network': 1329,
  'sei': 1329,
};

/**
 * List of "Top Networks" to prioritize in the UI and prefetching.
 */
export const TOP_COINGECKO_NETWORKS = [
  'bsc',
  'solana',
  'eth',
  'base',
  'arbitrum',
  'polygon_pos'
];

/**
 * Helper to get CG Network ID from Chain ID
 */
export function getCoinGeckoNetworkId(chainId: number): string | undefined {
  return CHAIN_ID_TO_COINGECKO_ID[chainId];
}
