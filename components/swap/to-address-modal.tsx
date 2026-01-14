"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { truncateAddress } from "@/lib/frontend/utils/wallet-display";

interface ToAddressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (address: string) => void;
  chainLabel?: string;
}

const RECENT_KEY = "tiwi_recent_recipient_addresses";

export default function ToAddressModal({
  open,
  onOpenChange,
  onSave,
  chainLabel,
}: ToAddressModalProps) {
  const [value, setValue] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  // Load recent addresses from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecent(parsed.slice(0, 5));
        }
      }
    } catch {
      // ignore
    }
  }, [open]);

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // Persist to recent list
    try {
      const next = [trimmed, ...recent.filter((a) => a !== trimmed)].slice(0, 5);
      setRecent(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      }
    } catch {
      // ignore storage errors
    }

    onSave?.(trimmed);
    setValue("");
    onOpenChange(false);
  };

  const hasValue = value.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="bg-[#0b0f0a] border border-[#1f261e] rounded-2xl sm:rounded-3xl p-0 max-w-[calc(100vw-2rem)] sm:max-w-[420px] w-full overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#1f261e]">
          <DialogTitle className="text-white text-lg sm:text-xl font-semibold">
            To Address
          </DialogTitle>
        </div>

        {/* Content */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs sm:text-sm text-[#b5b5b5]">
              Address{chainLabel ? ` on ${chainLabel}` : ""}
            </label>
            <Input
              placeholder="Address or ENS"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="bg-[#010501] border-[#1f261e] text-sm sm:text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs sm:text-sm text-[#7c7c7c]">
              Recent addresses
            </p>
            {recent.length === 0 ? (
              <p className="text-xs text-[#4f4f4f]">
                No recent addresses yet. Paste an address to save it here.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recent.map((addr) => (
                  <button
                    key={addr}
                    type="button"
                    onClick={() => setValue(addr)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-[#1f261e] bg-[#010501] hover:border-[#b1f128] hover:bg-[#121712] text-xs text-[#b5b5b5] cursor-pointer"
                  >
                    <span>{truncateAddress(addr)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={!hasValue}
              className="w-full text-sm sm:text-base py-2.5 sm:py-3 disabled:opacity-60"
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


