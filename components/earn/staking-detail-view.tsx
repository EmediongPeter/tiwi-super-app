"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { ArrowLeft, RefreshCw, X, Zap, AlertTriangle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { formatTokenAmount, formatCurrency, parseFormattedAmount } from "@/lib/shared/utils/portfolio-formatting";
import { useWallet } from "@/lib/wallet/hooks/useWallet";
import { useActiveWalletAddress } from "@/lib/wallet/hooks/useActiveWalletAddress";
import { useChainId } from "wagmi";
import { formatUnits, parseUnits, Address } from "viem";
import { useStaking } from "@/hooks/useStaking";
import { useFactoryStaking } from "@/hooks/useFactoryStaking";
import TransactionToast from "./transaction-toast";
import type { StakingPool } from "@/data/mock-staking-pools";
import { calculateAPRFromPoolConfig } from "@/lib/shared/utils/staking-rewards";

interface StakingDetailViewProps {
  pool: StakingPool;
  onBack: () => void;
}

export default function StakingDetailView({ pool, onBack }: StakingDetailViewProps) {
  const [activeTab, setActiveTab] = useState<"boost" | "unstake">("boost");
  const [showBoostMessage, setShowBoostMessage] = useState(true);
  const [showUnstakeWarning, setShowUnstakeWarning] = useState(true);
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastSuccess, setToastSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [txChainId, setTxChainId] = useState<number | undefined>();

  // Use the same wallet address hook as portfolio (works for both local and external wallets)
  const activeAddress = useActiveWalletAddress();
  const { isConnected, address } = useWallet();
  const chainId = useChainId();
  
  // Use the same wallet balances method as portfolio for accurate balance
  const tokenAddress = pool.tokenAddress;
  // TWC token is on BSC (chain ID 56) - ensure we use the correct chain
  const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';
  const isTWC = tokenAddress?.toLowerCase() === TWC_ADDRESS.toLowerCase();
  const poolChainId = isTWC ? 56 : (pool.chainId || chainId);
  
  // Fetch all wallet balances (EXACT same as portfolio)
  const { 
    balances: walletTokens,
    isLoading: balanceLoading,
    error: balanceError,
    refetch: refetchTokenBalance 
  } = useWalletBalances(activeAddress);
  
  // Find the specific token in the balances - EXACT same logic as portfolio
  // Portfolio finds tokens by matching address and chainId from walletTokens array
  const foundToken = useMemo(() => {
    if (!tokenAddress || !walletTokens || walletTokens.length === 0) {
      return null;
    }
    
    const tokenAddressLower = tokenAddress.toLowerCase();
    
    // Find token by address and chainId (EXACT same as portfolio)
    const token = walletTokens.find((token: any) => 
      token.address?.toLowerCase() === tokenAddressLower && 
      token.chainId === poolChainId
    );
    
    return token || null;
  }, [walletTokens, tokenAddress, poolChainId]);
  
  // Extract balance values - EXACT same as portfolio
  // Portfolio uses: token.balanceFormatted directly from WalletToken
  const tokenBalanceFormatted = foundToken?.balanceFormatted || '0.00';
  const tokenUsdValue = foundToken?.usdValue || '0.00';
  
  // Format balance like portfolio (uses compact notation for large numbers like "6.89B")
  // Portfolio uses: formatTokenAmount(token.balanceFormatted, 6)
  const displayBalance = formatTokenAmount(tokenBalanceFormatted, 6);
  
  // Format USD value like portfolio
  // Portfolio uses: formatCurrency(token.usdValue)
  const displayUsdValue = formatCurrency(tokenUsdValue);
  
  // Use balanceFormatted for calculations (same as portfolio)
  // Portfolio uses balanceFormatted directly - it's already a human-readable number string
  const decimals = pool.decimals || 18;
  
  // Parse balanceFormatted for calculations
  // balanceFormatted is already a number string like "6893232532.312375042" (no commas)
  const tokenBalanceNum = parseFloat(tokenBalanceFormatted) || 0;
  
  
  // Use factory staking hook if pool has poolId or factory address
  // Try to find poolId by matching token address with factory pools
  const poolId = (pool as any).poolId; // Pool ID from factory contract (if stored in DB)
  const factoryAddress = (pool as any).factoryAddress || pool.contractAddress; // Factory contract address
  
  // If we have factory address but no poolId, we could fetch all pools and match by token address
  // For now, we'll use poolId if available, otherwise fall back to single contract
  const factoryStaking = useFactoryStaking({
    factoryAddress: factoryAddress as Address | undefined,
    poolId: poolId ? Number(poolId) : undefined,
    stakingTokenAddress: pool.tokenAddress as Address | undefined,
    decimals: decimals,
    enabled: !!factoryAddress && !!pool.tokenAddress,
  });

  // Use single contract staking if no poolId (legacy pools)
  const singleStaking = useStaking({
    contractAddress: pool.contractAddress as Address | undefined,
    stakingTokenAddress: pool.tokenAddress as Address | undefined,
    decimals: decimals,
    enabled: !!pool.contractAddress && !!pool.tokenAddress && !poolId,
  });

  // Use factory staking if available, otherwise fall back to single contract
  const staking = poolId ? {
    userInfo: factoryStaking.userInfo,
    pendingReward: factoryStaking.pendingReward,
    totalStaked: factoryStaking.poolInfo?.state.totalStaked || null,
    isPending: factoryStaking.isPending,
    isLoading: factoryStaking.isLoading,
    isError: factoryStaking.isError,
    error: factoryStaking.error,
    depositTxHash: factoryStaking.depositTxHash,
    withdrawTxHash: factoryStaking.withdrawTxHash,
    claimTxHash: factoryStaking.claimTxHash,
    deposit: (amt: string) => factoryStaking.deposit(Number(poolId), amt),
    withdraw: (amt: string) => factoryStaking.withdraw(Number(poolId), amt),
    claim: () => factoryStaking.claim(Number(poolId)),
    approve: (amt?: string) => factoryStaking.approve(Number(poolId), amt),
    allowance: factoryStaking.allowance,
    needsApproval: (amt: string) => factoryStaking.needsApproval(Number(poolId), amt),
    refetch: () => {
      refetchTokenBalance();
      factoryStaking.refetch();
    },
  } : {
    ...singleStaking,
    refetch: () => {
      refetchTokenBalance();
      singleStaking.refetch();
    },
  };
  
  // Determine if we need approval
  const needsApproval = (poolId || pool.contractAddress) && pool.tokenAddress && amount 
    ? staking.needsApproval(amount)
    : false;
  
  // Use contract transaction hash if available, otherwise fall back to local state
  const currentTxHash = staking.depositTxHash || staking.withdrawTxHash || staking.claimTxHash || txHash;
  const isProcessingContract = staking.isPending || staking.isLoading;

  // Calculate percentage amounts
  const handlePercentageClick = (percentage: number) => {
    if (activeTab === "boost") {
      // For staking, use wallet balance (use raw balance for calculation)
      if (tokenBalanceNum > 0) {
        const amountToSet = (tokenBalanceNum * percentage / 100).toString();
        setAmount(amountToSet);
      }
    } else {
      // For unstaking, use staked amount
      if (staking.userInfo) {
        const stakedAmount = parseFloat(formatUnits(staking.userInfo.amount, decimals));
        const amountToSet = (stakedAmount * percentage / 100).toString();
        setAmount(amountToSet);
      }
    }
  };

  // Format amount for display in input (with K, M, B, T)
  const formattedInputValue = useMemo(() => {
    if (!amount || amount === '0' || amount === '') return '';
    const num = parseFloat(amount);
    if (isNaN(num) || num === 0) return '';
    return formatTokenAmount(amount, 6);
  }, [amount]);

  // Handle input change - parse formatted values back to raw numbers
  const handleAmountChange = (value: string) => {
    // If empty, set to empty
    if (value === '' || value.trim() === '') {
      setAmount('');
      return;
    }
    
    // Parse formatted value (handles K, M, B, T)
    const rawAmount = parseFormattedAmount(value);
    setAmount(rawAmount);
  };

  // Get min and max limits (for validation only, not auto-adjustment)
  const minStakeAmount = pool.minStakeAmount || 0;
  const maxStakeAmount = pool.maxStakeAmount || tokenBalanceNum;
  const effectiveMax = Math.min(maxStakeAmount, tokenBalanceNum);

  // Validation state
  const amountNum = parseFloat(amount || '0');
  const isValidAmount = amountNum >= minStakeAmount && amountNum <= effectiveMax && amountNum > 0;
  const isBelowMin = amountNum > 0 && amountNum < minStakeAmount;
  const isAboveMax = amountNum > effectiveMax;
  const exceedsBalance = amountNum > tokenBalanceNum;

  const handleMaxClick = () => {
    handlePercentageClick(100);
  };

  // Get staked amount for display
  const stakedAmount = staking.userInfo 
    ? formatUnits(staking.userInfo.amount, decimals)
    : "0";

  // Get pending rewards for display
  const pendingRewards = staking.pendingReward
    ? formatUnits(staking.pendingReward, decimals)
    : "0";

  const handleStakeNow = async () => {
    console.log('[Staking] handleStakeNow called', {
      activeAddress,
      amount,
      tokenBalanceNum,
      poolId,
      poolTokenAddress: pool.tokenAddress,
      poolContractAddress: pool.contractAddress,
      chainId,
      needsApproval,
    });

    if (!activeAddress) {
      setToastSuccess(false);
      setToastMessage("Please connect your wallet first");
      setToastOpen(true);
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setToastSuccess(false);
      setToastMessage("Please enter a valid amount");
      setToastOpen(true);
      return;
    }

    const amountNum = parseFloat(amount);
    
    // Check minimum stake
    if (amountNum < minStakeAmount) {
      setToastSuccess(false);
      setToastMessage(`Minimum stake amount is ${formatTokenAmount(minStakeAmount.toString(), 6)} ${pool.tokenSymbol}`);
      setToastOpen(true);
      return;
    }

    // Check maximum stake (pool max or balance, whichever is lower)
    if (amountNum > effectiveMax) {
      setToastSuccess(false);
      setToastMessage(`Maximum stake amount is ${formatTokenAmount(effectiveMax.toString(), 6)} ${pool.tokenSymbol}`);
      setToastOpen(true);
      return;
    }

    if (amountNum > tokenBalanceNum) {
      setToastSuccess(false);
      setToastMessage("Insufficient balance");
      setToastOpen(true);
      return;
    }

    // Check if contract is configured
    if (poolId) {
      // Factory contract - check if poolId and tokenAddress are available
      if (!pool.tokenAddress) {
        setToastSuccess(false);
        setToastMessage("Staking pool not configured with token address");
        setToastOpen(true);
        return;
      }
      if (!factoryAddress) {
        setToastSuccess(false);
        setToastMessage("Factory address not configured");
        setToastOpen(true);
        return;
      }
    } else {
      // Single contract - check if contract address is available
      if (!pool.contractAddress || !pool.tokenAddress) {
        setToastSuccess(false);
        setToastMessage("Staking pool not configured with contract address");
        setToastOpen(true);
        return;
      }
    }

    setIsProcessing(true);

    try {
      // Check if approval is needed
      if (needsApproval) {
        // Approve first - this will trigger wallet approval prompt
        console.log('[Staking] Approval needed, calling approve...', { amount, poolId });
        setToastMessage(`Please approve ${pool.tokenSymbol} in your wallet...`);
        setToastOpen(true);
        
        try {
          console.log('[Staking] Calling staking.approve...');
          const approvePromise = staking.approve(amount);
          console.log('[Staking] Approve promise created, waiting for wallet prompt...');
          
          // The wallet prompt should appear automatically when writeContract is called
          // We await the promise which resolves when transaction hash is available
          await approvePromise;
          console.log('[Staking] Approval transaction submitted, hash:', staking.depositTxHash || 'pending');
          
          // Wait for approval transaction to be submitted
          let waitCount = 0;
          while ((staking.isPending || staking.isLoading) && waitCount < 60) {
            await new Promise(resolve => setTimeout(resolve, 500));
            waitCount++;
          }
          
          console.log('[Staking] Approval transaction status:', {
            isPending: staking.isPending,
            isLoading: staking.isLoading,
            isError: staking.isError,
            error: staking.error,
          });
          
          // Refetch allowance to check if approval went through
          staking.refetch();
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (approvalError: any) {
          console.error("[Staking] Approval error:", approvalError);
          const errorMsg = approvalError?.message || approvalError?.shortMessage || approvalError?.cause?.message || "Approval failed. Please check your wallet and try again.";
          throw new Error(errorMsg);
        }
      }

      // Deposit tokens - this will trigger wallet transaction prompt
      if (activeTab === "boost") {
        console.log('[Staking] Depositing tokens...', { amount, poolId });
        setToastMessage(`Please confirm staking ${amount} ${pool.tokenSymbol} in your wallet...`);
        setToastOpen(true);
        
        try {
          console.log('[Staking] Calling staking.deposit...');
          const depositPromise = staking.deposit(amount);
          console.log('[Staking] Deposit promise created, waiting for wallet prompt...');
          
          // The wallet prompt should appear automatically when writeContract is called
          await depositPromise;
          console.log('[Staking] Deposit transaction submitted, hash:', staking.depositTxHash || 'pending');
          
          // Wait for deposit transaction to be submitted and confirmed
          let waitCount = 0;
          while ((staking.isPending || staking.isLoading) && waitCount < 120) {
            await new Promise(resolve => setTimeout(resolve, 500));
            waitCount++;
          }
          
          console.log('[Staking] Deposit transaction status:', {
            isPending: staking.isPending,
            isLoading: staking.isLoading,
            isError: staking.isError,
            error: staking.error,
          });
          
          // Check if transaction was successful
          if (staking.isError) {
            const errorMsg = staking.error?.message || staking.error?.shortMessage || "Transaction failed";
            throw new Error(errorMsg);
          }
          
          setTxChainId(chainId);
          setToastSuccess(true);
          setToastMessage(`Successfully staked ${amount} ${pool.tokenSymbol}`);
          setToastOpen(true);
        } catch (depositError: any) {
          console.error("[Staking] Deposit error:", depositError);
          const errorMsg = depositError?.message || depositError?.shortMessage || depositError?.cause?.message || "Staking failed. Please check your wallet and try again.";
          throw new Error(errorMsg);
        }
      } else {
        // Withdraw tokens
        setToastMessage(`Please confirm unstaking ${amount} ${pool.tokenSymbol} in your wallet...`);
        setToastOpen(true);
        
        try {
          await staking.withdraw(amount);
          
          // Wait for withdraw transaction to be submitted and confirmed
          let waitCount = 0;
          while ((staking.isPending || staking.isLoading) && waitCount < 120) {
            await new Promise(resolve => setTimeout(resolve, 500));
            waitCount++;
          }
          
          if (staking.isError) {
            throw new Error(staking.error?.message || "Transaction failed");
          }
          
          setTxChainId(chainId);
          setToastSuccess(true);
          setToastMessage(`Successfully unstaked ${amount} ${pool.tokenSymbol}`);
          setToastOpen(true);
        } catch (withdrawError: any) {
          console.error("Withdraw error:", withdrawError);
          throw new Error(withdrawError?.message || withdrawError?.shortMessage || "Unstaking failed. Please try again.");
        }
      }
      
      // Reset form after successful transaction
      setAmount("");
      refetchTokenBalance();
      staking.refetch();
    } catch (error: any) {
      console.error("Transaction error:", error);
      setToastSuccess(false);
      const errorMessage = error?.message || error?.shortMessage || error?.toString() || "Transaction failed. Please try again.";
      setToastMessage(errorMessage);
      setToastOpen(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle claim rewards
  const handleClaim = async () => {
    if (!activeAddress) {
      setToastSuccess(false);
      setToastMessage("Please connect your wallet first");
      setToastOpen(true);
      return;
    }

    if (!poolId && !pool.contractAddress) {
      setToastSuccess(false);
      setToastMessage("Staking pool not configured");
      setToastOpen(true);
      return;
    }

    setIsProcessing(true);

    try {
      await staking.claim();
      setTxChainId(chainId);
      setToastSuccess(true);
      setToastMessage("Successfully claimed rewards");
      setToastOpen(true);
      
      refetchTokenBalance();
      staking.refetch();
    } catch (error: any) {
      console.error("Claim error:", error);
      setToastSuccess(false);
      setToastMessage(error.message || "Claim failed. Please try again.");
      setToastOpen(true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6 items-center relative shrink-0 w-full max-w-[880px] mx-auto px-4 lg:px-0 staking-detail-enter">
        {/* Header with Back Button and Token - Centered as per Figma */}
        <div className="flex items-center justify-start relative shrink-0 w-full">
          <button
            onClick={onBack}
            className="cursor-pointer relative shrink-0 size-10 hover:opacity-80 transition-opacity"
            aria-label="Back"
          >
            <ArrowLeft className="size-10 text-white" />
          </button>
          <div className="flex gap-2 items-center relative shrink-0 mx-auto">
            <div className="relative shrink-0 size-10">
              <Image
                src={pool.tokenIcon}
                alt={pool.tokenSymbol}
                width={40}
                height={40}
                className="block max-w-none size-full rounded-full"
              />
            </div>
            <div className="flex flex-col items-start justify-center relative shrink-0">
              <p className="font-['Manrope',sans-serif] font-semibold leading-normal relative shrink-0 text-base text-white whitespace-nowrap">
                {pool.tokenSymbol}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Card */}
        <div className="bg-[#0b0f0a] border-[#273024] border-[0.5px] border-solid flex flex-col items-start overflow-clip p-4 relative rounded-xl shrink-0 w-full">
          <div className="flex gap-px items-center relative shrink-0 w-full">
            <div className="flex-1 flex flex-col items-center relative shrink-0">
              <div className="flex flex-col font-['Manrope',sans-serif] font-medium gap-1 items-center leading-normal relative shrink-0 text-center w-full">
                <p className="relative shrink-0 text-[#7c7c7c] text-xs tracking-[-0.48px] w-full">
                  TVL
                </p>
                <p className="relative shrink-0 text-sm text-white tracking-[-0.56px] w-full">
                  {(() => {
                    // Calculate TVL from pool info
                    if (factoryStaking.poolInfo) {
                      const totalStaked = Number(formatUnits(factoryStaking.poolInfo.state.totalStaked, decimals));
                      const maxTvl = Number(formatUnits(factoryStaking.poolInfo.config.maxTvl, decimals));
                      // TVL is current total staked, or max TVL if set
                      return maxTvl > 0 
                        ? `${totalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${maxTvl.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.tokenSymbol}`
                        : `${totalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.tokenSymbol}`;
                    }
                    if (staking.totalStaked) {
                      return `${formatUnits(staking.totalStaked, decimals)} ${pool.tokenSymbol}`;
                    }
                    return pool.tvl || "N/A";
                  })()}
                </p>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-start relative shrink-0">
              <div className="flex flex-col font-['Manrope',sans-serif] font-medium gap-1 items-center leading-normal relative shrink-0 text-center w-full">
                <p className="relative shrink-0 text-[#7c7c7c] text-xs tracking-[-0.48px] w-full">
                  APR
                </p>
                <p className="relative shrink-0 text-sm text-white tracking-[-0.56px] w-full">
                  {(() => {
                    // Calculate APR from pool config
                    if (factoryStaking.poolInfo) {
                      const poolConfig = factoryStaking.poolInfo.config;
                      const poolState = factoryStaking.poolInfo.state;
                      const poolReward = Number(formatUnits(poolConfig.poolReward, decimals));
                      const maxTvl = Number(formatUnits(poolConfig.maxTvl, decimals));
                      const totalStaked = Number(formatUnits(poolState.totalStaked, decimals));
                      const rewardDurationSeconds = Number(poolConfig.rewardDurationSeconds);
                      
                      // Use maxTvl or totalStaked (whichever is relevant)
                      const tvlForCalculation = maxTvl > 0 ? maxTvl : (totalStaked > 0 ? totalStaked : maxTvl);
                      
                      // Calculate APR (assuming same token price for staking and reward)
                      // In production, you'd fetch token prices from oracles
                      if (tvlForCalculation > 0 && rewardDurationSeconds > 0) {
                        const apr = calculateAPRFromPoolConfig(
                          poolReward,
                          tvlForCalculation,
                          rewardDurationSeconds,
                          1, // rewardTokenPrice (placeholder - should fetch from oracle)
                          1  // stakingTokenPrice (placeholder - should fetch from oracle)
                        );
                        return `${apr.toFixed(2)}%`;
                      }
                      return "N/A";
                    }
                    return pool.apr || pool.apy || "N/A";
                  })()}
                </p>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-start relative shrink-0">
              <div className="flex flex-col font-['Manrope',sans-serif] font-medium gap-1 items-center leading-normal relative shrink-0 text-center w-full">
                <p className="relative shrink-0 text-[#7c7c7c] text-xs tracking-[-0.48px] w-full">
                  Total Staked
                </p>
                <p className="relative shrink-0 text-sm text-white tracking-[-0.56px] w-full">
                  {(() => {
                    if (factoryStaking.poolInfo) {
                      const totalStaked = Number(formatUnits(factoryStaking.poolInfo.state.totalStaked, decimals));
                      return `${totalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.tokenSymbol}`;
                    }
                    if (staking.totalStaked) {
                      return `${formatUnits(staking.totalStaked, decimals)} ${pool.tokenSymbol}`;
                    }
                    return pool.totalStaked || "N/A";
                  })()}
                </p>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-start relative shrink-0">
              <div className="flex flex-col font-['Manrope',sans-serif] font-medium gap-1 items-center leading-normal relative shrink-0 text-center w-full">
                <p className="relative shrink-0 text-[#7c7c7c] text-xs tracking-[-0.48px] w-full">
                  Limits
                </p>
                <p className="relative shrink-0 text-sm text-white tracking-[-0.56px] w-full">
                  {pool.limits || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section - Exact Figma dimensions */}
        <div className="bg-[#0b0f0a] border-[#273024] border-[0.5px] border-solid flex flex-col h-[71px] items-start px-4 py-3.5 relative rounded-full shrink-0 w-full max-w-[881px]">
          <div className="flex gap-4 lg:gap-[233px] items-center justify-between relative shrink-0 w-full">
            <div className="bg-[#0b0f0a] flex items-center p-1 relative rounded-full shrink-0 w-full lg:w-[568px]">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "boost" | "unstake")} className="w-full">
                <TabsList className="bg-transparent p-0 h-[35px] w-full gap-0">
                  <TabsTrigger
                    value="boost"
                    className="data-[state=active]:bg-[#141e00] data-[state=active]:border-[#b1f128] data-[state=active]:border data-[state=active]:text-[#b1f128] text-[#7c7c7c] h-[35px] rounded-full px-4 py-1.5 text-sm font-medium flex-1 lg:w-[280px] border-0 cursor-pointer"
                  >
                    Boost
                  </TabsTrigger>
                  <TabsTrigger
                    value="unstake"
                    className="data-[state=active]:bg-[#141e00] data-[state=active]:border-[#b1f128] data-[state=active]:border data-[state=active]:text-[#b1f128] text-[#7c7c7c] h-[35px] rounded-full px-4 py-1.5 text-sm font-medium flex-1 lg:w-[280px] border-0 cursor-pointer"
                  >
                    Unstake
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <button
              onClick={() => {
                refetchTokenBalance();
                factoryStaking.refetch();
                staking.refetch?.();
              }}
              className="bg-[#0b0f0a] h-[43px] overflow-clip relative rounded-[20px] shrink-0 w-12 flex items-center justify-center hover:opacity-80 transition-opacity"
              aria-label="Refresh"
            >
              <RefreshCw className="size-6 text-white" />
            </button>
          </div>
        </div>

        {/* Boost Message Banner */}
        {showBoostMessage && activeTab === "boost" && (
          <div className="bg-[rgba(73,143,0,0.15)] border-[#498f00] border-[0.5px] border-solid flex flex-col items-start overflow-clip px-4 py-3 relative rounded-xl shrink-0 w-full">
            <div className="flex items-start justify-between relative shrink-0 w-full">
              <div className="flex gap-2 items-center relative shrink-0">
                <Zap className="size-6 text-[#498f00]" />
                <p className="font-['Inter',sans-serif] font-normal leading-normal not-italic relative shrink-0 text-[#498f00] text-[10px] whitespace-pre-wrap">
                  Boost your earnings by extending your lock period or adding more tokens.
                </p>
              </div>
              <button
                onClick={() => setShowBoostMessage(false)}
                className="cursor-pointer relative shrink-0 size-4 hover:opacity-80 transition-opacity"
                aria-label="Dismiss"
              >
                <X className="size-4 text-[#498f00]" />
              </button>
            </div>
          </div>
        )}

        {/* Unstake Warning Banner */}
        {showUnstakeWarning && activeTab === "unstake" && (
          <div className="bg-[rgba(255,68,68,0.15)] border-[#ff4444] border-[0.5px] border-solid flex flex-col items-start overflow-clip px-4 py-3 relative rounded-xl shrink-0 w-full">
            <div className="flex items-start justify-between relative shrink-0 w-full">
              <div className="flex gap-2 items-center relative shrink-0">
                <AlertTriangle className="size-6 text-[#ff4444]" />
                <p className="font-['Inter',sans-serif] font-normal leading-normal not-italic relative shrink-0 text-[#ff4444] text-[10px] whitespace-pre-wrap">
                  Unstaking initiates a 30-day cooldown, though you can cancel at any point.
                </p>
              </div>
              <button
                onClick={() => setShowUnstakeWarning(false)}
                className="cursor-pointer relative shrink-0 size-4 hover:opacity-80 transition-opacity"
                aria-label="Dismiss"
              >
                <X className="size-4 text-[#ff4444]" />
              </button>
            </div>
          </div>
        )}

        {/* Content Section - Changes based on active tab */}
        {activeTab === "boost" ? (
          /* Boost Tab - Add More Tokens Section */
          <div className="flex flex-col gap-6 lg:gap-7 items-center justify-center relative shrink-0 w-full max-w-[612px]">
            <p className="font-['Manrope',sans-serif] font-medium leading-normal relative shrink-0 text-base text-white w-full whitespace-pre-wrap text-left">
              Add More Tokens
            </p>
            {/* Token Balance Display - Same format as portfolio */}
            <div className="flex flex-col gap-1 w-full max-w-[606px] px-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#7c7c7c]">Available Balance:</span>
                <div className="flex flex-col items-end">
                  {!activeAddress ? (
                    <span className="text-yellow-500 text-xs">No wallet connected</span>
                  ) : balanceLoading ? (
                    <span className="text-[#7c7c7c] text-base">Loading...</span>
                  ) : balanceError ? (
                    <span className="text-red-500 text-xs">Error: {balanceError}</span>
                  ) : !tokenAddress ? (
                    <span className="text-yellow-500 text-xs">No token address configured</span>
                  ) : (
                    <>
                      <span className="text-base text-white font-semibold">
                        {displayBalance} {pool.tokenSymbol}
                      </span>
                      {tokenUsdValue && parseFloat(tokenUsdValue) > 0 && (
                        <span className="text-sm text-[#7c7c7c]">
                          {displayUsdValue}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 items-center justify-center relative shrink-0 w-full">
              {/* Percentage Buttons Row - Above input box */}
              {activeAddress && (
                <div className="flex gap-2 items-center justify-end w-full max-w-[606px]">
                  <button
                    onClick={() => handlePercentageClick(30)}
                    type="button"
                    disabled={tokenBalanceNum === 0}
                    className="px-3 py-1.5 bg-[#0b0f0a] border border-[#1f261e] rounded-lg text-xs text-white hover:border-[#b1f128] hover:bg-[#141e00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    30%
                  </button>
                  <button
                    onClick={() => handlePercentageClick(50)}
                    type="button"
                    disabled={tokenBalanceNum === 0}
                    className="px-3 py-1.5 bg-[#0b0f0a] border border-[#1f261e] rounded-lg text-xs text-white hover:border-[#b1f128] hover:bg-[#141e00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => handlePercentageClick(75)}
                    type="button"
                    disabled={tokenBalanceNum === 0}
                    className="px-3 py-1.5 bg-[#0b0f0a] border border-[#1f261e] rounded-lg text-xs text-white hover:border-[#b1f128] hover:bg-[#141e00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    75%
                  </button>
                  <button
                    onClick={handleMaxClick}
                    type="button"
                    disabled={tokenBalanceNum === 0}
                    className="px-3 py-1.5 bg-[#b1f128] rounded-lg text-xs text-black font-medium hover:bg-[#9dd81f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Max
                  </button>
                </div>
              )}
              
              {/* Input Box - Expanded */}
              <div className="h-[112px] relative shrink-0 w-full max-w-[606px] mb-6">
                <div className="absolute bg-[#010501] border border-[#1f261e] border-solid flex flex-col items-center justify-center left-0 px-0 py-6 rounded-2xl top-0 w-full">
                  <div className="flex flex-col items-center px-6 py-0 relative shrink-0 w-full">
                    <div className="border-[#7c7c7c] border-[0.2px] border-solid h-16 overflow-visible relative rounded-2xl shrink-0 w-full max-w-[500px]">
                      {/* Max button inside input box (fallback if no balance) */}
                      {(!activeAddress || tokenBalanceNum === 0) && (
                        <div className="absolute bg-[#b1f128] h-7 flex items-center justify-center right-4 px-4 py-1 rounded-full top-1/2 translate-y-[-50%] z-10">
                          <button
                            onClick={handleMaxClick}
                            type="button"
                            className="flex flex-col font-['Manrope',sans-serif] font-medium justify-center leading-0 relative shrink-0 text-base text-black text-right whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            Max
                          </button>
                        </div>
                      )}
                      <div className="absolute flex font-['Manrope',sans-serif] font-medium gap-1 items-end leading-0 left-4 text-right top-1.5 pr-2" style={{ right: '60px' }}>
                        <Input
                          type="text"
                          value={formattedInputValue}
                          onChange={(e) => handleAmountChange(e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder={activeAddress && tokenBalanceNum > 0 ? displayBalance : "0.000"}
                          className={`bg-transparent border-0 p-0 text-[40px] text-white placeholder:text-[#7c7c7c] focus-visible:ring-0 focus-visible:ring-offset-0 w-full h-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isBelowMin || isAboveMax || exceedsBalance ? 'text-red-400' : ''}`}
                        />
                        <div className="flex flex-col h-6 justify-center relative shrink-0 text-sm text-white w-[33px]">
                          <p className="leading-normal whitespace-pre-wrap">{pool.tokenSymbol}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Validation messages - outside the input box */}
                {amount && amountNum > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 text-xs text-center">
                    {isBelowMin && (
                      <span className="text-red-400">Minimum stake: {formatTokenAmount(minStakeAmount.toString(), 6)} {pool.tokenSymbol}</span>
                    )}
                    {isAboveMax && !exceedsBalance && (
                      <span className="text-red-400">Maximum stake: {formatTokenAmount(effectiveMax.toString(), 6)} {pool.tokenSymbol}</span>
                    )}
                    {exceedsBalance && (
                      <span className="text-red-400">Insufficient balance</span>
                    )}
                    {isValidAmount && (
                      <span className="text-green-400">✓ Valid amount</span>
                    )}
                  </div>
                )}
              </div>
              <Button
                onClick={handleStakeNow}
                disabled={isProcessing || isProcessingContract || !amount || !isValidAmount}
                className="bg-[#081f02] h-14 items-center justify-center px-6 py-4 relative rounded-full shrink-0 w-full max-w-[606px] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="font-['Manrope',sans-serif] font-semibold leading-normal relative shrink-0 text-[#b1f128] text-lg text-center tracking-[0.018px] whitespace-pre-wrap">
                  {needsApproval && isProcessingContract ? "Approving..." : isProcessing || isProcessingContract ? "Processing..." : needsApproval ? "Approve & Stake Now" : "Stake Now"}
                </p>
              </Button>
            </div>
          </div>
        ) : (
          /* Unstake Tab - Unstake Tokens Section */
          <div className="flex flex-col gap-6 lg:gap-7 items-center justify-center relative shrink-0 w-full max-w-[612px]">
            <p className="font-['Manrope',sans-serif] font-medium leading-normal relative shrink-0 text-base text-white w-full whitespace-pre-wrap text-left">
              Unstake Tokens
            </p>
            <div className="flex flex-col gap-12 sm:gap-16 lg:gap-20 items-center justify-center relative shrink-0 w-full">
              <div className="flex flex-col gap-4 w-full max-w-[606px]">
                {/* Staked Amount Display */}
                {activeAddress && staking.userInfo && parseFloat(stakedAmount) > 0 && (
                  <div className="flex items-center justify-between px-2">
                    <span className="text-xs text-[#7c7c7c]">Staked Amount:</span>
                    <span className="text-sm text-white font-medium">
                      {parseFloat(stakedAmount).toLocaleString(undefined, { maximumFractionDigits: 6 })} {pool.tokenSymbol}
                    </span>
                  </div>
                )}
                
                {/* Percentage Buttons for Unstaking */}
                {activeAddress && staking.userInfo && parseFloat(stakedAmount) > 0 && (
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => handlePercentageClick(25)}
                      type="button"
                      className="flex-1 px-3 py-1.5 bg-[#0b0f0a] border border-[#1f261e] rounded-lg text-xs text-white hover:border-[#b1f128] transition-colors"
                    >
                      25%
                    </button>
                    <button
                      onClick={() => handlePercentageClick(50)}
                      type="button"
                      className="flex-1 px-3 py-1.5 bg-[#0b0f0a] border border-[#1f261e] rounded-lg text-xs text-white hover:border-[#b1f128] transition-colors"
                    >
                      50%
                    </button>
                    <button
                      onClick={() => handlePercentageClick(75)}
                      type="button"
                      className="flex-1 px-3 py-1.5 bg-[#0b0f0a] border border-[#1f261e] rounded-lg text-xs text-white hover:border-[#b1f128] transition-colors"
                    >
                      75%
                    </button>
                    <button
                      onClick={handleMaxClick}
                      type="button"
                      className="flex-1 px-3 py-1.5 bg-[#b1f128] rounded-lg text-xs text-black font-medium hover:bg-[#9dd81f] transition-colors"
                    >
                      Max
                    </button>
                  </div>
                )}

                {/* Amount Input */}
                <div className="h-[112px] relative shrink-0 w-full mb-6">
                  <div className="absolute bg-[#010501] border border-[#1f261e] border-solid flex flex-col items-center justify-center left-0 px-0 py-6 rounded-2xl top-0 w-full">
                    <div className="flex flex-col items-center px-6 py-0 relative shrink-0 w-full">
                      <div className="border-[#7c7c7c] border-[0.2px] border-solid h-16 overflow-hidden relative rounded-2xl shrink-0 w-full max-w-[353px]">
                        <div className="absolute bg-[#b1f128] h-7 flex items-center justify-center right-4 px-4 py-1 rounded-full top-1/2 translate-y-[-50%]">
                          <button
                            onClick={handleMaxClick}
                            type="button"
                            className="flex flex-col font-['Manrope',sans-serif] font-medium justify-center leading-0 relative shrink-0 text-base text-black text-right whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            Max
                          </button>
                        </div>
                        <div className="absolute flex font-['Manrope',sans-serif] font-medium gap-1 items-end leading-0 left-4 text-right top-1.5 w-[180px]">
                          <Input
                            type="text"
                            value={formattedInputValue}
                            onChange={(e) => handleAmountChange(e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="0.000"
                            className={`bg-transparent border-0 p-0 text-[40px] text-white placeholder:text-[#7c7c7c] focus-visible:ring-0 focus-visible:ring-offset-0 w-full h-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isBelowMin || isAboveMax || exceedsBalance ? 'text-red-400' : ''}`}
                          />
                          <div className="flex flex-col h-6 justify-center relative shrink-0 text-sm text-white w-[33px]">
                            <p className="leading-normal whitespace-pre-wrap">{pool.tokenSymbol}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Validation messages for unstake - outside the input box */}
                  {amount && amountNum > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 text-xs text-center">
                      {isBelowMin && (
                        <span className="text-red-400">Minimum unstake: {formatTokenAmount(minStakeAmount.toString(), 6)} {pool.tokenSymbol}</span>
                      )}
                      {isAboveMax && !exceedsBalance && (
                        <span className="text-red-400">Maximum unstake: {formatTokenAmount(effectiveMax.toString(), 6)} {pool.tokenSymbol}</span>
                      )}
                      {exceedsBalance && (
                        <span className="text-red-400">Exceeds staked amount</span>
                      )}
                      {isValidAmount && (
                        <span className="text-green-400">✓ Valid amount</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <Button
                onClick={handleStakeNow}
                disabled={isProcessing || isProcessingContract || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(stakedAmount)}
                className="bg-[#081f02] h-14 items-center justify-center px-6 py-4 relative rounded-full shrink-0 w-full max-w-[606px] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="font-['Manrope',sans-serif] font-semibold leading-normal relative shrink-0 text-[#b1f128] text-lg text-center tracking-[0.018px] whitespace-pre-wrap">
                  {isProcessing || isProcessingContract ? "Processing..." : "Unstake"}
                </p>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Rewards Display - if user has staked */}
      {staking.userInfo && staking.userInfo.amount > 0n && (
        <div className="bg-[#0b0f0a] border-[#273024] border-[0.5px] border-solid flex flex-col items-start overflow-clip p-4 relative rounded-xl shrink-0 w-full">
          <div className="flex justify-between items-center w-full mb-2">
            <p className="text-[#7c7c7c] text-xs">Pending Rewards</p>
            <p className="text-white text-sm font-medium">{pendingRewards} {pool.tokenSymbol}</p>
          </div>
          <div className="flex justify-between items-center w-full">
            <p className="text-[#7c7c7c] text-xs">Staked Amount</p>
            <p className="text-white text-sm font-medium">{stakedAmount} {pool.tokenSymbol}</p>
          </div>
          {parseFloat(pendingRewards) > 0 && (
            <Button
              onClick={handleClaim}
              disabled={isProcessing || isProcessingContract}
              className="mt-4 w-full bg-[#b1f128] text-[#010501] hover:bg-[#9dd81f] disabled:opacity-50"
            >
              Claim Rewards
            </Button>
          )}
        </div>
      )}

      {/* Transaction Toast */}
      <TransactionToast
        open={toastOpen}
        onOpenChange={setToastOpen}
        success={toastSuccess}
        message={toastMessage}
        txHash={currentTxHash}
        chainId={txChainId || chainId}
      />
    </>
  );
}

