"use client";

import { Button } from "@/components/ui/button";
import { parseNumber } from "@/lib/shared/utils/number";

interface SwapActionButtonProps {
  activeTab: "swap" | "limit";
  isConnected: boolean;
  onSwapClick?: () => void;
  onConnectClick?: () => void;
  isExecutingTransfer?: boolean;
  transferStatus?: string;
  fromAmount?: string;
}

export default function SwapActionButton({
  activeTab,
  isConnected,
  onSwapClick,
  onConnectClick,
  isExecutingTransfer = false,
  transferStatus,
  fromAmount = "",
}: SwapActionButtonProps) {
  const isLimit = activeTab === "limit";
  const hasAmount = fromAmount && fromAmount.trim() !== "" && parseFloat(fromAmount) > 0;

  return (
    <div className="relative mt-3 sm:mt-4">
      {!isLimit && isConnected && (
        <Button
          onClick={onSwapClick}
          disabled={isExecutingTransfer || !hasAmount}
          className="w-full relative z-10 text-sm sm:text-base py-2.5 sm:py-3 lg:py-3"
        >
          {isExecutingTransfer 
            ? (transferStatus || "Processing...") 
            : hasAmount
            ? "Swap"
            : "Enter Amount"}
        </Button>
      )}
      {!isLimit && !isConnected && (
        <Button
          onClick={onConnectClick}
          className="w-full relative z-10 text-sm sm:text-base py-2.5 sm:py-3 lg:py-3"
        >
          Connect Wallet
        </Button>
      )}
      {isLimit && isConnected && (
        <Button
          onClick={onSwapClick}
          className="w-full relative z-10 text-sm sm:text-base py-2.5 sm:py-3 lg:py-3"
        >
          Place Limit Order
        </Button>
      )}
      {isLimit && !isConnected && (
        <Button
          onClick={onConnectClick}
          className="w-full relative z-10 text-sm sm:text-base py-2.5 sm:py-3 lg:py-3"
        >
          Connect Wallet
        </Button>
      )}
      {/* Gradient Glow Below Button */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-[#b1f128]/20 blur-[2px]"></div>
      <div className="absolute -bottom-1 left-0 right-0 h-px bg-[linear-gradient(to_right,transparent_0%,rgba(177,241,40,0.3)_50%,transparent_100%)]"></div>
      <div className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-1/2 h-[3px] bg-[#b1f128]/10 blur-sm"></div>
    </div>
  );
}

