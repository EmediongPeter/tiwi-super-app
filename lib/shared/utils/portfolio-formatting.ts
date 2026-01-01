/**
 * Portfolio Formatting Utilities
 * 
 * Helper functions for formatting data for portfolio display
 */

import type { WalletToken } from '@/lib/backend/types/wallet';

export interface PortfolioAsset {
  name: string;
  symbol: string;
  amount: string;
  value: string; // Formatted as "$X,XXX.XX"
  icon: string;
  trend: 'bullish' | 'bearish';
}

/**
 * Format currency value with commas and 2 decimals
 */
export function formatCurrency(value: string | undefined): string {
  if (!value) return '$0.00';
  
  const num = parseFloat(value);
  if (isNaN(num)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Get trend from 24h price change
 */
export function getTrendFromPriceChange(priceChange24h?: string): 'bullish' | 'bearish' {
  if (!priceChange24h) return 'bearish';
  
  const change = parseFloat(priceChange24h);
  if (isNaN(change)) return 'bearish';
  
  return change >= 0 ? 'bullish' : 'bearish';
}

/**
 * Get token fallback icon path
 */
export function getTokenFallbackIcon(symbol: string): string {
  // Try common token icons first
  const commonTokens: Record<string, string> = {
    'ETH': '/assets/icons/tokens/ethereum.svg',
    'BNB': '/assets/icons/chains/bsc.svg',
    'BTC': '/assets/icons/chains/bitcoin.svg',
    'SOL': '/assets/icons/tokens/solana.svg',
    'USDT': '/assets/icons/tokens/tether.svg',
    'USDC': '/assets/icons/tokens/usdc.svg',
    'MATIC': '/assets/icons/chains/polygon.svg',
    'POL': '/assets/icons/chains/polygon.svg',
    'AVAX': '/assets/icons/chains/avalanche.svg',
  };
  
  if (commonTokens[symbol.toUpperCase()]) {
    return commonTokens[symbol.toUpperCase()];
  }
  
  // Default fallback - first letter in circle
  return `/assets/icons/tokens/default.svg`;
}

/**
 * Map WalletToken to PortfolioAsset format
 */
export function mapWalletTokenToAsset(token: WalletToken): PortfolioAsset {
  return {
    name: token.name,
    symbol: token.symbol,
    amount: token.balanceFormatted,
    value: formatCurrency(token.usdValue),
    icon: token.logoURI || getTokenFallbackIcon(token.symbol),
    trend: getTrendFromPriceChange(token.priceChange24h),
  };
}

/**
 * Map array of WalletToken to PortfolioAsset array
 * Filters zero balances and sorts by USD value (highest first)
 */
export function mapWalletTokensToAssets(
  tokens: WalletToken[],
  options?: {
    includeZeroBalances?: boolean;
    sortBy?: 'value' | 'name' | 'symbol';
  }
): PortfolioAsset[] {
  const { includeZeroBalances = false, sortBy = 'value' } = options || {};
  
  // Filter tokens
  let filtered = tokens;
  if (!includeZeroBalances) {
    filtered = tokens.filter(token => {
      const usdValue = parseFloat(token.usdValue || '0');
      return usdValue > 0;
    });
  }
  
  // Map to portfolio assets
  const assets = filtered.map(mapWalletTokenToAsset);
  
  // Sort
  switch (sortBy) {
    case 'value':
      return assets.sort((a, b) => {
        const aValue = parseFloat(a.value.replace(/[^0-9.]/g, ''));
        const bValue = parseFloat(b.value.replace(/[^0-9.]/g, ''));
        return bValue - aValue; // Highest first
      });
    case 'name':
      return assets.sort((a, b) => a.name.localeCompare(b.name));
    case 'symbol':
      return assets.sort((a, b) => a.symbol.localeCompare(b.symbol));
    default:
      return assets;
  }
}

