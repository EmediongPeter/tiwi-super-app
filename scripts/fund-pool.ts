/**
 * Script to Fund Staking Pool with Reward Tokens
 * 
 * Usage:
 *   npx hardhat run scripts/fund-pool.ts --network mainnet
 * 
 * Environment Variables Required:
 *   - CONTRACT_ADDRESS: Address of deployed TiwiStakingPool contract
 *   - REWARD_TOKEN_ADDRESS: Address of reward token (ERC20)
 *   - REWARD_TOKEN_DECIMALS: Decimals of reward token (default: 18)
 * 
 * Note: Make sure the deployer wallet has enough reward tokens and has approved
 *       the contract to spend them (or approve in the script).
 */

import { ethers } from "hardhat";

async function main() {
  console.log("💰 Funding TiwiStakingPool with reward tokens...\n");

  const contractAddress = process.env.CONTRACT_ADDRESS;
  const rewardTokenAddress = process.env.REWARD_TOKEN_ADDRESS;

  if (!contractAddress) {
    throw new Error("❌ CONTRACT_ADDRESS environment variable is required");
  }

  if (!rewardTokenAddress) {
    throw new Error("❌ REWARD_TOKEN_ADDRESS environment variable is required");
  }

  const rewardTokenDecimals = parseInt(process.env.REWARD_TOKEN_DECIMALS || "18");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("📝 Funding with account:", deployer.address);

  // Get contract
  const TiwiStakingPool = await ethers.getContractFactory("TiwiStakingPool");
  const stakingPool = TiwiStakingPool.attach(contractAddress);

  // Get pool reward amount
  const poolReward = await stakingPool.poolReward();
  const poolRewardFormatted = ethers.formatUnits(poolReward, rewardTokenDecimals);

  console.log("📋 Contract Address:", contractAddress);
  console.log("📋 Reward Token:", rewardTokenAddress);
  console.log("📋 Pool Reward Required:", poolRewardFormatted, "tokens\n");

  // Get ERC20 token contract
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
  ];

  const rewardToken = new ethers.Contract(rewardTokenAddress, ERC20_ABI, deployer);

  // Check balance
  const balance = await rewardToken.balanceOf(deployer.address);
  const balanceFormatted = ethers.formatUnits(balance, rewardTokenDecimals);

  console.log("💰 Deployer balance:", balanceFormatted, "tokens");

  if (balance < poolReward) {
    throw new Error(`❌ Insufficient balance. Need ${poolRewardFormatted} tokens, have ${balanceFormatted}`);
  }

  // Check allowance
  const allowance = await rewardToken.allowance(deployer.address, contractAddress);
  console.log("📋 Current allowance:", ethers.formatUnits(allowance, rewardTokenDecimals), "tokens");

  if (allowance < poolReward) {
    console.log("⏳ Approving contract to spend reward tokens...");
    const approveTx = await rewardToken.approve(contractAddress, poolReward);
    console.log("📤 Approval transaction:", approveTx.hash);
    await approveTx.wait();
    console.log("✅ Approval confirmed\n");
  }

  // Fund pool
  console.log("⏳ Funding pool with reward tokens...");
  const fundTx = await stakingPool.fundRewards();
  console.log("📤 Transaction sent:", fundTx.hash);
  console.log("⏳ Waiting for confirmation...");

  const receipt = await fundTx.wait();
  console.log("✅ Pool funded successfully!");
  console.log("📊 Gas used:", receipt.gasUsed.toString(), "\n");

  // Verify funding
  const contractBalance = await rewardToken.balanceOf(contractAddress);
  console.log("✅ Contract balance:", ethers.formatUnits(contractBalance, rewardTokenDecimals), "tokens\n");

  console.log("🎉 Pool funding complete!");
  console.log("✅ The staking pool is now ready to accept deposits and distribute rewards!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Funding failed:", error);
    process.exit(1);
  });
