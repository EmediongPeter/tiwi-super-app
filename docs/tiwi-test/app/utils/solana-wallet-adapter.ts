// Solana wallet adapter utilities
// Helps connect to common Solana wallets like Phantom, Solflare, etc.

export interface SolanaWallet {
  publicKey: any; // PublicKey object from @solana/web3.js (has toString method)
  signTransaction: (transaction: any) => Promise<any>;
  signAllTransactions: (transactions: any[]) => Promise<any[]>;
  sendTransaction?: (transaction: any, connection: any) => Promise<string>;
  isConnected: boolean;
  connected?: boolean; // Alias for isConnected (for compatibility with signAndExecuteSwap)
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Get connected Solana wallet from window object
 */
export const getSolanaWallet = async (): Promise<SolanaWallet | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  // Try Phantom first (most common)
  if ((window as any).phantom?.solana?.isPhantom) {
    const phantom = (window as any).phantom.solana;
    if (phantom.isConnected && phantom.publicKey) {
      return {
        publicKey: phantom.publicKey, // Keep as PublicKey object (has toString method)
        signTransaction: phantom.signTransaction?.bind(phantom) || (() => Promise.reject(new Error('signTransaction not available'))),
        signAllTransactions: phantom.signAllTransactions?.bind(phantom) || (() => Promise.reject(new Error('signAllTransactions not available'))),
        sendTransaction: phantom.sendTransaction?.bind(phantom),
        isConnected: phantom.isConnected,
        connected: phantom.isConnected, // Alias for compatibility with signAndExecuteSwap
        connect: async () => {
          await phantom.connect();
        },
        disconnect: async () => {
          await phantom.disconnect();
        },
      };
    }
  }

  // Try Solflare
  if ((window as any).solflare?.isSolflare) {
    const solflare = (window as any).solflare;
    if (solflare.isConnected && solflare.publicKey) {
      return {
        publicKey: solflare.publicKey, // Keep as PublicKey object (has toString method)
        signTransaction: solflare.signTransaction?.bind(solflare) || (() => Promise.reject(new Error('signTransaction not available'))),
        signAllTransactions: solflare.signAllTransactions?.bind(solflare) || (() => Promise.reject(new Error('signAllTransactions not available'))),
        sendTransaction: solflare.sendTransaction?.bind(solflare),
        isConnected: solflare.isConnected,
        connected: solflare.isConnected, // Alias for compatibility with signAndExecuteSwap
        connect: async () => {
          await solflare.connect();
        },
        disconnect: async () => {
          await solflare.disconnect();
        },
      };
    }
  }

  // Try generic Solana wallet
  if ((window as any).solana) {
    const solana = (window as any).solana;
    if (solana.isConnected && solana.publicKey) {
      return {
        publicKey: solana.publicKey, // Keep as PublicKey object (has toString method)
        signTransaction: solana.signTransaction?.bind(solana) || (() => Promise.reject(new Error('signTransaction not available'))),
        signAllTransactions: solana.signAllTransactions?.bind(solana) || (() => Promise.reject(new Error('signAllTransactions not available'))),
        sendTransaction: solana.sendTransaction?.bind(solana),
        isConnected: solana.isConnected,
        connected: solana.isConnected, // Alias for compatibility with signAndExecuteSwap
        connect: async () => {
          await solana.connect();
        },
        disconnect: async () => {
          await solana.disconnect();
        },
      };
    }
  }

  return null;
};

/**
 * Connect to Solana wallet
 * Always disconnects first to ensure fresh connection prompt
 */
export const connectSolanaWallet = async (): Promise<SolanaWallet> => {
  if (typeof window === 'undefined') {
    throw new Error('Window is not available');
  }

  // Try Phantom first
  if ((window as any).phantom?.solana?.isPhantom) {
    const phantom = (window as any).phantom.solana;
    try {
      // Always disconnect first to ensure fresh connection prompt
      if (phantom.disconnect) {
        try {
          await phantom.disconnect();
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          // Ignore disconnect errors - wallet might not be connected
        }
      }
      await phantom.connect();
      return {
        publicKey: phantom.publicKey?.toString() || '',
        signTransaction: phantom.signTransaction.bind(phantom),
        signAllTransactions: phantom.signAllTransactions.bind(phantom),
        sendTransaction: phantom.sendTransaction.bind(phantom),
        isConnected: true,
        connect: async () => {
          await phantom.connect();
        },
        disconnect: async () => {
          await phantom.disconnect();
        },
      };
    } catch (error) {
      console.error('Error connecting to Phantom:', error);
    }
  }

  // Try Solflare
  if ((window as any).solflare?.isSolflare) {
    const solflare = (window as any).solflare;
    try {
      // Always disconnect first to ensure fresh connection prompt
      if (solflare.disconnect) {
        try {
          await solflare.disconnect();
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          // Ignore disconnect errors - wallet might not be connected
        }
      }
      await solflare.connect();
      return {
        publicKey: solflare.publicKey?.toString() || '',
        signTransaction: solflare.signTransaction.bind(solflare),
        signAllTransactions: solflare.signAllTransactions.bind(solflare),
        sendTransaction: solflare.sendTransaction.bind(solflare),
        isConnected: true,
        connect: async () => {
          await solflare.connect();
        },
        disconnect: async () => {
          await solflare.disconnect();
        },
      };
    } catch (error) {
      console.error('Error connecting to Solflare:', error);
    }
  }

  // Try generic Solana wallet
  if ((window as any).solana) {
    const solana = (window as any).solana;
    try {
      // Always disconnect first to ensure fresh connection prompt
      if (solana.disconnect) {
        try {
          await solana.disconnect();
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          // Ignore disconnect errors - wallet might not be connected
        }
      }
      await solana.connect();
      return {
        publicKey: solana.publicKey?.toString() || '',
        signTransaction: solana.signTransaction.bind(solana),
        signAllTransactions: solana.signAllTransactions.bind(solana),
        sendTransaction: solana.sendTransaction.bind(solana),
        isConnected: true,
        connect: async () => {
          await solana.connect();
        },
        disconnect: async () => {
          await solana.disconnect();
        },
      };
    } catch (error) {
      console.error('Error connecting to Solana wallet:', error);
    }
  }

  throw new Error('No Solana wallet found. Please install Phantom or Solflare.');
};

/**
 * Get Solana wallet adapter for LiFi SDK
 * Converts our custom SolanaWallet interface to SignerWalletAdapter format
 */
export const getSolanaWalletAdapterForLiFi = async (): Promise<any> => {
  const wallet = await getSolanaWallet();
  if (!wallet || !wallet.isConnected) {
    throw new Error('Solana wallet not connected');
  }

  // Import PublicKey from @solana/web3.js
  const { PublicKey } = await import('@solana/web3.js');
  
  // Create a wrapper that matches SignerWalletAdapter interface
  return {
    publicKey: new PublicKey(wallet.publicKey),
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
    signMessage: async (message: Uint8Array) => {
      // Most Solana wallets support signMessage
      if (typeof window !== 'undefined') {
        const phantom = (window as any).phantom?.solana;
        const solflare = (window as any).solflare;
        const solana = (window as any).solana;
        
        if (phantom?.isPhantom && phantom.signMessage) {
          return await phantom.signMessage(message);
        }
        if (solflare?.isSolflare && solflare.signMessage) {
          return await solflare.signMessage(message);
        }
        if (solana?.signMessage) {
          return await solana.signMessage(message);
        }
      }
      throw new Error('Wallet does not support signMessage');
    },
    connected: wallet.isConnected,
    connect: wallet.connect,
    disconnect: wallet.disconnect,
  };
};

