"use client";

import { useState, useEffect } from "react";
import PoolCard from "./pool-card";
import { Flame } from "lucide-react";
import type { StakingPool } from "@/data/mock-staking-pools";

interface RecommendedPoolsProps {
  onPoolClick?: (pool: StakingPool) => void;
}

export default function RecommendedPools({ onPoolClick }: RecommendedPoolsProps) {
  const [recommendedPools, setRecommendedPools] = useState<StakingPool[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch active staking pools from admin database
    const fetchRecommendedPools = async () => {
      try {
        const response = await fetch("/api/v1/staking-pools?status=active");
        if (!response.ok) {
          console.error("Failed to fetch recommended pools:", response.statusText);
          setRecommendedPools([]);
          return;
        }
        const data = await response.json();
        const pools = data.pools || [];
        
        // Map API response to StakingPool format and limit to 8 pools for sidebar
        const mappedPools: StakingPool[] = pools
          .slice(0, 8) // Limit to 8 pools for sidebar
          .map((pool: any) => ({
            id: pool.id,
            tokenSymbol: pool.tokenSymbol || "Unknown",
            tokenName: pool.tokenName || pool.tokenSymbol || "Unknown Token",
            apy: pool.apy ? `~${pool.apy.toFixed(2)}%` : "N/A",
            tokenIcon: pool.tokenLogo || "/assets/logos/twc-token.svg",
            tvl: undefined,
            apr: pool.apy ? `${pool.apy.toFixed(2)}%` : undefined,
            totalStaked: undefined,
            limits: pool.minStakeAmount && pool.maxStakeAmount 
              ? `${pool.minStakeAmount}-${pool.maxStakeAmount} ${pool.tokenSymbol || ""}`
              : pool.minStakeAmount 
                ? `Min: ${pool.minStakeAmount} ${pool.tokenSymbol || ""}`
                : undefined,
          }));
        
        setRecommendedPools(mappedPools);
      } catch (error) {
        console.error("Error fetching recommended pools:", error);
        setRecommendedPools([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendedPools();
  }, []);

  return (
    <div className="flex flex-col gap-4 items-start px-4 py-0 relative shrink-0 w-full">
      {/* Header */}
      <div className="flex gap-2.5 h-6 items-center px-0 py-2 relative shrink-0 w-full">
        <div className="flex gap-2.5 h-6 items-center relative shrink-0">
          <div className="relative shrink-0 size-6">
            <Flame className="size-6 text-white" />
          </div>
          <p className="font-['Manrope',sans-serif] font-semibold leading-normal relative shrink-0 text-base text-center text-white">
            Recommended
          </p>
        </div>
      </div>

      {/* Pool Grid - 2 columns with proper gap matching Figma */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 items-start relative shrink-0 w-full">
          <div className="h-20 bg-[#121712] rounded-lg animate-pulse" />
          <div className="h-20 bg-[#121712] rounded-lg animate-pulse" />
        </div>
      ) : recommendedPools.length === 0 ? (
        <p className="text-[#7c7c7c] text-sm px-4">No pools available</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 items-start relative shrink-0 w-full">
          {recommendedPools.map((pool) => (
            <PoolCard
              key={pool.id}
              tokenName={pool.tokenSymbol}
              tokenIcon={pool.tokenIcon}
              apy={pool.apy}
              onClick={() => onPoolClick?.(pool)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

