// Recipient Wallet Selector
// -------------------------
// Lets the user choose where the assets should go:
// - Primary wallet (default)
// - A newly connected secondary wallet
// - A manually entered address
//
// Design goals:
// - Feel like a first-class "Send to" control in the swap card
// - Be chain-aware (EVM vs Solana) for validation and connection
// - Apply Relay-like rules without overcomplicating the UI

"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import ConnectWalletModal from "@/components/wallet/connect-wallet-modal";
import WalletExplorerModal from "@/components/wallet/wallet-explorer-modal";
import ChainSelectionModal from "@/components/wallet/chain-selection-modal";
import { connectSecondaryWallet } from "@/lib/wallet/utils/secondary-wallet";
import { getWalletById } from "@/lib/wallet/detection/detector";
import type { WalletType } from "@/components/wallet/connect-wallet-modal";
import type { WalletChain } from "@/lib/wallet/connection/types";
import type { WalletProvider } from "@/lib/wallet/detection/types";
import type { WalletConnectWallet } from "@/lib/wallet/services/wallet-explorer-service";
import { useWallet } from "@/lib/wallet/hooks/useWallet";

interface RecipientWalletSelectorProps {
  connectedAddress: string | null;
  recipientAddress: string | null;
  onRecipientChange: (address: string | null) => void;
  chainId?: number;
  chainType?: "EVM" | "Solana";
}

export default function RecipientWalletSelector({
  connectedAddress,
  recipientAddress,
  onRecipientChange,
  chainId,
  chainType,
}: RecipientWalletSelectorProps) {
  const { primaryWallet } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [manualAddressError, setManualAddressError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isChainSelectionOpen, setIsChainSelectionOpen] = useState(false);
  const [pendingWallet, setPendingWallet] = useState<WalletProvider | WalletConnectWallet | null>(null);
  const [pendingWalletId, setPendingWalletId] = useState<string | null>(null);
  const [previousModalState, setPreviousModalState] = useState<'connect' | 'explorer' | null>(null);
  
  // Determine desired chain from chainType or chainId
  const getChain = (): WalletChain => {
    if (chainType === "Solana") return "solana";
    if (chainType === "EVM") return "ethereum";
    // Default to ethereum if unknown
    return "ethereum";
  };

  // Helper: check if a wallet ID is the same provider as the primary wallet
  const isSameProviderAsPrimary = (walletId: string): boolean => {
    if (!primaryWallet) return false;
    return primaryWallet.provider?.toLowerCase() === walletId.toLowerCase();
  };

  // Check if wallet supports multiple chains
  const isMultiChainWallet = (wallet: WalletProvider | WalletConnectWallet | null): boolean => {
    if (!wallet) return false;
    
    if ('supportedChains' in wallet) {
      const supported = wallet.supportedChains.filter(
        chain => chain === 'ethereum' || chain === 'solana'
      );
      return supported.length > 1;
    }
    
    const multiChainNames = ['phantom', 'metamask', 'coinbase', 'trust', 'rabby'];
    return multiChainNames.some(name => wallet.name.toLowerCase().includes(name.toLowerCase()));
  };

  // Determine chain from wallet ID
  const getChainForWallet = (walletId: string): 'ethereum' | 'solana' => {
    const solanaOnlyWallets = ['solflare', 'glow', 'slope', 'nightly', 'jupiter'];
    if (solanaOnlyWallets.includes(walletId.toLowerCase())) {
      return 'solana';
    }
    return 'ethereum';
  };
  
  const handleWalletConnect = useCallback(
    async (walletInput: WalletType | WalletConnectWallet) => {
      try {
        // Handle WalletConnect wallet from explorer
        if (typeof walletInput === "object" && "id" in walletInput && "name" in walletInput) {
          const wcWallet = walletInput as WalletConnectWallet;

          // Relay-like rule: don't allow the same provider as the primary wallet
          if (isSameProviderAsPrimary(wcWallet.id)) {
            setManualAddressError(
              "This wallet is already connected as your primary wallet. Please use a different wallet or paste an address."
            );
            return;
          }

          // Check if this is a multi-chain wallet
          if (isMultiChainWallet(wcWallet)) {
            setPendingWallet(wcWallet);
            setPendingWalletId(wcWallet.id);
            setPreviousModalState("explorer");
            setIsChainSelectionOpen(true);
            setIsExplorerOpen(false);
            return;
          }

          // Single-chain wallet - determine chain and connect
          const desiredChain = getChain();
          const walletChain = getChainForWallet(wcWallet.id);
          const chain: WalletChain =
            desiredChain === "solana" && walletChain === "solana"
              ? "solana"
              : desiredChain === "ethereum" && walletChain === "ethereum"
              ? "ethereum"
              : walletChain;

          const address = await connectSecondaryWallet(wcWallet.id, chain);
          onRecipientChange(address);
          setIsExplorerOpen(false);
          return;
        }

        // Handle string wallet type
        const type = walletInput as WalletType;

        // For create/import, show instructions or redirect
        if (type === "create" || type === "import") {
          console.log("Create/import wallet not yet implemented");
          return;
        }

        // Get wallet from supported wallets
        const walletInfo = getWalletById(type);
        if (!walletInfo) {
          throw new Error(`Wallet "${type}" not found`);
        }

        // Relay-like rule: don't allow the same provider as the primary wallet
        if (isSameProviderAsPrimary(walletInfo.id)) {
          setManualAddressError(
            "This wallet is already connected as your primary wallet. Please use a different wallet or paste an address."
          );
          return;
        }

        // Convert to WalletProvider to check chains
        const walletProvider: WalletProvider = {
          id: walletInfo.id,
          name: walletInfo.name,
          icon: walletInfo.icon,
          supportedChains: walletInfo.supportedChains,
          installed: true,
        };

        // Check if multi-chain wallet
        if (isMultiChainWallet(walletProvider)) {
          setPendingWallet(walletProvider);
          setPendingWalletId(type);
          setPreviousModalState("connect");
          setIsChainSelectionOpen(true);
          setIsModalOpen(false);
          return;
        }

        // Single-chain wallet - connect immediately, favouring desired chain
        const chain = getChain();
        const address = await connectSecondaryWallet(type, chain);
        onRecipientChange(address);
        setIsModalOpen(false);
      } catch (error: any) {
        console.error("Error connecting secondary wallet:", error);
        setManualAddressError(error?.message || "Failed to connect wallet");
      }
    },
    [getChain, isMultiChainWallet, isSameProviderAsPrimary, onRecipientChange]
  );

  const handleChainSelect = useCallback(async (chain: WalletChain) => {
    if (!pendingWalletId) return;

    try {
      const address = await connectSecondaryWallet(pendingWalletId, chain);
      onRecipientChange(address);
      setIsChainSelectionOpen(false);
      setPendingWallet(null);
      setPendingWalletId(null);
      setPreviousModalState(null);
    } catch (error: any) {
      console.error('Error connecting secondary wallet:', error);
      setManualAddressError(error?.message || 'Failed to connect wallet');
    }
  }, [pendingWalletId]);

  const handleChainModalBack = useCallback(() => {
    setIsChainSelectionOpen(false);
    setPendingWallet(null);
    setPendingWalletId(null);
    
    // Restore previous modal state
    if (previousModalState === 'connect') {
      setIsModalOpen(true);
    } else if (previousModalState === 'explorer') {
      setIsExplorerOpen(true);
    }
    
    setPreviousModalState(null);
  }, [previousModalState]);

  // Validate address format based on chain type
  const isValidAddress = (address: string): boolean => {
    if (!address || !address.trim()) return false;
    const trimmed = address.trim();
    
    // If chainType is not specified, try to detect from address format
    if (!chainType) {
      // Try EVM first (most common)
      if (trimmed.startsWith("0x") && trimmed.length === 42) {
        return true;
      }
      // Try Solana (base58, 32-44 chars)
      if (trimmed.length >= 32 && trimmed.length <= 44 && !trimmed.startsWith("0x")) {
        return true;
      }
      return false;
    }
    
    if (chainType === "Solana") {
      // Solana addresses are base58, typically 32-44 characters
      return trimmed.length >= 32 && trimmed.length <= 44;
    } else {
      // EVM addresses are 0x followed by 40 hex characters
      return trimmed.startsWith("0x") && trimmed.length === 42;
    }
  };

  const handleManualAddressChange = (value: string) => {
    setManualAddress(value);
    setManualAddressError(null);
    
    // Validate and update recipient address in real-time
    const trimmed = value.trim();
    if (trimmed && isValidAddress(trimmed)) {
      onRecipientChange(trimmed);
      setManualAddressError(null);
    } else if (trimmed && !isValidAddress(trimmed)) {
      // Show error for invalid address
      setManualAddressError(
        chainType === "Solana" 
          ? "Invalid Solana address (32-44 characters)"
          : chainType === "EVM"
          ? "Invalid EVM address (0x followed by 40 hex characters)"
          : "Invalid address format"
      );
      // Don't update recipient if invalid
    } else if (trimmed === "") {
      // Clear recipient if input is empty
      onRecipientChange(null);
    }
  };

  const handleUsePrimaryWallet = () => {
    setShowDropdown(false);
    setShowManualInput(false);
    setManualAddress("");
    setManualAddressError(null);
    onRecipientChange(connectedAddress);
  };

  const handleUseManualAddress = () => {
    setShowDropdown(false);
    setShowManualInput(true);
    
    // If there's a valid manual address already, use it
    // Otherwise, if recipient is set and not primary, populate it
    if (manualAddress && isValidAddress(manualAddress)) {
      onRecipientChange(manualAddress.trim());
    } else if (recipientAddress && recipientAddress.toLowerCase() !== connectedAddress?.toLowerCase()) {
      // Recipient is already set to a secondary address, populate the input
      setManualAddress(recipientAddress);
      onRecipientChange(recipientAddress);
    } else {
      // Clear recipient if no valid manual address
      onRecipientChange(null);
    }
  };

  const handleConnectSecondaryWallet = () => {
    setShowDropdown(false);
    setManualAddressError(null);
    setIsModalOpen(true);
  };

  const openExplorer = () => {
    setIsModalOpen(false);
    setIsExplorerOpen(true);
  };

  const getDisplayAddress = (): string => {
    if (!recipientAddress) {
      return "Select Recipient";
    }
    
    // Always show truncated address, whether it's primary wallet, secondary wallet, or manual address
    return `${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`;
  };

  const isUsingPrimaryWallet = recipientAddress && 
    recipientAddress.toLowerCase() === connectedAddress?.toLowerCase();
  const isUsingManualAddress = recipientAddress && 
    recipientAddress.toLowerCase() !== connectedAddress?.toLowerCase() &&
    manualAddress && 
    manualAddress.trim().toLowerCase() === recipientAddress.toLowerCase();

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="px-3 py-1.5 text-xs rounded-full border border-[#1f261e] text-[#b5b5b5] bg-[#0b0f0a] hover:bg-[#121712] transition-colors flex items-center gap-1.5"
        >
          <span>{getDisplayAddress()}</span>
          <Image
            src="/assets/icons/arrow-down-white.svg"
            alt="Dropdown"
            width={16}
            height={16}
            className="w-3 h-3"
          />
        </button>

        {showDropdown && (
          <>
            <div className="absolute right-0 mt-1 w-56 bg-[#0b0f0a] border border-[#1f261e] rounded-lg shadow-lg z-50">
              <div className="py-1">
                <button
                  type="button"
                  onClick={handleUsePrimaryWallet}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-[#121712] transition-colors ${
                    isUsingPrimaryWallet
                      ? "text-[#b1f128] font-medium bg-[#121712]"
                      : "text-[#b5b5b5]"
                  }`}
                >
                  {isUsingPrimaryWallet ? "✓ " : ""}Use Primary Wallet
                </button>
                <button
                  type="button"
                  onClick={handleConnectSecondaryWallet}
                  className="w-full text-left px-4 py-2 text-sm text-[#b5b5b5] hover:bg-[#121712] transition-colors"
                >
                  Connect New Wallet
                </button>
                <div className="border-t border-[#1f261e] my-1">
                  <button
                    type="button"
                    onClick={handleUseManualAddress}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-[#121712] transition-colors ${
                      isUsingManualAddress
                        ? "text-[#b1f128] font-medium bg-[#121712]"
                        : "text-[#b5b5b5]"
                    }`}
                  >
                    {isUsingManualAddress ? "✓ " : ""}Enter Address
                  </button>
                </div>
              </div>
            </div>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />
          </>
        )}
      </div>

      {showManualInput && (
        <div className="mt-2 p-3 bg-[#0b0f0a] border border-[#1f261e] rounded-lg">
          <div className="space-y-2">
            <div className="text-sm font-medium text-[#b5b5b5]">
              Enter Recipient Address
            </div>
            <input
              type="text"
              placeholder={chainType === "Solana" ? "Solana address (32-44 chars)" : chainType === "EVM" ? "0x..." : "Wallet address"}
              value={manualAddress}
              onChange={(e) => handleManualAddressChange(e.target.value)}
              className="w-full px-3 py-2 bg-[#121712] border border-[#1f261e] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b1f128] text-white text-sm"
            />
            {manualAddressError && (
              <p className="text-xs text-red-500">{manualAddressError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowManualInput(false);
                  setManualAddress("");
                  setManualAddressError(null);
                  onRecipientChange(connectedAddress);
                }}
                className="px-3 py-1.5 text-xs bg-[#1f261e] text-[#b5b5b5] rounded-lg hover:bg-[#2a3229] transition-colors"
              >
                Cancel
              </button>
              {manualAddress && isValidAddress(manualAddress) && (
                <button
                  type="button"
                  onClick={() => {
                    setShowManualInput(false);
                    onRecipientChange(manualAddress.trim());
                  }}
                  className="px-3 py-1.5 text-xs bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd120] transition-colors font-medium"
                >
                  Use Address
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connect Wallet Modal */}
      <ConnectWalletModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setManualAddressError(null);
          }
        }}
        onWalletConnect={handleWalletConnect}
        onOpenExplorer={openExplorer}
      />

      {/* Wallet Explorer Modal */}
      <WalletExplorerModal
        open={isExplorerOpen}
        onOpenChange={(open) => {
          setIsExplorerOpen(open);
          if (!open) {
            setManualAddressError(null);
          }
        }}
        onWalletConnect={handleWalletConnect}
      />

      {/* Chain Selection Modal */}
      {pendingWallet && (
        <ChainSelectionModal
          open={isChainSelectionOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleChainModalBack();
            }
          }}
          wallet={pendingWallet}
          onChainSelect={handleChainSelect}
          onBack={handleChainModalBack}
        />
      )}
    </>
  );
}

