"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/admin-layout";
import CreatePoolModal from "@/components/admin/create-pool-modal";
import { IoAddOutline, IoSearchOutline, IoChevronForwardOutline } from "react-icons/io5";

// Mock staking pools data - showing tokens with APY
const stakingPools = [
  { id: 1, token: "ZONA", symbol: "ZONA", apy: "5.30%" },
  { id: 2, token: "ETH", symbol: "ETH", apy: "5.30%" },
  { id: 3, token: "BNB", symbol: "BNB", apy: "5.30%" },
  { id: 4, token: "BTC", symbol: "BTC", apy: "5.30%" },
  { id: 5, token: "USDT", symbol: "USDT", apy: "5.30%" },
  { id: 6, token: "USDC", symbol: "USDC", apy: "5.30%" },
  { id: 7, token: "MATIC", symbol: "MATIC", apy: "5.30%" },
  { id: 8, token: "SOL", symbol: "SOL", apy: "5.30%" },
  { id: 9, token: "AVAX", symbol: "AVAX", apy: "5.30%" },
  { id: 10, token: "ADA", symbol: "ADA", apy: "5.30%" },
  { id: 11, token: "DOT", symbol: "DOT", apy: "5.30%" },
  { id: 12, token: "LINK", symbol: "LINK", apy: "5.30%" },
  { id: 13, token: "UNI", symbol: "UNI", apy: "5.30%" },
  { id: 14, token: "AAVE", symbol: "AAVE", apy: "5.30%" },
  { id: 15, token: "ATOM", symbol: "ATOM", apy: "5.30%" },
  { id: 16, token: "XRP", symbol: "XRP", apy: "5.30%" },
  { id: 17, token: "DOGE", symbol: "DOGE", apy: "5.30%" },
  { id: 18, token: "LTC", symbol: "LTC", apy: "5.30%" },
  { id: 19, token: "ALGO", symbol: "ALGO", apy: "5.30%" },
  { id: 20, token: "NEAR", symbol: "NEAR", apy: "5.30%" },
];

export default function StakingPoolsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredPools = stakingPools.filter((pool) =>
    pool.token.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pool.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout activeNavItem="staking-pools">
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {/* Header Section */}
        <div className="mb-6 lg:mb-8">
          <h2 className="text-2xl lg:text-3xl font-semibold text-white mb-2">
            Staking Pools
          </h2>
          <p className="text-[#b5b5b5] text-sm">
            Create and manage staking pools for tokens across supported chains.
          </p>
        </div>

        {/* Search and Create Button */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7c7c7c]" />
            <input
              type="text"
              placeholder="Search Staking Pools"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121712] border border-[#1f261e] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#7c7c7c] focus:outline-none focus:border-[#b1f128]"
            />
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium text-sm whitespace-nowrap"
          >
            <IoAddOutline className="w-5 h-5" />
            <span>Create Stake</span>
          </button>
        </div>

        {/* Staking Pools Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredPools.map((pool) => (
            <div
              key={pool.id}
              onClick={() => router.push(`/admin/staking-pools/${pool.id}`)}
              className="bg-[#121712] border border-[#1f261e] rounded-xl p-4 hover:border-[#b1f128] transition-colors cursor-pointer"
            >
              <div className="flex flex-col items-center text-center">
                {/* Token Icon Placeholder */}
                <div className="w-12 h-12 rounded-full bg-[#1f261e] flex items-center justify-center mb-3">
                  <span className="text-white font-semibold text-lg">{pool.symbol.charAt(0)}</span>
                </div>
                {/* Token Symbol */}
                <div className="text-white font-medium text-sm mb-2">{pool.symbol}</div>
                {/* APY */}
                <div className="text-[#b1f128] text-sm font-medium">{pool.apy}</div>
                {/* Arrow Icon */}
                <IoChevronForwardOutline className="w-4 h-4 text-[#7c7c7c] mt-2" />
              </div>
            </div>
          ))}
        </div>

        {/* Create Pool Modal */}
        <CreatePoolModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
        />
      </main>
    </AdminLayout>
  );
}

