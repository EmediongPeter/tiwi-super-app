# BSC Factory Deployment Guide

Complete guide for deploying the TiwiStakingPoolFactory contract to Binance Smart Chain (BSC).

## 📋 Prerequisites

Before deploying to BSC, make sure you have:

1. ✅ **Node.js and pnpm** - Development environment set up
2. ✅ **BNB in wallet** - For gas fees (recommend at least 0.1 BNB)
3. ✅ **Private key** - From your deployer wallet
4. ✅ **BscScan API key** (optional) - For contract verification

---

## 🔧 Step 1: Environment Variables Setup

### Required Environment Variables

Create or update your `.env` file in the project root with the following:

```env
# ============================================================================
# REQUIRED - Deployment Configuration
# ============================================================================

# Your deployer wallet private key (with 0x prefix)
# ⚠️  NEVER commit this to git!
DEPLOYER_PRIVATE_KEY=0x...your_private_key_here

# ============================================================================
# OPTIONAL - Owner/Admin Configuration
# ============================================================================

# Admin address that will own the factory contract
# If not set, defaults to deployer address
# This address will be able to create pools and manage rewards
OWNER_ADDRESS=0x...admin_address_here

# ============================================================================
# OPTIONAL - Network Configuration
# ============================================================================

# BSC RPC endpoint (has default if not set)
# Default: https://bsc-dataseed1.defibit.io/
# You can use any of these alternatives:
#   - https://bsc-dataseed.binance.org/
#   - https://bsc-dataseed1.defibit.io/
#   - https://bsc-dataseed1.ninicoin.io/
#   - https://bsc-dataseed2.defibit.io/
#   - https://1rpc.io/bnb
BSC_RPC_URL=https://bsc-dataseed1.defibit.io/

# ============================================================================
# OPTIONAL - Contract Verification
# ============================================================================

# BscScan API key for automatic contract verification
# Get yours at: https://bscscan.com/myapikey
# Free to create, allows automatic verification after deployment
BSCSCAN_API_KEY=your_bscscan_api_key_here

# ============================================================================
# POST-DEPLOYMENT - Frontend Configuration
# ============================================================================

# Factory contract address (add this AFTER deployment)
# Will be shown in deployment output
NEXT_PUBLIC_FACTORY_ADDRESS_BSC=0x...factory_address_here
```

---

## 📝 Step 2: Get Your Private Key

### Option A: Export from MetaMask

1. Open MetaMask
2. Click account icon (top right)
3. Click "Account details"
4. Click "Export Private Key"
5. Enter your password
6. Copy the private key (starts with `0x`)

### Option B: Export from other wallets

Follow your wallet's documentation for exporting private keys.

⚠️ **Security Warning:**
- Never share your private key
- Never commit it to git
- Use a dedicated deployment wallet (not your main wallet)
- Store it securely (password manager, hardware wallet, etc.)

---

## 💰 Step 3: Fund Your Deployer Wallet

1. **Check BNB balance:**
   - Go to [BscScan](https://bscscan.com/)
   - Enter your wallet address
   - Make sure you have at least **0.1 BNB** for gas fees

2. **Get BNB if needed:**
   - Transfer BNB from another wallet
   - Buy BNB from an exchange and withdraw to your wallet
   - Use a bridge to transfer from another chain

---

## 🔑 Step 4: Get BscScan API Key (Optional but Recommended)

1. Go to [BscScan API](https://bscscan.com/myapikey)
2. Sign up or log in
3. Create a new API key
4. Copy the API key
5. Add to your `.env` file as `BSCSCAN_API_KEY`

This allows automatic contract verification after deployment.

---

## 🚀 Step 5: Deploy the Factory Contract

### 1. Make sure contract is compiled:

```bash
pnpm run compile
```

### 2. Deploy to BSC:

```bash
pnpm run deploy:factory:bsc
```

### 3. Expected Output:

```
🚀 Starting TiwiStakingPoolFactory deployment...

📝 Deploying with account: 0x...your_address
💰 Account balance: 0.5 BNB

📋 Deployment Configuration:
   Owner Address: 0x...owner_address
   Network: bsc

⏳ Deploying TiwiStakingPoolFactory contract...
✅ TiwiStakingPoolFactory deployed to: 0x...factory_address
📊 Transaction hash: 0x...tx_hash

⏳ Waiting for block confirmations before verification...
🔍 Verifying contract on block explorer...
✅ Contract verified successfully!

💾 Deployment info saved to: deployments/factory-bsc-1234567890.json
💾 Latest factory deployment saved to: deployments/factory-latest-bsc.json

🎉 Factory Deployment Complete!

📝 Next Steps:
   1. Add factory address to .env: FACTORY_ADDRESS=0x...factory_address
   2. Add factory address to database or config
   3. Admin can now create pools instantly from the admin panel!
   4. No need to deploy new contracts for each token pool.
```

---

## ✅ Step 6: Post-Deployment Setup

### 1. Save Factory Address

Copy the factory address from the deployment output and add it to your `.env`:

```env
NEXT_PUBLIC_FACTORY_ADDRESS_BSC=0x...factory_address_from_output
```

### 2. Verify Deployment on BscScan

1. Go to [BscScan](https://bscscan.com/)
2. Search for your factory contract address
3. Verify that:
   - Contract shows as verified ✅
   - Owner address matches your admin address
   - Contract code matches your deployment

### 3. Test Factory Contract

You can interact with the contract on BscScan:
- View contract: `https://bscscan.com/address/0x...factory_address#code`
- Read functions: Check `owner`, `poolCount`, etc.
- Write functions: Connect wallet and call `createPool()` (if you're the owner)

---

## 🎯 Step 7: Verify Everything Works

### 1. Check Environment Variables

Make sure your `.env` file has:
- ✅ `DEPLOYER_PRIVATE_KEY` - Your private key
- ✅ `NEXT_PUBLIC_FACTORY_ADDRESS_BSC` - Factory address
- ✅ `OWNER_ADDRESS` (optional) - Admin address
- ✅ `BSCSCAN_API_KEY` (optional) - For verification

### 2. Restart Development Server

If you're running the dev server, restart it to load new env variables:

```bash
# Stop current server (Ctrl+C)
pnpm run dev
```

### 3. Test Admin Panel

1. Go to `/admin/staking-pools`
2. Click "Create Stake"
3. Connect your wallet (should use owner address)
4. Create a test pool
5. Verify pool appears on-chain

---

## 🔍 Troubleshooting

### Error: "DEPLOYER_PRIVATE_KEY not set"

**Solution:** Make sure your `.env` file exists and has the correct variable name:
```env
DEPLOYER_PRIVATE_KEY=0x...your_key
```

### Error: "Insufficient balance" or "Out of gas"

**Solution:** Add more BNB to your deployer wallet:
- Current balance should be at least 0.1 BNB
- Deployment typically costs ~0.01-0.02 BNB

### Error: "Connect Timeout" or RPC errors

**Solution:** Try a different BSC RPC endpoint in your `.env`:
```env
BSC_RPC_URL=https://bsc-dataseed2.defibit.io/
# OR
BSC_RPC_URL=https://1rpc.io/bnb
```

### Error: "Contract verification failed"

**Solution:** 
- Check your `BSCSCAN_API_KEY` is correct
- Wait a few minutes after deployment before verification
- Manually verify on BscScan if needed

### Error: "No signers available"

**Solution:** 
- Check your `DEPLOYER_PRIVATE_KEY` format (should start with `0x`)
- Make sure it's a valid private key (64 hex characters after `0x`)
- Ensure it's in the `.env` file, not commented out

---

## 📊 Deployment Costs

Typical gas costs on BSC:
- **Contract Deployment:** ~2,000,000 - 3,000,000 gas
- **Gas Price:** ~3-5 Gwei (very low!)
- **Total Cost:** ~0.01 - 0.02 BNB (~$3-6 USD)

Much cheaper than Ethereum! 🎉

---

## 🔒 Security Checklist

Before deploying:

- [ ] Using a dedicated deployment wallet (not main wallet)
- [ ] Private key stored securely
- [ ] `.env` file added to `.gitignore`
- [ ] Never committing private keys to git
- [ ] Owner address verified (who will control the factory)
- [ ] Have enough BNB for gas fees
- [ ] Tested on testnet first (recommended)

---

## 📝 Quick Reference

### Essential Commands

```bash
# Compile contracts
pnpm run compile

# Deploy factory to BSC
pnpm run deploy:factory:bsc

# View deployment info
cat deployments/factory-latest-bsc.json
```

### Essential Environment Variables

```env
DEPLOYER_PRIVATE_KEY=0x...        # Required
OWNER_ADDRESS=0x...               # Optional (defaults to deployer)
BSC_RPC_URL=https://...           # Optional (has default)
BSCSCAN_API_KEY=...               # Optional (for verification)
NEXT_PUBLIC_FACTORY_ADDRESS_BSC=0x...  # Add after deployment
```

### Useful Links

- **BscScan:** https://bscscan.com/
- **BscScan API:** https://bscscan.com/myapikey
- **BSC Explorer:** https://bscscan.com/
- **BSC Faucet:** Not available for mainnet (need real BNB)

---

## 🎉 Success!

Once deployed, your factory contract will:

1. ✅ Manage all staking pools in one place
2. ✅ Allow admin to create pools instantly via `createPool()`
3. ✅ No need to deploy new contracts for each token
4. ✅ Lower gas costs (one deployment, unlimited pools)
5. ✅ Pools immediately available for users to stake

**Next Steps:**
- Deploy factory to BSC using the steps above
- Add factory address to `.env`
- Admin can now create pools from the admin panel!
- Users can stake immediately when pools are created

---

## 📞 Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all environment variables are set correctly
3. Ensure wallet has sufficient BNB
4. Check BscScan for transaction status
5. Review deployment logs for specific errors

Good luck with your deployment! 🚀
