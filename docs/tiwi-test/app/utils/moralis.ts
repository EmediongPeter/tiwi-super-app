import Moralis from 'moralis';

const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImI3YzM4YjA2LTUwMjQtNDcxNC1iOTZhLTZiNzljNGQxZTE4NiIsIm9yZ0lkIjoiNDg1MjE2IiwidXNlcklkIjoiNDk5MTk1IiwidHlwZUlkIjoiOTI3ZGNlNzQtYmZkZi00Yjc3LWJlZTUtZTBmNTNlNDAzMTAwIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjUyNjAyMjQsImV4cCI6NDkyMTAyMDIyNH0._OVkoNmyqPF5xmJSwOfuifJUjOKpeVVJYayAmG992D8';

let initializationPromise: Promise<void> | null = null;
let isInitialized = false;

export const initializeMoralis = async () => {
  // If already initialized, return immediately
  if (isInitialized) return;
  
  // If initialization is in progress, wait for the existing promise
  if (initializationPromise) {
    return initializationPromise;
  }
  
  // Start initialization and store the promise
  initializationPromise = (async () => {
    try {
      await Moralis.start({
        apiKey: MORALIS_API_KEY,
      });
      isInitialized = true;
    } catch (error: any) {
      // If the error is that modules are already started, treat it as success
      if (error?.message?.includes('Modules are started already') || 
          error?.message?.includes('C0009') ||
          error?.code === 'C0009') {
        isInitialized = true;
        // Don't log as error since this is expected in concurrent scenarios
        console.log('Moralis already initialized (concurrent call handled)');
      } else {
        console.error('Error initializing Moralis:', error);
        // Reset promise so we can retry
        initializationPromise = null;
        throw error;
      }
    }
  })();
  
  return initializationPromise;
};

// Map LI.FI chain IDs to Moralis chain hex strings (Moralis uses hex chain IDs)
const chainIdToMoralisChain: Record<number, string> = {
  1: '0x1', // Ethereum
  10: '0xa', // Optimism
  56: '0x38', // BSC
  137: '0x89', // Polygon
  42161: '0xa4b1', // Arbitrum
  43114: '0xa86a', // Avalanche
  8453: '0x2105', // Base
  250: '0xfa', // Fantom
  100: '0x64', // Gnosis
  1101: '0x44d', // Polygon zkEVM
  324: '0x144', // zkSync Era
  5000: '0x1388', // Mantle
  59144: '0xe708', // Linea
  534352: '0x82750', // Scroll
};

export interface WalletToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string; // Raw balance in smallest unit
  balanceFormatted: string; // Human-readable balance
  chainId: number;
  logoURI?: string;
}

export const getTokenBalance = async (
  address: string,
  tokenAddress: string,
  chainId: number
): Promise<string> => {
  try {
    await initializeMoralis();
    
    const moralisChain = chainIdToMoralisChain[chainId];
    if (!moralisChain) {
      console.warn(`Chain ${chainId} not supported by Moralis`);
      return '0';
    }

    // For native tokens (ETH, MATIC, etc.)
    if (tokenAddress === '0x0000000000000000000000000000000000000000' || 
        tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
      try {
        const response = await Moralis.EvmApi.balance.getNativeBalance({
          address,
          chain: moralisChain,
        });
        // Moralis returns balance as a string in wei
        return response.raw.balance || response.raw.balance?.toString() || '0';
      } catch (error) {
        console.error('Error fetching native balance:', error);
        return '0';
      }
    }

    // For ERC-20 tokens - get all tokens and find the specific one
    try {
      const allTokens = await Moralis.EvmApi.token.getWalletTokenBalances({
        address,
        chain: moralisChain,
      });
      
      if (allTokens.raw && Array.isArray(allTokens.raw)) {
        const tokenData = allTokens.raw.find(
          (token: any) => 
            token.token_address?.toLowerCase() === tokenAddress.toLowerCase() ||
            token.address?.toLowerCase() === tokenAddress.toLowerCase()
        );
        if (tokenData && tokenData.balance) {
          return tokenData.balance;
        }
      }
      
      // Token might exist but user has 0 balance
      return '0';
    } catch (tokenError) {
      console.error('Error fetching ERC-20 token balance:', tokenError);
      return '0';
    }
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return '0';
  }
};

// Get all tokens in wallet across multiple chains
export const getWalletTokens = async (
  address: string,
  chainIds: number[]
): Promise<WalletToken[]> => {
  await initializeMoralis();
  
  const allTokens: WalletToken[] = [];
  
  for (const chainId of chainIds) {
    const moralisChain = chainIdToMoralisChain[chainId];
    if (!moralisChain) {
      console.warn(`Chain ${chainId} not supported by Moralis`);
      continue;
    }
    
    try {
      // Get native balance
      try {
        const nativeBalance = await Moralis.EvmApi.balance.getNativeBalance({
          address,
          chain: moralisChain,
        });
        
        if (nativeBalance.raw.balance) {
          const balanceBigInt = BigInt(nativeBalance.raw.balance);
          if (balanceBigInt > BigInt(0)) {
            // Get native token symbol based on chain
            const nativeSymbols: Record<number, string> = {
              1: 'ETH',
              10: 'ETH',
              56: 'BNB',
              137: 'MATIC',
              42161: 'ETH',
              43114: 'AVAX',
              8453: 'ETH',
              250: 'FTM',
              100: 'xDAI',
            };
            
            const decimals = 18;
            const balanceFormatted = formatBalance(nativeBalance.raw.balance, decimals);
            
            allTokens.push({
              address: '0x0000000000000000000000000000000000000000',
              symbol: nativeSymbols[chainId] || 'NATIVE',
              name: `${nativeSymbols[chainId] || 'Native'} (Native)`,
              decimals,
              balance: nativeBalance.raw.balance,
              balanceFormatted,
              chainId,
            });
          }
        }
      } catch (nativeError) {
        console.error(`Error fetching native balance for chain ${chainId}:`, nativeError);
      }
      
      // Get ERC-20 token balances
      try {
        const tokenBalances = await Moralis.EvmApi.token.getWalletTokenBalances({
          address,
          chain: moralisChain,
        });
        
        if (tokenBalances.raw && Array.isArray(tokenBalances.raw)) {
          for (const tokenData of tokenBalances.raw) {
            if (tokenData.balance) {
              // Check if token has actual balance first
              const rawBalance = tokenData.balance || '0';
              const balanceBigInt = BigInt(rawBalance);
              
              // If balance is 0, don't include
              if (balanceBigInt === BigInt(0)) {
                continue;
              }

              // Native tokens are always included if they have balance
              // Check for native_token property (may not exist in all SDK versions)
              const isNative = (tokenData as any).native_token === true;
              if (isNative) {
                const decimals = tokenData.decimals || 18;
                const balanceFormatted = formatBalance(tokenData.balance, decimals);
                
                allTokens.push({
                  address: tokenData.token_address,
                  symbol: tokenData.symbol || 'UNKNOWN',
                  name: tokenData.name || 'Unknown Token',
                  decimals,
                  balance: tokenData.balance,
                  balanceFormatted,
                  chainId,
                  logoURI: tokenData.logo || tokenData.thumbnail,
                });
                continue;
              }

              // For ERC20 tokens, must be:
              // 1. Not spam
              // 2. Verified contract
              // 3. Has balance > 0 (already checked above)
              const notSpam = tokenData.possible_spam !== true;
              const verified = tokenData.verified_contract === true;
              
              if (!notSpam || !verified) {
                continue; // Filter out unverified or spam tokens
              }
              
              // Known decimals for common tokens (fallback if Moralis doesn't provide)
              const knownDecimals: Record<string, number> = {
                // USDT addresses across chains
                '0xdac17f958d2ee523a2206206994597c13d831ec7': 6, // Ethereum USDT
                '0x55d398326f99059ff775485246999027b3197955': 18, // BSC USDT (different!)
                '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 6, // Polygon USDT
                '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 6, // Arbitrum USDT
                '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58': 6, // Optimism USDT
                // USDC addresses
                '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6, // Ethereum USDC
                '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 18, // BSC USDC
              };
              
              // Known decimals by symbol (fallback if address not in map)
              const knownSymbolDecimals: Record<string, number> = {
                'USDT': 6, // Most chains use 6, except BSC which uses 18
                'USDC': 6, // Most chains use 6, except BSC which uses 18
              };
              
              // Get decimals - prioritize known addresses, then known symbols, then Moralis, then default
              const tokenAddressLower = (tokenData.token_address || '').toLowerCase();
              const tokenSymbol = (tokenData.symbol || '').toUpperCase();
              
              let decimals: number;
              if (knownDecimals[tokenAddressLower]) {
                decimals = knownDecimals[tokenAddressLower];
              } else if (knownSymbolDecimals[tokenSymbol]) {
                // For BSC, check if it's actually BSC USDT/USDC (18 decimals)
                if ((tokenSymbol === 'USDT' || tokenSymbol === 'USDC') && chainId === 56) {
                  decimals = 18; // BSC uses 18 decimals for stablecoins
                } else {
                  decimals = knownSymbolDecimals[tokenSymbol];
                }
              } else {
                decimals = tokenData.decimals !== undefined && tokenData.decimals !== null 
                  ? Number(tokenData.decimals) 
                  : 18;
              }
              
              // Ensure decimals is valid
              decimals = Math.max(0, Math.min(18, Math.floor(Number(decimals))));
              
              // ALWAYS calculate from raw balance - don't trust Moralis formatted values
              // This ensures we use the correct decimals
              const rawBalanceStr = tokenData.balance.toString();
              const balanceFormatted = formatBalance(rawBalanceStr, decimals);
              
              // Debug log for USDT to help diagnose issues
              if (tokenSymbol === 'USDT') {
                console.log('[Moralis] USDT balance debug:', {
                  symbol: tokenData.symbol,
                  address: tokenData.token_address,
                  rawBalance: rawBalanceStr,
                  decimals,
                  formatted: balanceFormatted,
                  tokenDataDecimals: tokenData.decimals,
                  chainId,
                });
              }
              
              allTokens.push({
                address: tokenData.token_address,
                symbol: tokenData.symbol || 'UNKNOWN',
                name: tokenData.name || 'Unknown Token',
                decimals,
                balance: tokenData.balance.toString(),
                balanceFormatted,
                chainId,
                logoURI: tokenData.logo || tokenData.thumbnail,
              });
            }
          }
        }
      } catch (tokenError) {
        console.error(`Error fetching token balances for chain ${chainId}:`, tokenError);
      }
    } catch (error) {
      console.error(`Error processing chain ${chainId}:`, error);
    }
  }
  
  return allTokens;
};

// Helper function to format balance
const formatBalance = (balance: string, decimals: number): string => {
  try {
    if (!balance || balance === '0') return '0';
    
    // Ensure decimals is a valid positive number
    const validDecimals = Math.max(0, Math.min(18, Math.floor(Number(decimals) || 18)));
    
    const balanceNum = BigInt(balance);
    const divisor = BigInt(10 ** validDecimals);
    const wholePart = balanceNum / divisor;
    const fractionalPart = balanceNum % divisor;
    
    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }
    
    const fractionalStr = fractionalPart.toString().padStart(validDecimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    return trimmedFractional ? `${wholePart}.${trimmedFractional}` : wholePart.toString();
  } catch (error) {
    console.warn('Error formatting balance:', balance, 'decimals:', decimals, error);
    return '0';
  }
};

// Get tokens for a specific chain
export const getWalletTokensForChain = async (
  address: string,
  chainId: number
): Promise<WalletToken[]> => {
  return getWalletTokens(address, [chainId]);
};

// ============================================================================
// SOLANA API FUNCTIONS
// ============================================================================

// Solana chain ID (matching LI.FI SDK)
export const SOLANA_CHAIN_ID = 7565164;

// Native SOL mint address
const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Get Solana native SOL balance
 */
export const getSolanaNativeBalance = async (
  address: string
): Promise<string> => {
  try {
    await initializeMoralis();
    
    const response = await Moralis.SolApi.account.getBalance({
      address,
      network: 'mainnet',
    });
    
    // Moralis returns balance - handle different possible response structures
    const result = response.result || response;
    const responseData = result as any;
    
    // Priority 1: Check for lamports field (raw balance in smallest unit)
    if (responseData.lamports !== undefined && responseData.lamports !== null) {
      let lamports = responseData.lamports.toString();
      // Fix: Moralis sometimes returns lamports multiplied by 10^9 incorrectly
      // If the value is suspiciously large (has 16+ digits), it might be incorrectly scaled
      const lamportsNum = BigInt(lamports);
      if (lamportsNum > BigInt(10 ** 15)) {
        // Likely incorrectly multiplied by 10^9, divide to correct
        const corrected = lamportsNum / BigInt(10 ** 9);
        console.log('[getSolanaNativeBalance] Corrected lamports from', lamports, 'to', corrected.toString());
        return corrected.toString();
      }
      return lamports;
    }
    
    // Priority 2: Check nested nativeBalance.lamports
    if (responseData.nativeBalance?.lamports !== undefined && responseData.nativeBalance?.lamports !== null) {
      let lamports = responseData.nativeBalance.lamports.toString();
      const lamportsNum = BigInt(lamports);
      if (lamportsNum > BigInt(10 ** 15)) {
        const corrected = lamportsNum / BigInt(10 ** 9);
        console.log('[getSolanaNativeBalance] Corrected nativeBalance.lamports from', lamports, 'to', corrected.toString());
        return corrected.toString();
      }
      return lamports;
    }
    
    // Priority 3: Check if balance is in SOL format (needs conversion to lamports)
    // Moralis might return balance in SOL (e.g., 0.019912460) which needs to be converted to lamports
    if (responseData.sol !== undefined && responseData.sol !== null) {
      const solAmount = typeof responseData.sol === 'string' 
        ? parseFloat(responseData.sol) 
        : Number(responseData.sol);
      // Convert SOL to lamports: multiply by 1e9
      const lamports = BigInt(Math.floor(solAmount * 1e9));
      return lamports.toString();
    }
    
    // Priority 4: Check balance field - might be in SOL or lamports format
    if (responseData.balance !== undefined && responseData.balance !== null) {
      const balance = responseData.balance;
      const balanceStr = balance.toString();
      const balanceNum = typeof balance === 'string' ? parseFloat(balance) : Number(balance);
      
      // If balance has decimal point, it's in SOL format - convert to lamports
      const hasDecimal = balanceStr.includes('.');
      if (hasDecimal) {
        const lamports = BigInt(Math.floor(balanceNum * 1e9));
        return lamports.toString();
      }
      
      // If balance is a whole number but small (< 1000), it's likely in SOL format
      if (balanceNum > 0 && balanceNum < 1000) {
        const lamports = BigInt(Math.floor(balanceNum * 1e9));
        return lamports.toString();
      }
      
      // Otherwise, assume it's already in lamports
      // Fix: Check if balance is suspiciously large (might be incorrectly multiplied by 10^9)
      const balanceBigInt = BigInt(balanceStr);
      if (balanceBigInt > BigInt(10 ** 15)) {
        // Likely incorrectly multiplied by 10^9, divide to correct
        const corrected = balanceBigInt / BigInt(10 ** 9);
        console.log('[getSolanaNativeBalance] Corrected balance from', balanceStr, 'to', corrected.toString());
        return corrected.toString();
      }
      return balanceStr;
    }
    
    // Priority 5: Check result.balance directly
    if ((result as any).balance !== undefined && (result as any).balance !== null) {
      const balance = (result as any).balance;
      const balanceStr = balance.toString();
      const balanceNum = typeof balance === 'string' ? parseFloat(balance) : Number(balance);
      
      const hasDecimal = balanceStr.includes('.');
      if (hasDecimal || (balanceNum > 0 && balanceNum < 1000)) {
        const lamports = BigInt(Math.floor(balanceNum * 1e9));
        return lamports.toString();
      }
      
      // Fix: Check if balance is suspiciously large (might be incorrectly multiplied by 10^9)
      const balanceBigInt = BigInt(balanceStr);
      if (balanceBigInt > BigInt(10 ** 15)) {
        // Likely incorrectly multiplied by 10^9, divide to correct
        const corrected = balanceBigInt / BigInt(10 ** 9);
        console.log('[getSolanaNativeBalance] Corrected result.balance from', balanceStr, 'to', corrected.toString());
        return corrected.toString();
      }
      
      return balanceStr;
    }
    
    console.warn('[getSolanaNativeBalance] Could not find balance in response:', responseData);
    return '0';
  } catch (error) {
    console.error('Error fetching Solana native balance:', error);
    return '0';
  }
};

/**
 * Get all Solana token balances (native SOL + SPL tokens)
 */
export const getSolanaTokenBalances = async (
  address: string
): Promise<WalletToken[]> => {
  try {
    await initializeMoralis();
    
    const tokens: WalletToken[] = [];
    
    // Get native SOL balance
    try {
      const nativeBalance = await getSolanaNativeBalance(address);
      if (nativeBalance !== '0') {
        tokens.push({
          address: NATIVE_SOL_MINT,
          symbol: 'SOL',
          name: 'Solana',
          decimals: 9,
          balance: nativeBalance,
          balanceFormatted: formatBalance(nativeBalance, 9),
          chainId: SOLANA_CHAIN_ID,
        });
      }
    } catch (nativeError) {
      console.error('Error fetching Solana native balance:', nativeError);
    }
    
    // Get SPL token balances
    try {
      const response = await Moralis.SolApi.account.getSPL({
        address,
        network: 'mainnet',
      });
      
      const result = response.result || response;
      const splTokens = Array.isArray(result) ? result : (Array.isArray((result as any).data) ? (result as any).data : []);
      
      if (splTokens && Array.isArray(splTokens)) {
        for (const token of splTokens) {
          try {
            // Handle Moralis response structure - amount is SolNative type, mint is SolAddress
            const tokenData = token as any;
            let rawAmount = '0';
            let balanceFormatted = '0';
            
            // First, get the token decimals to properly convert if needed
            let tokenDecimals = 9; // Default to 9 (SOL standard)
            if (tokenData.decimals !== undefined && tokenData.decimals !== null) {
              tokenDecimals = Number(tokenData.decimals);
            }
            
            // Extract amount from SolNative type
            if (tokenData.amount) {
              // Priority 1: Check for lamports/raw amount (smallest unit)
              if (tokenData.amount.lamports !== undefined) {
                rawAmount = tokenData.amount.lamports.toString();
              } else if ((tokenData.amount as any).raw !== undefined) {
                rawAmount = (tokenData.amount as any).raw.toString();
              }
              // Priority 2: Check if it's a string/number that might be in token format
              else if (typeof tokenData.amount === 'string') {
                const amountStr = tokenData.amount;
                const amountNum = parseFloat(amountStr);
                // If it has decimal point or is small, it might be in token format (not smallest unit)
                if (amountStr.includes('.') || (amountNum > 0 && amountNum < 1000)) {
                  // Convert from token format to smallest unit
                  const smallestUnit = BigInt(Math.floor(amountNum * (10 ** tokenDecimals)));
                  rawAmount = smallestUnit.toString();
                } else {
                  // Assume it's already in smallest unit
                  rawAmount = amountStr;
                }
              } else if (typeof tokenData.amount === 'number') {
                const amountNum = tokenData.amount;
                // If it's small or has decimals, convert to smallest unit
                if (amountNum > 0 && amountNum < 1000) {
                  const smallestUnit = BigInt(Math.floor(amountNum * (10 ** tokenDecimals)));
                  rawAmount = smallestUnit.toString();
                } else {
                  rawAmount = amountNum.toString();
                }
              } else if (tokenData.amount.toString) {
                const amountStr = tokenData.amount.toString();
                const amountNum = parseFloat(amountStr);
                if (amountStr.includes('.') || (amountNum > 0 && amountNum < 1000)) {
                  const smallestUnit = BigInt(Math.floor(amountNum * (10 ** tokenDecimals)));
                  rawAmount = smallestUnit.toString();
                } else {
                  rawAmount = amountStr;
                }
              }
              
              // Get formatted balance if available (for display, but we'll recalculate from rawAmount)
              if ((tokenData.amount as any).sol !== undefined) {
                balanceFormatted = (tokenData.amount as any).sol.toString();
              }
            }
            
            const balanceBigInt = BigInt(rawAmount || '0');
            
            if (balanceBigInt > BigInt(0)) {
              // Known decimals for popular Solana tokens
              const knownSolanaDecimals: Record<string, number> = {
                'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
              };
              
              // Known decimals by symbol (fallback)
              const knownSolanaSymbolDecimals: Record<string, number> = {
                'USDT': 6,
                'USDC': 6,
              };
              
              // Extract mint address from SolAddress type
              let mintAddress = '';
              if (tokenData.mint) {
                if (typeof tokenData.mint === 'string') {
                  mintAddress = tokenData.mint;
                } else if (tokenData.mint.address) {
                  mintAddress = tokenData.mint.address;
                } else if (tokenData.mint.toString) {
                  mintAddress = tokenData.mint.toString();
                }
              }
              
              const mintAddressLower = mintAddress.toLowerCase();
              const tokenSymbol = (tokenData.symbol || '').toUpperCase();
              
              // Get decimals - prioritize known addresses, then known symbols, then Moralis, then default to 9 (SOL standard)
              let decimals: number;
              if (knownSolanaDecimals[mintAddressLower]) {
                decimals = knownSolanaDecimals[mintAddressLower];
              } else if (knownSolanaSymbolDecimals[tokenSymbol]) {
                decimals = knownSolanaSymbolDecimals[tokenSymbol];
              } else {
                decimals = tokenData.decimals !== undefined && tokenData.decimals !== null 
                  ? Number(tokenData.decimals) 
                  : 9; // Default to 9 for Solana (SOL standard)
              }
              
              // Ensure decimals is valid
              decimals = Math.max(0, Math.min(18, Math.floor(Number(decimals))));
              
              // ALWAYS calculate from raw balance - don't trust Moralis formatted values
              if (!balanceFormatted || balanceFormatted === '0') {
                balanceFormatted = formatBalance(rawAmount, decimals);
              }
              
              // Debug log for USDT to help diagnose
              if (tokenSymbol === 'USDT') {
                console.log('[Moralis] Solana USDT balance debug:', {
                  symbol: tokenData.symbol,
                  mintAddress,
                  rawAmount,
                  decimals,
                  formatted: balanceFormatted,
                  tokenDataDecimals: tokenData.decimals,
                });
              }
              
              tokens.push({
                address: mintAddress,
                symbol: tokenData.symbol || 'UNKNOWN',
                name: tokenData.name || 'Unknown Token',
                decimals,
                balance: rawAmount,
                balanceFormatted,
                chainId: SOLANA_CHAIN_ID,
                logoURI: tokenData.logo || tokenData.thumbnail,
              });
            }
          } catch (tokenError) {
            console.warn('Error processing Solana token:', tokenError);
            // Continue with next token
          }
        }
      }
    } catch (splError) {
      console.error('Error fetching Solana SPL token balances:', splError);
      // Continue without SPL tokens
    }
    
    return tokens;
  } catch (error) {
    console.error('Error fetching Solana token balances:', error);
    return [];
  }
};

/**
 * Get a single Solana token balance (native SOL or SPL token)
 */
export const getSolanaTokenBalance = async (
  address: string,
  tokenAddress: string
): Promise<string> => {
  try {
    await initializeMoralis();
    
    // Check if it's native SOL
    const tokenAddressLower = tokenAddress.toLowerCase();
    const nativeSolMintLower = NATIVE_SOL_MINT.toLowerCase();
    const isNativeSOL = tokenAddressLower === nativeSolMintLower || 
                       tokenAddress === NATIVE_SOL_MINT ||
                       tokenAddressLower === 'so11111111111111111111111111111111111111112';
    
    if (isNativeSOL) {
      // Get native SOL balance
      return await getSolanaNativeBalance(address);
    } else {
      // Get SPL token balance
      try {
        const response = await Moralis.SolApi.account.getSPL({
          address,
          network: 'mainnet',
        });
        
        const result = response.result || response;
        const splTokens = Array.isArray(result) ? result : (Array.isArray((result as any).data) ? (result as any).data : []);
        
        if (splTokens && Array.isArray(splTokens)) {
          // Find the specific token
          for (const token of splTokens) {
            const tokenData = token as any;
            let mintAddress = '';
            
            // Extract mint address
            if (tokenData.mint) {
              if (typeof tokenData.mint === 'string') {
                mintAddress = tokenData.mint;
              } else if (tokenData.mint.address) {
                mintAddress = tokenData.mint.address;
              } else if (tokenData.mint.toString) {
                mintAddress = tokenData.mint.toString();
              }
            }
            
            // Check if this is the token we're looking for
            if (mintAddress.toLowerCase() === tokenAddressLower) {
              // Extract amount - need to get decimals first
              let tokenDecimals = 9; // Default
              if (tokenData.decimals !== undefined && tokenData.decimals !== null) {
                tokenDecimals = Number(tokenData.decimals);
              }
              
              let rawAmount = '0';
              if (tokenData.amount) {
                // Priority 1: Check for lamports/raw amount (smallest unit)
                if (tokenData.amount.lamports !== undefined) {
                  rawAmount = tokenData.amount.lamports.toString();
                } else if ((tokenData.amount as any).raw !== undefined) {
                  rawAmount = (tokenData.amount as any).raw.toString();
                }
                // Priority 2: Check if it's a string/number that might be in token format
                else if (typeof tokenData.amount === 'string') {
                  const amountStr = tokenData.amount;
                  const amountNum = parseFloat(amountStr);
                  // If it has decimal point or is small, convert from token format to smallest unit
                  if (amountStr.includes('.') || (amountNum > 0 && amountNum < 1000)) {
                    const smallestUnit = BigInt(Math.floor(amountNum * (10 ** tokenDecimals)));
                    rawAmount = smallestUnit.toString();
                  } else {
                    // Assume it's already in smallest unit
                    rawAmount = amountStr;
                  }
                } else if (typeof tokenData.amount === 'number') {
                  const amountNum = tokenData.amount;
                  // If it's small, convert to smallest unit
                  if (amountNum > 0 && amountNum < 1000) {
                    const smallestUnit = BigInt(Math.floor(amountNum * (10 ** tokenDecimals)));
                    rawAmount = smallestUnit.toString();
                  } else {
                    rawAmount = amountNum.toString();
                  }
                } else if (tokenData.amount.toString) {
                  const amountStr = tokenData.amount.toString();
                  const amountNum = parseFloat(amountStr);
                  if (amountStr.includes('.') || (amountNum > 0 && amountNum < 1000)) {
                    const smallestUnit = BigInt(Math.floor(amountNum * (10 ** tokenDecimals)));
                    rawAmount = smallestUnit.toString();
                  } else {
                    rawAmount = amountStr;
                  }
                }
              }
              return rawAmount;
            }
          }
        }
        
        // Token not found in wallet
        return '0';
      } catch (splError) {
        console.error('Error fetching Solana SPL token balance:', splError);
        return '0';
      }
    }
  } catch (error) {
    console.error('Error fetching Solana token balance:', error);
    return '0';
  }
};

