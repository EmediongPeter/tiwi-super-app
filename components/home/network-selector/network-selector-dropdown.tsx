"use client";

import { NetworkSelectorItem } from "./network-selector-item";

/**
 * Static chain data for the network selector.
 * Will be replaced with prefetched chain data in the future.
 */
const STATIC_CHAINS = [
    { id: "solana", name: "Solana", logoPath: "/assets/chains/chain-1.svg" },
    { id: "bsc", name: "BNB Smart Chain", logoPath: "/assets/chains/chain-2.svg" },
    { id: "ethereum", name: "Ethereum", logoPath: "/assets/chains/chain-3.svg" },
    { id: "arbitrum", name: "Arbitrum One", logoPath: "/assets/chains/chain-4.svg" },
    { id: "base", name: "Base", logoPath: "/assets/chains/chain-5.svg" },
    { id: "polygon", name: "Polygon", logoPath: "/assets/chains/chain-6.svg" },
    { id: "avalanche", name: "Avalanche", logoPath: "/assets/chains/chain-7.svg" },
    { id: "optimism", name: "Optimism", logoPath: "/assets/chains/chain-8.svg" },
];

interface NetworkSelectorDropdownProps {
    /** Currently selected chain IDs */
    selectedChains: string[];
    /** Whether all networks are selected */
    allSelected: boolean;
    /** Callback when "All networks" is toggled */
    onToggleAll?: () => void;
    /** Callback when a specific chain is toggled */
    onToggleChain?: (chainId: string) => void;
}

/**
 * Dropdown panel for the network selector.
 * Displays a list of networks with checkboxes for filtering.
 */
export function NetworkSelectorDropdown({
    selectedChains,
    allSelected,
    onToggleAll,
    onToggleChain,
}: NetworkSelectorDropdownProps) {
    return (
        <div
            className="
        absolute top-full left-0 mt-2 z-50
        w-[200px] max-h-[300px] overflow-y-auto
        bg-[#0b0f0a] border border-[#1f261e] rounded-xl
        shadow-[0_8px_32px_rgba(0,0,0,0.5)]
        py-1.5
        network-dropdown-scrollbar
      "
        >
            {/* All Networks Option */}
            <NetworkSelectorItem
                name="All networks"
                isSelected={allSelected}
                isAllNetworks={true}
                onToggle={onToggleAll}
            />

            {/* Divider */}
            <div className="h-px bg-[#1f261e] mx-3 my-0.5" />

            {/* Individual Chain Options */}
            {STATIC_CHAINS.map((chain) => (
                <NetworkSelectorItem
                    key={chain.id}
                    name={chain.name}
                    logoPath={chain.logoPath}
                    isSelected={allSelected || selectedChains.includes(chain.id)}
                    onToggle={() => onToggleChain?.(chain.id)}
                />
            ))}
        </div>
    );
}

// Export static chains for use in trigger component
export { STATIC_CHAINS };
