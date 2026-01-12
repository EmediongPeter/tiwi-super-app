"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IoChevronDownOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoCloseCircleOutline,
} from "react-icons/io5";

interface ManageLiveStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
}

const statusOptions = [
  { label: "Operational", value: "operational", color: "green" },
  { label: "Degraded", value: "degraded", color: "yellow" },
  { label: "Down", value: "down", color: "red" },
  { label: "Maintenance", value: "maintenance", color: "yellow" },
];

const services = [
  "Swap",
  "Liquidity",
  "Bridge",
  "Governance",
  "Nodes",
  "Staking",
  "NFT",
  "Referrals",
];

export default function ManageLiveStatusModal({
  open,
  onOpenChange,
  item,
}: ManageLiveStatusModalProps) {
  const [service, setService] = useState("");
  const [status, setStatus] = useState("operational");
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const serviceRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      if (item) {
        setService(item.service || "");
        setStatus(item.status || "operational");
      } else {
        setService("");
        setStatus("operational");
      }
    } else {
      // Reset when modal closes
      setService("");
      setStatus("operational");
      setShowServiceDropdown(false);
      setShowStatusDropdown(false);
    }
  }, [item, open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (serviceRef.current && !serviceRef.current.contains(event.target as Node)) {
        setShowServiceDropdown(false);
      }
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getStatusColor = (color: string) => {
    switch (color) {
      case "green":
        return "bg-[#4ade80] text-[#010501]";
      case "yellow":
        return "bg-yellow-500 text-[#010501]";
      case "red":
        return "bg-[#ff5c5c] text-white";
      default:
        return "bg-[#7c7c7c] text-white";
    }
  };

  const getStatusIcon = (color: string) => {
    switch (color) {
      case "green":
        return <IoCheckmarkCircleOutline className="w-5 h-5" />;
      case "yellow":
        return <IoAlertCircleOutline className="w-5 h-5" />;
      case "red":
        return <IoCloseCircleOutline className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const selectedStatusOption = statusOptions.find((opt) => opt.value === status);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!service) {
      alert("Please select a service");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/live-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service,
          status,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Reset form
        setService("");
        setStatus("operational");
        onOpenChange(false);
        // Trigger refresh in parent component
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("liveStatusUpdated"));
        }
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update live status");
      }
    } catch (error) {
      console.error("Error updating live status:", error);
      alert("Failed to update live status. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#121712] border-[#1f261e] text-white max-w-2xl max-h-[90vh] overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between mb-6">
          <DialogTitle className="text-xl font-semibold text-white">
            {item ? "Edit" : "Add"} Live Status
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="text-[#b1f128] hover:text-[#9dd81f] transition-colors"
          >
            X Cancel
          </button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Service Dropdown */}
          <div className="relative" ref={serviceRef}>
            <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
              Service
            </label>
            <button
              onClick={() => {
                setShowServiceDropdown(!showServiceDropdown);
                setShowStatusDropdown(false);
              }}
              className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white flex items-center justify-between hover:border-[#b1f128] transition-colors"
            >
              <span>{service || "Select service"}</span>
              <IoChevronDownOutline className="w-5 h-5 text-[#b5b5b5]" />
            </button>
            {showServiceDropdown && (
              <div className="absolute z-10 w-full mt-2 bg-[#0b0f0a] border border-[#1f261e] rounded-lg shadow-lg p-2">
                <div className="flex flex-wrap gap-2">
                  {services.map((svc) => (
                    <button
                      key={svc}
                      onClick={() => {
                        setService(svc);
                        setShowServiceDropdown(false);
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        service === svc
                          ? "bg-[#b1f128] text-[#010501]"
                          : "bg-[#121712] border border-[#1f261e] text-[#b5b5b5] hover:bg-[#1a1f1a] hover:text-white"
                      }`}
                    >
                      {svc}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="relative" ref={statusRef}>
            <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
              Status
            </label>
            <button
              onClick={() => {
                setShowStatusDropdown(!showStatusDropdown);
                setShowServiceDropdown(false);
              }}
              className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white flex items-center justify-between hover:border-[#b1f128] transition-colors"
            >
              {selectedStatusOption && (
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${getStatusColor(
                      selectedStatusOption.color
                    )}`}
                  >
                    {getStatusIcon(selectedStatusOption.color)}
                    {selectedStatusOption.label}
                  </span>
                </div>
              )}
              <IoChevronDownOutline className="w-5 h-5 text-[#b5b5b5]" />
            </button>
            {showStatusDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-[#0b0f0a] border border-[#1f261e] rounded-lg shadow-lg">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setStatus(option.value);
                      setShowStatusDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#121712] transition-colors text-left"
                  >
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${getStatusColor(
                        option.color
                      )}`}
                    >
                      {getStatusIcon(option.color)}
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-[#1f261e]">
            <button
              onClick={handleSubmit}
              disabled={!service || isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isSubmitting ? "Updating..." : item ? "Update" : "Add"} Status</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

