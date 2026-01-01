/**
 * Amount Transformer
 * 
 * Transforms human-readable amounts to smallest unit and vice versa.
 */

/**
 * Transform human-readable amount to smallest unit
 * @param amount - Human-readable amount (e.g., "100.5")
 * @param decimals - Token decimals (e.g., 18 for ETH, 6 for USDC)
 * @returns Amount in smallest unit as string (e.g., "100500000")
 */
export function toSmallestUnit(amount: string, decimals: number): string {
  // Handle empty or invalid input
  if (!amount || amount.trim() === '') {
    return '0';
  }
  
  // Split into integer and decimal parts
  const [integerPart = '0', decimalPart = ''] = amount.split('.');
  
  // Pad decimal part to required length and truncate if too long
  const paddedDecimal = decimalPart
    .padEnd(decimals, '0')
    .slice(0, decimals);
  
  // Combine integer and decimal parts
  const result = integerPart + paddedDecimal;
  
  // Remove leading zeros (but keep at least one zero if result is "0")
  return result.replace(/^0+/, '') || '0';
}

/**
 * Convert smallest unit to human-readable amount
 * @param amount - Amount in smallest unit (e.g., "100500000")
 * @param decimals - Token decimals
 * @returns Human-readable amount (e.g., "100.5")
 */
export function toHumanReadable(amount: string, decimals: number): string {
  // Handle empty or invalid input
  if (!amount || amount === '0') {
    return '0';
  }
  
  // Remove leading zeros
  const trimmedAmount = amount.replace(/^0+/, '') || '0';
  console.log("🚀 ~ toHumanReadable ~ trimmedAmount:", trimmedAmount, {length: trimmedAmount.length})
  
  // If amount has fewer digits than decimals, pad with zeros
  if (trimmedAmount.length <= decimals) {
    const padded = trimmedAmount.padStart(decimals, '0');
    const integerPart = '0';
    const decimalPart = padded;
    const trimmedDecimal = decimalPart.replace(/0+$/, '');
    if (trimmedDecimal) {
      return `${integerPart}.${trimmedDecimal}`;
    }
    return '0';
  }
  
  // Amount has more digits than decimals
  // Split: integer part = everything except last 'decimals' digits
  //        decimal part = last 'decimals' digits
  const integerPart = trimmedAmount.slice(0, -decimals);
  const decimalPart = trimmedAmount.slice(-decimals);
  
  // Remove trailing zeros from decimal part
  const trimmedDecimal = decimalPart.replace(/0+$/, '');
  
  // Return formatted amount
  if (trimmedDecimal) {
    return `${integerPart}.${trimmedDecimal}`;
  }
  return integerPart;
}

/**
 * Validate amount format
 * @param amount - Amount string to validate
 * @returns true if valid, false otherwise
 */
export function isValidAmount(amount: string): boolean {
  if (!amount || amount.trim() === '') {
    return false;
  }
  
  // Check for valid number format (allows decimals)
  const numberRegex = /^\d+(\.\d+)?$/;
  if (!numberRegex.test(amount)) {
    return false;
  }
  
  // Check for negative numbers
  if (parseFloat(amount) < 0) {
    return false;
  }
  
  return true;
}

