/**
 * Secure Wallet Creation Utility
 * 
 * Generates new wallets with proper security measures:
 * - Secure mnemonic generation using @scure/bip39
 * - Wallet derivation using viem
 * - No exposure of private keys
 * - Proper validation
 */

import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { mnemonicToAccount } from 'viem/accounts';
import { HDKey } from '@scure/bip32';

export interface CreatedWallet {
  address: string;
  mnemonic: string; // Only available immediately after creation - never stored in plaintext
}

/**
 * Generate a new wallet with a 12-word mnemonic phrase
 * 
 * SECURITY NOTES:
 * - Mnemonic is generated using cryptographically secure random number generation
 * - The mnemonic should be encrypted before storage
 * - Never log or expose the mnemonic
 * - Clear mnemonic from memory after encryption
 * 
 * @returns Object containing wallet address and mnemonic phrase
 */
export function generateNewWallet(): CreatedWallet {
  try {
    // Generate a 12-word mnemonic (128 bits of entropy)
    const mnemonic = generateMnemonic(wordlist, 128);
    
    // Validate mnemonic
    if (!mnemonic || mnemonic.split(' ').length !== 12) {
      throw new Error('Failed to generate valid mnemonic');
    }

    // Derive wallet account from mnemonic
    const account = mnemonicToAccount(mnemonic);

    return {
      address: account.address,
      mnemonic: mnemonic,
    };
  } catch (error) {
    // Never expose internal error details
    console.error('Wallet generation failed');
    throw new Error('Failed to generate wallet. Please try again.');
  }
}

/**
 * Derive a private key from mnemonic using standard EVM derivation path.
 *
 * Default path: m/44'/60'/0'/0/0 (first account)
 */
export function derivePrivateKeyFromMnemonic(
  mnemonic: string,
  derivationPath = "m/44'/60'/0'/0/0"
): `0x${string}` {
  const seed = mnemonicToSeedSync(mnemonic);
  const hd = HDKey.fromMasterSeed(seed);
  const child = hd.derive(derivationPath);
  if (!child.privateKey) {
    throw new Error('Failed to derive private key from mnemonic');
  }

  const hex = Array.from(child.privateKey)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `0x${hex}` as `0x${string}`;
}

/**
 * Validate a mnemonic phrase
 * 
 * @param mnemonic - The mnemonic phrase to validate
 * @returns True if valid, false otherwise
 */
export function validateMnemonic(mnemonic: string): boolean {
  try {
    if (!mnemonic || typeof mnemonic !== 'string') {
      return false;
    }

    const words = mnemonic.trim().split(/\s+/);
    
    // Must be 12 or 24 words
    if (words.length !== 12 && words.length !== 24) {
      return false;
    }

    // Check if all words are in the BIP39 wordlist
    const allWordsValid = words.every((word) => wordlist.includes(word.toLowerCase()));
    
    if (!allWordsValid) {
      return false;
    }

    // Try to derive account to verify checksum
    try {
      mnemonicToAccount(mnemonic.trim());
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Derive wallet address from mnemonic (without exposing private key)
 * 
 * @param mnemonic - The mnemonic phrase
 * @returns Wallet address
 */
export function getAddressFromMnemonic(mnemonic: string): string {
  try {
    const account = mnemonicToAccount(mnemonic.trim());
    return account.address;
  } catch (error) {
    throw new Error('Invalid mnemonic phrase');
  }
}

