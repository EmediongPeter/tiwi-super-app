"use client";

/**
 * Orderbook Section Skeleton Loader
 * Matches the shape of OrderbookSection component
 */
export default function OrderbookSkeleton() {
  return (
    <div className="bg-[#0b0f0a] border-b border-l border-r-0 border-[#1f261e] border-t-0 flex flex-col h-[599px] xl:h-[540px] 2xl:h-[599px]">
      {/* Tabs */}
      <div className="border-b border-[#1f261e] flex items-start pb-0 pt-4 px-6">
        <div className="flex gap-6 xl:gap-5 2xl:gap-6 items-start">
          <div className="h-5 w-20 bg-[#121712] rounded animate-pulse"></div>
          <div className="h-5 w-16 bg-[#121712] rounded animate-pulse"></div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex gap-2">
          <div className="w-6 h-6 bg-[#121712] rounded animate-pulse"></div>
          <div className="w-6 h-6 bg-[#121712] rounded animate-pulse"></div>
        </div>
        <div className="w-[72px] h-7 bg-[#121712] rounded animate-pulse"></div>
      </div>

      {/* Column Headers */}
      <div className="flex items-center justify-between px-6 py-0">
        <div className="h-4 w-20 bg-[#121712] rounded animate-pulse"></div>
        <div className="h-4 w-16 bg-[#121712] rounded animate-pulse"></div>
        <div className="h-4 w-20 bg-[#121712] rounded animate-pulse"></div>
      </div>

      {/* Order Book Rows */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-2 space-y-1.5">
        {/* Sell Orders */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`ask-${i}`} className="flex items-center justify-between">
            <div className="h-4 w-20 bg-[#121712] rounded animate-pulse"></div>
            <div className="h-4 w-16 bg-[#121712] rounded animate-pulse"></div>
            <div className="h-4 w-20 bg-[#121712] rounded animate-pulse"></div>
          </div>
        ))}
        
        {/* Current Price */}
        <div className="flex items-center justify-between py-2 my-2 border-y border-[#1f261e]">
          <div className="h-6 w-24 bg-[#121712] rounded animate-pulse"></div>
          <div className="w-6 h-6 bg-[#121712] rounded animate-pulse"></div>
        </div>

        {/* Buy Orders */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`bid-${i}`} className="flex items-center justify-between">
            <div className="h-4 w-20 bg-[#121712] rounded animate-pulse"></div>
            <div className="h-4 w-16 bg-[#121712] rounded animate-pulse"></div>
            <div className="h-4 w-20 bg-[#121712] rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

