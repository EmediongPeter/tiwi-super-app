"use client";

import Image from "next/image";
import { SPOTLIGHT } from "@/lib/home/mock-data";

/**
 * Mobile Spotlight component
 * - Horizontal scrolling cards
 * - Free scroll (no snap)
 * - Pill-shaped cards with token info
 */
export function MobileSpotlight() {
  return (
    <div className="w-full flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <p className="text-white text-base font-semibold">Spotlight</p>
          <div className="flex items-center justify-center w-4 h-4">
            <div className="rotate-90 -scale-y-100">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M8 12L3 7L8 2" stroke="#B5B5B5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
      </div>

      {/* Horizontal scrolling cards */}
      <div className="overflow-x-auto scrollbar-hide -mx-[18px] px-[18px]">
        <div className="flex gap-1.5 items-start w-max">
          {SPOTLIGHT.map((item) => (
            <div
              key={item.rank}
              className="border border-[#1f261e] flex gap-2 items-center pl-2 pr-4 py-2 rounded-full shrink-0"
            >
              <Image
                src={item.icon}
                alt={item.symbol}
                width={32}
                height={32}
                className="w-8 h-8 shrink-0"
              />
              <div className="flex flex-col items-start justify-center leading-normal shrink-0">
                <p className="text-white text-sm font-semibold">{item.symbol}</p>
                <p
                  className={`text-xs font-medium ${
                    item.changePositive ? "text-[#3fea9b]" : "text-[#ff5c5c]"
                  }`}
                >
                  {item.change}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

