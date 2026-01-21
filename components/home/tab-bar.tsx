"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";

type TabKey = "Favourite" | "Hot" | "New" | "Gainers" | "Losers";

const tabs: TabKey[] = ["Favourite", "Hot", "New", "Gainers", "Losers"];

// Map TabKey to translation key
const tabTranslationMap: Record<TabKey, "home.favourite" | "home.hot" | "home.new" | "home.gainers" | "home.losers"> = {
  "Favourite": "home.favourite",
  "Hot": "home.hot",
  "New": "home.new",
  "Gainers": "home.gainers",
  "Losers": "home.losers",
};

interface TabBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const [scrollPosition, setScrollPosition] = useState<'start' | 'middle' | 'end'>('start');

  // Check if content is scrollable and track scroll position
  const updateScrollState = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const canScroll = scrollWidth > clientWidth + 2; // 2px tolerance

    setIsScrollable(canScroll);

    if (!canScroll) {
      setScrollPosition('start');
      return;
    }

    // Determine position with small thresholds
    const atStart = scrollLeft <= 5;
    const atEnd = scrollLeft >= scrollWidth - clientWidth - 5;

    if (atStart && !atEnd) {
      setScrollPosition('start');
    } else if (atEnd && !atStart) {
      setScrollPosition('end');
    } else {
      setScrollPosition('middle');
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Initial check
    updateScrollState();

    // Listen for scroll events
    container.addEventListener("scroll", updateScrollState);

    // Listen for resize events
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, []);

  // Determine which fades to show
  // Show both fades by default when scrollable (as a hint)
  // But make the fade more prominent in the direction with more content
  const showLeftFade = isScrollable && scrollPosition !== 'start';
  const showRightFade = isScrollable && scrollPosition !== 'end';

  // Show subtle fades on both sides when at start position as scroll hint
  const showLeftHint = isScrollable && scrollPosition === 'start';
  const showRightHint = isScrollable && scrollPosition === 'end';

  return (
    <div className="relative flex-1 min-w-0">
      {/* Left Fade Gradient - Full opacity when scrolled */}
      {showLeftFade && (
        <div
          className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none transition-opacity duration-200"
          style={{
            background: "linear-gradient(to right, #010501 0%, transparent 100%)",
          }}
        />
      )}

      {/* Left Fade Hint - Subtle when at start (indicates scroll left is possible after scrolling right) */}
      {showLeftHint && (
        <div
          className="absolute left-0 top-0 bottom-0 w-4 z-10 pointer-events-none opacity-30"
          style={{
            background: "linear-gradient(to right, #010501 0%, transparent 100%)",
          }}
        />
      )}

      {/* Scrollable Tabs Container */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tabs.map((tab) => {
          const isActive = active === tab;
          const translationKey = tabTranslationMap[tab];
          return (
            <button
              key={tab}
              onClick={() => onChange(tab)}
              className={`px-3 lg:px-4 xl:px-5 2xl:px-6 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${isActive ? "bg-[#081f02] text-[#b1f128]" : "bg-[#0b0f0a] text-[#b5b5b5]"
                }`}
            >
              {t(translationKey)}
            </button>
          );
        })}
      </div>

      {/* Right Fade Gradient - Full opacity when more content to the right */}
      {showRightFade && (
        <div
          className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none transition-opacity duration-200"
          style={{
            background: "linear-gradient(to left, #010501 0%, transparent 100%)",
          }}
        />
      )}

      {/* Right Fade Hint - Subtle when at end */}
      {showRightHint && (
        <div
          className="absolute right-0 top-0 bottom-0 w-4 z-10 pointer-events-none opacity-30"
          style={{
            background: "linear-gradient(to left, #010501 0%, transparent 100%)",
          }}
        />
      )}
    </div>
  );
}
