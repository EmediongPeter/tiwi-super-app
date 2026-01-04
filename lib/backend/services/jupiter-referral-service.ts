/**
 * Jupiter Referral Service
 * 
 * Manages Jupiter referral accounts and token accounts for fee collection.
 * Uses Jupiter's Referral SDK to create and manage fee accounts.
 */

import { ReferralProvider } from "@jup-ag/referral-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { createSolanaConnection } from '@/lib/backend/utils/solana-connection';

// Jupiter Ultra Referral Project public key
const JUPITER_REFERRAL_PROJECT = new PublicKey('DkiqsTrw1u1bYFumumC7sCG2S8K25qc2vemJFHyW2wJc');
const REFERRAL_PROGRAM = new PublicKey('REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3');

/**
 * Jupiter Referral Service
 * Handles referral account and token account management
 */
export class JupiterReferralService {
  private connection: Connection | null = null;
  private provider: ReferralProvider | null = null;
  private referralAccount: PublicKey | null = null;
  
  /**
   * Initialize connection and provider
   */
  private async initialize(): Promise<void> {
    if (!this.connection) {
      this.connection = await createSolanaConnection();
      this.provider = new ReferralProvider(this.connection);
    }
    
    // Load referral account from environment
    const referralAccountAddress = process.env.JUPITER_REFERRAL_ACCOUNT;
    if (referralAccountAddress) {
      try {
        this.referralAccount = new PublicKey(referralAccountAddress);
      } catch (error) {
        console.warn('[JupiterReferralService] Invalid JUPITER_REFERRAL_ACCOUNT in environment');
      }
    }
  }
  
  /**
   * Get referral account address
   * Returns the referral account from environment variable
   */
  async getReferralAccount(): Promise<PublicKey | null> {
    await this.initialize();
    return this.referralAccount;
  }
  
  /**
   * Get referral token account address (deterministic PDA)
   * This address can be calculated, but the account must exist on-chain
   */
  getReferralTokenAccountAddress(
    referralAccountPubKey: PublicKey,
    mint: PublicKey
  ): PublicKey {
    const [tokenAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("referral_ata"),
        referralAccountPubKey.toBuffer(),
        mint.toBuffer(),
      ],
      REFERRAL_PROGRAM
    );
    return tokenAccount;
  }
  
  /**
   * Check if referral token account exists on-chain
   */
  async checkReferralTokenAccountExists(
    referralAccountPubKey: PublicKey,
    mint: PublicKey
  ): Promise<boolean> {
    await this.initialize();
    if (!this.connection) return false;
    
    try {
      const tokenAccountAddress = this.getReferralTokenAccountAddress(
        referralAccountPubKey,
        mint
      );
      const accountInfo = await this.connection.getAccountInfo(tokenAccountAddress);
      return accountInfo !== null;
    } catch (error) {
      console.error('[JupiterReferralService] Error checking token account:', error);
      return false;
    }
  }
  
  /**
   * Determine which fee account to use based on swap pair
   * Returns the referral token account address for the preferred mint
   * 
   * Priority: USDC > USDT > SOL
   */
  async getFeeAccountForSwap(
    inputMint: string,
    outputMint: string,
    swapMode: 'ExactIn' | 'ExactOut' = 'ExactIn'
  ): Promise<{ feeAccount: string; feeMint: string } | null> {
    await this.initialize();
    
    const referralAccount = await this.getReferralAccount();
    if (!referralAccount) {
      console.warn('[JupiterReferralService] No referral account configured');
      return null;
    }
    
    // Preferred mints in order of priority
    const preferredMints = [
      { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
      { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' },
      { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL' },
    ];
    
    const inputMintPubkey = new PublicKey(inputMint);
    const outputMintPubkey = new PublicKey(outputMint);
    
    if (swapMode === 'ExactIn') {
      // Can use input or output mint
      for (const preferred of preferredMints) {
        const preferredMint = new PublicKey(preferred.address);
        if (inputMintPubkey.equals(preferredMint) || outputMintPubkey.equals(preferredMint)) {
          const feeAccount = this.getReferralTokenAccountAddress(referralAccount, preferredMint);
          const exists = await this.checkReferralTokenAccountExists(referralAccount, preferredMint);
          
          if (exists) {
            return {
              feeAccount: feeAccount.toBase58(),
              feeMint: preferred.address,
            };
          }
        }
      }
      
      // Fallback to output mint if preferred mints not available
      const feeAccount = this.getReferralTokenAccountAddress(referralAccount, outputMintPubkey);
      const exists = await this.checkReferralTokenAccountExists(referralAccount, outputMintPubkey);
      
      if (exists) {
        return {
          feeAccount: feeAccount.toBase58(),
          feeMint: outputMint,
        };
      }
    } else {
      // ExactOut: Can only use input mint
      const feeAccount = this.getReferralTokenAccountAddress(referralAccount, inputMintPubkey);
      const exists = await this.checkReferralTokenAccountExists(referralAccount, inputMintPubkey);
      
      if (exists) {
        return {
          feeAccount: feeAccount.toBase58(),
          feeMint: inputMint,
        };
      }
    }
    
    // No fee account available
    return null;
  }
}

// Singleton instance
let referralServiceInstance: JupiterReferralService | null = null;

/**
 * Get singleton JupiterReferralService instance
 */
export function getJupiterReferralService(): JupiterReferralService {
  if (!referralServiceInstance) {
    referralServiceInstance = new JupiterReferralService();
  }
  return referralServiceInstance;
}

