"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import ManageFAQModal from "@/components/admin/manage-faq-modal";
import ManageTutorialModal from "@/components/admin/manage-tutorial-modal";
import {
  IoDocumentTextOutline,
  IoBookOutline,
  IoRadioOutline,
  IoAddOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoCloseCircleOutline,
  IoTrashOutline,
  IoCreateOutline,
} from "react-icons/io5";

interface LiveStatus {
  id: string;
  service: string;
  status: 'operational' | 'degraded' | 'down' | 'maintenance';
  updatedAt: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'General' | 'Transactions' | 'Chains' | 'Lending' | 'Staking' | 'Liquidity' | 'NFTs' | 'Referrals' | 'Security' | 'Troubleshooting';
  createdAt: string;
  updatedAt: string;
}

interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: 'Trading' | 'Liquidity' | 'Staking' | 'NFTs' | 'Social' | 'Security' | 'Getting Started' | 'Advanced';
  link: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export default function SupportHubPage() {
  const [activeTab, setActiveTab] = useState<"faq" | "tutorials" | "live-status">("faq");
  const [isFAQModalOpen, setIsFAQModalOpen] = useState(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);
  const [liveStatuses, setLiveStatuses] = useState<LiveStatus[]>([]);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoadingFAQs, setIsLoadingFAQs] = useState(false);
  const [selectedFAQ, setSelectedFAQ] = useState<FAQ | null>(null);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [isLoadingTutorials, setIsLoadingTutorials] = useState(false);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);

  // Fetch FAQs from API
  const fetchFAQs = useCallback(async () => {
    setIsLoadingFAQs(true);
    try {
      const response = await fetch("/api/v1/faqs");
      if (response.ok) {
        const data = await response.json();
        setFaqs(data.faqs || []);
      } else {
        console.error("Failed to fetch FAQs");
      }
    } catch (error) {
      console.error("Error fetching FAQs:", error);
    } finally {
      setIsLoadingFAQs(false);
    }
  }, []);

  // Fetch Tutorials from API
  const fetchTutorials = useCallback(async () => {
    setIsLoadingTutorials(true);
    try {
      const response = await fetch("/api/v1/tutorials");
      if (response.ok) {
        const data = await response.json();
        setTutorials(data.tutorials || []);
      } else {
        console.error("Failed to fetch tutorials");
      }
    } catch (error) {
      console.error("Error fetching tutorials:", error);
    } finally {
      setIsLoadingTutorials(false);
    }
  }, []);

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

  // Fetch FAQs when FAQ tab is active
  useEffect(() => {
    if (activeTab === "faq") {
      fetchFAQs();
    }
  }, [activeTab, fetchFAQs]);

  // Fetch Tutorials when tutorials tab is active
  useEffect(() => {
    if (activeTab === "tutorials") {
      fetchTutorials();
    }
  }, [activeTab, fetchTutorials]);

  // Fetch statuses when live-status tab is active
  useEffect(() => {
    if (activeTab === "live-status") {
      fetchLiveStatuses();
    }
  }, [activeTab, fetchLiveStatuses]);

  // Listen for FAQ updates
  useEffect(() => {
    const handleFAQUpdate = () => {
      if (activeTab === "faq") {
        fetchFAQs();
      }
    };

    window.addEventListener("faqUpdated", handleFAQUpdate);
    return () => {
      window.removeEventListener("faqUpdated", handleFAQUpdate);
    };
  }, [activeTab, fetchFAQs]);

  // Listen for Tutorial updates
  useEffect(() => {
    const handleTutorialUpdate = () => {
      if (activeTab === "tutorials") {
        fetchTutorials();
      }
    };

    window.addEventListener("tutorialUpdated", handleTutorialUpdate);
    return () => {
      window.removeEventListener("tutorialUpdated", handleTutorialUpdate);
    };
  }, [activeTab, fetchTutorials]);

  // Delete FAQ
  const handleDeleteFAQ = async (id: string) => {
    if (!confirm("Are you sure you want to delete this FAQ?")) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/faqs?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchFAQs();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete FAQ");
      }
    } catch (error) {
      console.error("Error deleting FAQ:", error);
      alert("Failed to delete FAQ. Please try again.");
    }
  };

  // Edit FAQ
  const handleEditFAQ = (faq: FAQ) => {
    setSelectedFAQ(faq);
    setIsFAQModalOpen(true);
  };

  // Add new FAQ
  const handleAddFAQ = () => {
    setSelectedFAQ(null);
    setIsFAQModalOpen(true);
  };

  // Delete Tutorial
  const handleDeleteTutorial = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tutorial?")) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/tutorials?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchTutorials();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete tutorial");
      }
    } catch (error) {
      console.error("Error deleting tutorial:", error);
      alert("Failed to delete tutorial. Please try again.");
    }
  };

  // Edit Tutorial
  const handleEditTutorial = (tutorial: Tutorial) => {
    setSelectedTutorial(tutorial);
    setIsTutorialModalOpen(true);
  };

  // Add new Tutorial
  const handleAddTutorial = () => {
    setSelectedTutorial(null);
    setIsTutorialModalOpen(true);
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
                onClick={handleAddFAQ}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium text-sm"
              >
                <IoAddOutline className="w-5 h-5" />
                <span>Add FAQ</span>
              </button>
            </div>

            {isLoadingFAQs ? (
              <div className="text-center py-12">
                <p className="text-[#b5b5b5]">Loading FAQs...</p>
              </div>
            ) : faqs.length === 0 ? (
              <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-6 text-center">
                <p className="text-[#b5b5b5] text-sm">
                  No FAQs found. Click "Add FAQ" to create one.
                </p>
              </div>
            ) : (
              <div className="bg-[#121712] border border-[#1f261e] rounded-xl overflow-hidden">
                <div className="divide-y divide-[#1f261e]">
                  {faqs.map((faq) => (
                    <div key={faq.id} className="p-4 lg:p-6 hover:bg-[#0b0f0a] transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-white font-medium text-sm lg:text-base">{faq.question}</h4>
                            <span className="px-2 py-0.5 bg-[#0b0f0a] border border-[#1f261e] rounded text-[#b5b5b5] text-xs">
                              {faq.category}
                            </span>
                          </div>
                          <p className="text-[#b5b5b5] text-xs lg:text-sm mb-2">{faq.answer}</p>
                          <span className="text-[#7c7c7c] text-xs">
                            Updated {new Date(faq.updatedAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditFAQ(faq)}
                            className="p-2 text-[#b1f128] hover:bg-[#1a1f1a] rounded-lg transition-colors"
                            title="Edit FAQ"
                          >
                            <IoCreateOutline className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFAQ(faq.id)}
                            className="p-2 text-[#ff5c5c] hover:bg-[#2a1a1a] rounded-lg transition-colors"
                            title="Delete FAQ"
                          >
                            <IoTrashOutline className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ManageFAQModal
              open={isFAQModalOpen}
              onOpenChange={(open) => {
                setIsFAQModalOpen(open);
                if (!open) {
                  setSelectedFAQ(null);
                }
              }}
              item={selectedFAQ}
            />
          </>
        )}

        {/* Tutorials Tab */}
        {activeTab === "tutorials" && (
          <>
            <div className="flex justify-between items-center mb-4 lg:mb-6">
              <h3 className="text-xl font-semibold text-white">Tutorials</h3>
              <button
                onClick={handleAddTutorial}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium text-sm"
              >
                <IoAddOutline className="w-5 h-5" />
                <span>Add Tutorial</span>
              </button>
            </div>

            {isLoadingTutorials ? (
              <div className="text-center py-12">
                <p className="text-[#b5b5b5]">Loading tutorials...</p>
              </div>
            ) : tutorials.length === 0 ? (
              <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-6 text-center">
                <p className="text-[#b5b5b5] text-sm">
                  No tutorials found. Click "Add Tutorial" to create one.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tutorials.map((tutorial) => (
                  <div
                    key={tutorial.id}
                    className="bg-[#121712] border border-[#1f261e] rounded-xl overflow-hidden hover:border-[#b1f128] transition-colors relative group"
                  >
                    {/* Thumbnail */}
                    {tutorial.thumbnailUrl ? (
                      <div className="w-full h-48 bg-[#0b0f0a] overflow-hidden">
                        <img
                          src={tutorial.thumbnailUrl}
                          alt={tutorial.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-[#0b0f0a] flex items-center justify-center">
                        <IoBookOutline className="w-12 h-12 text-[#1f261e]" />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="p-4 lg:p-6">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <h4 className="text-white font-medium text-sm lg:text-base mb-2">{tutorial.title}</h4>
                          <p className="text-[#b5b5b5] text-xs lg:text-sm mb-2 line-clamp-2">{tutorial.description}</p>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-[#0b0f0a] border border-[#1f261e] rounded text-[#7c7c7c] text-xs">
                              {tutorial.category}
                            </span>
                            {tutorial.link && (
                              <a
                                href={tutorial.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#b1f128] text-xs hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View →
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={() => handleEditTutorial(tutorial)}
                        className="p-2 bg-[#0b0f0a] bg-opacity-90 text-[#b1f128] hover:bg-[#1a1f1a] rounded-lg transition-colors"
                        title="Edit tutorial"
                      >
                        <IoCreateOutline className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTutorial(tutorial.id)}
                        className="p-2 bg-[#0b0f0a] bg-opacity-90 text-[#ff5c5c] hover:bg-[#2a1a1a] rounded-lg transition-colors"
                        title="Delete tutorial"
                      >
                        <IoTrashOutline className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ManageTutorialModal
              open={isTutorialModalOpen}
              onOpenChange={(open) => {
                setIsTutorialModalOpen(open);
                if (!open) {
                  setSelectedTutorial(null);
                }
              }}
              item={selectedTutorial}
            />
          </>
        )}

        {/* Live Status Tab */}
        {activeTab === "live-status" && (
          <>
            <div className="flex justify-between items-center mb-4 lg:mb-6">
              <h3 className="text-xl font-semibold text-white">Live Status Updates</h3>
            </div>

            {isLoadingStatuses ? (
              <div className="text-center py-12">
                <p className="text-[#b5b5b5]">Loading live statuses...</p>
              </div>
            ) : liveStatuses.length === 0 ? (
              <div className="bg-[#121712] border border-[#1f261e] rounded-xl p-6 text-center">
                <p className="text-[#b5b5b5] text-sm">
                  No live statuses found.
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
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </AdminLayout>
  );
}
