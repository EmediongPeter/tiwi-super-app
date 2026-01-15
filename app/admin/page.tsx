"use client";

import { useState, useEffect, useMemo } from "react";
import AdminLayout, { useAdminSearch } from "@/components/admin/admin-layout";
import { IoArrowUpOutline, IoArrowDownOutline, IoAlertCircleOutline } from "react-icons/io5";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DashboardStats {
  totalTokensLocked: number;
  totalTokensLockedGrowth: number;
  activeStakingPools: number;
  activeStakingPoolsGrowth: number;
  totalStakedAmount: number;
  activeLiquidityPools: number;
  liveNotifications: number;
  liveNotificationsGrowth: number;
  incomingNotifications: number;
  activeAdCampaigns: number;
  activeAdCampaignsGrowth: number;
  newCampaignsRunning: number;
  protocolStatus: number;
  protocolStatusGrowth: number;
  criticalAlerts: Array<{
    title: string;
    description: string;
    service: string;
    status: string;
  }>;
  recentNotifications: Array<{
    message: string;
    time: string;
    id: string;
  }>;
}

function DashboardContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCriticalAlertsModalOpen, setIsCriticalAlertsModalOpen] = useState(false);
  const [isLiveNotificationsModalOpen, setIsLiveNotificationsModalOpen] = useState(false);
  const { searchQuery } = useAdminSearch();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/v1/admin/dashboard");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          console.error("Failed to fetch dashboard stats");
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const criticalAlerts = stats?.criticalAlerts || [];
  const recentNotifications = stats?.recentNotifications || [];
  
  // Filter content based on search query
  const filteredCriticalAlerts = useMemo(() => {
    if (!searchQuery.trim()) return criticalAlerts;
    const query = searchQuery.toLowerCase();
    return criticalAlerts.filter(
      (alert) =>
        alert.title.toLowerCase().includes(query) ||
        alert.description.toLowerCase().includes(query) ||
        alert.service.toLowerCase().includes(query) ||
        alert.status.toLowerCase().includes(query)
    );
  }, [criticalAlerts, searchQuery]);

  const filteredRecentNotifications = useMemo(() => {
    if (!searchQuery.trim()) return recentNotifications;
    const query = searchQuery.toLowerCase();
    return recentNotifications.filter(
      (notification) =>
        notification.message.toLowerCase().includes(query) ||
        notification.id.toLowerCase().includes(query)
    );
  }, [recentNotifications, searchQuery]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(2) + "K";
    }
    return num.toFixed(2);
  };

  const formatGrowth = (growth: number) => {
    const absGrowth = Math.abs(growth);
    return absGrowth.toFixed(1);
  };

  if (isLoading) {
    return (
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="text-center py-12">
          <p className="text-[#b5b5b5]">Loading dashboard...</p>
        </div>
      </main>
    );
  }
  
  // Show only first 5 items in dashboard
  const displayedCriticalAlerts = filteredCriticalAlerts.slice(0, 5);
  const displayedNotifications = filteredRecentNotifications.slice(0, 5);

  return (
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {/* Dashboard Overview */}
          <div className="mb-6 lg:mb-8">
            <h2 className="text-2xl lg:text-3xl font-semibold text-white mb-2">Dashboard</h2>
            <p className="text-[#b5b5b5] text-xs lg:text-sm">
              Monitor protocol activity, manage alerts, and track assets across
              staking, liquidity, and ad campaigns in real-time.
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-4 lg:mb-6">
            {/* Total Tokens Locked */}
            <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <h3 className="text-[#b5b5b5] text-xs lg:text-sm font-medium">
                  Total Tokens Locked
                </h3>
                {stats && stats.totalTokensLockedGrowth !== 0 && (
                  <div className={`flex items-center gap-1 ${stats.totalTokensLockedGrowth >= 0 ? 'text-[#4ade80]' : 'text-[#ff5c5c]'}`}>
                    {stats.totalTokensLockedGrowth >= 0 ? (
                      <IoArrowUpOutline className="w-3 h-3 lg:w-4 lg:h-4" />
                    ) : (
                      <IoArrowDownOutline className="w-3 h-3 lg:w-4 lg:h-4" />
                    )}
                    <span className="text-xs">{formatGrowth(stats.totalTokensLockedGrowth)}%</span>
                  </div>
                )}
              </div>
              <div className="text-2xl lg:text-3xl font-semibold text-white mb-2">
                {stats ? formatNumber(stats.totalTokensLocked) : "0"}
              </div>
              <p className="text-[#7c7c7c] text-xs">
                total tokens staked
              </p>
            </div>

            {/* Active Staking Pools */}
            <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <h3 className="text-[#b5b5b5] text-xs lg:text-sm font-medium">
                  Active Staking Pools
                </h3>
                {stats && stats.activeStakingPoolsGrowth !== 0 && (
                  <div className={`flex items-center gap-1 ${stats.activeStakingPoolsGrowth >= 0 ? 'text-[#4ade80]' : 'text-[#ff5c5c]'}`}>
                    {stats.activeStakingPoolsGrowth >= 0 ? (
                      <IoArrowUpOutline className="w-3 h-3 lg:w-4 lg:h-4" />
                    ) : (
                      <IoArrowDownOutline className="w-3 h-3 lg:w-4 lg:h-4" />
                    )}
                    <span className="text-xs">{formatGrowth(stats.activeStakingPoolsGrowth)}%</span>
                  </div>
                )}
              </div>
              <div className="text-2xl lg:text-3xl font-semibold text-white mb-2">
                {stats ? formatNumber(stats.totalStakedAmount) : "0"}
              </div>
              <p className="text-[#7c7c7c] text-xs">
                {stats ? `${stats.activeStakingPools} active pools` : "0 active pools"}
              </p>
            </div>

            {/* Active Liquidity Pools */}
            <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <h3 className="text-[#b5b5b5] text-xs lg:text-sm font-medium">
                  Active Liquidity Pools
                </h3>
              </div>
              <div className="text-2xl lg:text-3xl font-semibold text-white mb-2">—</div>
              <p className="text-[#7c7c7c] text-xs">Coming soon</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-4 lg:mb-6">
            {/* Live Notifications */}
            <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <h3 className="text-[#b5b5b5] text-xs lg:text-sm font-medium">
                  Live Notifications
                </h3>
                {stats && stats.liveNotificationsGrowth !== 0 && (
                  <div className={`flex items-center gap-1 ${stats.liveNotificationsGrowth >= 0 ? 'text-[#4ade80]' : 'text-[#ff5c5c]'}`}>
                    {stats.liveNotificationsGrowth >= 0 ? (
                      <IoArrowUpOutline className="w-3 h-3 lg:w-4 lg:h-4" />
                    ) : (
                      <IoArrowDownOutline className="w-3 h-3 lg:w-4 lg:h-4" />
                    )}
                    <span className="text-xs">{formatGrowth(stats.liveNotificationsGrowth)}%</span>
                  </div>
                )}
              </div>
              <div className="text-xl lg:text-2xl font-semibold text-white mb-2">
                {stats ? stats.liveNotifications : "0"}
              </div>
              <p className="text-[#7c7c7c] text-xs">
                {stats ? `${stats.incomingNotifications} new notifications incoming` : "0 new notifications incoming"}
              </p>
            </div>

            {/* Active Ad Campaigns */}
            <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <h3 className="text-[#b5b5b5] text-xs lg:text-sm font-medium">
                  Active Ad Campaigns
                </h3>
                {stats && stats.activeAdCampaignsGrowth !== 0 && (
                  <div className={`flex items-center gap-1 ${stats.activeAdCampaignsGrowth >= 0 ? 'text-[#4ade80]' : 'text-[#ff5c5c]'}`}>
                    {stats.activeAdCampaignsGrowth >= 0 ? (
                      <IoArrowUpOutline className="w-3 h-3 lg:w-4 lg:h-4" />
                    ) : (
                      <IoArrowDownOutline className="w-3 h-3 lg:w-4 lg:h-4" />
                    )}
                    <span className="text-xs">{formatGrowth(stats.activeAdCampaignsGrowth)}%</span>
                  </div>
                )}
              </div>
              <div className="text-xl lg:text-2xl font-semibold text-white mb-2">
                {stats ? stats.activeAdCampaigns : "0"}
              </div>
              <p className="text-[#7c7c7c] text-xs">
                {stats ? `${stats.newCampaignsRunning} new campaigns running` : "0 new campaigns running"}
              </p>
            </div>

            {/* Protocol Status */}
            <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <h3 className="text-[#b5b5b5] text-xs lg:text-sm font-medium">
                  Protocol Status
                </h3>
                {stats && stats.protocolStatusGrowth !== 0 && (
                  <div className={`flex items-center gap-1 ${stats.protocolStatusGrowth <= 0 ? 'text-[#4ade80]' : 'text-[#ff5c5c]'}`}>
                    {stats.protocolStatusGrowth <= 0 ? (
                      <IoArrowDownOutline className="w-3 h-3 lg:w-4 lg:h-4" />
                    ) : (
                      <IoArrowUpOutline className="w-3 h-3 lg:w-4 lg:h-4" />
                    )}
                    <span className="text-xs">{formatGrowth(stats.protocolStatusGrowth)}%</span>
                  </div>
                )}
              </div>
              <div className="text-xl lg:text-2xl font-semibold text-white mb-2">
                {stats ? stats.protocolStatus : "0"}
              </div>
              <p className="text-[#7c7c7c] text-xs">
                {stats?.protocolStatus === 1 ? "Active issue" : "Active issues"}
              </p>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Critical Alerts */}
            <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-base lg:text-lg">Critical Alerts</h3>
                {filteredCriticalAlerts.length > 5 && (
                  <button 
                    onClick={() => setIsCriticalAlertsModalOpen(true)}
                    className="text-[#b1f128] text-xs lg:text-sm font-medium hover:underline"
                  >
                    View all
                  </button>
                )}
              </div>
              <div className="space-y-3 lg:space-y-4">
                {displayedCriticalAlerts.length === 0 ? (
                  <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg p-3 lg:p-4">
                    <p className="text-[#b5b5b5] text-xs lg:text-sm">No critical alerts</p>
                  </div>
                ) : (
                  displayedCriticalAlerts.map((alert, index) => (
                    <div
                      key={index}
                      className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg p-3 lg:p-4"
                    >
                      <div className="flex items-start gap-2 lg:gap-3">
                        <IoAlertCircleOutline className="w-4 h-4 lg:w-5 lg:h-5 text-[#ff5c5c] shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-white font-medium text-xs lg:text-sm mb-1">
                            {alert.title}
                          </h4>
                          <p className="text-[#b5b5b5] text-xs mb-2 lg:mb-3">
                            {alert.description}
                          </p>
                          <button className="text-[#b1f128] text-xs font-medium hover:underline">
                            Review now
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Live Notifications */}
            <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-base lg:text-lg">
                  Live Notifications
                </h3>
                {filteredRecentNotifications.length > 5 && (
                  <button 
                    onClick={() => setIsLiveNotificationsModalOpen(true)}
                    className="text-[#b1f128] text-xs lg:text-sm font-medium hover:underline"
                  >
                    View all
                  </button>
                )}
              </div>
              <div className="space-y-3 lg:space-y-4">
                {displayedNotifications.length === 0 ? (
                  <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg p-3 lg:p-4">
                    <p className="text-[#b5b5b5] text-xs lg:text-sm">No recent notifications</p>
                  </div>
                ) : (
                  displayedNotifications.map((notification, index) => (
                    <div
                      key={notification.id || index}
                      className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg p-3 lg:p-4"
                    >
                      <p className="text-[#b5b5b5] text-xs lg:text-sm mb-2">
                        {notification.message}
                      </p>
                      <p className="text-[#7c7c7c] text-xs">{notification.time}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Critical Alerts Modal */}
          <Dialog open={isCriticalAlertsModalOpen} onOpenChange={setIsCriticalAlertsModalOpen}>
            <DialogContent className="bg-[#121712] border-[#1f261e] text-white max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-white">
                  All Critical Alerts
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto space-y-3 lg:space-y-4 pr-2">
                {filteredCriticalAlerts.length === 0 ? (
                  <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg p-3 lg:p-4">
                    <p className="text-[#b5b5b5] text-xs lg:text-sm">
                      {searchQuery ? "No critical alerts found" : "No critical alerts"}
                    </p>
                  </div>
                ) : (
                  filteredCriticalAlerts.map((alert, index) => (
                    <div
                      key={index}
                      className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg p-3 lg:p-4"
                    >
                      <div className="flex items-start gap-2 lg:gap-3">
                        <IoAlertCircleOutline className="w-4 h-4 lg:w-5 lg:h-5 text-[#ff5c5c] shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-white font-medium text-xs lg:text-sm mb-1">
                            {alert.title}
                          </h4>
                          <p className="text-[#b5b5b5] text-xs mb-2 lg:mb-3">
                            {alert.description}
                          </p>
                          <button className="text-[#b1f128] text-xs font-medium hover:underline">
                            Review now
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Live Notifications Modal */}
          <Dialog open={isLiveNotificationsModalOpen} onOpenChange={setIsLiveNotificationsModalOpen}>
            <DialogContent className="bg-[#121712] border-[#1f261e] text-white max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-white">
                  All Live Notifications
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto space-y-3 lg:space-y-4 pr-2">
                {filteredRecentNotifications.length === 0 ? (
                  <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg p-3 lg:p-4">
                    <p className="text-[#b5b5b5] text-xs lg:text-sm">
                      {searchQuery ? "No notifications found" : "No recent notifications"}
                    </p>
                  </div>
                ) : (
                  filteredRecentNotifications.map((notification, index) => (
                    <div
                      key={notification.id || index}
                      className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg p-3 lg:p-4"
                    >
                      <p className="text-[#b5b5b5] text-xs lg:text-sm mb-2">
                        {notification.message}
                      </p>
                      <p className="text-[#7c7c7c] text-xs">{notification.time}</p>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </main>
  );
}

export default function AdminDashboard() {
  return (
    <AdminLayout activeNavItem="dashboard">
      <DashboardContent />
    </AdminLayout>
  );
}

