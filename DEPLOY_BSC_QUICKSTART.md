# BSC Deployment Quick Start 🚀

## ⚡ 5-Minute Setup

### Step 1: Add Required Variables to `.env`

Create or edit `.env` file in project root:

```env
# REQUIRED - Your wallet private key
DEPLOYER_PRIVATE_KEY=0x...your_private_key_here
```

**How to get your private key:**
- MetaMask: Account icon → Account details → Export Private Key
- Other wallets: Follow wallet's export instructions
- ⚠️ Keep it secret! Never commit to git!

### Step 2: Add Optional Variables (Recommended)

```env
# Optional but recommended
OWNER_ADDRESS=0x...admin_address_here  # Who can create pools (defaults to deployer)
BSCSCAN_API_KEY=your_api_key           # Get at https://bscscan.com/myapikey (free)
```

### Step 3: Fund Your Wallet

- Ensure your wallet has at least **0.1 BNB**
- Check balance: https://bscscan.com/address/YOUR_ADDRESS
- Get BNB: Transfer from exchange or bridge

### Step 4: Deploy!

```bash
# Compile contracts
pnpm run compile

# Deploy to BSC
pnpm run deploy:factory:bsc
```

### Step 5: Save Factory Address

After deployment, copy the factory address from output and add to `.env`:

```env
NEXT_PUBLIC_FACTORY_ADDRESS_BSC=0x...factory_address_from_output
```

---

## 📋 Complete Environment Variables List

```env
# ========================================
# REQUIRED
# ========================================
DEPLOYER_PRIVATE_KEY=0x...your_private_key

# ========================================
# OPTIONAL (Recommended)
# ========================================
OWNER_ADDRESS=0x...admin_address
BSCSCAN_API_KEY=your_bscscan_api_key
BSC_RPC_URL=https://bsc-dataseed1.defibit.io/

# ========================================
# POST-DEPLOYMENT (Add after deployment)
# ========================================
NEXT_PUBLIC_FACTORY_ADDRESS_BSC=0x...factory_address
```

---

## ✅ What Happens During Deployment

1. ✅ Checks for `DEPLOYER_PRIVATE_KEY`
2. ✅ Connects to BSC network
3. ✅ Checks wallet balance
4. ✅ Deploys factory contract
5. ✅ Waits for confirmation
6. ✅ Verifies contract on BscScan (if API key set)
7. ✅ Saves deployment info to `deployments/` folder

---

## 🎯 Expected Output

```
🚀 Starting TiwiStakingPoolFactory deployment...

📝 Deploying with account: 0x...your_address
💰 Account balance: 0.5 BNB

📋 Deployment Configuration:
   Owner Address: 0x...owner
   Network: bsc

⏳ Deploying TiwiStakingPoolFactory contract...
✅ TiwiStakingPoolFactory deployed to: 0x...FACTORY_ADDRESS
📊 Transaction hash: 0x...TX_HASH

✅ Contract verified successfully!

🎉 Factory Deployment Complete!

📝 Next Steps:
   1. Add factory address to .env: FACTORY_ADDRESS=0x...FACTORY_ADDRESS
   ...
```

---

## 🆘 Troubleshooting

**"DEPLOYER_PRIVATE_KEY not set"**
→ Add it to your `.env` file

**"Insufficient balance"**
→ Add more BNB (need at least 0.1 BNB)

**"Connect timeout"**
→ Try different RPC in `.env`: `BSC_RPC_URL=https://1rpc.io/bnb`

**"No signers available"**
→ Check private key format (should start with `0x`)

---

## 📚 Full Documentation

See `BSC_DEPLOYMENT_GUIDE.md` for complete instructions.

---

**Ready? Let's deploy! 🚀**

```bash
pnpm run deploy:factory:bsc
```
