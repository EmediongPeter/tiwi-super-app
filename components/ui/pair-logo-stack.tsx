"use client";

import { useState } from "react";
import Image from "next/image";
import type { MarketToken } from "@/lib/backend/types/backend-tokens";
import { useChainLogo } from "@/hooks/useChainLogo";

interface PairLogoStackProps {
  baseToken: MarketToken;
  quoteToken: MarketToken;
  pairName: string;
  chainName: string;
  chainLogoURI?: string;
  className?: string;
}

/**
 * PairLogoStack Component
 * 
 * Displays overlapping token logos (base on top, quote behind) with pair name
 * and chain information below. Fully responsive across all devices.
 * 
 * Design:
 * - Base token logo: larger, on top, offset left
 * - Quote token logo: smaller, behind, offset right
 * - Pair name: bold, below logos
 * - Chain info: small logo + name, below pair name
 */
export function PairLogoStack({
  baseToken,
  quoteToken,
  pairName,
  chainName,
  chainLogoURI: propChainLogoURI,
  className = "",
}: PairLogoStackProps) {
  const [baseError, setBaseError] = useState(false);
  const [quoteError, setQuoteError] = useState(false);
  const [chainError, setChainError] = useState(false);
  
  // Get chain logo from chains API if not provided
  const apiChainLogo = useChainLogo(chainName);
  const chainLogoURI = propChainLogoURI || apiChainLogo;

  // Get first letter for fallback
  const baseLetter = (baseToken.symbol || baseToken.name || "?").trim().charAt(0).toUpperCase();
  const quoteLetter = (quoteToken.symbol || quoteToken.name || "?").trim().charAt(0).toUpperCase();

  // Generate gradient background colors based on first letter
  const getGradientColor = (letter: string): string => {
    const colors: Record<string, string> = {
      'A': 'from-blue-500/20 to-blue-600/30',
      'B': 'from-purple-500/20 to-purple-600/30',
      'C': 'from-cyan-500/20 to-cyan-600/30',
      'D': 'from-indigo-500/20 to-indigo-600/30',
      'E': 'from-emerald-500/20 to-emerald-600/30',
      'F': 'from-fuchsia-500/20 to-fuchsia-600/30',
      'G': 'from-green-500/20 to-green-600/30',
      'H': 'from-amber-500/20 to-amber-600/30',
      'I': 'from-indigo-500/20 to-indigo-600/30',
      'J': 'from-rose-500/20 to-rose-600/30',
      'K': 'from-pink-500/20 to-pink-600/30',
      'L': 'from-lime-500/20 to-lime-600/30',
      'M': 'from-violet-500/20 to-violet-600/30',
      'N': 'from-teal-500/20 to-teal-600/30',
      'O': 'from-orange-500/20 to-orange-600/30',
      'P': 'from-purple-500/20 to-purple-600/30',
      'Q': 'from-cyan-500/20 to-cyan-600/30',
      'R': 'from-red-500/20 to-red-600/30',
      'S': 'from-sky-500/20 to-sky-600/30',
      'T': 'from-teal-500/20 to-teal-600/30',
      'U': 'from-blue-500/20 to-indigo-600/30',
      'V': 'from-violet-500/20 to-violet-600/30',
      'W': 'from-amber-500/20 to-amber-600/30',
      'X': 'from-rose-500/20 to-rose-600/30',
      'Y': 'from-yellow-500/20 to-yellow-600/30',
      'Z': 'from-zinc-500/20 to-zinc-600/30',
    };
    return colors[letter] || 'from-gray-500/20 to-gray-600/30';
  };

  const baseGradient = getGradientColor(baseLetter);
  const quoteGradient = getGradientColor(quoteLetter);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Logo Stack Container */}
      <div className="relative flex items-center shrink-0">
        {/* Quote Token Logo (Behind, Smaller) */}
        <div className="relative shrink-0">
          <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-5 md:h-5 lg:w-6 lg:h-6 xl:w-6 xl:h-6 relative">
            {quoteError || !quoteToken.logoURI ? (
              <div
                className={`w-full h-full rounded-full bg-gradient-to-br ${quoteGradient} flex items-center justify-center text-white font-bold text-[7px] sm:text-[8px] md:text-[8px] lg:text-[9px] xl:text-[10px] border border-white/10 shadow-lg`}
              >
                {quoteLetter}
              </div>
            ) : (
              <Image
                src={quoteToken.logoURI}
                alt={quoteToken.symbol || quoteToken.name}
                width={28}
                height={28}
                className="w-full h-full rounded-full object-contain"
                onError={() => setQuoteError(true)}
                unoptimized
              />
            )}
          </div>
        </div>

        {/* Base Token Logo (On Top, Larger, Overlapping) */}
        <div className="relative shrink-0 -ml-2 sm:-ml-2.5 md:-ml-2.5 lg:-ml-3 xl:-ml-3 z-10">
          <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 md:w-6 md:h-6 lg:w-7 lg:h-7 xl:w-7 xl:h-7 relative">
            {baseError || !baseToken.logoURI ? (
              <div
                className={`w-full h-full rounded-full bg-gradient-to-br ${baseGradient} flex items-center justify-center text-white font-bold text-[8px] sm:text-[9px] md:text-[9px] lg:text-[10px] xl:text-[11px] border border-white/10 shadow-lg`}
              >
                {baseLetter}
              </div>
            ) : (
              <Image
                src={baseToken.logoURI}
                alt={baseToken.symbol || baseToken.name}
                width={32}
                height={32}
                className="w-full h-full rounded-full object-contain"
                onError={() => setBaseError(true)}
                unoptimized
              />
            )}
          </div>
        </div>
      </div>

      {/* Pair Name and Chain Info (Vertical Stack) */}
      <div className="flex flex-col gap-0.5 min-w-0">
        {/* Pair Name */}
        <div className="text-white font-bold text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] xl:text-[14px] leading-tight whitespace-nowrap">
          {pairName}
        </div>

        {/* Chain Info (Logo + Name) */}
        <div className="flex items-center gap-1">
          {chainLogoURI && !chainError ? (
            <div className="relative w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3 shrink-0">
              <Image
                src={chainLogoURI}
                alt={chainName}
                width={12}
                height={12}
                className="w-full h-full rounded-full object-contain"
                onError={() => setChainError(true)}
                unoptimized
              />
            </div>
          ) : null}
          <span className="text-[#7c7c7c] text-[6.5px] sm:text-[7.5px] md:text-[8.5px] lg:text-[9px] font-medium uppercase tracking-wide">
            {chainName}
          </span>
        </div>
      </div>
    </div>
  );
}

