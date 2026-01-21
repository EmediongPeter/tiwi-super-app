"use client";

import { useState, useRef, useEffect } from "react";
import { NetworkSelectorTrigger } from "./network-selector-trigger";
import { NetworkSelectorDropdown, STATIC_CHAINS } from "./network-selector-dropdown";

interface NetworkSelectorProps {
    /** Optional callback when selection changes (for future implementation) */
    onSelectionChange?: (selectedChains: string[]) => void;
}

/**
 * Network Selector Component
 * 
 * A dropdown component for filtering tokens by blockchain network.
 * Styled after PancakeSwap's network selector with Tiwi's brand colors.
 * 
 * Features:
 * - Pill-shaped trigger with stacked chain icons
 * - Dropdown with "All networks" toggle and individual chain checkboxes
 * - Click-outside to close
 * - Smooth animations
 * 
 * Note: Currently static - functionality will be added later.
 */
export function NetworkSelector({ onSelectionChange }: NetworkSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [allSelected, setAllSelected] = useState(true);
    const [selectedChains, setSelectedChains] = useState<string[]>(
        STATIC_CHAINS.map(chain => chain.id)
    );

    const containerRef = useRef<HTMLDivElement>(null);

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

    // Handle toggle for "All networks"
    const handleToggleAll = () => {
        const newAllSelected = !allSelected;
        setAllSelected(newAllSelected);

        if (newAllSelected) {
            setSelectedChains(STATIC_CHAINS.map(chain => chain.id));
        } else {
            setSelectedChains([]);
        }

        onSelectionChange?.(newAllSelected ? STATIC_CHAINS.map(chain => chain.id) : []);
    };

    // Handle toggle for individual chain
    const handleToggleChain = (chainId: string) => {
        let newSelectedChains: string[];

        if (selectedChains.includes(chainId)) {
            // Remove chain
            newSelectedChains = selectedChains.filter(id => id !== chainId);
        } else {
            // Add chain
            newSelectedChains = [...selectedChains, chainId];
        }

        setSelectedChains(newSelectedChains);

        // Update allSelected status
        const allAreSelected = newSelectedChains.length === STATIC_CHAINS.length;
        setAllSelected(allAreSelected);

        onSelectionChange?.(newSelectedChains);
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger Button */}
            <NetworkSelectorTrigger
                isOpen={isOpen}
                selectedCount={selectedChains.length}
                totalChains={STATIC_CHAINS.length}
                allSelected={allSelected}
                onClick={() => setIsOpen(!isOpen)}
            />

            {/* Dropdown Panel */}
            {isOpen && (
                <NetworkSelectorDropdown
                    selectedChains={selectedChains}
                    allSelected={allSelected}
                    onToggleAll={handleToggleAll}
                    onToggleChain={handleToggleChain}
                />
            )}
        </div>
    );
}
