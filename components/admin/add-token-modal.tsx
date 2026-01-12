"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IoChevronDownOutline } from "react-icons/io5";

interface AddTokenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  { label: "New", value: "new" },
  { label: "Memes", value: "memes" },
  { label: "FIBA", value: "fiba" },
  { label: "Gainers", value: "gainers" },
  { label: "Losers", value: "losers" },
  { label: "Governance", value: "governance" },
];

const chains = [
  { label: "Ethereum", value: "ethereum", chainId: 1 },
  { label: "BSC", value: "bsc", chainId: 56 },
  { label: "Polygon", value: "polygon", chainId: 137 },
  { label: "Arbitrum", value: "arbitrum", chainId: 42161 },
  { label: "Optimism", value: "optimism", chainId: 10 },
];

export default function AddTokenModal({
  open,
  onOpenChange,
}: AddTokenModalProps) {
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [selectedChain, setSelectedChain] = useState("Ethereum");
  const [selectedCategory, setSelectedCategory] = useState("New");
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const chainRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setTokenSymbol("");
      setTokenName("");
      setTokenAddress("");
      setSelectedChain("Ethereum");
      setSelectedCategory("New");
    } else {
      setShowChainDropdown(false);
      setShowCategoryDropdown(false);
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chainRef.current && !chainRef.current.contains(event.target as Node)) {
        setShowChainDropdown(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async () => {
    if (!tokenSymbol.trim() || !tokenAddress.trim()) {
      alert("Please fill in token symbol and address");
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to add token
      console.log("Adding token:", {
        symbol: tokenSymbol,
        name: tokenName,
        address: tokenAddress,
        chain: selectedChain,
        category: selectedCategory,
      });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reset form
      setTokenSymbol("");
      setTokenName("");
      setTokenAddress("");
      setSelectedChain("Ethereum");
      setSelectedCategory("New");

      onOpenChange(false);
      alert("Token added successfully!");
    } catch (error) {
      console.error("Error adding token:", error);
      alert("Failed to add token. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#121712] border-[#1f261e] text-white w-fit max-w-[90vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto"
        showCloseButton={false}
      >
        <div className="p-6">
          <DialogHeader className="flex flex-row items-center justify-between mb-6">
            <DialogTitle className="text-xl font-semibold text-white">
              Add Token
            </DialogTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="text-[#b1f128] hover:text-[#9dd81f] transition-colors font-medium"
            >
              Close
            </button>
          </DialogHeader>

          <div className="space-y-6">
            {/* Token Symbol */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Token Symbol *
              </label>
              <input
                type="text"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                placeholder="e.g., ETH, BTC, USDT"
                maxLength={10}
                className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#b1f128]"
              />
            </div>

            {/* Token Name */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Token Name
              </label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g., Ethereum, Bitcoin, Tether"
                className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#b1f128]"
              />
            </div>

            {/* Token Address */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Token Contract Address *
              </label>
              <input
                type="text"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                placeholder="0x..."
                className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-[#b1f128]"
              />
            </div>

            {/* Chain Selection */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Chain
              </label>
              <div className="relative" ref={chainRef}>
                <button
                  onClick={() => {
                    setShowChainDropdown(!showChainDropdown);
                    setShowCategoryDropdown(false);
                  }}
                  className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white text-sm flex items-center justify-between hover:border-[#b1f128] transition-colors"
                >
                  <span>{selectedChain}</span>
                  <IoChevronDownOutline className="w-4 h-4" />
                </button>
                {showChainDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-[#0b0f0a] border border-[#1f261e] rounded-lg shadow-lg">
                    {chains.map((chain) => (
                      <button
                        key={chain.value}
                        onClick={() => {
                          setSelectedChain(chain.label);
                          setShowChainDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#121712] transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {chain.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Category Selection */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Category
              </label>
              <div className="relative" ref={categoryRef}>
                <button
                  onClick={() => {
                    setShowCategoryDropdown(!showCategoryDropdown);
                    setShowChainDropdown(false);
                  }}
                  className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white text-sm flex items-center justify-between hover:border-[#b1f128] transition-colors"
                >
                  <span>{selectedCategory}</span>
                  <IoChevronDownOutline className="w-4 h-4" />
                </button>
                {showCategoryDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-[#0b0f0a] border border-[#1f261e] rounded-lg shadow-lg">
                    {categories.map((category) => (
                      <button
                        key={category.value}
                        onClick={() => {
                          setSelectedCategory(category.label);
                          setShowCategoryDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#121712] transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => onOpenChange(false)}
                className="flex-1 px-6 py-2.5 bg-[#121712] border border-[#1f261e] text-[#b5b5b5] rounded-lg hover:bg-[#1a1f1a] hover:text-white transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !tokenSymbol.trim() || !tokenAddress.trim()}
                className="flex-1 px-6 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Adding..." : "Add Token"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
