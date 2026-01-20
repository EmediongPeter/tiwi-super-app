# 🚀 Deploy Factory Contract to BSC - Quick Start

## ✅ Everything is Ready!

Your contract is compiled and ready to deploy. Just follow these steps:

## Step 1: Add Your Private Key

Edit your `.env` file and add:

```env
DEPLOYER_PRIVATE_KEY=0x...your_private_key_here
```

**How to get your private key:**
- MetaMask: Account icon → Account details → Export Private Key
- Enter your password
- Copy the key (starts with `0x`)

⚠️ **Keep it secret! Never commit to git!**

## Step 2: Ensure Wallet Has BNB

- Check balance: https://bscscan.com/address/YOUR_ADDRESS
- Need at least **0.1 BNB** for gas fees
- Deployment costs ~0.01-0.02 BNB

## Step 3: Deploy!

```bash
pnpm run deploy:factory:bsc
```

## What Happens:

1. ✅ Connects to BSC network
2. ✅ Checks wallet balance
3. ✅ Deploys factory contract
4. ✅ Waits for confirmation
5. ✅ Verifies on BscScan (if API key set)
6. ✅ Saves deployment info

## After Deployment:

Copy the factory address from output and add to `.env`:

```env
NEXT_PUBLIC_FACTORY_ADDRESS_BSC=0x...factory_address_from_output
```

## 🎉 That's It!

Once deployed:
- Admin can connect ANY wallet
- Create pools instantly from admin panel
- Connected wallet becomes pool owner
- Pools available immediately for users!

---

**Need help?** See `BSC_DEPLOYMENT_GUIDE.md` for detailed instructions.
