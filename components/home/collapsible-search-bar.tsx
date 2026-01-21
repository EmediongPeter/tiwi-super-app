"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";

interface CollapsibleSearchBarProps {
    value?: string;
    onChange?: (value: string) => void;
    /** Placeholder text for the search input */
    placeholder?: string;
    /** Reference to the tabs container to measure available space */
    tabsContainerRef?: React.RefObject<HTMLDivElement>;
}

// Minimum width needed to show the full search bar (in pixels)
const FULL_SEARCH_BAR_MIN_WIDTH = 200;
// The width of the tabs + network selector when they fit comfortably
const COMFORTABLE_TABS_WIDTH = 600;

/**
 * Collapsible Search Bar Component
 * 
 * Dynamically shows full search bar or icon based on available container space.
 * When collapsed, clicking the icon expands the search bar to cover the tabs.
 * 
 * Features:
 * - Dynamic width-based visibility (not fixed breakpoint)
 * - Smooth expand/collapse animations
 * - Click outside to close
 * - X button to close
 * - Properly aligned with tabs row
 */
export function CollapsibleSearchBar({
    value = "",
    onChange,
    placeholder = "Search by tokens",
    tabsContainerRef,
}: CollapsibleSearchBarProps) {
    const [searchValue, setSearchValue] = useState(value);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [showFullBar, setShowFullBar] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const expandedBarRef = useRef<HTMLDivElement>(null);

    // Check if there's enough space for the full search bar
    const checkAvailableSpace = useCallback(() => {
        if (!tabsContainerRef?.current) {
            // Fallback to window width check
            setShowFullBar(window.innerWidth >= 1720);
            return;
        }

        const container = tabsContainerRef.current;
        const containerWidth = container.offsetWidth;

        // If the container is wide enough to fit tabs comfortably + search bar
        const hasSpace = containerWidth >= COMFORTABLE_TABS_WIDTH + FULL_SEARCH_BAR_MIN_WIDTH;
        setShowFullBar(hasSpace);
    }, [tabsContainerRef]);

    // Monitor container width changes
    useEffect(() => {
        checkAvailableSpace();

        // Also check on window resize as fallback
        window.addEventListener("resize", checkAvailableSpace);

        // Use ResizeObserver if tabs container ref is available
        let resizeObserver: ResizeObserver | null = null;
        if (tabsContainerRef?.current) {
            resizeObserver = new ResizeObserver(checkAvailableSpace);
            resizeObserver.observe(tabsContainerRef.current);
        }

        return () => {
            window.removeEventListener("resize", checkAvailableSpace);
            resizeObserver?.disconnect();
        };
    }, [checkAvailableSpace, tabsContainerRef]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setSearchValue(newValue);
        onChange?.(newValue);
    };

    const handleExpand = () => {
        setIsExpanded(true);
        setIsClosing(false);
    };

    const handleCollapse = () => {
        // Trigger closing animation
        setIsClosing(true);

        // Wait for animation to complete before actually closing
        setTimeout(() => {
            setIsExpanded(false);
            setIsClosing(false);
        }, 200); // Match animation duration
    };

    // Focus input when expanded
    useEffect(() => {
        if (isExpanded && !isClosing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded, isClosing]);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is outside both the container and the expanded bar
            const isOutsideContainer = containerRef.current && !containerRef.current.contains(event.target as Node);
            const isOutsideExpandedBar = expandedBarRef.current && !expandedBarRef.current.contains(event.target as Node);

            if (isOutsideContainer && (isOutsideExpandedBar || !expandedBarRef.current)) {
                if (isExpanded && !isClosing) {
                    handleCollapse();
                }
            }
        };

        if (isExpanded) {
            // Small delay to prevent immediate close on the same click
            setTimeout(() => {
                document.addEventListener("mousedown", handleClickOutside);
            }, 10);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isExpanded, isClosing]);

    // Handle Escape key to close
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape" && isExpanded && !isClosing) {
                handleCollapse();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isExpanded, isClosing]);

    // Sync external value changes
    useEffect(() => {
        setSearchValue(value);
    }, [value]);
    
    return (
        <div ref={containerRef} className="relative shrink-0">
            {/* Mode 1: Full search bar when there's enough space */}
            {showFullBar && (
                <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-full px-3 lg:px-4 py-2 lg:py-2.5 flex items-center gap-2 lg:gap-3 w-full min-w-[180px] max-w-[280px]">
                    <Image
                        src="/assets/icons/search-01.svg"
                        alt="Search"
                        width={16}
                        height={16}
                        className="shrink-0 lg:w-5 lg:h-5 opacity-70"
                    />
                    <input
                        type="text"
                        value={searchValue}
                        onChange={handleChange}
                        placeholder={placeholder}
                        className="bg-transparent text-xs lg:text-sm text-white placeholder:text-[#7c7c7c] outline-none w-full"
                    />
                </div>
            )}

            {/* Mode 2: Collapsed icon when space is limited */}
            {!showFullBar && (
                <>
                    {/* Search Icon Button (visible when not expanded) */}
                    {!isExpanded && (
                        <button
                            type="button"
                            onClick={handleExpand}
                            className="bg-[#0b0f0a] border border-[#1f261e] rounded-full p-2.5 flex items-center justify-center cursor-pointer hover:border-[#b1f128]/30 transition-colors"
                            aria-label="Open search"
                        >
                            <Image
                                src="/assets/icons/search-01.svg"
                                alt="Search"
                                width={18}
                                height={18}
                                className="shrink-0 opacity-70"
                            />
                        </button>
                    )}

                    {/* Expanded Search Bar - Positioned to cover the tabs */}
                    {isExpanded && (
                        <div
                            ref={expandedBarRef}
                            className={`
                absolute right-0 top-1/2 z-20 
                flex items-center
                ${isClosing ? 'animate-search-collapse' : 'animate-search-expand'}
              `}
                            style={{
                                // Calculate width to be 50% of the tabs container width for more compact expansion
                                width: tabsContainerRef?.current
                                    ? `${tabsContainerRef.current.offsetWidth * 0.5}px`
                                    : "250px",
                                maxWidth: "500px",
                                transform: "translateY(-50%)",
                            }}
                        >
                            <div className="flex-1 bg-[#0b0f0a] border border-[#1f261e] rounded-full px-3 py-2 flex items-center gap-2 shadow-lg">
                                <Image
                                    src="/assets/icons/search-01.svg"
                                    alt="Search"
                                    width={16}
                                    height={16}
                                    className="shrink-0 opacity-70"
                                />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={searchValue}
                                    onChange={handleChange}
                                    placeholder={placeholder}
                                    className="bg-transparent text-sm text-white placeholder:text-[#7c7c7c] outline-none w-full"
                                />
                                {/* Close Button */}
                                <button
                                    type="button"
                                    onClick={handleCollapse}
                                    className="shrink-0 p-1 rounded-full hover:bg-[#1f261e] transition-colors"
                                    aria-label="Close search"
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 14 14"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="text-[#7c7c7c]"
                                    >
                                        <path
                                            d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Placeholder to maintain layout when search is expanded */}
                    {isExpanded && (
                        <div className="w-10 h-10 shrink-0 opacity-0 pointer-events-none" />
                    )}
                </>
            )}
        </div>
    );
}
