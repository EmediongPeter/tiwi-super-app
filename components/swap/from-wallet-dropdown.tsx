"use client";

import Image from "next/image";
import { useWallet } from "@/lib/wallet/hooks/useWallet";
import { getWalletIconFromAccount, truncateAddress } from "@/lib/frontend/utils/wallet-display";
import WalletDropdown from "./wallet-dropdown";

interface FromWalletDropdownProps {
  open: boolean;
  onClose: () => void;
  onConnectNewWallet: () => void;
  onSelectWallet?: (address: string) => void;
  currentAddress?: string | null;
}

export default function FromWalletDropdown({
  open,
  onClose,
  onConnectNewWallet,
  onSelectWallet,
  currentAddress,
}: FromWalletDropdownProps) {
  const { primaryWallet } = useWallet();

  // For now, we only have primary wallet, but this structure supports multiple wallets
  const connectedWallets = primaryWallet ? [primaryWallet] : [];

  const handleWalletSelect = (wallet: typeof primaryWallet) => {
    if (wallet && onSelectWallet) {
      onSelectWallet(wallet.address);
    }
    onClose();
  };

  const handleConnectNew = () => {
    onClose();
    onConnectNewWallet();
  };

  return (
    <WalletDropdown open={open} onClose={onClose} className="top-full mt-1.5">
      <div className="py-2">
        {/* Connected Wallets Section */}
        {connectedWallets.length > 0 && (
          <div className="px-2">
            {connectedWallets.map((wallet) => {
              if (!wallet) return null;
              const walletIcon = getWalletIconFromAccount(wallet);
              const isActive = currentAddress?.toLowerCase() === wallet.address.toLowerCase();

              return (
                <button
                  key={`${wallet.provider}-${wallet.address}`}
                  type="button"
                  onClick={() => handleWalletSelect(wallet)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm transition-colors ${
                    isActive
                      ? "bg-[#121712]"
                      : "hover:bg-[#121712]"
                  }`}
                >
                  {/* Wallet Icon - Small */}
                  {walletIcon && (
                    <Image
                      src={walletIcon}
                      alt="Wallet"
                      width={20}
                      height={20}
                      className="w-5 h-5 rounded-full shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  
                  {/* Truncated Address - Inline */}
                  <span className="text-white text-xs font-medium truncate flex-1 text-left">
                    {truncateAddress(wallet.address)}
                  </span>

                  {/* Active Indicator */}
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#b1f128] shrink-0"></div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Divider */}
        {connectedWallets.length > 0 && (
          <div className="my-1.5 border-t border-[#1f261e]"></div>
        )}

        {/* Connect New Wallet Button */}
        <div className="px-2">
          <button 
            type="button"
            onClick={handleConnectNew}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#121712] transition-colors cursor-pointer"
          >
            <span className="text-white text-sm font-medium">Connect a new wallet</span>
          </button>
        </div>

        {/* Empty State */}
        {connectedWallets.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-white font-semibold text-sm mb-1">No wallets connected</p>
            <p className="text-[#7c7c7c] text-xs">Connect a wallet to start swapping</p>
          </div>
        )}
      </div>
    </WalletDropdown>
  );
}

