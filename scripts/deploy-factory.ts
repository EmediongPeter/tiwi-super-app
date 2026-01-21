/**
 * Deployment Script for TiwiStakingPoolFactory
 * 
 * This factory contract manages ALL staking pools for different tokens.
 * Deploy ONCE per chain - then admin can create pools instantly via createPool()
 * 
 * Usage:
 *   pnpm run deploy:factory:mainnet
 * 
 * Environment Variables Required:
 *   - DEPLOYER_PRIVATE_KEY: Private key of deployer wallet
 *   - MAINNET_RPC_URL: RPC URL for mainnet (or network-specific RPC)
 *   - OWNER_ADDRESS: Address that will own the factory (admin)
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("🚀 Starting TiwiStakingPoolFactory deployment...\n");

  // Get ethers from hardhat runtime environment
  const { ethers } = hre;

  // Check if DEPLOYER_PRIVATE_KEY is set
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("❌ DEPLOYER_PRIVATE_KEY environment variable is required. Please set it in your .env file.");
  }

  // Get deployer
  const signers = await ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error("❌ No signers available. Please check your DEPLOYER_PRIVATE_KEY in .env file.");
  }
  
  const [deployer] = signers;
  console.log("📝 Deploying with account:", deployer.address);
  
  // Get balance (convert from wei to BNB for BSC)
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "BNB\n");

  // Get owner address from environment or use deployer
  const ownerAddress = process.env.OWNER_ADDRESS || deployer.address;

  console.log("📋 Deployment Configuration:");
  console.log("   Owner Address:", ownerAddress);
  console.log("   Network:", (await ethers.provider.getNetwork()).name, "\n");

  // Deploy factory contract
  console.log("⏳ Deploying TiwiStakingPoolFactory contract...");
  const TiwiStakingPoolFactory = await ethers.getContractFactory("TiwiStakingPoolFactory");
  const factory = await TiwiStakingPoolFactory.deploy(ownerAddress);

  await factory.waitForDeployment();
  const contractAddress = await factory.getAddress();

  console.log("✅ TiwiStakingPoolFactory deployed to:", contractAddress);
  console.log("📊 Transaction hash:", factory.deploymentTransaction()?.hash, "\n");

  // Verify contract on Etherscan (if API key is provided)
  const network = await ethers.provider.getNetwork();
  const hasApiKey = process.env.ETHERSCAN_API_KEY || process.env.BSCSCAN_API_KEY || 
                    process.env.POLYGONSCAN_API_KEY || process.env.ARBISCAN_API_KEY ||
                    process.env.BASESCAN_API_KEY || process.env.OPTIMISM_API_KEY ||
                    process.env.SNOWTRACE_API_KEY;
  
  if (hasApiKey) {
    console.log("⏳ Waiting for block confirmations before verification...");
    await factory.deploymentTransaction()?.wait(5);
    
    console.log("🔍 Verifying contract on block explorer...");
    try {
      const { default: hre } = await import("hardhat");
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [ownerAddress],
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
    deploymentTxHash: factory.deploymentTransaction()?.hash,
    deployedAt: new Date().toISOString(),
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save to JSON file
  const networkName = (await ethers.provider.getNetwork()).name;
  const deploymentFile = path.join(deploymentsDir, `factory-${networkName}-${Date.now()}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to:", deploymentFile);

  // Also save to latest file
  const latestFile = path.join(deploymentsDir, `factory-latest-${networkName}.json`);
  fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Latest factory deployment saved to:", latestFile, "\n");

  console.log("🎉 Factory Deployment Complete!\n");
  console.log("📝 Next Steps:");
  console.log(`   1. Add factory address to .env: FACTORY_ADDRESS=${contractAddress}`);
  console.log(`   2. Add factory address to database or config`);
  console.log("   3. Admin can now create pools instantly from the admin panel!");
  console.log("   4. No need to deploy new contracts for each token pool.\n");

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
