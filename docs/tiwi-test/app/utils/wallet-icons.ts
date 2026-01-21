/**
 * Utility functions for fetching wallet icons from WalletConnect Explorer API
 */

const WALLETCONNECT_PROJECT_ID = '8e998cd112127e42dce5e2bf74122539';
const EXPLORER_API_BASE = 'https://explorer-api.walletconnect.com/v3';

/**
 * Mapping from our wallet IDs to WalletConnect wallet names/IDs
 * This helps match our wallets to WalletConnect Explorer listings
 */
const WALLET_NAME_MAPPING: Record<string, string[]> = {
  'phantom': ['phantom', 'Phantom'],
  'metamask': ['metamask', 'MetaMask'],
  'coinbase': ['coinbase wallet', 'Coinbase Wallet', 'coinbase'],
  'trust': ['trust wallet', 'Trust Wallet', 'trust'],
  'rabby': ['rabby', 'Rabby'],
  'brave': ['brave wallet', 'Brave Wallet', 'brave'],
  'okx': ['okx wallet', 'OKX Wallet', 'okx'],
  'solflare': ['solflare', 'Solflare'],
  'backpack': ['backpack', 'Backpack'],
  'glow': ['glow', 'Glow'],
  'slope': ['slope', 'Slope'],
  'zerion': ['zerion', 'Zerion'],
  'tokenpocket': ['tokenpocket', 'TokenPocket'],
  'bitkeep': ['bitkeep', 'BitKeep'],
  'mathwallet': ['mathwallet', 'MathWallet'],
  'frame': ['frame', 'Frame'],
  'frontier': ['frontier', 'Frontier'],
  'binance': ['binance wallet', 'Binance Wallet', 'binance'],
  'rainbow': ['rainbow', 'Rainbow'],
  'argent': ['argent', 'Argent'],
  'ledger': ['ledger', 'Ledger'],
  'trezor': ['trezor', 'Trezor'],
  'atomic': ['atomic wallet', 'Atomic Wallet', 'atomic'],
  'exodus': ['exodus', 'Exodus'],
  'guarda': ['guarda', 'Guarda'],
  'myetherwallet': ['myetherwallet', 'MyEtherWallet', 'mew'],
  'nightly': ['nightly', 'Nightly'],
  'coin98': ['coin98', 'Coin98'],
  'safepal': ['safepal', 'SafePal'],
  '1inch': ['1inch wallet', '1inch Wallet', '1inch'],
  'imtoken': ['imtoken', 'imToken'],
  'walletconnect': ['walletconnect', 'WalletConnect'],
  'bitget': ['bitget wallet', 'Bitget Wallet', 'bitget'],
  'crypto.com': ['crypto.com wallet', 'Crypto.com Wallet', 'crypto.com', 'cryptocom'],
  'enjin': ['enjin wallet', 'Enjin Wallet', 'enjin'],
  'zengo': ['zengo', 'ZenGo', 'zengo wallet'],
  'blockchain.com': ['blockchain.com wallet', 'Blockchain.com Wallet', 'blockchain'],
  'coinomi': ['coinomi', 'Coinomi', 'coinomi wallet'],
  'jaxx': ['jaxx liberty', 'Jaxx Liberty', 'jaxx'],
  'airgap': ['airgap wallet', 'AirGap Wallet', 'airgap'],
  
  // Additional Popular Wallets (41-60)
  'edge': ['edge wallet', 'Edge Wallet', 'edge'],
  'gnosis-safe': ['gnosis safe', 'Gnosis Safe', 'gnosis', 'safe'],
  'keepkey': ['keepkey', 'KeepKey'],
  'coolwallet': ['coolwallet', 'CoolWallet', 'coolwallet s'],
  'bitbox02': ['bitbox02', 'BitBox02', 'bitbox'],
  'ellipal': ['ellipal', 'Ellipal', 'ellipal titan'],
  'cobo-vault': ['cobo vault', 'Cobo Vault', 'cobovault'],
  'secux': ['secux', 'SecuX', 'secux v20'],
  'dcent': ['dcent', 'D\'Cent', 'dcent biometric'],
  'eidoo': ['eidoo', 'Eidoo'],
  'infinito': ['infinito wallet', 'Infinito Wallet', 'infinito'],
  'pillar': ['pillar wallet', 'Pillar Wallet', 'pillar'],
  'bitpay': ['bitpay wallet', 'BitPay Wallet', 'bitpay'],
  'brd': ['brd wallet', 'BRD Wallet', 'brd'],
  'atomicdex': ['atomicdex', 'AtomicDEX', 'atomic dex'],
  'mycelium': ['mycelium', 'Mycelium'],
  'bluewallet': ['bluewallet', 'BlueWallet', 'blue wallet'],
  'greenwallet': ['greenwallet', 'Green Wallet', 'green wallet'],
  'samourai': ['samourai wallet', 'Samourai Wallet', 'samourai'],
  'wasabi': ['wasabi wallet', 'Wasabi Wallet', 'wasabi'],
  
  // More DeFi & Multi-Chain Wallets (61-80)
  'tally': ['tally', 'Tally'],
  'torus': ['torus', 'Torus'],
  'portis': ['portis', 'Portis'],
  'fortmatic': ['fortmatic', 'Fortmatic', 'magic'],
  'authereum': ['authereum', 'Authereum'],
  'burner-wallet': ['burner wallet', 'Burner Wallet', 'burner'],
  'walletlink': ['walletlink', 'WalletLink'],
  'sequence': ['sequence', 'Sequence'],
  'ambire': ['ambire wallet', 'Ambire Wallet', 'ambire'],
  'loopring': ['loopring wallet', 'Loopring Wallet', 'loopring'],
  'imx': ['immutable x', 'Immutable X', 'imx'],
  'metamask-snap': ['metamask snaps', 'MetaMask Snaps'],
  'coinbase-pay': ['coinbase pay', 'Coinbase Pay'],
  'venly': ['venly', 'Venly'],
  'torus-direct': ['torus direct', 'Torus Direct'],
  'web3auth': ['web3auth', 'Web3Auth'],
  'magic': ['magic', 'Magic'],
  'privy': ['privy', 'Privy'],
  'dynamic': ['dynamic', 'Dynamic'],
  
  // More Solana Wallets (81-90)
  'sollet': ['sollet', 'Sollet'],
  'torus-solana': ['torus solana', 'Torus Solana'],
  'coin98-solana': ['coin98 solana', 'Coin98 Solana'],
  'math-solana': ['math solana', 'Math Solana'],
  'trust-solana': ['trust solana', 'Trust Solana'],
  'exodus-solana': ['exodus solana', 'Exodus Solana'],
  'atomic-solana': ['atomic solana', 'Atomic Solana'],
  'guarda-solana': ['guarda solana', 'Guarda Solana'],
  'coinbase-solana': ['coinbase solana', 'Coinbase Solana'],
  'ledger-solana': ['ledger solana', 'Ledger Solana'],
  
  // Exchange & Trading Wallets (91-100)
  'binance-chain': ['binance chain', 'Binance Chain'],
  'huobi': ['huobi wallet', 'Huobi Wallet', 'huobi'],
  'kucoin': ['kucoin wallet', 'KuCoin Wallet', 'kucoin'],
  'gate': ['gate.io wallet', 'Gate.io Wallet', 'gate'],
  'bybit': ['bybit wallet', 'Bybit Wallet', 'bybit'],
  'kraken': ['kraken wallet', 'Kraken Wallet', 'kraken'],
  'gemini': ['gemini wallet', 'Gemini Wallet', 'gemini'],
  'ftx': ['ftx wallet', 'FTX Wallet', 'ftx'],
  'crypto.com-defi': ['crypto.com defi', 'Crypto.com DeFi'],
  'binance-web3': ['binance web3', 'Binance Web3'],
};

/**
 * Cache for wallet icons to avoid repeated API calls
 */
const walletIconCache = new Map<string, string>();

/**
 * Cache for wallet listings to avoid repeated API calls
 */
let walletListingsCache: Record<string, any> | null = null;
let walletListingsCacheTime: number = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * Fetch all wallet listings from WalletConnect Explorer API
 */
async function fetchWalletListings(): Promise<Record<string, any>> {
  // Return cached data if still valid
  const now = Date.now();
  if (walletListingsCache && (now - walletListingsCacheTime) < CACHE_DURATION) {
    return walletListingsCache;
  }

  try {
    const response = await fetch(
      `${EXPLORER_API_BASE}/wallets?projectId=${WALLETCONNECT_PROJECT_ID}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch wallets: ${response.statusText}`);
    }
    
    const data = await response.json();
    walletListingsCache = data.listings || {};
    walletListingsCacheTime = now;
    
    return walletListingsCache;
  } catch (error) {
    console.error('Error fetching wallet listings:', error);
    // Return empty object on error, will fallback to emoji icons
    return {};
  }
}

/**
 * Find wallet in listings by name (case-insensitive)
 */
function findWalletInListings(
  listings: Record<string, any>,
  walletId: string
): any | null {
  const searchNames = WALLET_NAME_MAPPING[walletId.toLowerCase()] || [walletId];
  
  // First, try exact match by wallet ID
  for (const [key, wallet] of Object.entries(listings)) {
    const walletNameLower = (wallet.name || '').toLowerCase();
    const walletIdLower = walletId.toLowerCase();
    
    // Check if wallet ID matches
    if (key.toLowerCase().includes(walletIdLower) || 
        walletNameLower.includes(walletIdLower)) {
      return wallet;
    }
  }
  
  // Then, try matching by search names
  for (const searchName of searchNames) {
    for (const [key, wallet] of Object.entries(listings)) {
      const walletName = (wallet.name || '').toLowerCase();
      const searchNameLower = searchName.toLowerCase();
      
      if (walletName === searchNameLower || 
          walletName.includes(searchNameLower) ||
          searchNameLower.includes(walletName)) {
        return wallet;
      }
    }
  }
  
  return null;
}

/**
 * Get wallet icon URL from WalletConnect Explorer API
 * Returns the logo URL or null if not found
 * @param walletId - The wallet ID from our supported wallets list
 * @param imageId - Optional WalletConnect image ID (from wallet.imageId)
 * @param size - Icon size (sm, md, lg)
 */
export async function getWalletIconUrl(
  walletId: string,
  imageId?: string,
  size: 'sm' | 'md' | 'lg' = 'md'
): Promise<string | null> {
  // Check cache first
  const cacheKey = imageId ? `${imageId}-${size}` : `${walletId}-${size}`;
  if (walletIconCache.has(cacheKey)) {
    return walletIconCache.get(cacheKey) || null;
  }
  
  try {
    // If imageId is provided directly, use it (preferred method)
    if (imageId) {
      const logoUrl = `${EXPLORER_API_BASE}/logo/${size}/${imageId}?projectId=${WALLETCONNECT_PROJECT_ID}`;
      walletIconCache.set(cacheKey, logoUrl);
      return logoUrl;
    }
    
    // Fallback: try to find wallet in listings
    const listings = await fetchWalletListings();
    const wallet = findWalletInListings(listings, walletId);
    
    if (!wallet) {
      console.warn(`Wallet not found in WalletConnect Explorer: ${walletId}`);
      return null;
    }
    
    // Get image_id from wallet
    const foundImageId = wallet.image_id;
    if (!foundImageId) {
      console.warn(`No image_id found for wallet: ${walletId}`);
      return null;
    }
    
    // Construct logo URL
    const logoUrl = `${EXPLORER_API_BASE}/logo/${size}/${foundImageId}?projectId=${WALLETCONNECT_PROJECT_ID}`;
    
    // Cache the URL
    walletIconCache.set(cacheKey, logoUrl);
    
    return logoUrl;
  } catch (error) {
    console.error(`Error fetching icon for wallet ${walletId}:`, error);
    return null;
  }
}

/**
 * Get wallet icon URL synchronously (returns cached value or null)
 * Use this when you need immediate access without async
 */
export function getCachedWalletIconUrl(
  walletId: string,
  size: 'sm' | 'md' | 'lg' = 'md'
): string | null {
  const cacheKey = `${walletId}-${size}`;
  return walletIconCache.get(cacheKey) || null;
}

/**
 * Preload wallet icons for all supported wallets
 * Call this on app initialization to improve performance
 */
export async function preloadWalletIcons(
  walletIds: string[],
  size: 'sm' | 'md' | 'lg' = 'md'
): Promise<void> {
  try {
    // Fetch all listings once
    const listings = await fetchWalletListings();
    
    // Preload icons for all wallets
    await Promise.all(
      walletIds.map(async (walletId) => {
        try {
          await getWalletIconUrl(walletId, size);
        } catch (error) {
          // Silently fail for individual wallets
          console.warn(`Failed to preload icon for ${walletId}:`, error);
        }
      })
    );
  } catch (error) {
    console.error('Error preloading wallet icons:', error);
  }
}

/**
 * Clear the wallet icon cache
 */
export function clearWalletIconCache(): void {
  walletIconCache.clear();
  walletListingsCache = null;
  walletListingsCacheTime = 0;
}

