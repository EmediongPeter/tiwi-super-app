import Image from "next/image";
import type { ChainDTO } from "@/lib/backend/types/backend-tokens";

interface NetworkSelectorTriggerProps {
    /** Whether the dropdown is currently open */
    isOpen: boolean;
    /** Selected chain ID */
    selectedChainId: number | null;
    /** All available chains */
    chains: ChainDTO[];
    /** Callback when trigger is clicked */
    onClick?: () => void;
}

/**
 * Trigger button for the network selector.
 */
export function NetworkSelectorTrigger({
    isOpen,
    selectedChainId,
    chains,
    onClick,
}: NetworkSelectorTriggerProps) {
    // Find the selected chain object
    const selectedChain = selectedChainId
        ? chains.find(c => c.id === selectedChainId)
        : null;

    // Top chains to show in the "stack" when All Networks is selected
    const topChains = chains.slice(0, 3);

    return (
        <button
            type="button"
            onClick={onClick}
            className={`
        flex items-center gap-2 px-3 py-2
        bg-[#0b0f0a] border border-[#1f261e] rounded-full
        hover:border-[#b1f128]/30 transition-all duration-200
        cursor-pointer shrink-0 min-w-[140px]
        ${isOpen ? "border-[#b1f128]/50" : ""}
      `}
        >
            {/* Chain Icon(s) */}
            <div className="flex items-center -space-x-1.5">
                {selectedChain ? (
                    <div className="relative w-5 h-5 shrink-0 z-10">
                        <Image
                            src={selectedChain.logoURI || "/assets/icons/network-placeholder.svg"}
                            alt={selectedChain.name}
                            width={20}
                            height={20}
                            className="w-5 h-5 rounded-full border-2 border-[#0b0f0a] object-cover"
                        />
                    </div>
                ) : (
                    topChains.map((chain, index) => (
                        <div
                            key={chain.id}
                            className="relative w-5 h-5 shrink-0"
                            style={{ zIndex: 3 - index }}
                        >
                            <Image
                                src={chain.logoURI || "/assets/icons/network-placeholder.svg"}
                                alt={chain.name}
                                width={20}
                                height={20}
                                className="w-5 h-5 rounded-full border-2 border-[#0b0f0a] object-cover"
                            />
                        </div>
                    ))
                )}
            </div>

            {/* Text Label */}
            <span className="text-white text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">
                {selectedChain ? selectedChain.name : "All networks"}
            </span>

            {/* Dropdown Chevron */}
            <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`
          text-[#7c7c7c] transition-transform duration-200 shrink-0 ml-auto
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

