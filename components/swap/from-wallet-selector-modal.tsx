"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConnectedWalletItem {
  id: string;
  address: string;
  icon: string;
  label?: string;
}

interface FromWalletSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: ConnectedWalletItem[];
  activeWalletId?: string;
  onSelectWallet?: (id: string) => void;
  onConnectNewWallet?: () => void;
}

export default function FromWalletSelectorModal({
  open,
  onOpenChange,
  wallets,
  activeWalletId,
  onSelectWallet,
  onConnectNewWallet,
}: FromWalletSelectorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="bg-[#0b0f0a] border border-[#1f261e] rounded-2xl sm:rounded-3xl p-0 max-w-[calc(100vw-2rem)] sm:max-w-[420px] w-full overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#1f261e]">
          <DialogTitle className="text-white text-lg sm:text-xl font-semibold">
            Select wallet
          </DialogTitle>
        </div>

        {/* Content */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {wallets.length === 0 && (
              <p className="text-[#7c7c7c] text-sm">
                You don&apos;t have any wallets connected yet.
              </p>
            )}

            {wallets.map((wallet) => {
              const isActive = wallet.id === activeWalletId;
              return (
                <button
                  key={wallet.id}
                  type="button"
                  onClick={() => onSelectWallet?.(wallet.id)}
                  className={`flex items-center justify-between w-full px-3.5 py-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    isActive
                      ? "border-[#b1f128] bg-[#121712]"
                      : "border-[#1f261e] bg-[#0b0f0a] hover:bg-[#121712]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full overflow-hidden bg-[#121712] flex items-center justify-center">
                      <Image
                        src={wallet.icon}
                        alt="Wallet"
                        width={28}
                        height={28}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">
                        {wallet.label || "Connected wallet"}
                      </span>
                      <span className="text-xs text-[#b5b5b5]">
                        {wallet.address}
                      </span>
                    </div>
                  </div>
                  {isActive && (
                    <span className="text-xs font-medium text-[#b1f128]">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#1f261e] pt-4 flex flex-col gap-2">
            <Button
              onClick={onConnectNewWallet}
              className="w-full text-sm sm:text-base py-2.5 sm:py-3"
            >
              Connect a new wallet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


