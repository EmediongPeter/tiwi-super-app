/**
 * Solana Connection Utility
 * 
 * Creates and manages Solana RPC connections for backend services.
 * Uses environment variable for RPC URL with fallbacks.
 */

import { Connection } from '@solana/web3.js';

// Solana RPC endpoints (with fallbacks for reliability)
const SOLANA_RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const SOLANA_RPC_FALLBACKS = [
  'https://solana.drpc.org',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
];

/**
 * Create a Solana connection with reliable RPC endpoint
 * Uses environment variable first, then fallback to reliable public endpoints
 */
export async function createSolanaConnection(): Promise<Connection> {
  // Try primary endpoint first
  try {
    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
    
    // Quick test to see if endpoint is accessible
    await Promise.race([
      connection.getVersion(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    
    return connection;
  } catch (error: any) {
    console.warn(`[Solana] Primary RPC endpoint failed (${SOLANA_RPC_ENDPOINT}), trying fallbacks...`, error?.message || error);
    
    // Try fallback endpoints
    for (const endpoint of SOLANA_RPC_FALLBACKS) {
      try {
        const connection = new Connection(endpoint, 'confirmed');
        await Promise.race([
          connection.getVersion(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        console.log(`[Solana] Using fallback RPC endpoint: ${endpoint}`);
        return connection;
      } catch (fallbackError: any) {
        console.warn(`[Solana] Fallback endpoint failed: ${endpoint}`, fallbackError?.message || fallbackError);
        continue;
      }
    }
    
    // If all fail, throw a helpful error
    throw new Error(
      `All Solana RPC endpoints failed. Please set SOLANA_RPC_URL in environment variables.`
    );
  }
}

