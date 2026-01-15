/**
 * Multi-Wallet Balances Hook
 * 
 * Aggregates balances from multiple connected wallets
 * Fetches balances in parallel and merges tokens across wallets
 */

import { useQueries } from '@tanstack/react-query';
import { useWalletBalances, getWalletBalancesQueryKey } from './useWalletBalances';
import type { WalletAccount } from '@/lib/wallet/connection/types';
import type { WalletToken } from '@/lib/backend/types/wallet';

export interface WalletBalanceData {
  wallet: WalletAccount;
  balances: WalletToken[];
  totalUSD: string;
  dailyChange?: number;
  dailyChangeUSD?: string;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
}

export interface UseMultiWalletBalancesReturn {
  // Aggregated data
  balances: WalletToken[]; // Merged tokens across all wallets
  totalUSD: string; // Sum of all wallet totals
  dailyChange?: number; // Aggregated daily change percentage
  dailyChangeUSD?: string; // Aggregated daily change USD
  
  // Per-wallet breakdown
  wallets: WalletBalanceData[];
  
  // Overall loading state
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  errors: string[];
  
  // Actions
  refetch: () => void;
  refetchWallet: (walletAddress: string) => void;
}

/**
 * Merge tokens from multiple wallets
 * Same token (chainId + address) across wallets: sum balances
 * Different chains: keep separate
 */
function mergeTokenBalances(walletDataList: WalletBalanceData[]): WalletToken[] {
  const tokenMap = new Map<string, WalletToken>();
  
  walletDataList.forEach(({ balances }) => {
    balances.forEach((token) => {
      // Create unique key: chainId-address (case-insensitive)
      const addressKey = (token.address || '').toLowerCase();
      const key = `${token.chainId}-${addressKey}`;
      
      const existing = tokenMap.get(key);
      if (existing) {
        // Same token exists - sum balances
        const existingBalance = parseFloat(existing.balance || '0');
        const newBalance = parseFloat(token.balance || '0');
        const existingUsdValue = parseFloat(existing.usdValue || '0');
        const newUsdValue = parseFloat(token.usdValue || '0');
        
        tokenMap.set(key, {
          ...existing,
          balance: (existingBalance + newBalance).toString(),
          balanceFormatted: (existingBalance + newBalance).toFixed(existing.decimals || 18),
          usdValue: (existingUsdValue + newUsdValue).toFixed(2),
        });
      } else {
        // New token - add it
        tokenMap.set(key, { ...token });
      }
    });
  });
  
  return Array.from(tokenMap.values());
}

/**
 * Sum total USD from all wallets
 */
function sumTotalUSD(walletDataList: WalletBalanceData[]): string {
  const total = walletDataList.reduce((sum, { totalUSD }) => {
    return sum + parseFloat(totalUSD || '0');
  }, 0);
  
  return total.toFixed(2);
}

/**
 * Aggregate daily changes from all wallets
 */
function aggregateDailyChange(walletDataList: WalletBalanceData[]): {
  dailyChange?: number;
  dailyChangeUSD?: string;
} {
  const walletsWithChange = walletDataList.filter(
    w => w.dailyChange !== undefined && w.dailyChangeUSD !== undefined
  );
  
  if (walletsWithChange.length === 0) {
    return {};
  }
  
  // Sum USD changes
  const totalChangeUSD = walletsWithChange.reduce((sum, { dailyChangeUSD }) => {
    return sum + parseFloat(dailyChangeUSD || '0');
  }, 0);
  
  // Calculate weighted average percentage
  const totalUSD = walletDataList.reduce((sum, { totalUSD }) => {
    return sum + parseFloat(totalUSD || '0');
  }, 0);
  
  const dailyChange = totalUSD > 0 
    ? (totalChangeUSD / totalUSD) * 100 
    : 0;
  
  return {
    dailyChange: parseFloat(dailyChange.toFixed(2)),
    dailyChangeUSD: totalChangeUSD.toFixed(2),
  };
}

/**
 * Hook to fetch and aggregate balances from multiple wallets
 * 
 * @param connectedWallets - Array of connected wallet accounts
 * @returns Aggregated balances, per-wallet breakdown, loading states
 */
export function useMultiWalletBalances(
  connectedWallets: WalletAccount[]
): UseMultiWalletBalancesReturn {
  // Fetch balances for all wallets in parallel using useQueries
  const balanceQueries = useQueries({
    queries: connectedWallets.map((wallet) => ({
      queryKey: getWalletBalancesQueryKey(wallet.address),
      queryFn: async () => {
        // Import fetchWalletBalances dynamically to avoid circular dependency
        const { fetchWalletBalances } = await import('./useWalletBalances');
        return await fetchWalletBalances(wallet.address);
      },
      enabled: !!wallet.address,
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    })),
  });
  
  // Transform queries into wallet data
  const wallets: WalletBalanceData[] = connectedWallets.map((wallet, index) => {
    const query = balanceQueries[index];
    const data = query.data;
    const hasData = !!data;
    const showSkeleton = query.isLoading || (query.isFetching && !hasData);
    
    return {
      wallet,
      balances: data?.balances || [],
      totalUSD: data?.totalUSD || '0.00',
      dailyChange: data?.dailyChange,
      dailyChangeUSD: data?.dailyChangeUSD,
      isLoading: showSkeleton,
      isFetching: query.isFetching,
      error: query.error 
        ? (query.error instanceof Error ? query.error.message : 'Failed to fetch wallet balances')
        : null,
    };
  });
  
  // Aggregate data
  const mergedBalances = mergeTokenBalances(wallets);
  const aggregatedTotalUSD = sumTotalUSD(wallets);
  const aggregatedDailyChange = aggregateDailyChange(wallets);
  
  // Overall loading state
  const isLoading = balanceQueries.some(q => q.isLoading && !q.data);
  const isFetching = balanceQueries.some(q => q.isFetching);
  const errors = wallets
    .filter(w => w.error)
    .map(w => `${w.wallet.address}: ${w.error}`);
  const hasError = errors.length > 0;
  
  // Refetch all wallets
  const refetch = () => {
    balanceQueries.forEach(query => {
      if (query.refetch) {
        query.refetch();
      }
    });
  };
  
  // Refetch specific wallet
  const refetchWallet = (walletAddress: string) => {
    const walletIndex = connectedWallets.findIndex(
      w => w.address.toLowerCase() === walletAddress.toLowerCase()
    );
    if (walletIndex >= 0 && balanceQueries[walletIndex]?.refetch) {
      balanceQueries[walletIndex].refetch();
    }
  };
  
  return {
    balances: mergedBalances,
    totalUSD: aggregatedTotalUSD,
    dailyChange: aggregatedDailyChange.dailyChange,
    dailyChangeUSD: aggregatedDailyChange.dailyChangeUSD,
    wallets,
    isLoading,
    isFetching,
    hasError,
    errors,
    refetch,
    refetchWallet,
  };
}

