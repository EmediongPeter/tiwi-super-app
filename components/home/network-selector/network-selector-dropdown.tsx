import { NetworkSelectorItem } from "./network-selector-item";
import type { ChainDTO } from "@/lib/backend/types/backend-tokens";
import { getCoinGeckoNetworkId } from "@/lib/shared/constants/coingecko-networks";

interface NetworkSelectorDropdownProps {
    /** Dynamic list of chains from API */
    chains: ChainDTO[];
    /** Selected chain ID. null means "All networks" */
    selectedChainId: number | null;
    /** Callback when selection changes */
    onSelect: (chainId: number | null, slug: string | null) => void;
}

/**
 * Dropdown panel for the network selector.
 * Displays a list of networks fetched from the backend.
 */
export function NetworkSelectorDropdown({
    chains,
    selectedChainId,
    onSelect,
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
                isSelected={selectedChainId === null}
                isAllNetworks={true}
                onToggle={() => onSelect(null, null)}
            />

            {/* Divider */}
            <div className="h-px bg-[#1f261e] mx-3 my-0.5" />

            {/* Individual Chain Options */}
            {chains.map((chain) => {
                const cgSlug = getCoinGeckoNetworkId(chain.id);
                // Only show chains we can map to CoinGecko for now (as per user goal)
                if (!cgSlug) return null;

                return (
                    <NetworkSelectorItem
                        key={chain.id}
                        name={chain.name}
                        logoPath={chain.logoURI}
                        isSelected={selectedChainId === chain.id}
                        onToggle={() => onSelect(chain.id, cgSlug)}
                    />
                );
            })}
        </div>
    );
}

