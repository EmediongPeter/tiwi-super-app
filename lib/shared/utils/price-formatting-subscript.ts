/**
 * Price Formatting with Subscript Notation
 * 
 * Formats very small prices like DexScreener:
 * - 0.00000000005044 → 0.0₉₅₀₄₄ (9 decimals before 5044)
 * - 0.0000000000005608 → 0.0₁₂₅₆₀₈ (12 decimals before 5608)
 */

// Unicode subscript characters for digits 0-9
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

/**
 * Convert a number to subscript notation
 * @param num - Number to convert (0-9)
 * @returns Subscript character
 */
function toSubscript(num: number): string {
  if (num >= 0 && num <= 9) {
    return SUBSCRIPT_DIGITS[num];
  }
  return num.toString();
}

/**
 * Convert a string of digits to subscript
 * @param digits - String of digits (e.g., "9", "12", "5044")
 * @returns Subscript string (e.g., "₉", "₁₂", "₅₀₄₄")
 */
function digitsToSubscript(digits: string): string {
  return digits.split('').map(d => toSubscript(parseInt(d, 10))).join('');
}

/**
 * Format a very small price with subscript notation (DexScreener style)
 * 
 * @param price - Price value (number or string)
 * @param options - Formatting options
 * @returns Formatted price string (e.g., "0.0₉₅₀₄₄" or "$0.0₉₅₀₄₄")
 * 
 * @example
 * formatPriceWithSubscript(0.00000000005044) // "0.0₉₅₀₄₄"
 * formatPriceWithSubscript(0.0000000000005608) // "0.0₁₂₅₆₀₈"
 * formatPriceWithSubscript(0.095044, { prefix: '$' }) // "$0.095044"
 * formatPriceWithSubscript(0.1149838573e-6) // "0.0₆₁₁₄₉" (6 leading zeros, then 1149...)
 */
export function formatPriceWithSubscript(
  price: number | string,
  options: {
    prefix?: string; // Prefix to add (e.g., "$")
    minDecimalsForSubscript?: number; // Minimum decimals to trigger subscript (default: 6)
    maxDisplayDecimals?: number; // Maximum decimals to display after subscript (default: 4)
  } = {}
): string {
  const {
    prefix = '',
    minDecimalsForSubscript = 6,
    maxDisplayDecimals = 4,
  } = options;

  let numPrice: number;
  
  // Handle scientific notation (e.g., "0.1149838573e-6")
  if (typeof price === 'string' && (price.includes('e') || price.includes('E'))) {
    numPrice = parseFloat(price);
  } else {
    numPrice = typeof price === 'string' ? parseFloat(price) : price;
  }
  
  if (isNaN(numPrice) || numPrice <= 0) {
    return `${prefix}0.00`;
  }

  // If price is >= 0.000001, use normal formatting
  if (numPrice >= 0.000001) {
    // Format normally with appropriate decimals
    if (numPrice < 0.01) {
      return `${prefix}${numPrice.toFixed(6)}`;
    } else if (numPrice < 1) {
      return `${prefix}${numPrice.toFixed(4)}`;
    } else if (numPrice < 1000) {
      return `${prefix}${numPrice.toFixed(2)}`;
    } else {
      return `${prefix}${numPrice.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  }

  // For very small prices, use subscript notation
  // Convert to fixed decimal string with high precision to handle scientific notation
  const priceStr = numPrice.toFixed(20); // Use high precision
  const [integerPart, decimalPart] = priceStr.split('.');
  
  if (!decimalPart) {
    return `${prefix}${integerPart}`;
  }

  // Find the first non-zero digit in decimal part
  let firstNonZeroIndex = -1;
  for (let i = 0; i < decimalPart.length; i++) {
    if (decimalPart[i] !== '0') {
      firstNonZeroIndex = i;
      break;
    }
  }

  if (firstNonZeroIndex === -1) {
    // All zeros
    return `${prefix}0.00`;
  }

  // Count leading zeros (decimals before first non-zero)
  const leadingZeros = firstNonZeroIndex;
  
  // If leading zeros < minDecimalsForSubscript, use normal formatting
  if (leadingZeros < minDecimalsForSubscript) {
    return `${prefix}${numPrice.toFixed(leadingZeros + maxDisplayDecimals + 1)}`;
  }

  // Extract the significant digits (first non-zero and following digits)
  const significantDigits = decimalPart.substring(firstNonZeroIndex);
  const displayDigits = significantDigits.substring(0, maxDisplayDecimals);

  // Format: 0.0 + subscript(leadingZeros) + displayDigits
  // Example: 0.00000000005044 → 0.0₉₅₀₄₄ (9 zeros before 5044)
  // Example: 0.1149838573e-6 = 0.0000001149838573 → 0.0₆₁₁₄₉ (6 zeros before 1149...)
  const subscript = digitsToSubscript(leadingZeros.toString());
  
  return `${prefix}0.${subscript}${displayDigits}`;
}

/**
 * Format price for TradingView chart (no prefix, for price axis and OHLC)
 * This is the formatter used directly in TradingView charts
 */
export function formatPriceForChart(price: number | string): string {
  return formatPriceWithSubscript(price, {
    prefix: '',
    minDecimalsForSubscript: 6,
    maxDisplayDecimals: 6, // Show more digits for chart precision
  });
}

/**
 * Format price in WBNB (or other quote token) with subscript notation
 * 
 * @param price - Price value (number or string)
 * @param quoteSymbol - Quote token symbol (e.g., "WBNB")
 * @returns Formatted price string (e.g., "0.0₁₂₅₆₀₈ WBNB")
 * 
 * @example
 * formatQuotePrice(0.0000000000005608, "WBNB") // "0.0₁₂₅₆₀₈ WBNB"
 */
export function formatQuotePrice(
  price: number | string,
  quoteSymbol: string
): string {
  const formatted = formatPriceWithSubscript(price, {
    minDecimalsForSubscript: 6,
    maxDisplayDecimals: 4,
  });
  return `${formatted} ${quoteSymbol}`;
}

/**
 * Format USD price with subscript notation if needed
 * 
 * @param price - Price value (number or string)
 * @returns Formatted price string (e.g., "$0.0₉₅₀₄₄" or "$0.095044")
 * 
 * @example
 * formatUSDPrice(0.00000000005044) // "$0.0₉₅₀₄₄"
 * formatUSDPrice(0.095044) // "$0.095044"
 */
export function formatUSDPrice(price: number | string): string {
  return formatPriceWithSubscript(price, {
    prefix: '$',
    minDecimalsForSubscript: 6,
    maxDisplayDecimals: 4,
  });
}

