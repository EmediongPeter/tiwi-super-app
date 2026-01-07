/**
 * Jupiter Referral Account Setup Script
 * 
 * This script creates Jupiter referral accounts for fee collection.
 * Run this once to set up fee accounts before using Jupiter swaps.
 * 
 * Usage:
 *   npx tsx scripts/setup-jupiter-referral.ts
 * 
 * Requirements:
 *   - JUPITER_API_KEY in environment
 *   - SOLANA_RPC_URL in environment (optional, uses public RPC if not set)
 *   - Wallet private key or keypair file for signing transactions
 */

import { ReferralProvider } from "@jup-ag/referral-sdk";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import { createSolanaConnection } from '@/lib/backend/utils/solana-connection';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as bs58 from 'bs58';

// Load environment variables from .env file
const envPath = path.join(process.cwd(), '.env');
const envLocalPath = path.join(process.cwd(), '.env.local');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  console.warn('⚠️  No .env or .env.local file found. Using environment variables from system.');
}

// Jupiter Ultra Referral Project public key
const JUPITER_REFERRAL_PROJECT = new PublicKey('DkiqsTrw1u1bYFumumC7sCG2S8K25qc2vemJFHyW2wJc');

// Popular token mints to create fee accounts for
const POPULAR_MINTS = [
  { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL' },
  { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
  { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' },
];

/**
 * Load wallet from private key or keypair file
 */
function loadWallet(): Keypair {
  // Try environment variable first
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  console.log("🚀 ~ loadWallet ~ privateKey:", privateKey)
  if (privateKey) {
    try {
      // Handle base58 string or JSON array
      let keyArray: number[];
      if (privateKey.startsWith('[')) {
        keyArray = JSON.parse(privateKey);
      } else {
        // Assume base58 - convert to Uint8Array
        const decoded = bs58.default.decode(privateKey);
        console.log("🚀 ~ loadWallet ~ decoded:", decoded)
        keyArray = Array.from(decoded);
        console.log("🚀 ~ loadWallet ~ keyArray:", keyArray)
      }
      return Keypair.fromSecretKey(Uint8Array.from(keyArray));
    } catch (error) {
      throw new Error('Failed to parse SOLANA_PRIVATE_KEY. Expected base58 string or JSON array.');
    }
  }
  
  // Try keypair file
  const keypairPath = process.env.SOLANA_KEYPAIR_PATH || path.join(process.cwd(), 'keypair.json');
  if (fs.existsSync(keypairPath)) {
    try {
      const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
      return Keypair.fromSecretKey(Uint8Array.from(keypairData));
    } catch (error) {
      throw new Error(`Failed to load keypair from ${keypairPath}`);
    }
  }
  
  throw new Error(
    'No wallet found. Set SOLANA_PRIVATE_KEY (base58 or JSON array) or SOLANA_KEYPAIR_PATH (path to keypair.json)'
  );
}

/**
 * Check if referral account exists
 */
async function checkReferralAccountExists(
  connection: Connection,
  referralAccount: PublicKey
): Promise<boolean> {
  const accountInfo = await connection.getAccountInfo(referralAccount);
  return accountInfo !== null;
}

/**
 * Main setup function
 */
async function main() {
  console.log('🚀 Jupiter Referral Account Setup');
  console.log('================================\n');
  
  // Validate environment
  console.log("🚀 ~ main ~ process.env.JUPITER_API_KEY:", process.env.JUPITER_API_KEY)
  if (!process.env.JUPITER_API_KEY) {
    console.error('❌ Error: JUPITER_API_KEY not set in environment');
    process.exit(1);
  }
  
  // Load wallet
  let wallet: Keypair;
  try {
    wallet = loadWallet();
    console.log(`✅ Wallet loaded: ${wallet.publicKey.toBase58()}\n`);
  } catch (error: any) {
    console.error(`❌ Error loading wallet: ${error.message}`);
    console.error('\nTo set up wallet:');
    console.error('  1. Set SOLANA_PRIVATE_KEY environment variable (base58 or JSON array)');
    console.error('  2. Or set SOLANA_KEYPAIR_PATH to path of keypair.json file');
    process.exit(1);
  }
  
  // Create connection
  let connection: Connection;
  try {
    connection = await createSolanaConnection();
    console.log('✅ Connected to Solana\n');
  } catch (error: any) {
    console.error(`❌ Error connecting to Solana: ${error.message}`);
    process.exit(1);
  }
  
  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  const balanceSOL = balance / 1e9;
  console.log(`💰 Wallet balance: ${balanceSOL.toFixed(4)} SOL`);
  
  if (balanceSOL < 0.1) {
    console.warn('⚠️  Warning: Low balance. You need SOL to pay for transaction fees.\n');
  } else {
    console.log('✅ Sufficient balance for setup\n');
  }
  
  // Initialize referral provider
  const provider = new ReferralProvider(connection);
  
  // Step 1: Create referral account
  console.log('📝 Step 1: Creating referral account...');
  try {
    const referralAccountName = process.env.JUPITER_REFERRAL_NAME || 'tiwi-protocol';
    const transaction = await provider.initializeReferralAccountWithName({
      payerPubKey: wallet.publicKey,
      partnerPubKey: wallet.publicKey,
      projectPubKey: JUPITER_REFERRAL_PROJECT,
      name: referralAccountName,
    });
    
    const referralAccount = transaction.referralAccountPubKey;
    const exists = await checkReferralAccountExists(connection, referralAccount);
    
    if (!exists) {
      console.log(`   Creating referral account: ${referralAccount.toBase58()}`);
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction.tx,
        [wallet],
        { commitment: 'confirmed' }
      );
      console.log(`   ✅ Referral account created!`);
      console.log(`   📋 Account: ${referralAccount.toBase58()}`);
      console.log(`   🔗 Transaction: https://solscan.io/tx/${signature}\n`);
    } else {
      console.log(`   ✅ Referral account already exists: ${referralAccount.toBase58()}\n`);
    }
    
    // Store referral account address
    console.log('📋 IMPORTANT: Add this to your .env file:');
    console.log(`   JUPITER_REFERRAL_ACCOUNT=${referralAccount.toBase58()}\n`);
    
    // Step 2: Create token accounts for popular mints
    console.log('📝 Step 2: Creating token accounts for popular mints...');
    for (const mintInfo of POPULAR_MINTS) {
      try {
        const mint = new PublicKey(mintInfo.address);
        const tokenTransaction = await provider.initializeReferralTokenAccountV2({
          payerPubKey: wallet.publicKey,
          referralAccountPubKey: referralAccount,
          mint,
        });
        
        const tokenAccount = tokenTransaction.tokenAccount;
        const tokenExists = await connection.getAccountInfo(tokenAccount);
        
        if (!tokenExists) {
          console.log(`   Creating ${mintInfo.symbol} token account...`);
          const signature = await sendAndConfirmTransaction(
            connection,
            tokenTransaction.tx,
            [wallet],
            { commitment: 'confirmed' }
          );
          console.log(`   ✅ ${mintInfo.symbol} token account created: ${tokenAccount.toBase58()}`);
          console.log(`   🔗 Transaction: https://solscan.io/tx/${signature}`);
        } else {
          console.log(`   ✅ ${mintInfo.symbol} token account already exists: ${tokenAccount.toBase58()}`);
        }
      } catch (error: any) {
        console.error(`   ❌ Error creating ${mintInfo.symbol} token account: ${error.message}`);
      }
    }
    
    console.log('\n✅ Setup complete!');
    console.log('\n📋 Summary:');
    console.log(`   Referral Account: ${referralAccount.toBase58()}`);
    console.log(`   Add to .env: JUPITER_REFERRAL_ACCOUNT=${referralAccount.toBase58()}`);
    console.log('\n💡 Note: You can create additional token accounts on-demand as needed.');
    
  } catch (error: any) {
    console.error(`❌ Error during setup: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run setup
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
