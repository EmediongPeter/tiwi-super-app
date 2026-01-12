"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface PoolSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chainName?: string;
}

export default function PoolSuccessModal({
  open,
  onOpenChange,
  chainName = "Ethereum",
}: PoolSuccessModalProps) {
  const router = useRouter();

  const handleViewPool = () => {
    onOpenChange(false);
    // Navigate to pools list or specific pool
    router.push("/admin/staking-pools");
  };

  const handleSharePool = () => {
    // Share functionality - could copy link to clipboard or open share dialog
    onOpenChange(false);
    // For now, just navigate to pools
    router.push("/admin/staking-pools");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#121712] border-[#1f261e] text-white max-w-md"
        showCloseButton={false}
      >
        <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
          {/* Success Icon - Large green circle with checkmark */}
          <div className="w-20 h-20 rounded-full bg-[#b1f128] flex items-center justify-center mb-6">
            <svg
              className="w-12 h-12 text-[#010501]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          
          {/* Success Message */}
          <h3 className="text-2xl font-semibold text-white mb-4">
            Pool Created Successfully!
          </h3>
          
          {/* Description */}
          <p className="text-[#b5b5b5] text-sm mb-6">
            You can now share your staking pool for {chainName} on your app or share it to other dApps/staking platforms.
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handleSharePool}
              className="w-full px-6 py-3 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium"
            >
              Share My Pool
            </button>
            <button
              onClick={handleViewPool}
              className="w-full px-6 py-3 bg-transparent border border-[#1f261e] text-white rounded-lg hover:border-[#b1f128] hover:text-[#b1f128] transition-colors font-medium"
            >
              View My Pool
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
