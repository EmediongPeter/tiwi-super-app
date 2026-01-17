"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWallet } from "@/lib/wallet/hooks/useWallet";
import { getWalletIconFromAccount, truncateAddress } from "@/lib/frontend/utils/wallet-display";
import { generateWalletId } from "@/lib/wallet/state/types";
import { useMultiWalletBalances } from "@/hooks/useMultiWalletBalances";
import Skeleton from "@/components/ui/skeleton";

interface AllWalletsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnectNewWallet?: () => void;
  onDisconnectWallet?: (walletId: string) => void;
}

export default function AllWalletsModal({
  open,
  onOpenChange,
  onConnectNewWallet,
  onDisconnectWallet,
}: AllWalletsModalProps) {
  const {
    connectedWallets,
    activeWalletId,
    setActiveWallet,
    removeWallet,
  } = useWallet();
  
  const { wallets: walletBalances, isLoading } = useMultiWalletBalances(connectedWallets);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleCopyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleSelectWallet = (walletId: string) => {
    setActiveWallet(walletId);
  };

  const handleDisconnect = async (walletId: string) => {
    await removeWallet(walletId);
    onDisconnectWallet?.(walletId);
    
    // If disconnected wallet was the only one, close modal
    if (connectedWallets.length <= 1) {
      onOpenChange(false);
    }
  };

  const formatCurrency = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return "$0.00";
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-[#0b0f0a] border border-[#1f261e] rounded-2xl sm:rounded-3xl p-0 max-w-[calc(100vw-2rem)] sm:max-w-[550px] w-full overflow-hidden max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 shrink-0 border-b border-[#1f261e]">
          <DialogTitle className="font-bold leading-normal text-2xl text-white m-0">
            All Wallets
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="cursor-pointer relative shrink-0 size-8 hover:opacity-80 transition-opacity"
            aria-label="Close modal"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </DialogHeader>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Connect New Wallet Button */}
          <button
            onClick={() => {
              onOpenChange(false);
              onConnectNewWallet?.();
            }}
            className="w-full bg-[#1f261e] hover:bg-[#2a3229] border border-[#1f261e] rounded-xl px-4 py-3 text-white font-semibold transition-colors"
          >
            Connect a new wallet
          </button>

          {/* Wallets List */}
          <div className="space-y-3">
            {isLoading && connectedWallets.length === 0 ? (
              // Loading skeleton
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-4 bg-[#121712] rounded-xl border border-[#1f261e]">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : walletBalances.length === 0 ? (
              // Empty state
              <div className="text-center py-12">
                <p className="text-white font-semibold text-sm mb-1">No wallets connected</p>
                <p className="text-[#7c7c7c] text-xs">Connect a wallet to get started</p>
              </div>
            ) : (
              // Wallets list
              walletBalances.map((walletData) => {
                const { wallet, balances, totalUSD, isLoading: walletLoading } = walletData;
                const walletId = generateWalletId(wallet);
                const isActive = activeWalletId === walletId;
                const walletIcon = getWalletIconFromAccount(wallet);
                const isCopied = copiedAddress === wallet.address;

                return (
                  <div
                    key={walletId}
                    className="bg-[#121712] border border-[#1f261e] rounded-xl p-4 hover:border-[#2a3229] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Wallet Icon */}
                      <div className="relative shrink-0">
                        {walletIcon ? (
                          <Image
                            src={walletIcon}
                            alt={wallet.provider}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full"
                            onError={(e) => {
                              e.currentTarget.src = '/assets/icons/wallet/wallet-04.svg';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[#1f261e] flex items-center justify-center">
                            <span className="text-white text-xs font-semibold">
                              {wallet.provider.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Wallet Info */}
                      <div className="flex-1 min-w-0">
                        {/* Address Row */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-white text-sm font-medium truncate">
                            {truncateAddress(wallet.address)}
                          </span>
                          <button
                            onClick={() => handleCopyAddress(wallet.address)}
                            className="shrink-0 p-1 hover:bg-[#1f261e] rounded transition-colors"
                            aria-label="Copy address"
                          >
                            {isCopied ? (
                              <Check className="w-4 h-4 text-[#b1f128]" />
                            ) : (
                              <Copy className="w-4 h-4 text-[#7c7c7c]" />
                            )}
                          </button>
                        </div>

                        {/* Balance */}
                        <div className="mb-2">
                          {walletLoading ? (
                            <Skeleton className="h-5 w-20" />
                          ) : (
                            <p className="text-white text-lg font-bold">
                              {formatCurrency(totalUSD)}
                            </p>
                          )}
                        </div>

                        {/* Chain Badge and Active Status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Chain Badge */}
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#1f261e] border border-[#2a3229] rounded-md">
                            {wallet.chain === 'solana' ? (
                              <>
                                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                <span className="text-xs text-white font-medium">Solana</span>
                              </>
                            ) : (
                              <>
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-xs text-white font-medium">EVM</span>
                              </>
                            )}
                          </span>

                          {/* Active Indicator */}
                          {isActive && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#b1f128]/20 border border-[#b1f128]/30 rounded-md">
                              <div className="w-2 h-2 rounded-full bg-[#b1f128]"></div>
                              <span className="text-xs text-[#b1f128] font-medium">Active</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        {!isActive && (
                          <button
                            onClick={() => handleSelectWallet(walletId)}
                            className="px-3 py-1.5 text-xs font-medium text-[#b1f128] hover:bg-[#b1f128]/10 rounded-lg transition-colors border border-[#b1f128]/20"
                          >
                            Select Wallet
                          </button>
                        )}
                        <button
                          onClick={() => handleDisconnect(walletId)}
                          className="px-3 py-1.5 text-xs font-medium text-[#7c7c7c] hover:text-white hover:bg-[#1f261e] rounded-lg transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

