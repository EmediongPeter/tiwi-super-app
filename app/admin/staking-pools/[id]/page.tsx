"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import AdminLayout from "@/components/admin/admin-layout";
import EditPoolModal from "@/components/admin/edit-pool-modal";
import DeactivatePoolModal from "@/components/admin/deactivate-pool-modal";

export default function PoolDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  
  const poolId = params?.id as string || "";

  // Mock pool data - in real app, fetch from API
  const poolData = {
    id: poolId || "1",
    chain: "Ethereum",
    chainId: 1,
    tokenAddress: "0x1234567890123456789012345678901234567890",
    tokenSymbol: "ETH",
    minStakingPeriod: "30 days",
    minStakeAmount: "0.1",
    maxStakeAmount: "1000.0",
    stakeModificationFee: true,
    timeBoost: false,
    country: "United States",
    stakePoolCreationFee: "0.15",
    rewardPoolCreationFee: "5%",
  };

  return (
    <AdminLayout activeNavItem="staking-pools">
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <button
            onClick={() => router.push("/admin/staking-pools")}
            className="text-[#b1f128] hover:text-[#9dd81f] transition-colors mb-4 flex items-center gap-2"
          >
            ← Back to Pools
          </button>
          <h2 className="text-2xl lg:text-3xl font-semibold text-white mb-2">
            Pool Details
          </h2>
        </div>

        {/* Pool Information Card */}
        <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-6 mb-6">
          <div className="space-y-6">
            {/* Step 1 Fields */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chain Selection */}
                <div>
                  <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                    Chain Selection
                  </label>
                  <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white">
                    {poolData.chain}
                  </div>
                </div>

                {/* Select Token */}
                <div>
                  <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                    Select Token
                  </label>
                  <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white">
                    {poolData.tokenAddress}
                  </div>
                  {poolData.tokenSymbol && (
                    <div className="text-[#b1f128] text-xs mt-1">Symbol: {poolData.tokenSymbol}</div>
                  )}
                </div>

                {/* Minimum staking period */}
                <div>
                  <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                    Minimum staking period
                  </label>
                  <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white">
                    {poolData.minStakingPeriod}
                  </div>
                </div>

                {/* Min Stake Amount */}
                <div>
                  <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                    Min Stake Amount
                  </label>
                  <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white">
                    {poolData.minStakeAmount}
                  </div>
                </div>

                {/* Max Stake Amount */}
                <div>
                  <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                    Max Stake Amount
                  </label>
                  <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white">
                    {poolData.maxStakeAmount}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 Fields */}
            <div className="pt-6 border-t border-[#1f261e]">
              <h3 className="text-lg font-semibold text-white mb-4">Advanced Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stake modification fee */}
                <div className="flex items-center justify-between">
                  <label className="block text-[#b5b5b5] text-sm font-medium">
                    Stake modification fee
                  </label>
                  <div className={`inline-flex h-6 w-11 items-center rounded-full ${
                    poolData.stakeModificationFee ? "bg-[#b1f128]" : "bg-[#1f261e]"
                  }`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      poolData.stakeModificationFee ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </div>
                </div>

                {/* Time boost */}
                <div>
                  <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                    Time boost
                  </label>
                  <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white">
                    {poolData.timeBoost ? "Enabled" : "Not Configured"}
                  </div>
                </div>

                {/* Select your country */}
                <div>
                  <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                    Select your country
                  </label>
                  <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white">
                    {poolData.country || "Not specified"}
                  </div>
                </div>
              </div>

              {/* Fee Information */}
              <div className="mt-6 bg-[#0b0f0a] border border-[#1f261e] rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#b5b5b5] text-sm">Stake Pool Creation Fee</span>
                  <span className="text-white text-sm font-medium">
                    {poolData.stakePoolCreationFee} {poolData.chain === "Ethereum" ? "ETH" : poolData.chain}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#b5b5b5] text-sm">Reward Pool Creation Fee</span>
                  <span className="text-white text-sm font-medium">
                    {poolData.rewardPoolCreationFee}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-6 pt-6 border-t border-[#1f261e]">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex-1 px-6 py-2.5 bg-[#121712] border border-[#b1f128] text-[#b1f128] rounded-lg hover:bg-[#081f02] transition-colors font-medium"
            >
              Edit Pool
            </button>
            <button
              onClick={() => setIsDeactivateModalOpen(true)}
              className="flex-1 px-6 py-2.5 bg-[#121712] border border-[#ff5c5c] text-[#ff5c5c] rounded-lg hover:bg-[#2a1a1a] transition-colors font-medium"
            >
              Deactivate Pool
            </button>
          </div>
        </div>

        {/* Modals */}
        <EditPoolModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          poolData={poolData}
        />
        <DeactivatePoolModal
          open={isDeactivateModalOpen}
          onOpenChange={setIsDeactivateModalOpen}
        />
      </main>
    </AdminLayout>
  );
}

