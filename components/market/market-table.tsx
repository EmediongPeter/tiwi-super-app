"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import MarketTableRowSkeleton from "./market-table-row-skeleton";
import type { MarketToken } from "@/lib/market/mock-data";

interface MarketTableProps {
  tokens: MarketToken[];
  isLoading?: boolean;
  marketType?: "spot" | "perp";
}

export default function MarketTable({ 
  tokens, 
  isLoading = false,
  marketType = "spot"
}: MarketTableProps) {
  const router = useRouter();
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const scrollYContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Navigate to trading page when row is clicked
  const handleRowClick = (token: MarketToken) => {
    // Convert symbol to pair format (e.g., "BTC" -> "BTC-USDT", "BTC-PERP" -> "BTC-USDT")
    const baseSymbol = token.symbol.replace("-PERP", "");
    const pair = `${baseSymbol}-USDT`;
    router.push(`/market/${pair}`);
  };

  // Pagination - show 50 rows at a time (market page shows more pairs)
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;
  const totalPages = Math.ceil(tokens.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const displayedTokens = tokens.slice(startIndex, endIndex);

  const changePage = (page: number) => {
    const clamped = Math.min(Math.max(page, 1), totalPages || 1);
    if (clamped === currentPage) return;
    setCurrentPage(clamped);
    if (scrollYContainerRef.current) {
      scrollYContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Reset to page 1 when tokens change
  useEffect(() => {
    setCurrentPage(1);
  }, [tokens.length]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      {/* Vertical scroll container */}
      <div
        ref={scrollYContainerRef}
        className="flex-1 overflow-y-auto market-table-scrollbar min-h-0"
      >
        {/* Horizontal scroll container */}
        <div className="overflow-x-auto market-table-scrollbar pr-6">
          <div className="min-w-[1129px]">
            <Table className="table-auto w-full relative">
              <TableHeader className="sticky top-0 z-30 bg-[#010501]">
                <TableRow className="border-b-[0.5px] border-[#1f261e] hover:bg-transparent">
                  <TableHead className="w-[140px] lg:w-[120px] xl:w-[132px] 2xl:w-[140px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-2 sm:py-2.5 2xl:py-[10px] text-left text-[12px] sm:text-[13px] xl:text-[14px] text-[#7c7c7c] font-semibold bg-[#010501]">
                    Token
                  </TableHead>
                  <TableHead className="w-[80px] lg:w-[70px] xl:w-[80px] 2xl:w-[80px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-2 sm:py-2.5 2xl:py-[10px] text-right text-[12px] sm:text-[13px] xl:text-[14px] text-[#7c7c7c] font-semibold bg-[#010501]">
                    Price
                  </TableHead>
                  <TableHead className="w-[81px] lg:w-[72px] xl:w-[81px] 2xl:w-[81px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-2 sm:py-2.5 2xl:py-[10px] text-right text-[12px] sm:text-[13px] xl:text-[14px] text-[#7c7c7c] font-semibold bg-[#010501]">
                    24h Change
                  </TableHead>
                  <TableHead className="w-[80px] lg:w-[70px] xl:w-[80px] 2xl:w-[80px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-2 sm:py-2.5 2xl:py-[10px] text-right text-[12px] sm:text-[13px] xl:text-[14px] text-[#7c7c7c] font-semibold bg-[#010501]">
                    24h Vol
                  </TableHead>
                  <TableHead className="w-[80px] lg:w-[70px] xl:w-[80px] 2xl:w-[80px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-2 sm:py-2.5 2xl:py-[10px] text-right text-[12px] sm:text-[13px] xl:text-[14px] text-[#7c7c7c] font-semibold bg-[#010501]">
                    Liquidity
                  </TableHead>
                  <TableHead className="w-[80px] lg:w-[70px] xl:w-[80px] 2xl:w-[80px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-2 sm:py-2.5 2xl:py-[10px] text-right text-[12px] sm:text-[13px] xl:text-[14px] text-[#7c7c7c] font-semibold bg-[#010501]">
                    Holders
                  </TableHead>
                  {marketType === "perp" && (
                    <>
                      <TableHead className="w-[80px] lg:w-[70px] xl:w-[80px] 2xl:w-[80px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-2 sm:py-2.5 2xl:py-[10px] text-right text-[12px] sm:text-[13px] xl:text-[14px] text-[#7c7c7c] font-semibold bg-[#010501]">
                        Funding Rate
                      </TableHead>
                      <TableHead className="w-[80px] lg:w-[70px] xl:w-[80px] 2xl:w-[80px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-2 sm:py-2.5 2xl:py-[10px] text-right text-[12px] sm:text-[13px] xl:text-[14px] text-[#7c7c7c] font-semibold bg-[#010501]">
                        Open Interest
                      </TableHead>
                    </>
                  )}
                  <TableHead className="w-[88px] lg:w-[70px] xl:w-[78px] 2xl:w-[88px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-2 sm:py-2.5 2xl:py-[10px] text-center text-[12px] sm:text-[13px] xl:text-[14px] text-[#7c7c7c] font-semibold bg-[#010501] sticky right-0 z-40 shadow-[-8px_0_12px_rgba(0,0,0,0.45)]">
                    Buy/Sell
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, idx) => (
                    <MarketTableRowSkeleton key={`skeleton-${idx}`} includePerpColumns={marketType === "perp"} />
                  ))
                ) : (
                  displayedTokens.map((token, idx) => {
                    const rowId = `row-${token.symbol}-${startIndex + idx}`;
                        const isHovered = hoveredRowId === rowId;
                    return (
                      <TableRow
                        key={token.symbol}
                        data-row-id={rowId}
                        onMouseEnter={() => setHoveredRowId(rowId)}
                        onMouseLeave={() => setHoveredRowId(null)}
                        onClick={() => handleRowClick(token)}
                        className={`border-b-[0.5px] border-[#1f261e] transition-colors cursor-pointer ${
                          isHovered ? "bg-[#0b0f0a]" : ""
                        }`}
                      >
                        <TableCell className="w-[140px] lg:w-[120px] xl:w-[132px] 2xl:w-[140px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-[14px] sm:py-[16px] xl:py-5 2xl:py-5 text-white text-[13px] sm:text-[14px] xl:text-[16px] font-semibold">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Image
                              src="/assets/icons/home/star.svg"
                              alt="star"
                              width={20}
                              height={20}
                              className="w-4 h-4 sm:w-4 sm:h-4 xl:w-5 xl:h-5 shrink-0"
                            />
                            <Image
                              src={token.icon}
                              alt={token.symbol}
                              width={32}
                              height={32}
                              className="w-7 h-7 sm:w-7 sm:h-7 xl:w-8 xl:h-8 shrink-0"
                            />
                            <span className="whitespace-nowrap">{token.symbol}</span>
                          </div>
                        </TableCell>
                        <TableCell className="w-[80px] lg:w-[70px] xl:w-[80px] 2xl:w-[80px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-[14px] sm:py-[16px] xl:py-5 2xl:py-5 text-right text-white text-[13px] sm:text-[14px] xl:text-[16px] font-medium">
                          {token.price}
                        </TableCell>
                        <TableCell
                          className={`w-[81px] lg:w-[72px] xl:w-[81px] 2xl:w-[81px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-[14px] sm:py-[16px] xl:py-5 2xl:py-5 text-right text-[13px] sm:text-[14px] xl:text-[16px] font-medium ${
                            token.changePositive ? "text-[#3fea9b]" : "text-[#ff5c5c]"
                          }`}
                        >
                          {token.change}
                        </TableCell>
                        <TableCell className="w-[80px] lg:w-[70px] xl:w-[80px] 2xl:w-[80px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-[14px] sm:py-[16px] xl:py-5 2xl:py-5 text-right text-white text-[13px] sm:text-[14px] xl:text-[16px] font-medium">
                          {token.vol}
                        </TableCell>
                        <TableCell className="w-[80px] lg:w-[70px] xl:w-[80px] 2xl:w-[80px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-[14px] sm:py-[16px] xl:py-5 2xl:py-5 text-right text-white text-[13px] sm:text-[14px] xl:text-[16px] font-medium">
                          {token.liq}
                        </TableCell>
                        <TableCell className="w-[80px] lg:w-[70px] xl:w-[80px] 2xl:w-[80px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-[14px] sm:py-[16px] xl:py-5 2xl:py-5 text-right text-white text-[13px] sm:text-[14px] xl:text-[16px] font-medium">
                          {token.holders}
                        </TableCell>
                        {marketType === "perp" && (
                          <>
                            <TableCell className={`w-[80px] lg:w-[70px] xl:w-[80px] 2xl:w-[80px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-[14px] sm:py-[16px] xl:py-5 2xl:py-5 text-right text-[13px] sm:text-[14px] xl:text-[16px] font-medium ${
                              token.fundingRate?.startsWith('+') ? "text-[#3fea9b]" : token.fundingRate?.startsWith('-') ? "text-[#ff5c5c]" : "text-white"
                            }`}>
                              {token.fundingRate || "N/A"}
                            </TableCell>
                            <TableCell className="w-[80px] lg:w-[70px] xl:w-[80px] 2xl:w-[80px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-[14px] sm:py-[16px] xl:py-5 2xl:py-5 text-right text-white text-[13px] sm:text-[14px] xl:text-[16px] font-medium">
                              {token.openInterest || "N/A"}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="w-[95px] lg:w-[80px] xl:w-[86px] 2xl:w-[96px] px-3 sm:px-4 xl:px-5 2xl:px-6 py-[14px] sm:py-[16px] xl:py-5 2xl:py-5 text-center sticky right-0 bg-[#010501] z-30 shadow-[-8px_0_12px_rgba(0,0,0,0.45)]">
                          <div className="flex justify-center items-center">
                            <button
                              className={`bg-[#081F02] flex items-center justify-center rounded-full cursor-pointer transition-all duration-150 w-[46px] h-[36px] xl:w-[50px] xl:h-[40px] min-w-[46px] hover:opacity-95 ${
                                isHovered
                                  ? "px-3 xl:px-4 py-2 gap-2 min-w-[86px] h-[38px] xl:h-[42px] opacity-100"
                                  : ""
                              }`}
                              aria-label={`Trade ${token.symbol}`}
                            >
                              <Image
                                src="/assets/icons/home/trade.svg"
                                alt="trade"
                                width={24}
                                height={24}
                                className="w-5 h-5"
                              />
                              {isHovered && (
                                <span className="text-[#b1f128] text-[12.5px] lg:text-[13px] xl:text-[14px] font-semibold leading-none whitespace-nowrap">
                                  Trade
                                </span>
                              )}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Pagination Controls */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 lg:gap-2 xl:gap-2.5 2xl:gap-2.5 px-3 lg:px-4 xl:px-5 2xl:px-6 py-2 lg:py-2.5 xl:py-2.5 2xl:py-3 bg-[#010501]">
          <button
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1}
            className="bg-[#0b0f0a] border border-[#1f261e] flex items-center justify-center p-1.5 lg:p-1.5 xl:p-2 2xl:p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-80"
            aria-label="Previous page"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 lg:w-4 xl:w-5 2xl:w-6 h-4 lg:h-4 xl:h-5 2xl:h-6">
              <path d="M15 18L9 12L15 6" stroke="#b5b5b5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {/* Page Numbers */}
          <div className="flex items-center gap-1.5 lg:gap-2 xl:gap-2.5 2xl:gap-2.5">
            {/* Always show page 1 */}
            <button
              onClick={() => changePage(1)}
              className={`flex items-center justify-center p-1.5 lg:p-1.5 xl:p-2 2xl:p-2 rounded-lg text-xs lg:text-sm xl:text-base 2xl:text-base transition-colors min-w-[20px] lg:min-w-[22px] xl:min-w-[24px] 2xl:min-w-[24px] h-[20px] lg:h-[22px] xl:h-[24px] 2xl:h-[24px] ${
                currentPage === 1
                  ? "bg-[#b1f128] text-[#010501] font-semibold"
                  : "bg-[#0b0f0a] border border-[#1f261e] text-[#b5b5b5] font-medium hover:bg-[#081f02]"
              }`}
            >
              1
            </button>
            
            {/* Show page 2 if on page 1, 2, or 3 */}
            {currentPage <= 3 && (
              <button
                onClick={() => changePage(2)}
                className={`flex items-center justify-center p-1.5 lg:p-1.5 xl:p-2 2xl:p-2 rounded-lg text-xs lg:text-sm xl:text-base 2xl:text-base transition-colors min-w-[20px] lg:min-w-[22px] xl:min-w-[24px] 2xl:min-w-[24px] h-[20px] lg:h-[22px] xl:h-[24px] 2xl:h-[24px] ${
                  currentPage === 2
                    ? "bg-[#b1f128] text-[#010501] font-semibold"
                    : "bg-[#0b0f0a] border border-[#1f261e] text-[#b5b5b5] font-medium hover:bg-[#081f02]"
                }`}
              >
                2
              </button>
            )}
            
            {/* Show page 3 if on page 1, 2, or 3 */}
            {currentPage <= 3 && totalPages >= 3 && (
              <button
                onClick={() => changePage(3)}
                className={`flex items-center justify-center p-1.5 lg:p-1.5 xl:p-2 2xl:p-2 rounded-lg text-xs lg:text-sm xl:text-base 2xl:text-base transition-colors min-w-[20px] lg:min-w-[22px] xl:min-w-[24px] 2xl:min-w-[24px] h-[20px] lg:h-[22px] xl:h-[24px] 2xl:h-[24px] ${
                  currentPage === 3
                    ? "bg-[#b1f128] text-[#010501] font-semibold"
                    : "bg-[#0b0f0a] border border-[#1f261e] text-[#b5b5b5] font-medium hover:bg-[#081f02]"
                }`}
              >
                3
              </button>
            )}
            
            {/* Show ellipsis if current page is far from start */}
            {currentPage > 4 && (
              <span className="text-xs lg:text-sm xl:text-base 2xl:text-base font-medium text-[#b5b5b5] px-0.5 lg:px-0.5 xl:px-1 2xl:px-1">...</span>
            )}
            
            {/* Show current page if it's in the middle */}
            {currentPage > 3 && currentPage < totalPages - 2 && (
              <button
                onClick={() => changePage(currentPage)}
                className="bg-[#b1f128] flex items-center justify-center p-1.5 lg:p-1.5 xl:p-2 2xl:p-2 rounded-lg text-xs lg:text-sm xl:text-base 2xl:text-base font-semibold text-[#010501] min-w-[20px] lg:min-w-[22px] xl:min-w-[24px] 2xl:min-w-[24px] h-[20px] lg:h-[22px] xl:h-[24px] 2xl:h-[24px]"
              >
                {currentPage}
              </button>
            )}
            
            {/* Show ellipsis before last page if needed */}
            {currentPage < totalPages - 2 && totalPages > 5 && (
              <span className="text-xs lg:text-sm xl:text-base 2xl:text-base font-medium text-[#b5b5b5] px-0.5 lg:px-0.5 xl:px-1 2xl:px-1">...</span>
            )}
            
            {/* Show last page if not already shown */}
            {totalPages > 3 && (
              <button
                onClick={() => changePage(totalPages)}
                className={`flex items-center justify-center p-1.5 lg:p-1.5 xl:p-2 2xl:p-2 rounded-lg text-xs lg:text-sm xl:text-base 2xl:text-base transition-colors min-w-[20px] lg:min-w-[22px] xl:min-w-[24px] 2xl:min-w-[24px] h-[20px] lg:h-[22px] xl:h-[24px] 2xl:h-[24px] ${
                  currentPage === totalPages
                    ? "bg-[#b1f128] text-[#010501] font-semibold"
                    : "bg-[#0b0f0a] border border-[#1f261e] text-[#b5b5b5] font-medium hover:bg-[#081f02]"
                }`}
              >
                {totalPages}
              </button>
            )}
          </div>
          
          <button
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="bg-[#0b0f0a] border border-[#1f261e] flex items-center justify-center p-1.5 lg:p-1.5 xl:p-2 2xl:p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-80"
            aria-label="Next page"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="rotate-180 w-4 lg:w-4 xl:w-5 2xl:w-6 h-4 lg:h-4 xl:h-5 2xl:h-6">
              <path d="M15 18L9 12L15 6" stroke="#b5b5b5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
