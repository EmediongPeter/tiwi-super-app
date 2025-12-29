"use client";

import type { MarketToken } from "@/lib/market/mock-data";

interface MobileMarketCardProps {
  token: MarketToken;
  leverage?: string; // e.g., "10X", "5X"
}

/**
 * Mobile Market Card Component
 * Displays token pair with leverage badge, volume, price, and 24h change
 * Matches Figma design exactly
 */
export default function MobileMarketCard({ token, leverage = "10X" }: MobileMarketCardProps) {
  // Extract base symbol (remove -PERP if present)
  const baseSymbol = token.symbol.replace("-PERP", "");
  
  return (
    <div className="flex items-center overflow-hidden px-0 py-[10px] w-full">
      <div className="flex flex-[1_0_0] gap-[10px] items-center min-h-px min-w-px">
        {/* Left side: Token pair, leverage badge, and volume */}
        <div className="flex flex-[1_0_0] flex-col items-start justify-center min-h-px min-w-px">
          <div className="flex gap-[8px] items-center">
            <p className="text-white text-sm sm:text-sm font-medium leading-normal">
              <span className="font-semibold">{baseSymbol}</span>
              <span className="text-[#b5b5b5]">/USDT</span>
            </p>
            <div className="bg-[#1f261e] flex items-center justify-center px-[6px] py-[2px] rounded-[6px] shrink-0">
              <p className="text-[#b5b5b5] text-[10px] sm:text-[10px] font-medium leading-normal">
                {leverage}
              </p>
            </div>
          </div>
          <p className="text-[#b5b5b5] text-xs sm:text-xs font-medium leading-normal">
            Vol {token.vol.replace("$", "")}
          </p>
        </div>
        
        {/* Right side: Price and 24h change */}
        <div className="flex flex-col items-end justify-center leading-normal shrink-0">
          <p className="text-white text-sm sm:text-sm font-semibold leading-normal">
            {token.price}
          </p>
          <p
            className={`text-xs sm:text-xs font-medium leading-normal ${
              token.changePositive ? "text-[#3fea9b]" : "text-[#ff5c5c]"
            }`}
          >
            {token.change}
          </p>
        </div>
      </div>
    </div>
  );
}

