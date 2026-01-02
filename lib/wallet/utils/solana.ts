/**
 * Solana Wallet Utilities
 */

export async function createSolanaConnection() {
  const { Connection, clusterApiUrl } = await import("@solana/web3.js");
  
  // Use environment variable if available, otherwise use public RPC
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");
  
  return new Connection(rpcUrl, "confirmed");
}

export async function getSolanaWallet() {
  // Check for Phantom wallet
  if (typeof window !== "undefined" && (window as any).solana?.isPhantom) {
    return (window as any).solana;
  }
  
  // Check for other Solana wallets
  if (typeof window !== "undefined" && (window as any).solflare) {
    return (window as any).solflare;
  }
  
  throw new Error("No Solana wallet found. Please install Phantom or Solflare.");
}

