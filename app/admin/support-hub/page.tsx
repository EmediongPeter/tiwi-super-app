"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import ManageFAQModal from "@/components/admin/manage-faq-modal";
import ManageTutorialModal from "@/components/admin/manage-tutorial-modal";
import ManageLiveStatusModal from "@/components/admin/manage-live-status-modal";
import {
  IoDocumentTextOutline,
  IoBookOutline,
  IoRadioOutline,
  IoAddOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoCloseCircleOutline,
  IoTrashOutline,
} from "react-icons/io5";

interface LiveStatus {
  id: string;
  service: string;
  status: 'operational' | 'degraded' | 'down' | 'maintenance';
  updatedAt: string;
}

export default function SupportHubPage() {
  const [activeTab, setActiveTab] = useState<"faq" | "tutorials" | "live-status">("faq");
  const [isFAQModalOpen, setIsFAQModalOpen] = useState(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);
  const [isLiveStatusModalOpen, setIsLiveStatusModalOpen] = useState(false);
  const [liveStatuses, setLiveStatuses] = useState<LiveStatus[]>([]);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);

  // Mock data
  const faqs = [
    { id: 1, question: "How do I connect my wallet?", answer: "Click on the wallet icon in the top right corner..." },
    { id: 2, question: "What chains are supported?", answer: "We support Ethereum, BSC, Polygon, and more..." },
    { id: 3, question: "How do I stake tokens?", answer: "Navigate to the Staking section and select a pool..." },
  ];

  const tutorials = [
    { id: 1, title: "Getting Started with TIWI", description: "Learn the basics of using TIWI Protocol" },
    { id: 2, title: "How to Swap Tokens", description: "Step-by-step guide to swapping tokens" },
    { id: 3, title: "Staking Guide", description: "Complete guide to staking your tokens" },
  ];

  // Fetch live statuses from API
  const fetchLiveStatuses = useCallback(async () => {
    setIsLoadingStatuses(true);
    try {
      const response = await fetch("/api/v1/live-status");
      if (response.ok) {
        const data = await response.json();
        setLiveStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error("Error fetching live statuses:", error);
    } finally {
      setIsLoadingStatuses(false);
    }
  }, []);

  // Fetch statuses when live-status tab is active
  useEffect(() => {
    if (activeTab === "live-status") {
      fetchLiveStatuses();
    }
  }, [activeTab, fetchLiveStatuses]);

  // Listen for live status updates
  useEffect(() => {
    const handleStatusUpdate = () => {
      if (activeTab === "live-status") {
        fetchLiveStatuses();
      }
    };

    window.addEventListener("liveStatusUpdated", handleStatusUpdate);
    return () => {
      window.removeEventListener("liveStatusUpdated", handleStatusUpdate);
    };
  }, [activeTab, fetchLiveStatuses]);

  // Delete live status
  const handleDeleteStatus = async (id: string) => {
    if (!confirm("Are you sure you want to delete this status?")) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/live-status?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchLiveStatuses();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete status");
      }
    } catch (error) {
      console.error("Error deleting live status:", error);
      alert("Failed to delete status. Please try again.");
    }
  };

  const getStatusColor = (status: LiveStatus['status']) => {
    switch (status) {
      case "operational":
        return "bg-[#4ade80] text-[#010501]";
      case "degraded":
      case "maintenance":
        return "bg-yellow-500 text-[#010501]";
      case "down":
        return "bg-[#ff5c5c] text-white";
      default:
        return "bg-[#7c7c7c] text-white";
    }
  };

  const getStatusIcon = (status: LiveStatus['status']) => {
    switch (status) {
      case "operational":
        return <IoCheckmarkCircleOutline className="w-4 h-4" />;
      case "degraded":
      case "maintenance":
        return <IoAlertCircleOutline className="w-4 h-4" />;
      case "down":
        return <IoCloseCircleOutline className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: LiveStatus['status']) => {
    switch (status) {
      case "operational":
        return "Operational";
      case "degraded":
        return "Degraded";
      case "down":
        return "Down";
      case "maintenance":
        return "Maintenance";
      default:
        return status;
    }
  };

  return (
    <AdminLayout activeNavItem="support-hub">
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <h2 className="text-2xl lg:text-3xl font-semibold text-white mb-2">
            Support Hub
          </h2>
          <p className="text-[#b5b5b5] text-xs lg:text-sm">
            Manage FAQs, tutorials, and live status updates for users.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 lg:mb-8 border-b border-[#1f261e]">
          <button
            onClick={() => setActiveTab("faq")}
            className={`pb-4 px-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === "faq"
                ? "text-[#b1f128] border-b-2 border-[#b1f128]"
                : "text-[#b5b5b5] hover:text-white"
            }`}
          >
            <IoDocumentTextOutline className="w-4 h-4" />
            FAQs
          </button>
          <button
            onClick={() => setActiveTab("tutorials")}
            className={`pb-4 px-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === "tutorials"
                ? "text-[#b1f128] border-b-2 border-[#b1f128]"
                : "text-[#b5b5b5] hover:text-white"
            }`}
          >
            <IoBookOutline className="w-4 h-4" />
            Tutorials
          </button>
          <button
            onClick={() => setActiveTab("live-status")}
            className={`pb-4 px-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === "live-status"
                ? "text-[#b1f128] border-b-2 border-[#b1f128]"
                : "text-[#b5b5b5] hover:text-white"
            }`}
          >
            <IoRadioOutline className="w-4 h-4" />
            Live Status
          </button>
        </div>

        {/* FAQ Tab */}
        {activeTab === "faq" && (
          <>
            <div className="flex justify-between items-center mb-4 lg:mb-6">
              <h3 className="text-xl font-semibold text-white">Frequently Asked Questions</h3>
              <button
                onClick={() => setIsFAQModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium text-sm"
              >
                <IoAddOutline className="w-5 h-5" />
                <span>Add FAQ</span>
              </button>
            </div>

            <div className="bg-[#121712] border border-[#1f261e] rounded-xl overflow-hidden">
              <div className="divide-y divide-[#1f261e]">
                {faqs.map((faq) => (
                  <div key={faq.id} className="p-4 lg:p-6 hover:bg-[#0b0f0a] transition-colors">
                    <h4 className="text-white font-medium text-sm lg:text-base mb-2">{faq.question}</h4>
                    <p className="text-[#b5b5b5] text-xs lg:text-sm">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>

            <ManageFAQModal
              open={isFAQModalOpen}
              onOpenChange={setIsFAQModalOpen}
            />
          </>
        )}

        {/* Tutorials Tab */}
        {activeTab === "tutorials" && (
          <>
            <div className="flex justify-between items-center mb-4 lg:mb-6">
              <h3 className="text-xl font-semibold text-white">Tutorials</h3>
              <button
                onClick={() => setIsTutorialModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium text-sm"
              >
                <IoAddOutline className="w-5 h-5" />
                <span>Add Tutorial</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tutorials.map((tutorial) => (
                <div
                  key={tutorial.id}
                  className="bg-[#121712] border border-[#1f261e] rounded-xl p-4 lg:p-6 hover:border-[#b1f128] transition-colors cursor-pointer"
                >
                  <h4 className="text-white font-medium text-sm lg:text-base mb-2">{tutorial.title}</h4>
                  <p className="text-[#b5b5b5] text-xs lg:text-sm">{tutorial.description}</p>
                </div>
              ))}
            </div>

            <ManageTutorialModal
              open={isTutorialModalOpen}
              onOpenChange={setIsTutorialModalOpen}
            />
          </>
        )}

        {/* Live Status Tab */}
        {activeTab === "live-status" && (
          <>
            <div className="flex justify-between items-center mb-4 lg:mb-6">
              <h3 className="text-xl font-semibold text-white">Live Status Updates</h3>
              <button
                onClick={() => setIsLiveStatusModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium text-sm"
              >
                <IoAddOutline className="w-5 h-5" />
                <span>Update Status</span>
              </button>
            </div>

            {isLoadingStatuses ? (
              <div className="text-center py-12">
                <p className="text-[#b5b5b5]">Loading live statuses...</p>
              </div>
            ) : liveStatuses.length === 0 ? (
              <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-6 text-center">
                <p className="text-[#b5b5b5] text-sm">
                  No live statuses found. Click "Update Status" to add one.
                </p>
              </div>
            ) : (
              <div className="bg-[#121712] border border-[#1f261e] rounded-xl overflow-hidden">
                <div className="divide-y divide-[#1f261e]">
                  {liveStatuses.map((status) => (
                    <div
                      key={status.id}
                      className="p-4 lg:p-6 hover:bg-[#0b0f0a] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex-1">
                            <h4 className="text-white font-medium text-sm lg:text-base mb-2">
                              {status.service}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${getStatusColor(
                                  status.status
                                )}`}
                              >
                                {getStatusIcon(status.status)}
                                {getStatusLabel(status.status)}
                              </span>
                              <span className="text-[#7c7c7c] text-xs">
                                Updated {new Date(status.updatedAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteStatus(status.id)}
                          className="p-2 text-[#ff5c5c] hover:bg-[#2a1a1a] rounded-lg transition-colors"
                          title="Delete status"
                        >
                          <IoTrashOutline className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ManageLiveStatusModal
              open={isLiveStatusModalOpen}
              onOpenChange={setIsLiveStatusModalOpen}
            />
          </>
        )}
      </main>
    </AdminLayout>
  );
}
