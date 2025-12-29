"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";

interface ChartSectionMobileProps {
  pair: string;
}

type TimePeriod = "15m" | "1h" | "4h" | "6h" | "1D" | "3D" | "More";

/**
 * Mobile Chart Section Component
 * Optimized for mobile with smaller height
 */
export default function ChartSectionMobile({ pair }: ChartSectionMobileProps) {
  const [activeTimePeriod, setActiveTimePeriod] = useState<TimePeriod>("1D");
  const [tradingViewLoaded, setTradingViewLoaded] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tradingViewLoaded && chartContainerRef.current && (window as any).TradingView) {
      if (chartContainerRef.current) {
        chartContainerRef.current.innerHTML = "";
      }

      try {
        const widget = new (window as any).TradingView.widget({
          autosize: true,
          symbol: pair.replace("/", ""),
          interval: activeTimePeriod === "1D" ? "D" : activeTimePeriod === "15m" ? "15" : activeTimePeriod === "1h" ? "60" : activeTimePeriod === "4h" ? "240" : activeTimePeriod === "6h" ? "360" : "D",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#010501",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: "tradingview-chart-mobile",
          backgroundColor: "#010501",
          gridColor: "#1f261e",
        });
      } catch (error) {
        console.error("Error loading TradingView widget:", error);
      }

      return () => {
        if (chartContainerRef.current) {
          chartContainerRef.current.innerHTML = "";
        }
      };
    }
  }, [tradingViewLoaded, pair, activeTimePeriod]);

  const timePeriods: TimePeriod[] = ["15m", "1h", "4h", "6h", "1D", "3D", "More"];

  return (
    <div className="flex flex-col h-full">
      {/* Time Period Selector */}
      <div className="border-b border-[#1f261e] flex items-center justify-between px-4 py-2">
        <div className="flex gap-3 items-center overflow-x-auto scrollbar-hide">
          {timePeriods.map((period) => (
            <button
              key={period}
              onClick={() => period !== "More" && setActiveTimePeriod(period)}
              className={`px-2 py-1 rounded text-xs font-medium shrink-0 transition-colors ${
                activeTimePeriod === period && period !== "More"
                  ? "text-[#b1f128] font-semibold"
                  : "text-[#b5b5b5]"
              }`}
            >
              {period}
              {period === "More" && (
                <span className="ml-1 inline-block">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="rotate-180">
                    <path d="M19 9L12 16L5 9" stroke="#b5b5b5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 min-h-0 relative bg-[#0b0f0a]">
        <Script
          src="https://s3.tradingview.com/tv.js"
          strategy="lazyOnload"
          onLoad={() => setTradingViewLoaded(true)}
        />
        
        <div
          id="tradingview-chart-mobile"
          ref={chartContainerRef}
          className="w-full h-full"
        />
        
        {!tradingViewLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[#7c7c7c] text-sm">Loading chart...</div>
          </div>
        )}
      </div>
    </div>
  );
}

