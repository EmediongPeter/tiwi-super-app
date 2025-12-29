"use client";

/**
 * Orders Table Skeleton Loader
 * Matches the shape of OrdersTable component
 */
export default function OrdersTableSkeleton() {
  return (
    <div className="flex flex-col gap-10 xl:gap-9 2xl:gap-10 items-center px-0 py-4">
      <div className="flex flex-col items-start w-full">
        {/* Tabs */}
        <div className="border-b-[0.5px] border-[#1f261e] flex h-[33px] items-start px-10 xl:px-9 2xl:px-10 py-0">
          <div className="flex gap-6 xl:gap-5 2xl:gap-6 items-start">
            <div className="h-5 w-16 bg-[#121712] rounded animate-pulse"></div>
            <div className="h-5 w-32 bg-[#121712] rounded animate-pulse"></div>
          </div>
        </div>

        {/* Table Headers */}
        <div className="border-b-[0.5px] border-[#1f261e] flex items-start justify-between px-10 xl:px-9 2xl:px-10 py-4 w-full">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-5 w-20 bg-[#121712] rounded animate-pulse"></div>
          ))}
        </div>
      </div>

      {/* Empty State Skeleton */}
      <div className="flex flex-col gap-2 items-center justify-center py-16">
        <div className="w-8 h-8 bg-[#121712] rounded animate-pulse"></div>
        <div className="h-5 w-32 bg-[#121712] rounded animate-pulse"></div>
      </div>
    </div>
  );
}

