"use client";

import { formatPriceWithSubscript } from "@/lib/shared/utils/price-formatting-subscript";

interface SubscriptPairPriceProps {
  price: string | number | undefined;
  quoteSymbol: string;
  className?: string;
}

/**
 * SubscriptPairPrice Component
 * 
 * Displays pair price with quote token symbol using subscript notation for very small prices.
 * 
 * Format:
 * - Normal prices: "0.0227 USDC"
 * - Very small prices: "0.0₉4070 USDC" (with subscript for leading zeros)
 * - Tooltip shows full decimal value on hover
 * 
 * Only formats prices with many decimal places (>= 6 leading zeros) using subscript.
 * Other prices use standard formatting.
 */
export function SubscriptPairPrice({
  price,
  quoteSymbol,
  className = "",
}: SubscriptPairPriceProps) {
  if (price === undefined || price === null) {
    return (
      <span className={className}>
        0.00 {quoteSymbol}
      </span>
    );
  }

  // Convert to number for formatting
  const numPrice = typeof price === "string" ? parseFloat(price) : price;

  if (isNaN(numPrice) || numPrice <= 0) {
    return (
      <span className={className}>
        0.00 {quoteSymbol}
      </span>
    );
  }

  // Format price with subscript notation (no prefix, min 6 decimals for subscript)
  const formatted = formatPriceWithSubscript(numPrice, {
    prefix: '',
    minDecimalsForSubscript: 6,
    maxDisplayDecimals: 4,
  });

  // Full raw value for tooltip
  const rawValue = typeof price === "string" ? price : numPrice.toString();
  const tooltip = `${rawValue} ${quoteSymbol}`;

  return (
    <span className={className} title={tooltip}>
      {formatted} {quoteSymbol}
    </span>
  );
}

