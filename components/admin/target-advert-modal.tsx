"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TargetAdvertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTarget?: (targets: string[]) => void;
}

const targetingOptions = [
  { id: "all-users", label: "All Users", description: "Target all platform users" },
  { id: "by-network", label: "By Network", description: "Target users on specific networks" },
  { id: "by-activity-stakers", label: "Stakers", description: "Target users who have staked tokens" },
  { id: "by-activity-lps", label: "Liquidity Providers", description: "Target users who provide liquidity" },
  { id: "by-activity-dao", label: "DAO Voters", description: "Target users who participate in governance" },
];

export default function TargetAdvertModal({
  open,
  onOpenChange,
  onTarget,
}: TargetAdvertModalProps) {
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const handleToggleTarget = (targetId: string) => {
    setSelectedTargets((prev) =>
      prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId]
    );
  };

  const handleApply = () => {
    if (onTarget) {
      onTarget(selectedTargets);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#121712] border-[#1f261e] text-white w-fit max-w-[90vw] sm:max-w-[500px]"
        showCloseButton={false}
      >
        <div className="p-6">
          <DialogHeader className="flex flex-row items-center justify-between mb-6">
            <DialogTitle className="text-xl font-semibold text-white">
              Target Audience
            </DialogTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="text-[#b1f128] hover:text-[#9dd81f] transition-colors font-medium"
            >
              Close
            </button>
          </DialogHeader>

          <div className="space-y-3 mb-6">
            {targetingOptions.map((option) => (
              <div
                key={option.id}
                onClick={() => handleToggleTarget(option.id)}
                className="flex items-start gap-3 p-4 bg-[#0b0f0a] border border-[#1f261e] rounded-lg cursor-pointer hover:border-[#b1f128] transition-colors"
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedTargets.includes(option.id)
                      ? "bg-[#b1f128] border-[#b1f128]"
                      : "border-[#1f261e] bg-[#0b0f0a]"
                  }`}
                >
                  {selectedTargets.includes(option.id) && (
                    <svg
                      className="w-3 h-3 text-[#010501]"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium text-sm mb-1">
                    {option.label}
                  </div>
                  <div className="text-[#b5b5b5] text-xs">
                    {option.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 px-6 py-2.5 bg-[#121712] border border-[#1f261e] text-[#b5b5b5] rounded-lg hover:bg-[#1a1f1a] hover:text-white transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-6 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium"
            >
              Apply Targeting
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
