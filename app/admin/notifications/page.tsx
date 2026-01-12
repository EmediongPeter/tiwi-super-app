"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import CreateNotificationModal from "@/components/admin/create-notification-modal";
import {
  IoSearchOutline,
  IoAddOutline,
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoBugOutline,
  IoCloseOutline,
} from "react-icons/io5";
import { FiDownload } from "react-icons/fi";
import type { BugReport } from "@/lib/shared/types/bug-reports";
import type { Notification } from "@/lib/shared/types/notifications";
import { formatAddress } from "@/lib/shared/utils/formatting";

const filters = ["All", "Live", "Removed"];

export default function NotificationsPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [isLoadingBugs, setIsLoadingBugs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState<"notifications" | "bug-reports">("notifications");
  const [selectedBugReport, setSelectedBugReport] = useState<BugReport | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const getPriorityColor = (priority: Notification["priority"]) => {
    switch (priority) {
      case "critical":
        return "text-[#ff5c5c]";
      case "important":
        return "text-[#ffa500]";
      default:
        return "text-white";
    }
  };

  // Update notification status
  const handleUpdateNotificationStatus = async (id: string, status: Notification["status"]) => {
    try {
      const response = await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          status,
        }),
      });

      if (response.ok) {
        // Refresh notifications
        fetchNotifications();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update notification status");
      }
    } catch (error) {
      console.error("Error updating notification status:", error);
      alert("Failed to update notification status");
    }
  };

  const getStatusColor = (status: BugReport["status"]) => {
    switch (status) {
      case "pending":
        return "text-[#ffa500]";
      case "reviewed":
        return "text-[#4ade80]";
      case "resolved":
        return "text-[#4ade80]";
      case "dismissed":
        return "text-[#7c7c7c]";
      default:
        return "text-white";
    }
  };

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);
    try {
      const statusParam = activeFilter === "All" ? "" : activeFilter.toLowerCase();
      const url = statusParam 
        ? `/api/v1/notifications?status=${statusParam}`
        : "/api/v1/notifications";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [activeFilter]);

  // Fetch bug reports
  const fetchBugReports = useCallback(async () => {
    setIsLoadingBugs(true);
    try {
      const response = await fetch("/api/v1/bug-reports");
      if (response.ok) {
        const data = await response.json();
        setBugReports(data.bugReports || []);
      }
    } catch (error) {
      console.error("Error fetching bug reports:", error);
    } finally {
      setIsLoadingBugs(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "notifications") {
      fetchNotifications();
    } else if (activeTab === "bug-reports") {
      fetchBugReports();
    }
  }, [activeTab, fetchNotifications, fetchBugReports]);

  // Refetch notifications when filter changes
  useEffect(() => {
    if (activeTab === "notifications") {
      fetchNotifications();
    }
  }, [activeFilter, activeTab, fetchNotifications]);

  // Update bug report status
  const updateBugStatus = async (id: string, status: BugReport["status"]) => {
    try {
      const response = await fetch("/api/v1/bug-reports", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          status,
          reviewedBy: "Admin", // In production, use actual admin user
        }),
      });

      if (response.ok) {
        // Refresh bug reports
        const fetchResponse = await fetch("/api/v1/bug-reports");
        if (fetchResponse.ok) {
          const data = await fetchResponse.json();
          setBugReports(data.bugReports || []);
          
          // Update selected bug report if it's the one being updated
          if (selectedBugReport && selectedBugReport.id === id) {
            const updatedReport = data.bugReports.find((r: BugReport) => r.id === id);
            if (updatedReport) {
              setSelectedBugReport(updatedReport);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error updating bug report status:", error);
    }
  };

  // Open sidebar with bug report details
  const handleViewBugReport = (report: BugReport) => {
    setSelectedBugReport(report);
    setIsSidebarOpen(true);
  };

  // Close sidebar
  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    setSelectedBugReport(null);
  }, []);

  // Download log file
  const handleDownloadLogFile = (logFile: string) => {
    try {
      // If it's a base64 string, convert it to a blob
      if (logFile.startsWith('data:')) {
        const base64Data = logFile.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bug-report-log-${selectedBugReport?.id}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // If it's a URL, open in new tab
        window.open(logFile, '_blank');
      }
    } catch (error) {
      console.error("Error downloading log file:", error);
      alert("Failed to download log file");
    }
  };

  // Close sidebar on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSidebarOpen) {
        handleCloseSidebar();
      }
    };

    if (isSidebarOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when sidebar is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isSidebarOpen, handleCloseSidebar]);

  // Filter bug reports by search query
  const filteredBugReports = bugReports.filter((report) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      report.description.toLowerCase().includes(query) ||
      report.userWallet.toLowerCase().includes(query) ||
      report.id.toLowerCase().includes(query)
    );
  });

  return (
    <AdminLayout activeNavItem="notifications">
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 lg:mb-8 border-b border-[#1f261e]">
          <button
            onClick={() => setActiveTab("notifications")}
            className={`pb-4 px-2 text-sm font-medium transition-colors ${
              activeTab === "notifications"
                ? "text-[#b1f128] border-b-2 border-[#b1f128]"
                : "text-[#b5b5b5] hover:text-white"
            }`}
          >
            User Notifications
          </button>
          <button
            onClick={() => setActiveTab("bug-reports")}
            className={`pb-4 px-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === "bug-reports"
                ? "text-[#b1f128] border-b-2 border-[#b1f128]"
                : "text-[#b5b5b5] hover:text-white"
            }`}
          >
            <IoBugOutline className="w-4 h-4" />
            Bug Reports
            {bugReports.filter((r) => r.status === "pending").length > 0 && (
              <span className="bg-[#ff5c5c] text-white text-xs px-2 py-0.5 rounded-full">
                {bugReports.filter((r) => r.status === "pending").length}
              </span>
            )}
          </button>
        </div>

        {/* User Notifications Section */}
        {activeTab === "notifications" && (
          <>
            <div className="mb-6 lg:mb-8">
              <h2 className="text-2xl lg:text-3xl font-semibold text-white mb-2">
                User Notifications
              </h2>
              <p className="text-[#b5b5b5] text-xs lg:text-sm">
                Send real-time or scheduled notifications to inform users about important updates.
              </p>
            </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4 lg:mb-6">
          {/* Search Input */}
          <div className="relative flex-1">
            <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7c7c7c]" />
            <input
              type="text"
              placeholder="Search Notifications"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121712] border border-[#1f261e] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#7c7c7c] focus:outline-none focus:border-[#b1f128]"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeFilter === filter
                    ? "bg-[#b1f128] text-[#010501]"
                    : "bg-[#121712] border border-[#1f261e] text-[#b5b5b5] hover:bg-[#1a1f1a] hover:text-white"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Create Notifications Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium text-sm whitespace-nowrap"
          >
            <IoAddOutline className="w-5 h-5" />
            <span>Create Notifications</span>
          </button>
        </div>

        {/* Notifications Table */}
        {isLoadingNotifications ? (
          <div className="text-center py-12">
            <p className="text-[#b5b5b5]">Loading notifications...</p>
          </div>
        ) : (
          <div className="bg-[#121712] border border-[#1f261e] rounded-xl overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1f261e]">
                    <th className="text-left px-6 py-4 text-[#b5b5b5] text-xs font-medium uppercase">
                      Date
                    </th>
                    <th className="text-left px-6 py-4 text-[#b5b5b5] text-xs font-medium uppercase">
                      Title
                    </th>
                    <th className="text-left px-6 py-4 text-[#b5b5b5] text-xs font-medium uppercase">
                      Message Body
                    </th>
                    <th className="text-left px-6 py-4 text-[#b5b5b5] text-xs font-medium uppercase">
                      Status
                    </th>
                    <th className="text-left px-6 py-4 text-[#b5b5b5] text-xs font-medium uppercase">
                      Target Audience
                    </th>
                    <th className="text-left px-6 py-4 text-[#b5b5b5] text-xs font-medium uppercase">
                      Delivery Type
                    </th>
                    <th className="text-left px-6 py-4 text-[#b5b5b5] text-xs font-medium uppercase">
                      Priority
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {notifications
                    .filter((notification) => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        notification.title.toLowerCase().includes(query) ||
                        notification.messageBody.toLowerCase().includes(query)
                      );
                    })
                    .map((notification) => (
                    <tr
                      key={notification.id}
                      className="border-b border-[#1f261e] last:border-b-0 hover:bg-[#0b0f0a] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="text-white text-sm">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white font-medium text-sm">{notification.title}</span>
                      </td>
                      <td className="px-6 py-4 max-w-md">
                        <p className="text-[#b5b5b5] text-sm line-clamp-2">
                          {notification.messageBody}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={notification.status}
                          onChange={(e) => handleUpdateNotificationStatus(notification.id, e.target.value as Notification["status"])}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            notification.status === "live"
                              ? "bg-[#4ade80] text-white border-[#4ade80]"
                              : notification.status === "removed"
                              ? "bg-[#7c7c7c] text-white border-[#7c7c7c]"
                              : "bg-[#ffa500] text-white border-[#ffa500]"
                          } hover:opacity-90`}
                        >
                          <option value="live" className="bg-[#010501] text-white">Live</option>
                          <option value="removed" className="bg-[#010501] text-white">Removed</option>
                          <option value="scheduled" className="bg-[#010501] text-white">Scheduled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[#b5b5b5] text-sm capitalize">
                          {notification.targetAudience.replace(/-/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[#b5b5b5] text-sm capitalize">{notification.deliveryType}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-medium text-sm ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Table View */}
            <div className="lg:hidden divide-y divide-[#1f261e]">
              {notifications
                .filter((notification) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    notification.title.toLowerCase().includes(query) ||
                    notification.messageBody.toLowerCase().includes(query)
                  );
                })
                .map((notification) => (
                <div key={notification.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-white font-medium text-sm mb-1">
                        {notification.title}
                      </div>
                      <div className="text-[#7c7c7c] text-xs mb-2">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </div>
                      <p className="text-[#b5b5b5] text-xs mb-3 line-clamp-2">
                        {notification.messageBody}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-[#7c7c7c] mb-1">Status</div>
                      <select
                        value={notification.status}
                        onChange={(e) => handleUpdateNotificationStatus(notification.id, e.target.value as Notification["status"])}
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          notification.status === "live"
                            ? "bg-[#4ade80] text-white border-[#4ade80]"
                            : notification.status === "removed"
                            ? "bg-[#7c7c7c] text-white border-[#7c7c7c]"
                            : "bg-[#ffa500] text-white border-[#ffa500]"
                        } hover:opacity-90`}
                      >
                        <option value="live" className="bg-[#010501] text-white">Live</option>
                        <option value="removed" className="bg-[#010501] text-white">Removed</option>
                        <option value="scheduled" className="bg-[#010501] text-white">Scheduled</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-[#7c7c7c] mb-1">Priority</div>
                      <div className={getPriorityColor(notification.priority)}>
                        {notification.priority}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#7c7c7c] mb-1">Target Audience</div>
                      <div className="text-[#b5b5b5] capitalize">
                        {notification.targetAudience.replace(/-/g, " ")}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#7c7c7c] mb-1">Delivery Type</div>
                      <div className="text-[#b5b5b5] capitalize">{notification.deliveryType}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Create Notification Modal */}
        <CreateNotificationModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          onSuccess={fetchNotifications}
        />
          </>
        )}

        {/* Bug Reports Section */}
        {activeTab === "bug-reports" && (
          <>
            <div className="mb-6 lg:mb-8">
              <h2 className="text-2xl lg:text-3xl font-semibold text-white mb-2">
                Bug Reports
              </h2>
              <p className="text-[#b5b5b5] text-xs lg:text-sm">
                Review and manage bug reports submitted by users.
              </p>
            </div>

            {/* Search */}
            <div className="mb-4 lg:mb-6">
              <div className="relative">
                <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7c7c7c]" />
                <input
                  type="text"
                  placeholder="Search bug reports by description, wallet, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#121712] border border-[#1f261e] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#7c7c7c] focus:outline-none focus:border-[#b1f128]"
                />
              </div>
            </div>

            {/* Bug Reports Table */}
            {isLoadingBugs ? (
              <div className="text-center py-12">
                <p className="text-[#b5b5b5]">Loading bug reports...</p>
              </div>
            ) : filteredBugReports.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#b5b5b5]">No bug reports found.</p>
              </div>
            ) : (
              <div className="bg-[#121712] border border-[#1f261e] rounded-xl overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1f261e]">
                        <th className="text-left px-6 py-4 text-[#b5b5b5] text-xs font-medium uppercase">
                          Date
                        </th>
                        <th className="text-left px-6 py-4 text-[#b5b5b5] text-xs font-medium uppercase">
                          User Wallet
                        </th>
                        <th className="text-left px-6 py-4 text-[#b5b5b5] text-xs font-medium uppercase">
                          Description
                        </th>
                        <th className="text-left px-6 py-4 text-[#b5b5b5] text-xs font-medium uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBugReports.map((report) => (
                        <tr
                          key={report.id}
                          className="border-b border-[#1f261e] last:border-b-0 hover:bg-[#0b0f0a] transition-colors cursor-pointer"
                          onClick={() => handleViewBugReport(report)}
                        >
                          <td className="px-6 py-4">
                            <span className="text-white text-sm">
                              {new Date(report.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-white font-mono text-sm">
                              {formatAddress(report.userWallet)}
                            </span>
                          </td>
                          <td className="px-6 py-4 max-w-md">
                            <p className="text-[#b5b5b5] text-sm line-clamp-2">
                              {report.description}
                            </p>
                            {report.screenshot && (
                              <span className="text-xs text-[#7c7c7c] mt-1 block">
                                📷 Screenshot attached
                              </span>
                            )}
                            {report.logFile && (
                              <span className="text-xs text-[#7c7c7c] mt-1 block">
                                📄 Log file attached
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={report.status}
                              onChange={(e) => updateBugStatus(report.id, e.target.value as BugReport["status"])}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                                report.status === "pending"
                                  ? "bg-[#ffa500] text-white border-[#ffa500]"
                                  : report.status === "reviewed"
                                  ? "bg-[#4ade80] text-white border-[#4ade80]"
                                  : report.status === "resolved"
                                  ? "bg-[#4ade80] text-white border-[#4ade80]"
                                  : "bg-[#7c7c7c] text-white border-[#7c7c7c]"
                              } hover:opacity-90`}
                            >
                              <option value="pending" className="bg-[#010501] text-white">Pending</option>
                              <option value="reviewed" className="bg-[#010501] text-white">Reviewed</option>
                              <option value="resolved" className="bg-[#010501] text-white">Resolved</option>
                              <option value="dismissed" className="bg-[#010501] text-white">Dismissed</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Table View */}
                <div className="lg:hidden divide-y divide-[#1f261e]">
                  {filteredBugReports.map((report) => (
                    <div key={report.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="text-white font-medium text-sm mb-1">
                            {formatAddress(report.userWallet)}
                          </div>
                          <div className="text-[#7c7c7c] text-xs mb-2">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </div>
                          <p className="text-[#b5b5b5] text-xs mb-3 line-clamp-3">
                            {report.description}
                          </p>
                          {(report.screenshot || report.logFile) && (
                            <div className="flex gap-2 text-xs text-[#7c7c7c] mb-3">
                              {report.screenshot && <span>📷 Screenshot</span>}
                              {report.logFile && <span>📄 Log File</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[#7c7c7c] text-xs mb-1">Status</div>
                          <select
                            value={report.status}
                            onChange={(e) => updateBugStatus(report.id, e.target.value as BugReport["status"])}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                              report.status === "pending"
                                ? "bg-[#ffa500] text-white border-[#ffa500]"
                                : report.status === "reviewed"
                                ? "bg-[#4ade80] text-white border-[#4ade80]"
                                : report.status === "resolved"
                                ? "bg-[#4ade80] text-white border-[#4ade80]"
                                : "bg-[#7c7c7c] text-white border-[#7c7c7c]"
                            } hover:opacity-90`}
                          >
                            <option value="pending" className="bg-[#010501] text-white">Pending</option>
                            <option value="reviewed" className="bg-[#010501] text-white">Reviewed</option>
                            <option value="resolved" className="bg-[#010501] text-white">Resolved</option>
                            <option value="dismissed" className="bg-[#010501] text-white">Dismissed</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Bug Report Details Sidebar */}
        {isSidebarOpen && selectedBugReport && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:z-50"
              onClick={handleCloseSidebar}
            />
            
            {/* Sidebar */}
            <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-[#0b0f0a] border-l border-[#1f261e] z-50 overflow-y-auto shadow-2xl transform transition-transform duration-300 ease-in-out">
              <div className="p-6 lg:p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-white">Bug Report Details</h2>
                  <button
                    onClick={handleCloseSidebar}
                    className="p-2 hover:bg-[#121712] rounded-lg transition-colors"
                  >
                    <IoCloseOutline className="w-6 h-6 text-[#b5b5b5]" />
                  </button>
                </div>

                {/* Status Badge */}
                <div className="mb-6">
                  <label className="text-sm text-[#b5b5b5] mb-2 block">Status</label>
                  <select
                    value={selectedBugReport.status}
                    onChange={(e) => updateBugStatus(selectedBugReport.id, e.target.value as BugReport["status"])}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                      selectedBugReport.status === "pending"
                        ? "bg-[#ffa500] text-white border-[#ffa500]"
                        : selectedBugReport.status === "reviewed"
                        ? "bg-[#4ade80] text-white border-[#4ade80]"
                        : selectedBugReport.status === "resolved"
                        ? "bg-[#4ade80] text-white border-[#4ade80]"
                        : "bg-[#7c7c7c] text-white border-[#7c7c7c]"
                    } hover:opacity-90`}
                  >
                    <option value="pending" className="bg-[#010501] text-white">Pending</option>
                    <option value="reviewed" className="bg-[#010501] text-white">Reviewed</option>
                    <option value="resolved" className="bg-[#010501] text-white">Resolved</option>
                    <option value="dismissed" className="bg-[#010501] text-white">Dismissed</option>
                  </select>
                </div>

                {/* User Wallet */}
                <div className="mb-6">
                  <label className="text-sm text-[#b5b5b5] mb-2 block">User Wallet</label>
                  <div className="bg-[#010501] border border-[#1f261e] rounded-lg px-4 py-3">
                    <span className="text-white font-mono text-sm break-all">
                      {selectedBugReport.userWallet}
                    </span>
                  </div>
                </div>

                {/* Date Submitted */}
                <div className="mb-6">
                  <label className="text-sm text-[#b5b5b5] mb-2 block">Date Submitted</label>
                  <div className="bg-[#010501] border border-[#1f261e] rounded-lg px-4 py-3">
                    <span className="text-white text-sm">
                      {new Date(selectedBugReport.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <label className="text-sm text-[#b5b5b5] mb-2 block">Description</label>
                  <div className="bg-[#010501] border border-[#1f261e] rounded-lg px-4 py-3 min-h-[120px]">
                    <p className="text-white text-sm whitespace-pre-wrap">
                      {selectedBugReport.description}
                    </p>
                  </div>
                </div>

                {/* Screenshot */}
                {selectedBugReport.screenshot && (
                  <div className="mb-6">
                    <label className="text-sm text-[#b5b5b5] mb-2 block">Screenshot</label>
                    <div className="bg-[#010501] border border-[#1f261e] rounded-lg p-4">
                      <img
                        src={selectedBugReport.screenshot}
                        alt="Bug report screenshot"
                        className="max-w-full h-auto rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <p className="hidden text-[#7c7c7c] text-xs mt-2">
                        Failed to load screenshot. The file may be corrupted.
                      </p>
                    </div>
                  </div>
                )}

                {/* Log File */}
                {selectedBugReport.logFile && (
                  <div className="mb-6">
                    <label className="text-sm text-[#b5b5b5] mb-2 block">Log File</label>
                    <div className="bg-[#010501] border border-[#1f261e] rounded-lg p-4">
                      <button
                        onClick={() => handleDownloadLogFile(selectedBugReport.logFile!)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium text-sm"
                      >
                        <FiDownload className="w-4 h-4" />
                        Download Log File
                      </button>
                    </div>
                  </div>
                )}

                {/* Device Info */}
                {selectedBugReport.deviceInfo && (
                  <div className="mb-6">
                    <label className="text-sm text-[#b5b5b5] mb-2 block">Device Information</label>
                    <div className="bg-[#010501] border border-[#1f261e] rounded-lg p-4 space-y-2">
                      {selectedBugReport.deviceInfo.userAgent && (
                        <div>
                          <span className="text-xs text-[#7c7c7c]">User Agent:</span>
                          <p className="text-white text-sm break-all">{selectedBugReport.deviceInfo.userAgent}</p>
                        </div>
                      )}
                      {selectedBugReport.deviceInfo.platform && (
                        <div>
                          <span className="text-xs text-[#7c7c7c]">Platform:</span>
                          <p className="text-white text-sm">{selectedBugReport.deviceInfo.platform}</p>
                        </div>
                      )}
                      {selectedBugReport.deviceInfo.language && (
                        <div>
                          <span className="text-xs text-[#7c7c7c]">Language:</span>
                          <p className="text-white text-sm">{selectedBugReport.deviceInfo.language}</p>
                        </div>
                      )}
                      {selectedBugReport.deviceInfo.screenResolution && (
                        <div>
                          <span className="text-xs text-[#7c7c7c]">Screen Resolution:</span>
                          <p className="text-white text-sm">{selectedBugReport.deviceInfo.screenResolution}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Review Information */}
                {selectedBugReport.reviewedAt && (
                  <div className="mb-6">
                    <label className="text-sm text-[#b5b5b5] mb-2 block">Review Information</label>
                    <div className="bg-[#010501] border border-[#1f261e] rounded-lg p-4 space-y-2">
                      <div>
                        <span className="text-xs text-[#7c7c7c]">Reviewed At:</span>
                        <p className="text-white text-sm">
                          {new Date(selectedBugReport.reviewedAt).toLocaleString()}
                        </p>
                      </div>
                      {selectedBugReport.reviewedBy && (
                        <div>
                          <span className="text-xs text-[#7c7c7c]">Reviewed By:</span>
                          <p className="text-white text-sm">{selectedBugReport.reviewedBy}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Report ID */}
                <div className="mb-6">
                  <label className="text-sm text-[#b5b5b5] mb-2 block">Report ID</label>
                  <div className="bg-[#010501] border border-[#1f261e] rounded-lg px-4 py-3">
                    <span className="text-white font-mono text-xs break-all">
                      {selectedBugReport.id}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </AdminLayout>
  );
}



