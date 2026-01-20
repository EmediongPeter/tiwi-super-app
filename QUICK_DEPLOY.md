# 🚀 Quick Mainnet Deployment Guide

## Prerequisites

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env and add your values
   ```

## Required Environment Variables

Add these to your `.env` file:

```env
# Deployer wallet (NEVER commit this!)
DEPLOYER_PRIVATE_KEY=0x...your_private_key_here

# Network RPC URL
MAINNET_RPC_URL=https://eth.llamarpc.com

# Block explorer API key (for verification)
ETHERSCAN_API_KEY=your_etherscan_api_key

# Token addresses
STAKING_TOKEN_ADDRESS=0x... # ERC20 token users will stake
REWARD_TOKEN_ADDRESS=0x... # ERC20 token for rewards
OWNER_ADDRESS=0x... # Admin/owner address
```

## Deployment Steps

### 1. Compile Contract

```bash
pnpm run compile
```

### 2. Deploy to Mainnet

```bash
pnpm run deploy:mainnet
```

**Output will show:**
- Contract address
- Transaction hash
- Deployment info saved to `deployments/` folder

### 3. Configure Pool (After Deployment)

Set these environment variables:

```bash
export CONTRACT_ADDRESS=0x... # Your deployed contract address
export POOL_REWARD=10000 # Total reward tokens
export REWARD_DURATION_DAYS=30 # Duration in days
export MAX_TVL=100000 # Maximum TVL
```

Then run:

```bash
pnpm run configure:pool
```

### 4. Fund Pool

Set these environment variables:

```bash
export CONTRACT_ADDRESS=0x... # Your deployed contract address
export REWARD_TOKEN_ADDRESS=0x... # Reward token address
```

Then run:

```bash
pnpm run fund:pool
```

**Note:** Make sure your deployer wallet has enough reward tokens!

### 5. Add to Admin Panel

1. Go to `/admin/staking-pools`
2. Edit your pool
3. Add the contract address
4. Save

## ✅ Done!

Your staking pool is now live on mainnet and ready for users to stake!

## 🔗 Other Networks

For other networks, use:

```bash
pnpm run deploy:bsc        # BNB Chain
pnpm run deploy:polygon    # Polygon
pnpm run deploy:arbitrum   # Arbitrum
pnpm run deploy:base       # Base
pnpm run deploy:optimism   # Optimism
pnpm run deploy:avalanche  # Avalanche
```

## ⚠️ Important Notes

- **Never commit your private key to git!**
- **Test on testnet first** (use `deploy:sepolia`)
- **Double-check all addresses** before deployment
- **Keep deployment records** in `deployments/` folder

## 🆘 Troubleshooting

- **Compilation errors?** Check Solidity version matches (0.8.20)
- **Deployment fails?** Check RPC URL and wallet balance
- **Verification fails?** Check API key and wait a few minutes
- **Gas errors?** Increase gas price or use a different RPC
