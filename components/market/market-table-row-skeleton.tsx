"use client";

/**
 * Market Table Row Skeleton
 * 
 * Skeleton loader for market table rows (complete row with all columns)
 */

interface MarketTableRowSkeletonProps {
  includePerpColumns?: boolean;
}

export default function MarketTableRowSkeleton({ includePerpColumns = false }: MarketTableRowSkeletonProps) {
  return (
    <tr className="border-b-[0.5px] border-[#1f261e]">
      {/* Token Column */}
      <td className="w-[140px] lg:w-[104px] xl:w-[125px] 2xl:w-[140px] px-3 lg:px-4 xl:px-5 2xl:px-6 py-2.5 lg:py-3 xl:py-4 2xl:py-5">
        <div className="flex items-center gap-1.5 lg:gap-1.5 xl:gap-2 2xl:gap-2">
          <div className="size-4 lg:size-4 xl:size-5 2xl:size-5 rounded-full bg-[#121712] animate-pulse"></div>
          <div className="size-6 lg:size-6 xl:size-7 2xl:size-8 rounded-full bg-[#121712] animate-pulse"></div>
          <div className="h-3 lg:h-3 xl:h-4 2xl:h-4 bg-[#121712] rounded animate-pulse w-12 lg:w-12 xl:w-14 2xl:w-16"></div>
        </div>
      </td>
      
      {/* Price Column */}
      <td className="w-[80px] lg:w-[60px] xl:w-[72px] 2xl:w-[80px] px-3 lg:px-4 xl:px-5 2xl:px-6 py-2.5 lg:py-3 xl:py-4 2xl:py-5 text-right">
        <div className="h-3 lg:h-3 xl:h-4 2xl:h-4 bg-[#121712] rounded animate-pulse w-16 lg:w-14 xl:w-16 2xl:w-20 ml-auto"></div>
      </td>
      
      {/* 24h Change Column */}
      <td className="w-[81px] lg:w-[60px] xl:w-[72px] 2xl:w-[81px] px-3 lg:px-4 xl:px-5 2xl:px-6 py-2.5 lg:py-3 xl:py-4 2xl:py-5 text-right">
        <div className="h-3 lg:h-3 xl:h-4 2xl:h-4 bg-[#121712] rounded animate-pulse w-12 lg:w-12 xl:w-14 2xl:w-16 ml-auto"></div>
      </td>
      
      {/* 24h Vol Column */}
      <td className="w-[80px] lg:w-[60px] xl:w-[72px] 2xl:w-[80px] px-3 lg:px-4 xl:px-5 2xl:px-6 py-2.5 lg:py-3 xl:py-4 2xl:py-5 text-right">
        <div className="h-3 lg:h-3 xl:h-4 2xl:h-4 bg-[#121712] rounded animate-pulse w-16 lg:w-14 xl:w-16 2xl:w-20 ml-auto"></div>
      </td>
      
      {/* Liquidity Column */}
      <td className="w-[80px] lg:w-[60px] xl:w-[72px] 2xl:w-[80px] px-3 lg:px-4 xl:px-5 2xl:px-6 py-2.5 lg:py-3 xl:py-4 2xl:py-5 text-right">
        <div className="h-3 lg:h-3 xl:h-4 2xl:h-4 bg-[#121712] rounded animate-pulse w-16 lg:w-14 xl:w-16 2xl:w-20 ml-auto"></div>
      </td>
      
      {/* Holders Column */}
      <td className="w-[80px] lg:w-[60px] xl:w-[72px] 2xl:w-[80px] px-3 lg:px-4 xl:px-5 2xl:px-6 py-2.5 lg:py-3 xl:py-4 2xl:py-5 text-right">
        <div className="h-3 lg:h-3 xl:h-4 2xl:h-4 bg-[#121712] rounded animate-pulse w-12 lg:w-12 xl:w-14 2xl:w-16 ml-auto"></div>
      </td>
      
      {/* Perp-specific columns */}
      {includePerpColumns && (
        <>
          <td className="w-[80px] lg:w-[60px] xl:w-[72px] 2xl:w-[80px] px-3 lg:px-4 xl:px-5 2xl:px-6 py-2.5 lg:py-3 xl:py-4 2xl:py-5 text-right">
            <div className="h-3 lg:h-3 xl:h-4 2xl:h-4 bg-[#121712] rounded animate-pulse w-12 lg:w-12 xl:w-14 2xl:w-16 ml-auto"></div>
          </td>
          <td className="w-[80px] lg:w-[60px] xl:w-[72px] 2xl:w-[80px] px-3 lg:px-4 xl:px-5 2xl:px-6 py-2.5 lg:py-3 xl:py-4 2xl:py-5 text-right">
            <div className="h-3 lg:h-3 xl:h-4 2xl:h-4 bg-[#121712] rounded animate-pulse w-16 lg:w-14 xl:w-16 2xl:w-20 ml-auto"></div>
          </td>
        </>
      )}
      
      {/* Buy/Sell Column */}
      <td className="w-[88px] lg:w-[65px] xl:w-[78px] 2xl:w-[88px] px-3 lg:px-4 xl:px-5 2xl:px-6 py-2.5 lg:py-3 xl:py-4 2xl:py-5 text-center">
        <div className="w-8 lg:w-9 xl:w-10 2xl:w-11 h-8 lg:h-9 xl:h-10 2xl:h-11 bg-[#121712] rounded-full animate-pulse mx-auto"></div>
      </td>
    </tr>
  );
}

