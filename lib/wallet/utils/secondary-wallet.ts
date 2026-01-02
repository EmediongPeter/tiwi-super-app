/**
 * Secondary Wallet Connection Utility
 * 
 * Functions to connect wallets for recipient addresses without affecting the primary wallet
 */

import { connectWallet as connectWalletConnector } from '../connection/connector';
import type { WalletChain } from '../connection/types';
import type { WalletType } from '@/components/wallet/connect-wallet-modal';
import { getWalletById } from '../detection/detector';
import { mapWalletIdToProviderId } from './wallet-id-mapper';

// Determine chain from wallet ID
function getChainForWallet(walletId: string): 'ethereum' | 'solana' {
  const solanaOnlyWallets = ['solflare', 'glow', 'slope', 'nightly', 'jupiter'];
  if (solanaOnlyWallets.includes(walletId.toLowerCase())) {
    return 'solana';
  }
  return 'ethereum';
}

/**
 * Connect a wallet and get its address without updating the primary wallet state
 * This uses the real wallet connection flow but only returns the address
 * This is used for recipient wallet selection
 */
export async function connectSecondaryWallet(
  walletType: WalletType | string,
  chain?: WalletChain
): Promise<string> {
  let walletId: string;
  let walletChain: WalletChain;

  // Handle string wallet type
  if (typeof walletType === 'string') {
    // Get wallet info to determine chain if not provided
    const walletInfo = getWalletById(walletType);
    if (!walletInfo) {
      throw new Error(`Wallet "${walletType}" not found`);
    }

    walletId = walletInfo.id;
    walletChain = chain || getChainForWallet(walletId);
  } else {
    throw new Error('Invalid wallet type');
  }

  // Map wallet ID to provider ID
  const providerId = mapWalletIdToProviderId(walletId);
  
  // Use the real wallet connection function - this handles all the proper wallet detection,
  // verification, and connection logic
  const account = await connectWalletConnector(providerId, walletChain);
  
  // Return just the address - we don't update the primary wallet state
  return account.address;
}

