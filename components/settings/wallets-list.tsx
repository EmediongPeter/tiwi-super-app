"use client";

import { useMemo } from "react";
import { useWalletManagerStore } from "@/lib/wallet/state/wallet-manager-store";
import { useActiveWalletAddress } from "@/lib/wallet/hooks/useActiveWalletAddress";

const formatAddress = (address: string): string => {
  if (!address || address.length <= 10) return address;
  const withoutPrefix = address.startsWith("0x") ? address.slice(2) : address;
  if (withoutPrefix.length <= 7) return address;
  return `0x${withoutPrefix.slice(0, 3)}...${withoutPrefix.slice(-4)}`;
};

const sourceLabel: Record<string, string> = {
  local: "Local",
  metamask: "MetaMask",
  walletconnect: "WalletConnect",
  coinbase: "Coinbase",
  rabby: "Rabby",
  phantom: "Phantom",
  other: "Other",
};

export default function WalletsList() {
  const wallets = useWalletManagerStore((s) => s.wallets);
  const activeWalletId = useWalletManagerStore((s) => s.activeWalletId);
  const setActiveWallet = useWalletManagerStore((s) => s.setActiveWallet);
  const fallbackActiveAddress = useActiveWalletAddress();

  const sortedWallets = useMemo(
    () =>
      [...wallets].sort((a, b) => b.createdAt - a.createdAt),
    [wallets]
  );

  if (sortedWallets.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 items-start w-full">
      <div className="flex items-center justify-between w-full">
        <p className="font-['Manrope:Medium',sans-serif] font-medium leading-[normal] text-[#b5b5b5] text-[18px]">
          My Wallets
        </p>
        <p className="text-xs text-[#6E7873]">
          Active wallet controls balances, NFTs & portfolio views.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full">
        {sortedWallets.map((wallet) => {
          const isActive =
            wallet.id === activeWalletId ||
            (!!fallbackActiveAddress &&
              wallet.address.toLowerCase() === fallbackActiveAddress.toLowerCase());

          const label =
            wallet.label ||
            (wallet.isLocal ? "Local Wallet" : sourceLabel[wallet.source] || "Wallet");

          return (
            <button
              key={wallet.id}
              type="button"
              onClick={() => setActiveWallet(wallet.id)}
              className={`flex items-center justify-between w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                isActive
                  ? "border-[#B1F128] bg-[#081F02]"
                  : "border-[#1f261e] bg-[#0B0F0A] hover:border-[#2a3a24]"
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-white">{label}</span>
                <span className="text-xs text-[#6E7873]">
                  {formatAddress(wallet.address)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs rounded-full px-2 py-1 border border-[#2a3a24] text-[#b5b5b5]">
                  {sourceLabel[wallet.source] || "Wallet"}
                </span>
                {isActive && (
                  <span className="text-xs font-semibold text-[#B1F128]">
                    Active
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


