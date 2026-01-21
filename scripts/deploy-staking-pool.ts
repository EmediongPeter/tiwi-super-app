/**
 * Deployment Script for TiwiStakingPool
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-staking-pool.ts --network mainnet
 * 
 * Environment Variables Required:
 *   - DEPLOYER_PRIVATE_KEY: Private key of deployer wallet
 *   - MAINNET_RPC_URL: RPC URL for mainnet (or network-specific RPC)
 *   - STAKING_TOKEN_ADDRESS: Address of ERC20 token users will stake
 *   - REWARD_TOKEN_ADDRESS: Address of ERC20 token for rewards (can be same as staking token)
 *   - OWNER_ADDRESS: Address that will own the contract (admin)
 */

import hre from "hardhat";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Starting TiwiStakingPool deployment...\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Get contract addresses from environment or command line
  const stakingTokenAddress = process.env.STAKING_TOKEN_ADDRESS;
  const rewardTokenAddress = process.env.REWARD_TOKEN_ADDRESS || stakingTokenAddress;
  const ownerAddress = process.env.OWNER_ADDRESS || deployer.address;

  if (!stakingTokenAddress) {
    throw new Error("❌ STAKING_TOKEN_ADDRESS environment variable is required");
  }

  console.log("📋 Deployment Configuration:");
  console.log("   Staking Token:", stakingTokenAddress);
  console.log("   Reward Token:", rewardTokenAddress);
  console.log("   Owner Address:", ownerAddress);
  console.log("   Network:", (await ethers.provider.getNetwork()).name, "\n");

  // Deploy contract
  console.log("⏳ Deploying TiwiStakingPool contract...");
  const TiwiStakingPool = await ethers.getContractFactory("TiwiStakingPool");
  const stakingPool = await TiwiStakingPool.deploy(
    stakingTokenAddress,
    rewardTokenAddress,
    ownerAddress
  );

  await stakingPool.waitForDeployment();
  const contractAddress = await stakingPool.getAddress();

  console.log("✅ TiwiStakingPool deployed to:", contractAddress);
  console.log("📊 Transaction hash:", stakingPool.deploymentTransaction()?.hash, "\n");

  // Verify contract on Etherscan (if API key is provided)
  const network = await ethers.provider.getNetwork();
  const hasApiKey = process.env.ETHERSCAN_API_KEY || process.env.BSCSCAN_API_KEY || 
                    process.env.POLYGONSCAN_API_KEY || process.env.ARBISCAN_API_KEY ||
                    process.env.BASESCAN_API_KEY || process.env.OPTIMISM_API_KEY ||
                    process.env.SNOWTRACE_API_KEY;
  
  if (hasApiKey) {
    console.log("⏳ Waiting for block confirmations before verification...");
    await stakingPool.deploymentTransaction()?.wait(5);
    
    console.log("🔍 Verifying contract on block explorer...");
    try {
      // Import hardhat runtime environment
      const { default: hre } = await import("hardhat");
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [stakingTokenAddress, rewardTokenAddress, ownerAddress],
      });
      console.log("✅ Contract verified successfully!\n");
    } catch (error: any) {
      console.log("⚠️  Verification failed (this is okay if contract is already verified):", error.message, "\n");
    }
  }

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    contractAddress,
    deployer: deployer.address,
    owner: ownerAddress,
    stakingToken: stakingTokenAddress,
    rewardToken: rewardTokenAddress,
    deploymentTxHash: stakingPool.deploymentTransaction()?.hash,
    deployedAt: new Date().toISOString(),
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save to JSON file
  const networkName = (await ethers.provider.getNetwork()).name;
  const deploymentFile = path.join(deploymentsDir, `${networkName}-${Date.now()}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to:", deploymentFile);

  // Also save to latest file
  const latestFile = path.join(deploymentsDir, `latest-${networkName}.json`);
  fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Latest deployment saved to:", latestFile, "\n");

  console.log("🎉 Deployment Complete!\n");
  console.log("📝 Next Steps:");
  console.log("   1. Add contract address to admin panel:");
  console.log(`      Contract Address: ${contractAddress}`);
  console.log("   2. Configure pool rewards using setRewardConfig()");
  console.log("   3. Fund pool with reward tokens using fundRewards()");
  console.log("   4. Update staking pool in database with contract address\n");

  return deploymentInfo;
}

// Execute deployment
main()
  .then((deploymentInfo) => {
    console.log("✅ Deployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
