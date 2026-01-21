"use client";

import Image from "next/image";

interface NetworkSelectorItemProps {
    /** Chain name to display */
    name: string;
    /** Path to chain logo image */
    logoPath?: string;
    /** Whether this network is currently selected */
    isSelected: boolean;
    /** Whether this is the "All networks" option */
    isAllNetworks?: boolean;
    /** Callback when selection changes */
    onToggle?: () => void;
}

/**
 * Individual network row in the network selector dropdown.
 * Features a chain logo, name, and a styled checkbox.
 */
export function NetworkSelectorItem({
    name,
    logoPath,
    isSelected,
    isAllNetworks = false,
    onToggle,
}: NetworkSelectorItemProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#081F02] transition-colors duration-150 cursor-pointer group"
        >
            {/* Left side: Logo + Name */}
            <div className="flex items-center gap-2.5">
                {/* Chain Logo */}
                {logoPath && !isAllNetworks && (
                    <div className="relative w-5 h-5 shrink-0">
                        <Image
                            src={logoPath}
                            alt={name}
                            width={20}
                            height={20}
                            className="w-5 h-5 rounded-full object-cover"
                        />
                    </div>
                )}

                {/* Chain Name */}
                <span className="text-white text-[13px] font-medium">
                    {name}
                </span>
            </div>

            {/* Right side: Checkbox */}
            <div
                className={`
          relative w-5 h-5 rounded-[5px] border-2 transition-all duration-150 flex items-center justify-center shrink-0
          ${isSelected
                        ? "bg-[#b1f128] border-[#b1f128]"
                        : "bg-transparent border-[#1f261e] group-hover:border-[#b1f128]/50"
                    }
        `}
            >
                {/* Checkmark Icon */}
                {isSelected && (
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 14 14"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-[#010501]"
                    >
                        <path
                            d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </div>
        </button>
    );
}
