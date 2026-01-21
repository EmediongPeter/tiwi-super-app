/**
 * useFactoryStaking Hook
 * 
 * Hook for interacting with TIWI Staking Pool Factory contract
 * Allows admin to create pools and users to interact with pools via poolId
 */

import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useMemo } from 'react';
import { parseUnits, formatUnits, Address } from 'viem';
import { TIWI_STAKING_POOL_FACTORY_ABI_ARRAY } from '@/lib/contracts/types';
import type { FactoryPoolInfo, FactoryUserInfo, FactoryPoolConfig, FactoryPoolState } from '@/lib/contracts/types';

// ERC20 ABI for approvals
const ERC20_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Factory address per chain - should be in env config
const FACTORY_ADDRESSES: Record<number, Address> = {
  1: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS_MAINNET as Address) || '0x0000000000000000000000000000000000000000',
  56: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS_BSC as Address) || '0x0000000000000000000000000000000000000000',
  137: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS_POLYGON as Address) || '0x0000000000000000000000000000000000000000',
  42161: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS_ARBITRUM as Address) || '0x0000000000000000000000000000000000000000',
  8453: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS_BASE as Address) || '0x0000000000000000000000000000000000000000',
  10: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS_OPTIMISM as Address) || '0x0000000000000000000000000000000000000000',
  43114: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS_AVALANCHE as Address) || '0x0000000000000000000000000000000000000000',
};

interface UseFactoryStakingOptions {
  factoryAddress?: Address; // Optional override
  poolId?: bigint | number;
  stakingTokenAddress?: Address;
  decimals?: number;
  enabled?: boolean;
}

interface UseFactoryStakingReturn {
  // Pool info (if poolId provided)
  poolInfo: FactoryPoolInfo | null;
  userInfo: FactoryUserInfo | null;
  pendingReward: bigint | null;
  
  // All pools
  allPoolIds: bigint[] | null;
  
  // Loading states
  isLoading: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  
  // Transaction states
  createPoolTxHash: string | null;
  depositTxHash: string | null;
  withdrawTxHash: string | null;
  claimTxHash: string | null;
  fundPoolTxHash: string | null;
  
  // Actions
  createPool: (stakingToken: Address, rewardToken: Address, poolReward: string, rewardDurationSeconds: number, maxTvl: string) => Promise<bigint | null>;
  deposit: (poolId: bigint | number, amount: string) => Promise<void>;
  withdraw: (poolId: bigint | number, amount: string) => Promise<void>;
  claim: (poolId: bigint | number) => Promise<void>;
  fundPool: (poolId: bigint | number) => Promise<void>;
  updatePoolConfig: (poolId: bigint | number, poolReward: string, rewardDurationSeconds: number, maxTvl: string) => Promise<void>;
  authorizeAdmin: (adminAddress: Address) => Promise<void>;
  revokeAdmin: (adminAddress: Address) => Promise<void>;
  
  // Approval
  approve: (poolId: bigint | number, amount?: string) => Promise<void>;
  allowance: bigint | null;
  needsApproval: (poolId: bigint | number, amount: string) => boolean;
  
  // Refresh
  refetch: () => void;
}

export function useFactoryStaking(options: UseFactoryStakingOptions = {}): UseFactoryStakingReturn {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { writeContract, data: txHash, isPending, isError, error, isSuccess } = useWriteContract();
  const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash: txHash });

  const {
    factoryAddress,
    poolId,
    stakingTokenAddress,
    decimals = 18,
    enabled = true,
  } = options;

  // Get factory address (from options, chain mapping, or env)
  const contractAddress = useMemo(() => {
    if (factoryAddress) return factoryAddress;
    if (chainId && FACTORY_ADDRESSES[chainId]) return FACTORY_ADDRESSES[chainId];
    return undefined;
  }, [factoryAddress, chainId]);

  // Get all pool IDs
  const { data: allPoolIdsData, refetch: refetchPoolIds } = useReadContract({
    address: contractAddress,
    abi: TIWI_STAKING_POOL_FACTORY_ABI_ARRAY,
    functionName: 'getActivePoolIds',
    query: {
      enabled: enabled && !!contractAddress,
    },
  });

  // Get pool info (if poolId provided)
  const { data: poolInfoData, refetch: refetchPoolInfo } = useReadContract({
    address: contractAddress,
    abi: TIWI_STAKING_POOL_FACTORY_ABI_ARRAY,
    functionName: 'getPoolInfo',
    args: poolId !== undefined ? [BigInt(poolId)] : undefined,
    query: {
      enabled: enabled && !!contractAddress && poolId !== undefined,
    },
  });

  // Get user info (if poolId and address provided)
  const { data: userInfoData, refetch: refetchUserInfo } = useReadContract({
    address: contractAddress,
    abi: TIWI_STAKING_POOL_FACTORY_ABI_ARRAY,
    functionName: 'getUserInfo',
    args: poolId !== undefined && address ? [BigInt(poolId), address] : undefined,
    query: {
      enabled: enabled && !!contractAddress && poolId !== undefined && !!address,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  // Get pending reward
  const { data: pendingRewardData, refetch: refetchPending } = useReadContract({
    address: contractAddress,
    abi: TIWI_STAKING_POOL_FACTORY_ABI_ARRAY,
    functionName: 'pendingReward',
    args: poolId !== undefined && address ? [BigInt(poolId), address] : undefined,
    query: {
      enabled: enabled && !!contractAddress && poolId !== undefined && !!address,
      refetchInterval: 5000,
    },
  });

  // Get allowance (if stakingTokenAddress and poolId provided)
  const poolConfig = poolInfoData?.[0] as FactoryPoolConfig | undefined;
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: stakingTokenAddress || poolConfig?.stakingToken,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: {
      enabled: enabled && !!address && !!contractAddress && !!(stakingTokenAddress || poolConfig?.stakingToken),
    },
  });

  // Actions
  const createPool = async (
    stakingToken: Address,
    rewardToken: Address,
    poolReward: string,
    rewardDurationSeconds: number,
    maxTvl: string
  ): Promise<bigint | null> => {
    if (!contractAddress) throw new Error('Factory address not configured for this chain');
    if (!address) throw new Error('Wallet not connected');
    
    const poolRewardWei = parseUnits(poolReward, 18);
    const maxTvlWei = parseUnits(maxTvl, 18);
    
    const hash = await writeContract({
      address: contractAddress,
      abi: TIWI_STAKING_POOL_FACTORY_ABI_ARRAY,
      functionName: 'createPool',
      args: [stakingToken, rewardToken, poolRewardWei, BigInt(rewardDurationSeconds), maxTvlWei],
    });
    
    // Wait for transaction receipt to get poolId from event
    // Note: The poolId will be returned from the contract call
    // For now, we return null and extract it from the receipt/event later
    // TODO: Parse PoolCreated event to get the actual poolId
    return null;
  };

  // Authorize an admin wallet (factory owner only)
  const authorizeAdmin = async (adminAddress: Address) => {
    if (!contractAddress) throw new Error('Factory address not configured');
    
    await writeContract({
      address: contractAddress,
      abi: TIWI_STAKING_POOL_FACTORY_ABI_ARRAY,
      functionName: 'authorizeAdmin',
      args: [adminAddress],
    });
  };

  // Revoke admin authorization (factory owner only)
  const revokeAdmin = async (adminAddress: Address) => {
    if (!contractAddress) throw new Error('Factory address not configured');
    
    await writeContract({
      address: contractAddress,
      abi: TIWI_STAKING_POOL_FACTORY_ABI_ARRAY,
      functionName: 'revokeAdmin',
      args: [adminAddress],
    });
  };

  const deposit = async (poolId: bigint | number, amount: string) => {
    if (!contractAddress) throw new Error('Factory address not configured');
    if (!address) throw new Error('Wallet not connected');
    if (!isConnected) throw new Error('Wallet is not connected');
    if (!connector) throw new Error('Wallet connector not available');
    
    const amountWei = parseUnits(amount, decimals);
    
    console.log('[useFactoryStaking] deposit called', {
      contractAddress,
      poolId: Number(poolId),
      amount,
      amountWei: amountWei.toString(),
      address,
      isConnected,
      chainId,
      connector: connector?.name || connector?.id,
    });
    
    try {
      const hash = await writeContract({
        address: contractAddress,
        abi: TIWI_STAKING_POOL_FACTORY_ABI_ARRAY,
        functionName: 'deposit',
        args: [BigInt(poolId), amountWei],
        chainId: chainId,
      });
      console.log('[useFactoryStaking] deposit transaction hash:', hash);
      return hash;
    } catch (error: any) {
      console.error('[useFactoryStaking] deposit error:', error);
      // Provide more helpful error message
      if (error?.message?.includes('getChainId')) {
        throw new Error('Wallet connection issue. Please disconnect and reconnect your wallet.');
      }
      throw error;
    }
  };

  const withdraw = async (poolId: bigint | number, amount: string) => {
    if (!contractAddress) throw new Error('Factory address not configured');
    const amountWei = parseUnits(amount, decimals);
    
    await writeContract({
      address: contractAddress,
      abi: TIWI_STAKING_POOL_FACTORY_ABI_ARRAY,
      functionName: 'withdraw',
      args: [BigInt(poolId), amountWei],
    });
  };

  const claim = async (poolId: bigint | number) => {
    if (!contractAddress) throw new Error('Factory address not configured');
    
    await writeContract({
      address: contractAddress,
      abi: TIWI_STAKING_POOL_FACTORY_ABI_ARRAY,
      functionName: 'claim',
      args: [BigInt(poolId)],
    });
  };

  const fundPool = async (poolId: bigint | number) => {
    if (!contractAddress) throw new Error('Factory address not configured');
    
    await writeContract({
      address: contractAddress,
      abi: TIWI_STAKING_POOL_FACTORY_ABI_ARRAY,
      functionName: 'fundPoolRewards',
      args: [BigInt(poolId)],
    });
  };

  const updatePoolConfig = async (
    poolId: bigint | number,
    poolReward: string,
    rewardDurationSeconds: number,
    maxTvl: string
  ) => {
    if (!contractAddress) throw new Error('Factory address not configured');
    
    const poolRewardWei = parseUnits(poolReward, 18);
    const maxTvlWei = parseUnits(maxTvl, 18);
    
    await writeContract({
      address: contractAddress,
      abi: TIWI_STAKING_POOL_FACTORY_ABI_ARRAY,
      functionName: 'updatePoolConfig',
      args: [BigInt(poolId), poolRewardWei, BigInt(rewardDurationSeconds), maxTvlWei],
    });
  };

  const approve = async (poolId: bigint | number, amount?: string) => {
    const tokenAddress = stakingTokenAddress || poolConfig?.stakingToken;
    if (!tokenAddress) throw new Error('Staking token address not found');
    if (!contractAddress) throw new Error('Factory address not configured');
    if (!address) throw new Error('Wallet not connected');
    if (!isConnected) throw new Error('Wallet is not connected');
    if (!connector) throw new Error('Wallet connector not available');
    
    const amountWei = amount ? parseUnits(amount, decimals) : BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    
    console.log('[useFactoryStaking] approve called', {
      tokenAddress,
      contractAddress,
      amount,
      amountWei: amountWei.toString(),
      address,
      isConnected,
      chainId,
      connector: connector?.name || connector?.id,
    });
    
    try {
      const hash = await writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contractAddress, amountWei],
        chainId: chainId,
      });
      console.log('[useFactoryStaking] approve transaction hash:', hash);
      return hash;
    } catch (error: any) {
      console.error('[useFactoryStaking] approve error:', error);
      // Provide more helpful error message
      if (error?.message?.includes('getChainId')) {
        throw new Error('Wallet connection issue. Please disconnect and reconnect your wallet.');
      }
      throw error;
    }
  };

  const needsApproval = (poolId: bigint | number, amount: string): boolean => {
    if (!allowanceData) return true;
    const amountWei = parseUnits(amount, decimals);
    return allowanceData < amountWei;
  };

  const refetch = () => {
    refetchPoolIds();
    refetchPoolInfo();
    refetchUserInfo();
    refetchPending();
    refetchAllowance();
  };

  // Parse pool info
  const poolInfo: FactoryPoolInfo | null = poolInfoData
    ? {
        config: poolInfoData[0] as FactoryPoolConfig,
        state: poolInfoData[1] as FactoryPoolState,
      }
    : null;

  // Parse user info
  const userInfo: FactoryUserInfo | null = userInfoData
    ? {
        amount: userInfoData[0] as bigint,
        rewardDebt: userInfoData[1] as bigint,
        stakeTime: userInfoData[2] as bigint,
        pending: userInfoData[3] as bigint,
      }
    : null;

  return {
    poolInfo,
    userInfo,
    pendingReward: pendingRewardData as bigint | null,
    allPoolIds: allPoolIdsData as bigint[] | null,
    isLoading: isWaiting,
    isPending,
    isSuccess,
    isError,
    error: error as Error | null,
    createPoolTxHash: txHash || null,
    depositTxHash: txHash || null,
    withdrawTxHash: txHash || null,
    claimTxHash: txHash || null,
    fundPoolTxHash: txHash || null,
    createPool,
    deposit,
    withdraw,
    claim,
    fundPool,
    updatePoolConfig,
    authorizeAdmin,
    revokeAdmin,
    approve,
    allowance: allowanceData as bigint | null,
    needsApproval,
    refetch,
  };
}
