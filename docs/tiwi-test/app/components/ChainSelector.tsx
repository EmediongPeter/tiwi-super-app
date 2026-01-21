'use client';

import { useState, useEffect } from 'react';
import { getChains, ChainType, type ExtendedChain } from '@lifi/sdk';
import { SOLANA_CHAIN_ID } from '../utils/jupiter';

interface ChainSelectorProps {
  selectedChainId: number;
  onChainSelect: (chainId: number) => void;
  disabled?: boolean;
}

export default function ChainSelector({
  selectedChainId,
  onChainSelect,
  disabled = false,
}: ChainSelectorProps) {
  const [chains, setChains] = useState<ExtendedChain[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadChains = async () => {
      try {
        // Load ALL chains from LI.FI - get all supported chain types
        const allChainTypes: ChainType[] = [];
        
        // Try to get all available chain types from ChainType enum
        const chainTypeValues = Object.values(ChainType) as ChainType[];
        allChainTypes.push(...chainTypeValues);
        
        // Load chains for all types
        const chainPromises = allChainTypes.map(chainType => 
          getChains({ chainTypes: [chainType] }).catch(err => {
            console.warn(`[ChainSelector] Failed to load chains for type ${chainType}:`, err);
            return [];
          })
        );
        
        const chainArrays = await Promise.all(chainPromises);
        const allChainsFromLifi = chainArrays.flat();
        
        // Also try loading without specifying chain types to get all chains
        let allChainsDirect: ExtendedChain[] = [];
        try {
          allChainsDirect = await getChains();
        } catch (err) {
          console.warn('[ChainSelector] Failed to load all chains directly:', err);
        }
        
        // Merge all chains using a Map to deduplicate by chainId (keep first occurrence)
        const chainMap = new Map<number, ExtendedChain>();
        
        // LI.FI's internal Solana chain ID (we don't want this one)
        const LIFI_SOLANA_CHAIN_ID = 1151111081099710;
        // Our internal Solana chain ID (this is the one we want)
        const solanaChainId = 7565164;
        
        // Add chains from LI.FI (prioritize direct load, then add from typed loads)
        // Filter out LI.FI's Solana chain ID to avoid duplicates
        [...allChainsDirect, ...allChainsFromLifi]
          .filter(chain => chain.id !== LIFI_SOLANA_CHAIN_ID) // Remove LI.FI's Solana chain
          .forEach(chain => {
            if (!chainMap.has(chain.id)) {
              chainMap.set(chain.id, chain);
            }
          });
        
        // Check if Solana is included, if not add it manually
        const hasSolana = chainMap.has(solanaChainId);
        
        if (!hasSolana) {
          console.log('[ChainSelector] Solana not found in LI.FI chains, adding manually');
          const solanaChain: ExtendedChain = {
            id: solanaChainId,
            name: 'Solana',
            key: 'sol',
            chainType: 'SOLANA' as any,
            nativeCurrency: {
              name: 'Solana',
              symbol: 'SOL',
              decimals: 9,
            },
            nativeToken: {
              address: 'So11111111111111111111111111111111111111112',
              symbol: 'SOL',
              decimals: 9,
              name: 'Solana',
            },
            rpcUrls: ['https://api.mainnet-beta.solana.com'],
            blockExplorerUrls: ['https://solscan.io'],
            metamask: undefined,
            coin: 'SOL',
            mainnet: true,
          } as unknown as ExtendedChain;
          chainMap.set(solanaChainId, solanaChain);
        }
        
        // Convert to array, filter out any other Solana chains (keep only our correct one)
        let allChains = Array.from(chainMap.values());
        
        // Remove any Solana chains that aren't our correct chain ID
        // This ensures we only have one Solana entry
        allChains = allChains.filter(chain => {
          const isSolana = chain.name?.toLowerCase().includes('solana') || 
                          chain.key?.toLowerCase() === 'sol' ||
                          chain.chainType === 'SOLANA';
          // Keep Solana only if it's our correct chain ID, remove all others
          if (isSolana && chain.id !== solanaChainId) {
            console.log(`[ChainSelector] Removing duplicate/wrong Solana chain with ID ${chain.id}`);
            return false;
          }
          return true;
        });
        
        // Sort alphabetically by name
        allChains.sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
        
        console.log(`[ChainSelector] Loaded ${allChains.length} chains from LI.FI`);
        console.log('[ChainSelector] Chain types:', [...new Set(allChains.map(c => c.chainType))]);
        setChains(allChains);
      } catch (error) {
        console.error('[ChainSelector] Error loading chains:', error);
        // Fallback: try to load at least EVM chains
        try {
          const evmChains = await getChains({ chainTypes: [ChainType.EVM] });
          setChains(evmChains);
        } catch (fallbackError) {
          console.error('[ChainSelector] Fallback also failed:', fallbackError);
          // Last resort: empty array
          setChains([]);
        }
      }
    };
    loadChains();
  }, []);

  const filteredChains = chains.filter((chain) =>
    chain.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chain.key?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedChain = chains.find((chain) => chain.id === selectedChainId);

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-left flex items-center justify-between hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
      >
        <div className="flex items-center gap-2">
          {selectedChain ? (
            <>
              <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs">
                {selectedChain.name.charAt(0)}
              </div>
              <span className="font-medium text-sm">{selectedChain.name}</span>
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-sm">Select chain</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-hidden min-w-[200px]">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                placeholder="Search chains..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="overflow-y-auto max-h-80">
              {filteredChains.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No chains found
                </div>
              ) : (
                filteredChains.map((chain) => (
                  <button
                    key={chain.id}
                    onClick={() => {
                      onChainSelect(chain.id);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs">
                      {chain.name.charAt(0)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{chain.name}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

