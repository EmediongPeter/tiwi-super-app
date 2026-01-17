"use client";

import { useState, useEffect, useMemo } from "react";
import { TradingViewChart } from "@/components/charts/tradingview-chart";
import Skeleton from "@/components/ui/skeleton";
import type { Token } from "@/lib/frontend/types/tokens";
import { DEFAULT_FROM_TOKEN, DEFAULT_TO_TOKEN } from "@/app/swap/page";
import { ResolutionString } from "@/public/charts/charting_library/datafeed-api";
import { formatUSDPrice, formatQuotePrice } from "@/lib/shared/utils/price-formatting-subscript";

interface TradingChartProps {
  fromToken?: Token | null;
  toToken?: Token | null;
  className?: string;
}

export default function TradingChart({
  fromToken = DEFAULT_FROM_TOKEN,
  toToken = DEFAULT_TO_TOKEN,
  className = "",
}: TradingChartProps) {
  const [isChartReady, setIsChartReady] = useState(true);
  const [chartError, setChartError] = useState<Error | null>(null);

  // Determine if we have valid tokens for chart
  // MULTICHAIN SUPPORT: No longer requires same chain
  const hasValidTokens = useMemo(() => {
    return !!(
      fromToken &&
      toToken &&
      fromToken.address &&
      toToken.address &&
      fromToken.chainId &&
      toToken.chainId
      // Removed: fromToken.chainId === toToken.chainId - now supports cross-chain!
    );
  }, [fromToken, toToken]);

  // Format pair name
  const pairName = useMemo(() => {
    if (!fromToken || !toToken) return "Select Tokens";
    return `${fromToken.symbol}/${toToken.symbol}`;
  }, [fromToken, toToken]);

  // Format price data (OHLC format) - using token prices if available
  // Format like DexScreener: "Price USD $0.0₉₅₀₄₄" and "Price 0.0₁₂₅₆₀₈ WBNB"
  const priceData = useMemo(() => {
    if (!fromToken?.price || !toToken) return "Loading price data...";
    
    try {
      const priceUSD = parseFloat(fromToken.price);
      const change24h = fromToken.priceChange24h ?? 0;
      const changePercent = Math.abs(change24h).toFixed(2);
      const changeSign = change24h >= 0 ? "+" : "-";
      
      // Calculate quote price (e.g., WBNB price)
      // If toToken has a price, we can calculate the ratio
      let quotePriceText = '';
      if (toToken.price) {
        const toTokenPrice = parseFloat(toToken.price);
        if (toTokenPrice > 0) {
          const quotePrice = priceUSD / toTokenPrice;
          quotePriceText = `Price ${formatQuotePrice(quotePrice, toToken.symbol || '')}`;
        }
      }
      
      // Format USD price with subscript notation for very small values
      const usdPriceText = `Price USD ${formatUSDPrice(priceUSD)}`;
      
      // Combine: "Price USD $0.0₉₅₀₄₄ | Price 0.0₁₂₅₆₀₈ WBNB | -0.25%"
      const parts = [usdPriceText];
      if (quotePriceText) {
        parts.push(quotePriceText);
      }
      if (change24h !== 0) {
        parts.push(`${changeSign}${changePercent}%`);
      }
      
      return parts.join(' | ');
    } catch (error) {
      console.error('[TradingChart] Error formatting price:', error);
      return "Price data unavailable";
    }
  }, [fromToken, toToken]);

  // Reset chart ready state when tokens change
  useEffect(() => {
    setIsChartReady(true);
    setChartError(null);
  }, [fromToken?.address, toToken?.address, fromToken?.chainId, toToken?.chainId]);

  // Handle chart ready
  const handleChartReady = () => {
    setIsChartReady(true);
  };
  // Handle chart error
  const handleChartError = (error: Error) => {
    console.error("[TradingChart] Chart error:", error);
    setChartError(error);
    setIsChartReady(true); // Show error state instead of loading
  };

  return (
    <div className={`bg-[#010501] border border-[#1f261e] rounded-xl lg:rounded-2xl overflow-hidden backdrop-blur-sm ${className}`}>
      {/* Header */}
      <div className="p-3 sm:p-3.5 md:p-4 border-b border-[#1f261e]">
        <div className="flex items-center justify-between">
          <div>
            {!isChartReady && hasValidTokens ? (
              <>
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </>
            ) : (
              <>
                <h3 className="text-white font-semibold text-sm sm:text-base">
                  {pairName}
                </h3>
                <p className="text-[#b5b5b5] text-xs sm:text-sm mt-0.5 sm:mt-1">
                  {priceData}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-[320px] lg:h-[460px] xl:h-[450px] 2xl:h-[500px] bg-[#0b0f0a] relative overflow-hidden">
        {!isChartReady && hasValidTokens ? (
          <Skeleton className="w-full h-full rounded-none" />
        ) : chartError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <p className="text-[#b5b5b5] text-sm mb-2">
                Chart unavailable
              </p>
              <p className="text-[#7c7c7c] text-xs">
                {chartError.message || "Please try again"}
              </p>
            </div>
          </div>
        ) : hasValidTokens ? (
          <TradingViewChart
            baseToken={fromToken!.address}
            quoteToken={toToken!.address}
            chainId={fromToken!.chainId === toToken!.chainId ? fromToken!.chainId : undefined}
            baseChainId={fromToken!.chainId}
            quoteChainId={toToken!.chainId}
            height="100%"
            theme="dark"
            interval={"15" as ResolutionString}
            onError={handleChartError}
            onReady={handleChartReady}
            className="w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#b5b5b5] text-sm">
              Please select tokens to view chart
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

