/**
 * Tiwi Protocol Configuration
 * 
 * This file contains contract addresses and identifiers for Tiwi Protocol.
 * Update this file with your actual Tiwi Protocol contract addresses.
 */

// ============================================================================
// Tiwi Protocol Contract Addresses (per chain)
// ============================================================================

export const TIWI_PROTOCOL_CONTRACTS: Record<number, string[]> = {
  // Ethereum Mainnet
  1: [
    // Add Tiwi Protocol contract addresses here
    // Example: '0x...', // Tiwi Router
    // Example: '0x...', // Tiwi Staking Contract
  ],
  
  // BSC
  56: [
    // Add Tiwi Protocol contract addresses here
  ],
  
  // Polygon
  137: [
    // Add Tiwi Protocol contract addresses here
  ],
  
  // Arbitrum
  42161: [
    // Add Tiwi Protocol contract addresses here
  ],
  
  // Avalanche
  43114: [
    // Add Tiwi Protocol contract addresses here
  ],
  
  // Base
  8453: [
    // Add Tiwi Protocol contract addresses here
  ],
  
  // Optimism
  10: [
    // Add Tiwi Protocol contract addresses here
  ],
};

// ============================================================================
// Tiwi Protocol Identifiers (for metadata matching)
// ============================================================================

export const TIWI_PROTOCOL_NAMES = [
  'Tiwi',
  'TIWI',
  'tiwi-protocol',
  'tiwi protocol',
  'Tiwi Protocol',
];

export const TIWI_DEX_NAMES = [
  'Tiwi DEX',
  'TIWI DEX',
  'tiwi-dex',
  'Tiwi Swap',
];

// ============================================================================
// Configuration Flags
// ============================================================================

/**
 * Enable/disable filtering transactions to only show Tiwi Protocol transactions
 * Set to false to show all transactions
 */
export const TIWI_TRANSACTION_FILTER_ENABLED = process.env.TIWI_TRANSACTION_FILTER_ENABLED !== 'false';

/**
 * Filter mode:
 * - 'strict': Only transactions that interact with Tiwi contracts
 * - 'metadata': Only transactions with Tiwi protocol metadata
 * - 'both': Transactions that match either contract addresses OR metadata
 */
export type TiwiFilterMode = 'strict' | 'metadata' | 'both';

export const TIWI_FILTER_MODE: TiwiFilterMode = (process.env.TIWI_FILTER_MODE as TiwiFilterMode) || 'both';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an address is a Tiwi Protocol contract
 */
export function isTiwiProtocolContract(address: string, chainId: number): boolean {
  const contracts = TIWI_PROTOCOL_CONTRACTS[chainId] || [];
  const addressLower = address.toLowerCase();
  return contracts.some(contract => contract.toLowerCase() === addressLower);
}

/**
 * Check if protocol name matches Tiwi
 */
export function isTiwiProtocolName(protocolName?: string): boolean {
  if (!protocolName) return false;
  const nameLower = protocolName.toLowerCase();
  return TIWI_PROTOCOL_NAMES.some(name => nameLower.includes(name.toLowerCase()));
}

/**
 * Check if DEX name matches Tiwi
 */
export function isTiwiDEXName(dexName?: string): boolean {
  if (!dexName) return false;
  const nameLower = dexName.toLowerCase();
  return TIWI_DEX_NAMES.some(name => nameLower.includes(name.toLowerCase()));
}

/**
 * Get all Tiwi contract addresses across all chains
 */
export function getAllTiwiContracts(): string[] {
  const allContracts: string[] = [];
  Object.values(TIWI_PROTOCOL_CONTRACTS).forEach(contracts => {
    allContracts.push(...contracts);
  });
  return allContracts.map(c => c.toLowerCase());
}


