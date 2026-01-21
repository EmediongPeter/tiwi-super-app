import { useState, useRef, useEffect } from "react";
import { NetworkSelectorTrigger } from "./network-selector-trigger";
import { NetworkSelectorDropdown } from "./network-selector-dropdown";
import { useChainsQuery } from "@/hooks/useChainsQuery";
import { useNetworkFilterStore } from "@/lib/frontend/store/network-store";

/**
 * Network Selector Component
 * 
 * Dynamically fetches chains and manages global network filtering state.
 */
export function NetworkSelector() {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch real chains from backend
    const { data: chains = [], isLoading } = useChainsQuery();

    // Get/Set global filter state
    const { selectedChainId, setNetwork } = useNetworkFilterStore();

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (chainId: number | null, slug: string | null) => {
        setNetwork(chainId, slug);
        setIsOpen(false);
    };

    if (isLoading && chains.length === 0) {
        return <div className="w-[140px] h-9 bg-[#0b0f0a] border border-[#1f261e] rounded-full animate-pulse" />;
    }

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger Button */}
            <NetworkSelectorTrigger
                isOpen={isOpen}
                selectedChainId={selectedChainId}
                chains={chains}
                onClick={() => setIsOpen(!isOpen)}
            />

            {/* Dropdown Panel */}
            {isOpen && (
                <NetworkSelectorDropdown
                    chains={chains}
                    selectedChainId={selectedChainId}
                    onSelect={handleSelect}
                />
            )}
        </div>
    );
}

