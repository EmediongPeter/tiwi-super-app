// Cosmos ecosystem chain configurations
export interface CosmosChain {
  chainId: string;
  chainName: string;
  displayName: string;
  icon?: string;
  bech32Prefix: string;
  rpcUrl?: string;
  restUrl?: string;
}

// Popular Cosmos chains
export const COSMOS_CHAINS: CosmosChain[] = [
  {
    chainId: 'cosmoshub-4',
    chainName: 'cosmoshub',
    displayName: 'Cosmos Hub',
    icon: '🌌',
    bech32Prefix: 'cosmos',
    rpcUrl: 'https://rpc.cosmos.network',
    restUrl: 'https://lcd.cosmos.network',
  },
  {
    chainId: 'osmosis-1',
    chainName: 'osmosis',
    displayName: 'Osmosis',
    icon: '💧',
    bech32Prefix: 'osmo',
    rpcUrl: 'https://rpc.osmosis.zone',
    restUrl: 'https://lcd.osmosis.zone',
  },
  {
    chainId: 'xion-mainnet-1',
    chainName: 'xion',
    displayName: 'Xion',
    icon: '⚡',
    bech32Prefix: 'xion',
    rpcUrl: 'https://rpc.xion-api.com',
    restUrl: 'https://rest.xion-api.com',
  },
  {
    chainId: 'juno-1',
    chainName: 'juno',
    displayName: 'Juno',
    icon: '🪐',
    bech32Prefix: 'juno',
    rpcUrl: 'https://rpc-juno.itastakers.com',
    restUrl: 'https://lcd-juno.itastakers.com',
  },
  {
    chainId: 'stargaze-1',
    chainName: 'stargaze',
    displayName: 'Stargaze',
    icon: '⭐',
    bech32Prefix: 'stars',
    rpcUrl: 'https://rpc.stargaze-apis.com',
    restUrl: 'https://rest.stargaze-apis.com',
  },
  {
    chainId: 'akashnet-2',
    chainName: 'akash',
    displayName: 'Akash',
    icon: '☁️',
    bech32Prefix: 'akash',
    rpcUrl: 'https://rpc.akashnet.net',
    restUrl: 'https://api.akashnet.net',
  },
  {
    chainId: 'regen-1',
    chainName: 'regen',
    displayName: 'Regen',
    icon: '🌱',
    bech32Prefix: 'regen',
    rpcUrl: 'https://rpc.regen.network',
    restUrl: 'https://api.regen.network',
  },
  {
    chainId: 'sentinelhub-2',
    chainName: 'sentinel',
    displayName: 'Sentinel',
    icon: '🛡️',
    bech32Prefix: 'sent',
    rpcUrl: 'https://rpc-sentinel.keplr.app',
    restUrl: 'https://lcd-sentinel.keplr.app',
  },
  {
    chainId: 'persistenceCore-1',
    chainName: 'persistence',
    displayName: 'Persistence',
    icon: '🔗',
    bech32Prefix: 'persistence',
    rpcUrl: 'https://rpc-persistence.keplr.app',
    restUrl: 'https://lcd-persistence.keplr.app',
  },
  {
    chainId: 'crypto-org-chain-mainnet-1',
    chainName: 'cryptoorg',
    displayName: 'Crypto.org',
    icon: '💎',
    bech32Prefix: 'cro',
    rpcUrl: 'https://rpc-crypto-org.keplr.app',
    restUrl: 'https://lcd-crypto-org.keplr.app',
  },
  {
    chainId: 'irisnet-1',
    chainName: 'irisnet',
    displayName: 'IRISnet',
    icon: '🌈',
    bech32Prefix: 'iaa',
    rpcUrl: 'https://rpc-irisnet.keplr.app',
    restUrl: 'https://lcd-irisnet.keplr.app',
  },
  {
    chainId: 'secret-4',
    chainName: 'secret',
    displayName: 'Secret Network',
    icon: '🔐',
    bech32Prefix: 'secret',
    rpcUrl: 'https://rpc.secret.express',
    restUrl: 'https://api.secret.express',
  },
  {
    chainId: 'axelar-dojo-1',
    chainName: 'axelar',
    displayName: 'Axelar',
    icon: '🌉',
    bech32Prefix: 'axelar',
    rpcUrl: 'https://rpc-axelar.keplr.app',
    restUrl: 'https://lcd-axelar.keplr.app',
  },
  {
    chainId: 'sommelier-3',
    chainName: 'sommelier',
    displayName: 'Sommelier',
    icon: '🍷',
    bech32Prefix: 'somm',
    rpcUrl: 'https://rpc-sommelier.keplr.app',
    restUrl: 'https://lcd-sommelier.keplr.app',
  },
  {
    chainId: 'umee-1',
    chainName: 'umee',
    displayName: 'Umee',
    icon: '🚀',
    bech32Prefix: 'umee',
    rpcUrl: 'https://rpc-umee.keplr.app',
    restUrl: 'https://lcd-umee.keplr.app',
  },
  {
    chainId: 'evmos_9001-2',
    chainName: 'evmos',
    displayName: 'Evmos',
    icon: '🔥',
    bech32Prefix: 'evmos',
    rpcUrl: 'https://rpc-evmos.keplr.app',
    restUrl: 'https://lcd-evmos.keplr.app',
  },
  {
    chainId: 'kava_2222-10',
    chainName: 'kava',
    displayName: 'Kava',
    icon: '⚖️',
    bech32Prefix: 'kava',
    rpcUrl: 'https://rpc-kava.keplr.app',
    restUrl: 'https://lcd-kava.keplr.app',
  },
  {
    chainId: 'stride-1',
    chainName: 'stride',
    displayName: 'Stride',
    icon: '🏃',
    bech32Prefix: 'stride',
    rpcUrl: 'https://rpc-stride.keplr.app',
    restUrl: 'https://lcd-stride.keplr.app',
  },
  {
    chainId: 'dydx-mainnet-1',
    chainName: 'dydx',
    displayName: 'dYdX',
    icon: '📊',
    bech32Prefix: 'dydx',
    rpcUrl: 'https://rpc-dydx.keplr.app',
    restUrl: 'https://lcd-dydx.keplr.app',
  },
  {
    chainId: 'neutron-1',
    chainName: 'neutron',
    displayName: 'Neutron',
    icon: '⚛️',
    bech32Prefix: 'neutron',
    rpcUrl: 'https://rpc-neutron.keplr.app',
    restUrl: 'https://lcd-neutron.keplr.app',
  },
];

// Get chain by chain ID
export const getCosmosChainById = (chainId: string): CosmosChain | undefined => {
  return COSMOS_CHAINS.find(chain => chain.chainId === chainId);
};

// Get chain by chain name
export const getCosmosChainByName = (chainName: string): CosmosChain | undefined => {
  return COSMOS_CHAINS.find(chain => chain.chainName === chainName);
};
