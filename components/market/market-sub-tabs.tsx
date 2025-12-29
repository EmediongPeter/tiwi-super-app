"use client";

type SubTabKey = "Favourite" | "Top" | "Spotlight" | "New" | "Gainers" | "Losers";

const subTabs: SubTabKey[] = ["Favourite", "Top", "Spotlight", "New", "Gainers", "Losers"];

interface MarketSubTabsProps {
  activeTab: SubTabKey;
  onTabChange: (tab: SubTabKey) => void;
}

export default function MarketSubTabs({ activeTab, onTabChange }: MarketSubTabsProps) {
  return (
    <div className="flex items-center gap-1.5 lg:gap-2 xl:gap-2 2xl:gap-2 overflow-x-auto scrollbar-hide">
      {subTabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-4 lg:px-5 xl:px-5.5 2xl:px-6 py-1 lg:py-1.5 xl:py-1.5 2xl:py-[5px] rounded-lg text-xs lg:text-sm xl:text-base 2xl:text-base font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isActive ? "bg-[#081f02] text-[#b1f128]" : "bg-[#0b0f0a] text-[#b5b5b5]"
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

