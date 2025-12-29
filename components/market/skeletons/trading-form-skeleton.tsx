"use client";

/**
 * Trading Form Skeleton Loader
 * Matches the shape of TradingForm component
 */
export default function TradingFormSkeleton() {
  return (
    <div className="flex flex-col gap-4 items-center w-full">
      {/* Buy/Sell Toggle */}
      <div className="bg-[#0b0f0a] flex items-center p-1 rounded-lg w-full">
        <div className="flex-1 h-10 bg-[#121712] rounded-md animate-pulse"></div>
        <div className="flex-1 h-10 bg-[#121712] rounded-md animate-pulse"></div>
      </div>

      {/* Market/Limit Tabs */}
      <div className="flex gap-4 items-center w-full">
        <div className="h-6 w-16 bg-[#121712] rounded animate-pulse"></div>
        <div className="h-6 w-16 bg-[#121712] rounded animate-pulse"></div>
      </div>

      {/* Order Value Input */}
      <div className="flex flex-col gap-2 items-start w-full">
        <div className="bg-[#1f261e] h-12 w-full rounded-lg animate-pulse"></div>
        <div className="flex items-center justify-between w-full">
          <div className="h-4 w-16 bg-[#121712] rounded animate-pulse"></div>
          <div className="h-4 w-20 bg-[#121712] rounded animate-pulse"></div>
        </div>
      </div>

      {/* Percentage Slider */}
      <div className="flex gap-2.5 items-center px-0 py-3.5 relative w-full">
        <div className="bg-[#1f261e] flex-1 h-1 rounded-2xl">
          <div className="flex items-center justify-between w-full">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-4 h-4 bg-[#121712] rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="border border-[#1f261e] flex flex-col gap-1 items-start p-3 rounded-lg w-full">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between w-full">
            <div className="h-4 w-16 bg-[#121712] rounded animate-pulse"></div>
            <div className="h-4 w-8 bg-[#121712] rounded animate-pulse"></div>
          </div>
        ))}
      </div>

      {/* Buy/Sell Button */}
      <div className="bg-[#156200] h-12 w-full rounded-full animate-pulse"></div>
    </div>
  );
}

