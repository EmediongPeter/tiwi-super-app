"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet/hooks/useWallet";
import { getWalletIconFromAccount, truncateAddress, isAddressChainCompatible } from "@/lib/frontend/utils/wallet-display";

interface ToTokenWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnectNewWallet: () => void;
  onAddressSelect: (address: string) => void;
  chainId?: number;
  currentRecipientAddress?: string | null;
}

const RECENT_ADDRESSES_KEY = "tiwi_recent_recipient_addresses";
const MAX_RECENT_ADDRESSES = 5;

export default function ToTokenWalletModal({
  open,
  onOpenChange,
  onConnectNewWallet,
  onAddressSelect,
  chainId,
  currentRecipientAddress,
}: ToTokenWalletModalProps) {
  const { primaryWallet, secondaryWallet, secondaryAddress } = useWallet();
  const [manualAddress, setManualAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);
  const [showPasteInput, setShowPasteInput] = useState(false);

  // Load recent addresses from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(RECENT_ADDRESSES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as string[];
          setRecentAddresses(parsed.filter((addr) => addr && addr.trim() !== ""));
        }
      } catch (error) {
        console.error("[ToTokenWalletModal] Error loading recent addresses:", error);
      }
    }
  }, []);

  // Get available wallets (primary + secondary if exists)
  const availableWallets = [
    primaryWallet,
    secondaryWallet,
  ].filter((w): w is NonNull<typeof w> => w !== null);

  // Validate address format
  const isValidAddress = (address: string): boolean => {
    if (!address || !address.trim()) return false;
    const trimmed = address.trim();

    // EVM: 0x + 40 hex chars
    if (trimmed.startsWith("0x") && trimmed.length === 42) {
      return true;
    }

    // Solana: base58, 32-44 chars, no 0x
    if (!trimmed.startsWith("0x") && trimmed.length >= 32 && trimmed.length <= 44) {
      return true;
    }

    return false;
  };

  // Validate address against chain
  const validateAddressForChain = (address: string): boolean => {
    if (!chainId) return isValidAddress(address);
    return isValidAddress(address) && isAddressChainCompatible(address, chainId);
  };

  const handleAddressInput = (value: string) => {
    setManualAddress(value);
    setAddressError(null);

    if (value.trim() && !isValidAddress(value.trim())) {
      setAddressError(
        chainId === 7565164
          ? "Invalid Solana address (32-44 characters)"
          : "Invalid EVM address (0x followed by 40 hex characters)"
      );
    } else if (value.trim() && chainId && !isAddressChainCompatible(value.trim(), chainId)) {
      setAddressError("Address is not compatible with the selected token's chain");
    }
  };

  const handlePasteAddress = () => {
    const trimmed = manualAddress.trim();
    if (!trimmed) {
      setAddressError("Please enter an address");
      return;
    }

    if (!validateAddressForChain(trimmed)) {
      if (!isValidAddress(trimmed)) {
        setAddressError(
          chainId === 7565164
            ? "Invalid Solana address format"
            : "Invalid EVM address format"
        );
      } else {
        setAddressError("Address is not compatible with the selected token's chain");
      }
      return;
    }

    // Save to recent addresses
    saveRecentAddress(trimmed);

    // Select the address
    onAddressSelect(trimmed);
    setManualAddress("");
    setShowPasteInput(false);
    setAddressError(null);
    onOpenChange(false);
  };

  const saveRecentAddress = (address: string) => {
    if (typeof window === "undefined") return;

    try {
      const trimmed = address.trim().toLowerCase();
      const current = recentAddresses.map((a) => a.toLowerCase());
      const filtered = current.filter((a) => a !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_ADDRESSES);
      setRecentAddresses(updated);
      localStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("[ToTokenWalletModal] Error saving recent address:", error);
    }
  };

  const handleRecentAddressSelect = (address: string) => {
    if (validateAddressForChain(address)) {
      onAddressSelect(address);
      onOpenChange(false);
    } else {
      setAddressError("This address is not compatible with the selected token's chain");
    }
  };

  const handleWalletSelect = (wallet: NonNull<typeof primaryWallet>) => {
    if (chainId && !isAddressChainCompatible(wallet.address, chainId)) {
      setAddressError("This wallet is not compatible with the selected token's chain");
      return;
    }
    saveRecentAddress(wallet.address);
    onAddressSelect(wallet.address);
    onOpenChange(false);
  };

  const handleConnectNew = () => {
    onOpenChange(false);
    onConnectNewWallet();
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setManualAddress("");
      setAddressError(null);
      setShowPasteInput(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-[#0b0f0a] border border-[#1f261e] rounded-2xl sm:rounded-3xl p-0 max-w-[calc(100vw-2rem)] sm:max-w-[480px] w-full overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0 w-full border-b border-[#1f261e]">
          <DialogTitle className="font-bold leading-normal relative shrink-0 text-xl sm:text-2xl text-left text-white m-0">
            To Address
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
        <div className="flex flex-col px-6 py-6 gap-4 max-h-[70vh] overflow-y-auto wallet-modal-scrollbar">
          {/* Available Wallets Section */}
          {availableWallets.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-[#b5b5b5] uppercase tracking-wider">
                Your Wallets
              </h3>
              <div className="flex flex-col gap-2">
                {availableWallets.map((wallet) => {
                  const walletIcon = getWalletIconFromAccount(wallet);
                  const isSelected = currentRecipientAddress?.toLowerCase() === wallet.address.toLowerCase();

                  return (
                    <button
                      key={`${wallet.provider}-${wallet.address}`}
                      type="button"
                      onClick={() => handleWalletSelect(wallet)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                        isSelected
                          ? "bg-[#121712] border-2 border-[#b1f128]"
                          : "bg-[#0b0f0a] border border-[#1f261e] hover:bg-[#121712]"
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

                      {/* Selected Indicator */}
                      {isSelected && (
                        <div className="shrink-0">
                          <div className="w-2 h-2 rounded-full bg-[#b1f128]"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Paste Address Section */}
          <div className="flex flex-col gap-3">
            {!showPasteInput ? (
              <Button
                onClick={() => setShowPasteInput(true)}
                className="w-full bg-[#121712] hover:bg-[#1f261e] text-white border border-[#1f261e] py-3.5 text-base font-semibold transition-all duration-200"
              >
                <div className="flex items-center justify-center gap-2">
                  <Image
                    src="/assets/icons/wallet/wallet-04.svg"
                    alt="Paste"
                    width={20}
                    height={20}
                    className="w-5 h-5"
                  />
                  <span>Paste wallet address</span>
                </div>
              </Button>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-[#b5b5b5]">
                    Address or ENS
                  </label>
                  <Input
                    type="text"
                    value={manualAddress}
                    onChange={(e) => handleAddressInput(e.target.value)}
                    placeholder="0x... or ENS name"
                    className={`bg-[#0b0f0a] border ${
                      addressError ? "border-red-500" : "border-[#1f261e]"
                    } text-white placeholder-[#7c7c7c] focus:border-[#b1f128] focus:ring-1 focus:ring-[#b1f128] rounded-xl px-4 py-3 text-sm`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !addressError && manualAddress.trim()) {
                        handlePasteAddress();
                      }
                    }}
                  />
                  {addressError && (
                    <p className="text-xs text-red-400 font-medium">{addressError}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handlePasteAddress}
                    disabled={!!addressError || !manualAddress.trim()}
                    className="flex-1 bg-[#b1f128] hover:bg-[#9dd81f] text-[#010501] font-semibold py-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Save
                  </Button>
                  <Button
                    onClick={() => {
                      setShowPasteInput(false);
                      setManualAddress("");
                      setAddressError(null);
                    }}
                    className="px-4 bg-[#121712] hover:bg-[#1f261e] text-white border border-[#1f261e] font-semibold py-2.5 transition-all"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Recent Addresses Section */}
          {recentAddresses.length > 0 && (
            <div className="flex flex-col gap-3 pt-2 border-t border-[#1f261e]">
              <h3 className="text-sm font-semibold text-[#b5b5b5] uppercase tracking-wider">
                Recent addresses
              </h3>
              <div className="flex flex-col gap-2">
                {recentAddresses.map((address, index) => {
                  const isSelected = currentRecipientAddress?.toLowerCase() === address.toLowerCase();
                  const isValid = validateAddressForChain(address);

                  return (
                    <button
                      key={`recent-${index}-${address}`}
                      type="button"
                      onClick={() => handleRecentAddressSelect(address)}
                      disabled={!isValid}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        isSelected
                          ? "bg-[#121712] border-2 border-[#b1f128]"
                          : isValid
                          ? "bg-[#0b0f0a] border border-[#1f261e] hover:bg-[#121712]"
                          : "bg-[#0b0f0a] border border-[#1f261e] opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-full bg-[#121712] border border-[#1f261e] flex items-center justify-center shrink-0">
                        <Image
                          src="/assets/icons/wallet/wallet-04.svg"
                          alt="Address"
                          width={20}
                          height={20}
                          className="w-5 h-5 opacity-60"
                        />
                      </div>

                      {/* Address */}
                      <div className="flex flex-col items-start flex-1 min-w-0">
                        <span className="text-white font-medium text-sm truncate w-full">
                          {truncateAddress(address)}
                        </span>
                        {!isValid && chainId && (
                          <span className="text-xs text-[#7c7c7c]">
                            Incompatible with current chain
                          </span>
                        )}
                      </div>

                      {/* Selected Indicator */}
                      {isSelected && (
                        <div className="shrink-0">
                          <div className="w-2 h-2 rounded-full bg-[#b1f128]"></div>
                        </div>
                      )}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper type for non-null
type NonNull<T> = T extends null | undefined ? never : T;

