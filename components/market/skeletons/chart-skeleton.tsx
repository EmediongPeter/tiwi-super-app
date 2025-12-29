"use client";

/**
 * Chart Section Skeleton Loader
 * Matches the shape of ChartSection component
 */
export default function ChartSkeleton() {
  return (
    <div className="flex flex-col h-[599px] xl:h-[540px] 2xl:h-[599px]">
      {/* Tabs and Time Period Selector */}
      <div className="border-b-[0.5px] border-[#1f261e] flex h-[33px] items-center justify-between px-10 xl:px-9 2xl:px-10 pt-4">
        {/* Chart/Overview Tabs */}
        <div className="flex gap-6 xl:gap-5 2xl:gap-6 items-start">
          <div className="h-6 w-12 bg-[#121712] rounded animate-pulse"></div>
          <div className="h-6 w-20 bg-[#121712] rounded animate-pulse"></div>
        </div>

        {/* Time Period Selector */}
        <div className="flex gap-6 xl:gap-5 2xl:gap-6 items-center">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-4 w-8 bg-[#121712] rounded animate-pulse"></div>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 min-h-0 relative bg-[#0b0f0a]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full bg-[#121712] animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

