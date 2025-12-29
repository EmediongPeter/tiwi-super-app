"use client";

/**
 * Token Header Skeleton Loader
 * Matches the shape of TokenHeader component
 */
export default function TokenHeaderSkeleton() {
  return (
    <div className="border-b border-[#1f261e] flex h-16 items-center justify-between px-10 xl:px-9 2xl:px-10">
      {/* Left: Token Info and Stats */}
      <div className="flex gap-8 xl:gap-7 2xl:gap-8 items-center">
        {/* Back Arrow + Token */}
        <div className="flex gap-2 xl:gap-1.5 2xl:gap-2 items-center">
          <div className="w-2.5 h-2.5 bg-[#121712] rounded animate-pulse"></div>
          <div className="w-8 h-8 bg-[#121712] rounded-full animate-pulse"></div>
          <div className="h-6 w-24 bg-[#121712] rounded animate-pulse"></div>
        </div>

        {/* Separator */}
        <div className="h-16 flex items-center justify-center w-0">
          <div className="rotate-90 h-0 w-16 border-t border-[#1f261e]"></div>
        </div>

        {/* Price and Change */}
        <div className="flex flex-col gap-1 items-start justify-center">
          <div className="h-5 w-20 bg-[#121712] rounded animate-pulse"></div>
          <div className="h-5 w-16 bg-[#121712] rounded animate-pulse"></div>
        </div>

        {/* Separator */}
        <div className="h-16 flex items-center justify-center w-0">
          <div className="rotate-90 h-0 w-16 border-t border-[#1f261e]"></div>
        </div>

        {/* 24H Vol */}
        <div className="flex flex-col gap-1 items-start justify-center">
          <div className="h-5 w-16 bg-[#121712] rounded animate-pulse"></div>
          <div className="h-5 w-12 bg-[#121712] rounded animate-pulse"></div>
        </div>

        {/* Separator */}
        <div className="h-16 flex items-center justify-center w-0">
          <div className="rotate-90 h-0 w-16 border-t border-[#1f261e]"></div>
        </div>

        {/* 24H High */}
        <div className="flex flex-col gap-1 items-start justify-center">
          <div className="h-5 w-16 bg-[#121712] rounded animate-pulse"></div>
          <div className="h-5 w-14 bg-[#121712] rounded animate-pulse"></div>
        </div>

        {/* Separator */}
        <div className="h-16 flex items-center justify-center w-0">
          <div className="rotate-90 h-0 w-16 border-t border-[#1f261e]"></div>
        </div>

        {/* 24H Low */}
        <div className="flex flex-col gap-1 items-start justify-center">
          <div className="h-5 w-16 bg-[#121712] rounded animate-pulse"></div>
          <div className="h-5 w-12 bg-[#121712] rounded animate-pulse"></div>
        </div>

        {/* Separator */}
        <div className="h-16 flex items-center justify-center w-0">
          <div className="rotate-90 h-0 w-16 border-t border-[#1f261e]"></div>
        </div>

        {/* 24H Vol (duplicate) */}
        <div className="flex flex-col gap-1 items-start justify-center">
          <div className="h-5 w-16 bg-[#121712] rounded animate-pulse"></div>
          <div className="h-5 w-12 bg-[#121712] rounded animate-pulse"></div>
        </div>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex gap-4 xl:gap-3.5 2xl:gap-4 items-center">
        <div className="w-5 h-5 bg-[#121712] rounded animate-pulse"></div>
        <div className="w-5 h-5 bg-[#121712] rounded animate-pulse"></div>
      </div>
    </div>
  );
}

