"use client";

import Image from "next/image";

interface NetworkSelectorTriggerProps {
    /** Whether the dropdown is currently open */
    isOpen: boolean;
    /** Number of chains selected (for the badge) */
    selectedCount: number;
    /** Total number of available chains */
    totalChains: number;
    /** Whether all networks are selected */
    allSelected: boolean;
    /** Callback when trigger is clicked */
    onClick?: () => void;
}

/**
 * Trigger button for the network selector.
 * Shows stacked chain icons, count badge, "All networks" text, and chevron.
 * Styled as a pill-shaped button matching PancakeSwap's design.
 */
export function NetworkSelectorTrigger({
    isOpen,
    selectedCount,
    totalChains,
    allSelected,
    onClick,
}: NetworkSelectorTriggerProps) {
    // Display first 3 chain icons
    const displayedChainIcons = [
        "/assets/chains/chain-1.svg",
        "/assets/chains/chain-2.svg",
        "/assets/chains/chain-3.svg",
    ];

    // Calculate remaining chains to show in badge
    const remainingCount = totalChains - 3;

    // Determine display text
    const displayText = allSelected
        ? "All networks"
        : selectedCount === 1
            ? "1 network"
            : `${selectedCount} networks`;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`
        flex items-center gap-2 px-3 py-2
        bg-[#0b0f0a] border border-[#1f261e] rounded-full
        hover:border-[#b1f128]/30 transition-all duration-200
        cursor-pointer shrink-0
        ${isOpen ? "border-[#b1f128]/50" : ""}
      `}
        >
            {/* Stacked Chain Icons */}
            <div className="flex items-center -space-x-1.5">
                {displayedChainIcons.map((iconPath, index) => (
                    <div
                        key={index}
                        className="relative w-5 h-5 shrink-0"
                        style={{ zIndex: 3 - index }}
                    >
                        <Image
                            src={iconPath}
                            alt={`Chain ${index + 1}`}
                            width={20}
                            height={20}
                            className="w-5 h-5 rounded-full border-2 border-[#0b0f0a] object-cover"
                        />
                    </div>
                ))}

                {/* Remaining Count Badge */}
                {remainingCount > 0 && (
                    <div
                        className="
              relative w-5 h-5 shrink-0 rounded-full 
              bg-[#b1f128] border-2 border-[#0b0f0a]
              flex items-center justify-center
            "
                        style={{ zIndex: 0 }}
                    >
                        <span className="text-[#010501] text-[9px] font-bold leading-none">
                            +{remainingCount}
                        </span>
                    </div>
                )}
            </div>

            {/* Text Label */}
            <span className="text-white text-sm font-medium whitespace-nowrap">
                {displayText}
            </span>

            {/* Dropdown Chevron */}
            <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`
          text-[#7c7c7c] transition-transform duration-200 shrink-0
          ${isOpen ? "rotate-180" : ""}
        `}
            >
                <path
                    d="M4 6L8 10L12 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </button>
    );
}
