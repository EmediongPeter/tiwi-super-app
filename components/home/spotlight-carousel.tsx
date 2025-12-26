"use client";

import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
import { SPOTLIGHT } from "@/lib/home/mock-data";

/**
 * Spotlight carousel component
 * 
 * - Displays spotlight tokens in a carousel format
 * - Shows 3-5 items per page depending on screen size
 * - Auto-slides every 8 seconds
 * - Supports manual navigation via pagination indicators
 * - Includes slide-in animation similar to hero banner
 * - Responsive design
 */

export function SpotlightCarousel() {
  const [activePage, setActivePage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(3);
  const touchStartXRef = useRef<number | null>(null);

  // Responsive items per page based on screen size
  useEffect(() => {
    const updateItemsPerPage = () => {
      const width = window.innerWidth;
      if (width >= 1280) {
        setItemsPerPage(5); // xl and above
      } else if (width >= 1024) {
        setItemsPerPage(4); // lg
      } else {
        setItemsPerPage(3); // base
      }
    };

    updateItemsPerPage();
    window.addEventListener("resize", updateItemsPerPage);
    return () => window.removeEventListener("resize", updateItemsPerPage);
  }, []);

  const totalPages = Math.ceil(SPOTLIGHT.length / itemsPerPage);

  // Get items for current page
  const getPageItems = (pageIndex: number) => {
    const start = pageIndex * itemsPerPage;
    const end = start + itemsPerPage;
    return SPOTLIGHT.slice(start, end);
  };

  // Reset to first page when items per page changes
  useEffect(() => {
    setActivePage(0);
  }, [itemsPerPage]);

  // Auto-slide every 8 seconds
  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => {
      setActivePage((prev) => (prev + 1) % totalPages);
    }, 8000);
    return () => clearInterval(id);
  }, [totalPages]);

  const goToPage = useCallback(
    (pageIndex: number) => {
      if (totalPages === 0) return;
      const nextPage = ((pageIndex % totalPages) + totalPages) % totalPages;
      setActivePage(nextPage);
    },
    [totalPages]
  );

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current == null || totalPages <= 1) return;
    const deltaX = e.changedTouches[0]?.clientX - touchStartXRef.current;
    const threshold = 40; // minimal swipe distance in px
    if (deltaX > threshold) {
      goToPage(activePage - 1);
    } else if (deltaX < -threshold) {
      goToPage(activePage + 1);
    }
    touchStartXRef.current = null;
  };

  const currentPageItems = getPageItems(activePage);

  return (
    <div className="w-full flex flex-col">
      <div
        className="relative w-full border-t border-b border-[#1f261e] overflow-hidden shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="px-6 lg:px-7 xl:px-8 2xl:px-10 py-4 flex items-center justify-between border-b border-[#1f261e]/50">
          <div className="flex items-center gap-2 lg:gap-2.5 xl:gap-2.5">
            <Image
              src="/assets/icons/home/fire-02.svg"
              alt="Spotlight"
              width={20}
              height={20}
              className="lg:w-6 lg:h-6"
            />
            <span className="text-white text-xs lg:text-sm xl:text-base font-semibold">Spotlight</span>
          </div>
          <span className="text-[#7c7c7c] text-xs lg:text-sm xl:text-base font-semibold">Volume</span>
        </div>

        {/* Carousel Content */}
        <div className="relative overflow-hidden">
          <div
            key={activePage}
            className="spotlight-slide-in flex flex-col"
          >
            {currentPageItems.map((item) => (
              <div
                key={`${item.rank}-${activePage}`}
                className="flex items-center justify-between px-6 lg:px-7 xl:px-8 2xl:px-10 py-2 border-b border-[#1f261e]/30 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#7c7c7c] text-xs lg:text-xs xl:text-sm font-semibold w-5 lg:w-6 xl:w-7 text-left">
                    #{item.rank}
                  </span>
                  <Image
                    src={item.icon}
                    alt={item.symbol}
                    width={20}
                    height={20}
                    className="lg:w-7 lg:h-7"
                  />
                  <div className="flex items-center gap-1 lg:gap-1.5 xl:gap-2">
                    <span className="text-white text-xs lg:text-sm xl:text-base font-semibold">
                      {item.symbol}
                    </span>
                    <span
                      className={`text-xs lg:text-xs xl:text-sm font-medium ${
                        item.changePositive ? "text-[#3fea9b]" : "text-[#ff5c5c]"
                      }`}
                    >
                      {item.change}
                    </span>
                  </div>
                </div>
                <span className="text-white text-xs lg:text-sm xl:text-base font-semibold">
                  {item.vol}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pagination indicators */}
      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {Array.from({ length: totalPages }).map((_, index) => {
            const isActive = index === activePage;
            return (
              <button
                key={index}
                type="button"
                onClick={() => goToPage(index)}
                aria-label={`Go to spotlight page ${index + 1}`}
                className={`h-[5px] rounded-full transition-colors cursor-pointer ${
                  isActive ? "bg-[#b1f128] w-4" : "bg-[#1F261E] w-10"
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

