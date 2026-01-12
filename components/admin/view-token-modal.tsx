"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ViewTokenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: {
    id: string;
    symbol: string;
    rank: number;
    change24h: string;
    changeType: string;
    volume24h: string;
    icon?: string;
    startDate?: string;
    endDate?: string;
  } | null;
}

export default function ViewTokenModal({
  open,
  onOpenChange,
  token,
}: ViewTokenModalProps) {
  // Get today's date in YYYY-MM-DD format for date input
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  if (!token || !open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#121712] border-[#1f261e] text-white max-w-2xl max-h-[90vh] overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between mb-6">
          <DialogTitle className="text-xl font-semibold text-white">
            View Token Spotlight
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="text-[#b1f128] hover:text-[#9dd81f] transition-colors"
          >
            Close
          </button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Select Token - Read Only */}
          <div>
            <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
              Token
            </label>
            <div className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white flex items-center gap-3 opacity-75">
              {token.icon ? (
                <img
                  src={token.icon}
                  alt={token.symbol}
                  className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector(".fallback-icon")) {
                      const fallback = document.createElement("div");
                      fallback.className = "fallback-icon w-8 h-8 bg-[#b1f128] rounded-full flex items-center justify-center text-[#010501] font-semibold text-xs";
                      fallback.textContent = token.symbol;
                      parent.appendChild(fallback);
                    }
                  }}
                />
              ) : (
                <div className="w-8 h-8 bg-[#b1f128] rounded-full flex items-center justify-center text-[#010501] font-semibold text-xs">
                  {token.symbol}
                </div>
              )}
              <div className="text-left">
                <div className="text-white font-medium text-sm">
                  {token.symbol}
                </div>
              </div>
            </div>
          </div>

          {/* Rank Input - Read Only */}
          <div>
            <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
              Rank
            </label>
            <input
              type="number"
              value={token.rank}
              readOnly
              disabled
              className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white placeholder-[#7c7c7c] opacity-75 cursor-not-allowed"
            />
            <p className="text-[#7c7c7c] text-xs mt-1">
              Lower numbers indicate higher priority. Rank will be considered within the date range.
            </p>
          </div>

          {/* Date Pickers - Two Columns - Read Only */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={token.startDate || getTodayDate()}
                readOnly
                disabled
                className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white placeholder-[#7c7c7c] opacity-75 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                End Date
              </label>
              <input
                type="date"
                value={token.endDate || getTodayDate()}
                readOnly
                disabled
                className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white placeholder-[#7c7c7c] opacity-75 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Info Message */}
          <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg p-4">
            <p className="text-[#b5b5b5] text-sm">
              <span className="font-medium text-white">Note:</span> The token will be ranked based on the specified rank number within the selected date range. Tokens with lower rank numbers will appear first. If multiple tokens have overlapping date ranges, they will be ordered by rank.
            </p>
          </div>

          {/* Additional Token Info */}
          <div className="pt-4 border-t border-[#1f261e]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg p-4">
                <p className="text-[#b5b5b5] text-sm mb-1">24h Change</p>
                <p
                  className={`font-semibold text-lg ${
                    token.changeType === "positive"
                      ? "text-[#4ade80]"
                      : "text-[#ff5c5c]"
                  }`}
                >
                  {token.change24h}
                </p>
              </div>
              <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-lg p-4">
                <p className="text-[#b5b5b5] text-sm mb-1">24h Volume</p>
                <p className="text-white font-semibold text-lg">{token.volume24h}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

