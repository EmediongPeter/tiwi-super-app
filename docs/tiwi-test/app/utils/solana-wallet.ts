// Solana wallet utilities for fetching balances

import { Connection, PublicKey } from '@solana/web3.js';
import { getJupiterTokens, NATIVE_SOL_MINT, type JupiterToken } from './jupiter';

// Solana RPC endpoints (with fallbacks)
// Using more reliable public RPC endpoints
const SOLANA_RPC_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
];

// Get Solana connection - prioritize wallet's connection, then use public RPCs
const getSolanaConnection = (rpcUrl?: string): Connection => {
  // If explicit RPC URL provided, use it
  if (rpcUrl) {
    return new Connection(rpcUrl, 'confirmed');
  }
  
  // Try to get connection from connected wallet first
  if (typeof window !== 'undefined') {
    const solana = (window as any).solana;
    
    // Phantom and other wallets often expose a connection object
    if (solana && solana.connection) {
      return solana.connection;
    }
    
    // Some wallets expose RPC URL
    if (solana && solana.rpc && solana.rpc.url) {
      return new Connection(solana.rpc.url, 'confirmed');
    }
    
    // Check Phantom specifically
    const phantom = (window as any).phantom;
    if (phantom && phantom.solana) {
      if (phantom.solana.connection) {
        return phantom.solana.connection;
      }
      if (phantom.solana.rpc && phantom.solana.rpc.url) {
        return new Connection(phantom.solana.rpc.url, 'confirmed');
      }
    }
  }
  
  // Fallback to public RPC (will be retried with other endpoints if this fails)
  return new Connection(SOLANA_RPC_URLS[0], 'confirmed');
};

/**
 * Retry RPC call with multiple endpoints if one fails
 * Prioritizes wallet's connection, then falls back to public RPCs
 */
const retryWithFallback = async <T>(
  operation: (connection: Connection) => Promise<T>,
  rpcUrl?: string
): Promise<T> => {
  // Build list of connections to try, prioritizing wallet's connection
  const connections: Connection[] = [];
  
  // First priority: Explicit RPC URL if provided
  if (rpcUrl) {
    connections.push(new Connection(rpcUrl, 'confirmed'));
  }
  
  // Second priority: Wallet's connection object (if available)
  if (typeof window !== 'undefined') {
    const solana = (window as any).solana;
    
    // Try wallet's connection object directly (Phantom and others expose this)
    if (solana && solana.connection) {
      connections.push(solana.connection);
    }
    
    // Try wallet's RPC URL
    if (solana && solana.rpc && solana.rpc.url) {
      connections.push(new Connection(solana.rpc.url, 'confirmed'));
    }
    
    // Check Phantom specifically
    const phantom = (window as any).phantom;
    if (phantom && phantom.solana) {
      if (phantom.solana.connection) {
        connections.push(phantom.solana.connection);
      }
      if (phantom.solana.rpc && phantom.solana.rpc.url) {
        connections.push(new Connection(phantom.solana.rpc.url, 'confirmed'));
      }
    }
  }
  
  // Third priority: Public RPC endpoints
  for (const url of SOLANA_RPC_URLS) {
    // Skip if already added
    if (!connections.some(conn => (conn as any)._rpcEndpoint === url)) {
      connections.push(new Connection(url, 'confirmed'));
    }
  }
  
  let lastError: Error | null = null;
  
  // Try each connection in order
  for (const connection of connections) {
    try {
      return await operation(connection);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const endpoint = (connection as any)._rpcEndpoint || 'wallet connection';
      console.warn(`Failed to use RPC ${endpoint}, trying next...`, error);
      // Continue to next connection
    }
  }
  
  throw lastError || new Error('All RPC endpoints failed');
};

/**
 * Validate if address is a valid Solana address
 */
const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get native SOL balance
 */
export const getSOLBalance = async (
  address: string,
  rpcUrl?: string
): Promise<string> => {
  try {
    // Validate Solana address format
    if (!isValidSolanaAddress(address)) {
      console.warn('Invalid Solana address format:', address);
      return '0';
    }
    
    const publicKey = new PublicKey(address);
    return await retryWithFallback(async (connection) => {
      const balance = await connection.getBalance(publicKey);
      return balance.toString();
    }, rpcUrl);
  } catch (error) {
    console.error('Error fetching SOL balance:', error);
    return '0';
  }
};

/**
 * Get SPL token balance for a specific token
 */
export const getSPLTokenBalance = async (
  address: string,
  tokenMint: string,
  rpcUrl?: string
): Promise<string> => {
  try {
    // Validate Solana addresses
    if (!isValidSolanaAddress(address)) {
      console.warn('Invalid Solana wallet address format:', address);
      return '0';
    }
    if (!isValidSolanaAddress(tokenMint)) {
      console.warn('Invalid Solana token mint address format:', tokenMint);
      return '0';
    }
    
    const walletPublicKey = new PublicKey(address);
    const mintPublicKey = new PublicKey(tokenMint);
    
    return await retryWithFallback(async (connection) => {
      // Get all token accounts for this wallet
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { mint: mintPublicKey }
      );
      
      if (tokenAccounts.value.length === 0) {
        return '0';
      }
      
      // Sum up all balances for this token
      let totalBalance = BigInt(0);
      for (const account of tokenAccounts.value) {
        const parsedInfo = account.account.data.parsed.info;
        if (parsedInfo && parsedInfo.tokenAmount) {
          totalBalance += BigInt(parsedInfo.tokenAmount.amount);
        }
      }
      
      return totalBalance.toString();
    }, rpcUrl);
  } catch (error) {
    console.error('Error fetching SPL token balance:', error);
    return '0';
  }
};

/**
 * Get all token balances for a Solana wallet
 */
export interface WalletTokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  chainId: number;
  logoURI?: string;
}

export const getSolanaWalletTokens = async (
  address: string,
  rpcUrl?: string,
  walletProvider?: any
): Promise<WalletTokenBalance[]> => {
  try {
    const walletPublicKey = new PublicKey(address);
    const tokens: WalletTokenBalance[] = [];
    
    // Get native SOL balance - try wallet provider's connection first
    let solBalance = '0';
    if (walletProvider && walletProvider.connection) {
      try {
        const balance = await walletProvider.connection.getBalance(walletPublicKey);
        solBalance = balance.toString();
      } catch (error) {
        console.warn('Failed to get balance from wallet provider connection, trying fallback...', error);
        solBalance = await getSOLBalance(address, rpcUrl);
      }
    } else {
      solBalance = await getSOLBalance(address, rpcUrl);
    }
    if (solBalance !== '0') {
      const solBalanceFormatted = formatBalance(solBalance, 9);
      tokens.push({
        address: NATIVE_SOL_MINT,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        balance: solBalance,
        balanceFormatted: solBalanceFormatted,
        chainId: 7565164, // Solana chain ID in LI.FI
      });
    }
    
    // Get all token accounts - try wallet provider's connection first
    let tokenAccountsResult: any;
    if (walletProvider && walletProvider.connection) {
      try {
        tokenAccountsResult = await walletProvider.connection.getParsedTokenAccountsByOwner(
          walletPublicKey,
          { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
        );
      } catch (error) {
        console.warn('Failed to get token accounts from wallet provider connection, trying fallback...', error);
        tokenAccountsResult = await retryWithFallback(async (connection) => {
          return await connection.getParsedTokenAccountsByOwner(
            walletPublicKey,
            { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
          );
        }, rpcUrl);
      }
    } else {
      tokenAccountsResult = await retryWithFallback(async (connection) => {
        return await connection.getParsedTokenAccountsByOwner(
          walletPublicKey,
          { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
        );
      }, rpcUrl);
    }
    
    // Get Jupiter tokens list for metadata
    const jupiterTokens = await getJupiterTokens();
    const tokenMetadataMap = new Map<string, JupiterToken>();
    jupiterTokens.forEach(token => {
      tokenMetadataMap.set(token.address.toLowerCase(), token);
    });
    
    // Process token accounts
    const tokenBalanceMap = new Map<string, bigint>();
    const tokenDecimalsMap = new Map<string, number>();
    
    for (const account of tokenAccountsResult.value) {
      const parsedInfo = account.account.data.parsed.info;
      if (parsedInfo && parsedInfo.mint && parsedInfo.tokenAmount) {
        const mint = parsedInfo.mint;
        const amount = BigInt(parsedInfo.tokenAmount.amount);
        const decimals = parsedInfo.tokenAmount.decimals || 9;
        
        if (amount > BigInt(0)) {
          const existing = tokenBalanceMap.get(mint) || BigInt(0);
          tokenBalanceMap.set(mint, existing + amount);
          tokenDecimalsMap.set(mint, decimals);
        }
      }
    }
    
    // Convert to WalletTokenBalance format
    for (const [mint, balance] of tokenBalanceMap.entries()) {
      const decimals = tokenDecimalsMap.get(mint) || 9;
      const metadata = tokenMetadataMap.get(mint.toLowerCase());
      
      tokens.push({
        address: mint,
        symbol: metadata?.symbol || 'UNKNOWN',
        name: metadata?.name || 'Unknown Token',
        decimals: decimals,
        balance: balance.toString(),
        balanceFormatted: formatBalance(balance.toString(), decimals),
        chainId: 7565164,
        logoURI: metadata?.logoURI,
      });
    }
    
    return tokens;
  } catch (error) {
    console.error('Error fetching Solana wallet tokens:', error);
    return [];
  }
};

/**
 * Format balance from smallest unit to human-readable
 */
const formatBalance = (balance: string, decimals: number): string => {
  try {
    if (!balance || balance === '0') return '0';
    const balanceBigInt = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const wholePart = balanceBigInt / divisor;
    const fractionalPart = balanceBigInt % divisor;
    
    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }
    
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    return trimmedFractional ? `${wholePart}.${trimmedFractional}` : wholePart.toString();
  } catch {
    return '0';
  }
};

