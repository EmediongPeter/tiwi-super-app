/**
 * Script to Configure Staking Pool After Deployment
 * 
 * Usage:
 *   npx hardhat run scripts/configure-pool.ts --network mainnet
 * 
 * Environment Variables Required:
 *   - CONTRACT_ADDRESS: Address of deployed TiwiStakingPool contract
 *   - POOL_REWARD: Total reward tokens to allocate (in token units, not wei)
 *   - REWARD_DURATION_DAYS: Duration in days (will be converted to seconds)
 *   - MAX_TVL: Maximum TVL or Total Staked Tokens (in token units, not wei)
 *   - REWARD_TOKEN_DECIMALS: Decimals of reward token (default: 18)
 *   - STAKING_TOKEN_DECIMALS: Decimals of staking token (default: 18)
 */

import { ethers } from "hardhat";

async function main() {
  console.log("⚙️  Configuring TiwiStakingPool...\n");

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("❌ CONTRACT_ADDRESS environment variable is required");
  }

  const poolReward = process.env.POOL_REWARD;
  const rewardDurationDays = process.env.REWARD_DURATION_DAYS;
  const maxTvl = process.env.MAX_TVL;

  if (!poolReward || !rewardDurationDays || !maxTvl) {
    throw new Error("❌ POOL_REWARD, REWARD_DURATION_DAYS, and MAX_TVL environment variables are required");
  }

  const rewardTokenDecimals = parseInt(process.env.REWARD_TOKEN_DECIMALS || "18");
  const stakingTokenDecimals = parseInt(process.env.STAKING_TOKEN_DECIMALS || "18");

  // Get contract
  const TiwiStakingPool = await ethers.getContractFactory("TiwiStakingPool");
  const stakingPool = TiwiStakingPool.attach(contractAddress);

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("📝 Configuring with account:", deployer.address);
  console.log("📋 Contract Address:", contractAddress, "\n");

  // Convert to wei
  const poolRewardWei = ethers.parseUnits(poolReward, rewardTokenDecimals);
  const maxTvlWei = ethers.parseUnits(maxTvl, stakingTokenDecimals);
  const rewardDurationSeconds = BigInt(parseInt(rewardDurationDays) * 24 * 60 * 60);

  console.log("📋 Configuration:");
  console.log("   Pool Reward:", poolReward, `(${poolRewardWei.toString()} wei)`);
  console.log("   Reward Duration:", rewardDurationDays, "days", `(${rewardDurationSeconds.toString()} seconds)`);
  console.log("   Max TVL:", maxTvl, `(${maxTvlWei.toString()} wei)`);
  console.log("   Calculated Reward Per Second:", (poolRewardWei / rewardDurationSeconds).toString(), "wei/sec\n");

  // Configure pool
  console.log("⏳ Setting reward configuration...");
  const tx = await stakingPool.setRewardConfig(
    poolRewardWei,
    rewardDurationSeconds,
    maxTvlWei
  );

  console.log("📤 Transaction sent:", tx.hash);
  console.log("⏳ Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("✅ Configuration successful!");
  console.log("📊 Gas used:", receipt.gasUsed.toString(), "\n");

  // Verify configuration
  console.log("🔍 Verifying configuration...");
  const config = {
    poolReward: await stakingPool.poolReward(),
    rewardDurationSeconds: await stakingPool.rewardDurationSeconds(),
    maxTvl: await stakingPool.maxTvl(),
    rewardPerSecond: await stakingPool.rewardPerSecond(),
    startTime: await stakingPool.startTime(),
    endTime: await stakingPool.endTime(),
  };

  console.log("✅ Configuration verified:");
  console.log("   Pool Reward:", ethers.formatUnits(config.poolReward, rewardTokenDecimals));
  console.log("   Reward Duration:", (Number(config.rewardDurationSeconds) / (24 * 60 * 60)).toFixed(2), "days");
  console.log("   Max TVL:", ethers.formatUnits(config.maxTvl, stakingTokenDecimals));
  console.log("   Reward Per Second:", ethers.formatUnits(config.rewardPerSecond, rewardTokenDecimals), "tokens/sec");
  console.log("   Start Time:", new Date(Number(config.startTime) * 1000).toISOString());
  console.log("   End Time:", new Date(Number(config.endTime) * 1000).toISOString(), "\n");

  console.log("🎉 Pool configuration complete!");
  console.log("📝 Next Step: Fund the pool with reward tokens using fundRewards()\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Configuration failed:", error);
    process.exit(1);
  });
