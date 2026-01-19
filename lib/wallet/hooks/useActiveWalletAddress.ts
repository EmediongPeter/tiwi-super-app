"use client";

import { useMemo } from "react";
import { useWallet } from "@/lib/wallet/hooks/useWallet";
import { useWalletManagerStore } from "@/lib/wallet/state/wallet-manager-store";

/**
 * useActiveWalletAddress
 *
 * Single source of truth for "which wallet address is TIWI using right now?"
 * - If wallet manager has an active wallet, return its address.
 * - Otherwise, fall back to the currently connected external wallet (useWallet).
 */
export function useActiveWalletAddress(): string | null {
  const wallet = useWallet();
  const activeWalletId = useWalletManagerStore((s) => s.activeWalletId);
  const wallets = useWalletManagerStore((s) => s.wallets);

  const activeManaged = useMemo(() => {
    if (!activeWalletId) return null;
    return wallets.find((w) => w.id === activeWalletId) || null;
  }, [activeWalletId, wallets]);

  if (activeManaged?.address) {
    return activeManaged.address;
  }

  return wallet.address || null;
}


