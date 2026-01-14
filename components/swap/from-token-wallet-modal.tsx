"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useWallet } from "@/lib/wallet/hooks/useWallet";
import { getWalletIconFromAccount, truncateAddress } from "@/lib/frontend/utils/wallet-display";
import { Button } from "@/components/ui/button";

interface FromTokenWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnectNewWallet: () => void;
  onSelectWallet?: (address: string) => void;
}

export default function FromTokenWalletModal({
  open,
  onOpenChange,
  onConnectNewWallet,
  onSelectWallet,
}: FromTokenWalletModalProps) {
  const { primaryWallet } = useWallet();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // For now, we only have primary wallet, but this structure supports multiple wallets
  const connectedWallets = primaryWallet ? [primaryWallet] : [];

  const handleWalletSelect = (wallet: typeof primaryWallet) => {
    if (wallet && onSelectWallet) {
      onSelectWallet(wallet.address);
    }
    onOpenChange(false);
  };

  const handleConnectNew = () => {
    onOpenChange(false);
    onConnectNewWallet();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-[#0b0f0a] border border-[#1f261e] rounded-2xl sm:rounded-3xl p-0 max-w-[calc(100vw-2rem)] sm:max-w-[480px] w-full overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0 w-full border-b border-[#1f261e]">
          <DialogTitle className="font-bold leading-normal relative shrink-0 text-xl sm:text-2xl text-left text-white m-0">
            Select Wallet
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="cursor-pointer relative shrink-0 size-8 hover:opacity-80 transition-opacity"
            aria-label="Close modal"
          >
            <Image
              src="/assets/icons/cancel-circle.svg"
              alt="Close"
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col px-6 py-6 gap-4 max-h-[60vh] overflow-y-auto wallet-modal-scrollbar">
          {/* Connected Wallets Section */}
          {connectedWallets.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-[#b5b5b5] uppercase tracking-wider">
                Connected Wallets
              </h3>
              <div className="flex flex-col gap-2">
                {connectedWallets.map((wallet, index) => {
                  if (!wallet) return null;
                  const walletIcon = getWalletIconFromAccount(wallet);
                  const isHovered = hoveredIndex === index;

                  return (
                    <button
                      key={`${wallet.provider}-${wallet.address}`}
                      type="button"
                      onClick={() => handleWalletSelect(wallet)}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                        isHovered
                          ? "bg-[#121712] border border-[#1f261e] shadow-lg"
                          : "bg-[#0b0f0a] border border-[#1f261e]"
                      }`}
                    >
                      {/* Wallet Icon */}
                      <div className="relative shrink-0">
                        {walletIcon ? (
                          <Image
                            src={walletIcon}
                            alt="Wallet"
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#121712] border border-[#1f261e] flex items-center justify-center">
                            <Image
                              src="/assets/icons/wallet/wallet-04.svg"
                              alt="Wallet"
                              width={24}
                              height={24}
                              className="w-6 h-6 opacity-60"
                            />
                          </div>
                        )}
                      </div>

                      {/* Wallet Info */}
                      <div className="flex flex-col items-start flex-1 min-w-0">
                        <span className="text-white font-semibold text-sm sm:text-base truncate w-full">
                          {wallet.provider.charAt(0).toUpperCase() + wallet.provider.slice(1)}
                        </span>
                        <span className="text-[#7c7c7c] font-medium text-xs sm:text-sm truncate w-full">
                          {truncateAddress(wallet.address)}
                        </span>
                      </div>

                      {/* Active Indicator */}
                      <div className="shrink-0">
                        <div className="w-2 h-2 rounded-full bg-[#b1f128]"></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Connect New Wallet Button */}
          <div className="pt-2">
            <Button
              onClick={handleConnectNew}
              className="w-full bg-[#121712] hover:bg-[#1f261e] text-white border border-[#1f261e] py-3.5 text-base font-semibold transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-2">
                <Image
                  src="/assets/icons/wallet/wallet-04.svg"
                  alt="Connect"
                  width={20}
                  height={20}
                  className="w-5 h-5"
                />
                <span>Connect a new wallet</span>
              </div>
            </Button>
          </div>

          {/* Empty State */}
          {connectedWallets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-[#121712] border border-[#1f261e] flex items-center justify-center">
                <Image
                  src="/assets/icons/wallet/wallet-04.svg"
                  alt="No wallets"
                  width={32}
                  height={32}
                  className="w-8 h-8 opacity-40"
                />
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-white font-semibold text-base">No wallets connected</p>
                <p className="text-[#7c7c7c] text-sm text-center max-w-[280px]">
                  Connect a wallet to start swapping tokens
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

