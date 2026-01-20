# TIWI Staking Pool - Mainnet Deployment Guide

## 🚀 Quick Start

This guide will help you deploy the TiwiStakingPool contract to Ethereum Mainnet (or any EVM-compatible network).

## 📋 Prerequisites

1. **Node.js** and **pnpm** installed
2. **Hardhat** installed (will be installed automatically)
3. **Deployer wallet** with:
   - ETH (or native token) for gas fees
   - Reward tokens (if funding immediately)
4. **RPC URL** for the target network
5. **Block explorer API key** (for contract verification)

## 🔧 Setup

### 1. Install Dependencies

```bash
cd tiwi-super-app
pnpm install
```

This will install Hardhat and all required dependencies.

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp env.example .env
```

**Required Variables for Deployment:**

```env
# Deployer wallet private key (NEVER commit to git!)
DEPLOYER_PRIVATE_KEY=0x...

# Network RPC URL
MAINNET_RPC_URL=https://eth.llamarpc.com

# Block explorer API key (for verification)
ETHERSCAN_API_KEY=your_api_key_here

# Token addresses
STAKING_TOKEN_ADDRESS=0x... # ERC20 token users will stake
REWARD_TOKEN_ADDRESS=0x... # ERC20 token for rewards (can be same)
OWNER_ADDRESS=0x... # Admin/owner address
```

## 📝 Deployment Steps

### Step 1: Compile Contract

```bash
pnpm run compile
```

This compiles the Solidity contract and checks for errors.

### Step 2: Deploy to Mainnet

```bash
pnpm run deploy:mainnet
```

Or for other networks:

```bash
# BNB Chain
pnpm run deploy:bsc

# Polygon
pnpm run deploy:polygon

# Arbitrum
pnpm run deploy:arbitrum

# Base
pnpm run deploy:base

# Optimism
pnpm run deploy:optimism

# Avalanche
pnpm run deploy:avalanche
```

**What happens:**
- Deploys the contract with your specified parameters
- Saves deployment info to `deployments/` directory
- Verifies contract on block explorer (if API key provided)

**Output:**
```
✅ TiwiStakingPool deployed to: 0x...
📊 Transaction hash: 0x...
✅ Contract verified successfully!
💾 Deployment info saved to: deployments/mainnet-1234567890.json
```

### Step 3: Configure Pool Rewards

After deployment, configure the pool with reward settings:

```bash
# Set environment variables for configuration
export CONTRACT_ADDRESS=0x... # Your deployed contract address
export POOL_REWARD=10000 # Total reward tokens
export REWARD_DURATION_DAYS=30 # Duration in days
export MAX_TVL=100000 # Maximum TVL

# Run configuration script
pnpm run configure:pool
```

This calls `setRewardConfig()` on the contract with your admin settings.

### Step 4: Fund the Pool

Fund the pool with reward tokens:

```bash
# Set environment variables
export CONTRACT_ADDRESS=0x... # Your deployed contract address
export REWARD_TOKEN_ADDRESS=0x... # Reward token address

# Run funding script
pnpm run fund:pool
```

**Important:** Make sure your deployer wallet:
- Has enough reward tokens
- Has approved the contract to spend them (script handles this automatically)

### Step 5: Add Contract Address to Admin Panel

1. Go to `/admin/staking-pools`
2. Find your pool or create a new one
3. Edit the pool
4. Add the deployed contract address in the "Contract Address" field
5. Save

The pool is now fully configured and ready for users to stake!

## 🔍 Verification

### Manual Verification (if automatic verification failed)

```bash
npx hardhat verify --network mainnet \
  <CONTRACT_ADDRESS> \
  <STAKING_TOKEN_ADDRESS> \
  <REWARD_TOKEN_ADDRESS> \
  <OWNER_ADDRESS>
```

### Check Deployment

Deployment info is saved in:
- `deployments/latest-mainnet.json` (latest deployment)
- `deployments/mainnet-<timestamp>.json` (timestamped)

## 📊 Deployment Checklist

- [ ] Install dependencies (`pnpm install`)
- [ ] Configure `.env` file with all required variables
- [ ] Compile contract (`pnpm run compile`)
- [ ] Deploy to mainnet (`pnpm run deploy:mainnet`)
- [ ] Verify contract on block explorer
- [ ] Configure pool rewards (`pnpm run configure:pool`)
- [ ] Fund pool with reward tokens (`pnpm run fund:pool`)
- [ ] Add contract address to admin panel
- [ ] Test staking from `/earn` page

## 🛡️ Security Best Practices

1. **Never commit private keys** to git
2. **Use a dedicated deployer wallet** (not your main wallet)
3. **Test on testnet first** (Sepolia, BSC Testnet, etc.)
4. **Verify contract** on block explorer
5. **Double-check all addresses** before deployment
6. **Keep deployment records** for audit purposes

## 🔗 Network-Specific Notes

### Ethereum Mainnet
- Gas fees: High (use gas price optimization)
- Verification: Etherscan
- Recommended RPC: Alchemy, Infura, or public RPC

### BNB Chain
- Gas fees: Low
- Verification: BscScan
- Native token: BNB

### Polygon
- Gas fees: Very low
- Verification: PolygonScan
- Native token: MATIC

### Arbitrum / Base / Optimism
- Gas fees: Low (L2)
- Verification: Arbiscan / Basescan / Optimism Explorer
- Native token: ETH

## 📞 Support

If you encounter issues:

1. Check contract compilation errors
2. Verify RPC URL is correct
3. Ensure deployer wallet has enough ETH for gas
4. Check block explorer for transaction status
5. Review deployment logs in `deployments/` directory

## 🎯 Example Deployment Flow

```bash
# 1. Setup
pnpm install
cp env.example .env
# Edit .env with your values

# 2. Deploy
pnpm run compile
pnpm run deploy:mainnet

# 3. Configure (after deployment)
export CONTRACT_ADDRESS=0x1234...
export POOL_REWARD=10000
export REWARD_DURATION_DAYS=30
export MAX_TVL=100000
pnpm run configure:pool

# 4. Fund
export REWARD_TOKEN_ADDRESS=0x5678...
pnpm run fund:pool

# 5. Add to admin panel
# Go to /admin/staking-pools and add contract address
```

## ✅ Post-Deployment

After successful deployment:

1. **Save deployment info** - Keep the deployment JSON files safe
2. **Add to admin panel** - Link contract to database pool
3. **Test thoroughly** - Test staking, rewards, and unstaking
4. **Monitor** - Watch contract on block explorer
5. **Document** - Record contract address and configuration

---

**Ready to deploy?** Start with `pnpm install` and follow the steps above! 🚀
