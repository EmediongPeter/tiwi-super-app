/**
 * Script to fetch wallets from WalletConnect Explorer API
 * and generate the supported-wallets.ts file with only WalletConnect wallets
 */

const fs = require('fs');
const path = require('path');

const WALLETCONNECT_PROJECT_ID = '8e998cd112127e42dce5e2bf74122539';
const EXPLORER_API_BASE = 'https://explorer-api.walletconnect.com/v3';

// Common wallet name mappings for detection
const WALLET_DETECTION_MAPPINGS = {
  'MetaMask': ['ethereum.isMetaMask', 'window.ethereum.isMetaMask'],
  'Trust Wallet': ['ethereum.isTrust', 'ethereum.isTrustWallet', 'window.trustwallet', 'window.trustWallet'],
  'Coinbase Wallet': ['ethereum.isCoinbaseWallet', 'window.ethereum.isCoinbaseWallet'],
  'Phantom': ['phantom', 'window.phantom'],
  'Rabby': ['ethereum.isRabby', 'window.rabby'],
  'Brave Wallet': ['ethereum.isBraveWallet'],
  'OKX Wallet': ['ethereum.isOkxWallet', 'window.okxwallet'],
  'Solflare': ['solflare', 'window.solflare', 'solana.isSolflare'],
  'Backpack': ['backpack', 'window.backpack'],
  'Glow': ['glow', 'window.glow'],
  'Slope': ['Slope', 'window.Slope'],
  'Zerion': ['ethereum.isZerion'],
  'TokenPocket': ['ethereum.isTokenPocket'],
  'BitKeep': ['ethereum.isBitKeep'],
  'MathWallet': ['ethereum.isMathWallet'],
  'Frame': ['ethereum.isFrame'],
  'Frontier': ['ethereum.isFrontier'],
  'Binance Wallet': ['BinanceChain', 'window.BinanceChain'],
  'Rainbow': ['ethereum.isRainbow'],
  'Argent': ['argent', 'window.argent'],
  'Ledger': ['ledger', 'window.ledger'],
  'Trezor': ['trezor', 'window.trezor'],
  'Atomic Wallet': ['atomic', 'window.atomic'],
  'Exodus': ['exodus', 'window.exodus'],
  'Guarda': ['guarda', 'window.guarda'],
  'MyEtherWallet': ['myetherwallet', 'window.myetherwallet'],
  'Nightly': ['nightly', 'window.nightly'],
  'Coin98': ['coin98', 'window.coin98'],
  'SafePal': ['safepal', 'window.safepal'],
  '1inch Wallet': ['inch', 'window.oneInch'],
  'imToken': ['imtoken', 'window.imToken'],
};

function getDetectionKeys(walletName, supportsEthereum, supportsSolana) {
  const name = walletName || '';
  const nameLower = name.toLowerCase().replace(/\s+/g, '');
  
  // Check if we have predefined detection keys
  if (WALLET_DETECTION_MAPPINGS[name]) {
    return WALLET_DETECTION_MAPPINGS[name];
  }
  
  // Generate default detection keys
  const keys = [];
  if (nameLower) {
    keys.push(nameLower);
    keys.push(`window.${nameLower}`);
  }
  
  if (supportsEthereum) {
    const camelName = name.replace(/\s+/g, '');
    keys.push(`ethereum.is${camelName}`);
  }
  
  if (supportsSolana) {
    const camelName = name.replace(/\s+/g, '');
    keys.push(`solana.is${camelName}`);
  }
  
  return keys.length > 0 ? keys : ['unknown'];
}

function generateWalletId(walletName) {
  return walletName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 50);
}

async function fetchWalletConnectWallets() {
  try {
    console.log('Fetching wallets from WalletConnect Explorer API...');
    const response = await fetch(
      `${EXPLORER_API_BASE}/wallets?projectId=${WALLETCONNECT_PROJECT_ID}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch wallets: ${response.statusText}`);
    }
    
    const data = await response.json();
    const listings = data.listings || {};
    
    console.log(`Found ${Object.keys(listings).length} wallets in WalletConnect Explorer`);
    
    // Filter wallets that support Ethereum (eip155) or Solana
    const supportedWallets = [];
    
    for (const [walletId, wallet] of Object.entries(listings)) {
      const chains = wallet.chains || [];
      
      // Check if wallet supports Ethereum (eip155) or Solana
      const supportsEthereum = chains.some(chain => chain.startsWith('eip155'));
      const supportsSolana = chains.some(chain => chain.startsWith('solana'));
      
      if (supportsEthereum || supportsSolana) {
        // Determine supported chains for our app
        const supportedChains = [];
        if (supportsEthereum) supportedChains.push('ethereum');
        if (supportsSolana) supportedChains.push('solana');
        
        const walletName = wallet.name || 'Unknown';
        const detectionKeys = getDetectionKeys(walletName, supportsEthereum, supportsSolana);
        
        // Get homepage URL
        const homepage = wallet.homepage || 
                        wallet.app?.ios || 
                        wallet.app?.android || 
                        wallet.app?.browser || 
                        '';
        
        const generatedId = generateWalletId(walletName);
        
        // Check for duplicate IDs and make them unique
        let uniqueId = generatedId;
        let counter = 1;
        while (supportedWallets.some(w => w.id === uniqueId)) {
          uniqueId = `${generatedId}-${counter}`;
          counter++;
        }
        
        supportedWallets.push({
          walletConnectId: walletId,
          id: uniqueId,
          name: walletName,
          imageId: wallet.image_id,
          supportedChains,
          detectionKeys,
          homepage,
          description: wallet.description || `${walletName} wallet`,
        });
      }
    }
    
    // Prioritize important wallets (MetaMask, Rabby, Jupiter, etc.)
    const priorityWallets = [
      'MetaMask', 'Rabby', 'Jupiter', 'Phantom', 'Trust Wallet', 
      'Coinbase Wallet', 'Ledger', 'Trezor', 'Solflare', 'Backpack'
    ];
    
    // Sort wallets
    supportedWallets.sort((a, b) => {
      const aPriority = priorityWallets.findIndex(p => 
        a.name.toLowerCase().includes(p.toLowerCase()) || 
        p.toLowerCase().includes(a.name.toLowerCase())
      );
      const bPriority = priorityWallets.findIndex(p => 
        b.name.toLowerCase().includes(p.toLowerCase()) || 
        p.toLowerCase().includes(b.name.toLowerCase())
      );
      
      // Prioritize important wallets first
      if (aPriority !== -1 && bPriority === -1) return -1;
      if (aPriority === -1 && bPriority !== -1) return 1;
      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      
      // Then prioritize wallets with both chains
      if (a.supportedChains.length !== b.supportedChains.length) {
        return b.supportedChains.length - a.supportedChains.length;
      }
      
      // Then sort by name
      return a.name.localeCompare(b.name);
    });
    
    // Ensure MetaMask, Rabby, and Jupiter are included
    const requiredWallets = ['MetaMask', 'Rabby', 'Jupiter'];
    const includedRequired = requiredWallets.map(rw => 
      supportedWallets.find(w => 
        w.name.toLowerCase().includes(rw.toLowerCase()) || 
        rw.toLowerCase().includes(w.name.toLowerCase())
      )
    ).filter(Boolean);
    
    // Remove required wallets from main list to avoid duplicates
    const otherWallets = supportedWallets.filter(w => 
      !includedRequired.some(rw => rw.id === w.id)
    );
    
    // Combine: required wallets first, then others
    const finalWallets = [...includedRequired, ...otherWallets];
    
    // Take top 100
    const top100Wallets = finalWallets.slice(0, 100);
    
    console.log(`\nSelected ${top100Wallets.length} wallets supporting Ethereum and/or Solana`);
    console.log(`Ethereum only: ${top100Wallets.filter(w => w.supportedChains.length === 1 && w.supportedChains[0] === 'ethereum').length}`);
    console.log(`Solana only: ${top100Wallets.filter(w => w.supportedChains.length === 1 && w.supportedChains[0] === 'solana').length}`);
    console.log(`Both chains: ${top100Wallets.filter(w => w.supportedChains.length === 2).length}`);
    
    return top100Wallets;
  } catch (error) {
    console.error('Error fetching wallets:', error);
    throw error;
  }
}

function escapeString(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/'/g, "\\'")     // Escape single quotes
    .replace(/\n/g, '\\n')    // Escape newlines
    .replace(/\r/g, '\\r')    // Escape carriage returns
    .replace(/\t/g, '\\t');   // Escape tabs
}

function generateTypeScriptFile(wallets) {
  const walletEntries = wallets.map((wallet, index) => {
    const chainsStr = wallet.supportedChains.map(c => `'${c}'`).join(', ');
    const detectionKeysStr = wallet.detectionKeys.map(k => `'${escapeString(k)}'`).join(', ');
    const emoji = '🔗'; // Default emoji, will be replaced by WalletConnect icons
    
    return `  {
    id: '${escapeString(wallet.id)}',
    name: '${escapeString(wallet.name)}',
    icon: '${emoji}',
    supportedChains: [${chainsStr}],
    detectionKeys: [${detectionKeysStr}],
    installUrl: '${escapeString(wallet.homepage || '#')}',
    description: '${escapeString(wallet.description || wallet.name + ' wallet')}',
    walletConnectId: '${wallet.walletConnectId}',
    imageId: '${wallet.imageId}'
  }`;
  }).join(',\n');

  const fileContent = `/**
 * Supported wallets configuration
 * Only wallets that support ERC20 (Ethereum) and/or SOL (Solana) tokens are included
 * All wallets are from WalletConnect Explorer API to ensure icon availability
 */

export type SupportedChain = 'ethereum' | 'solana';

export interface SupportedWallet {
  id: string;
  name: string;
  icon: string;
  supportedChains: SupportedChain[];
  detectionKeys: string[]; // Properties to check for wallet detection
  installUrl?: string; // Link to install the wallet
  description?: string;
  walletConnectId?: string; // WalletConnect Explorer ID
  imageId?: string; // WalletConnect image ID for icon fetching
}

/**
 * List of 100 most popular supported wallets for ERC20 and SOL tokens
 * All wallets are from WalletConnect Explorer API (2024-2025)
 * This ensures all wallets have icons available via WalletConnect Explorer
 */
export const SUPPORTED_WALLETS: SupportedWallet[] = [
${walletEntries}
];

/**
 * Get all wallet IDs
 */
export const getAllWalletIds = (): string[] => {
  return SUPPORTED_WALLETS.map(wallet => wallet.id);
};

/**
 * Get wallet by ID
 */
export const getWalletById = (id: string): SupportedWallet | undefined => {
  return SUPPORTED_WALLETS.find(wallet => wallet.id === id);
};

/**
 * Get wallet by WalletConnect ID
 */
export const getWalletByWalletConnectId = (walletConnectId: string): SupportedWallet | undefined => {
  return SUPPORTED_WALLETS.find(wallet => wallet.walletConnectId === walletConnectId);
};

/**
 * Check if a wallet supports a specific chain
 */
export const walletSupportsChain = (walletId: string, chain: SupportedChain): boolean => {
  const wallet = getWalletById(walletId);
  return wallet ? wallet.supportedChains.includes(chain) : false;
};
`;

  return fileContent;
}

// Run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  fetchWalletConnectWallets()
    .then(wallets => {
      const tsContent = generateTypeScriptFile(wallets);
      const outputPath = path.join(__dirname, 'app', 'utils', 'supported-wallets.ts');
      
      fs.writeFileSync(outputPath, tsContent, 'utf8');
      console.log(`\n✅ Successfully generated ${outputPath}`);
      console.log(`   Total wallets: ${wallets.length}`);
    })
    .catch(error => {
      console.error('Failed to generate wallet list:', error);
      process.exit(1);
    });
}

module.exports = { fetchWalletConnectWallets, generateTypeScriptFile };

