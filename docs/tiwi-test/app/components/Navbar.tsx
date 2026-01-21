'use client';

import Link from 'next/link';
import { useDisconnect } from 'wagmi';
import { disconnectWallet, type WalletAccount, type WalletChain } from '../utils/wallet-detector';
import WalletSelector from './WalletSelector';
import { useWallet } from '../contexts/WalletContext';

// Map WalletChain to chain display names
const chainLabels: Record<WalletChain, string> = {
  ethereum: 'Ethereum',
  solana: 'Solana',
};

export default function Navbar() {
  const { connectedWallet, setConnectedWallet, showWalletSelector, setShowWalletSelector } = useWallet();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const handleDisconnect = async () => {
    if (!connectedWallet) return;

    try {
      // Disconnect the wallet
      await disconnectWallet(connectedWallet.provider, connectedWallet.chain);
      
      // Also disconnect from Wagmi if it was an EVM wallet
      if (connectedWallet.chain === 'ethereum') {
        try {
          wagmiDisconnect();
        } catch (error) {
          // Ignore Wagmi disconnect errors
        }
      }
      
      // Clear the connected wallet state
      setConnectedWallet(null);
      setShowWalletSelector(false);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
              LI.FI Swap
            </Link>
            
            {/* Navigation Links */}
            <Link
              href="/portfolio"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Portfolio
            </Link>
          </div>

          {/* Wallet Connection Section */}
          <div className="flex items-center gap-4">
            {/* Show connected wallet info */}
            {connectedWallet && !showWalletSelector && (
              <div className="flex items-center gap-3 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    {chainLabels[connectedWallet.chain] || connectedWallet.chain}
                  </span>
                  <span className="text-xs font-mono text-green-700 dark:text-green-300">
                    {connectedWallet.address.slice(0, 6)}...{connectedWallet.address.slice(-4)}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors font-medium"
                >
                  Disconnect
                </button>
              </div>
            )}

            {/* Connect Wallet Button */}
            {!connectedWallet && (
              <button
                onClick={() => setShowWalletSelector(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                Connect Wallet
              </button>
            )}

            {/* Wallet Selector Modal */}
            {showWalletSelector && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Connect Wallet</h2>
                    <button
                      onClick={() => setShowWalletSelector(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-4">
                    <WalletSelector
                      onWalletConnected={(account: WalletAccount) => {
                        setConnectedWallet(account);
                        setShowWalletSelector(false);
                      }}
                      onWalletDisconnected={(provider: string, chain: WalletChain) => {
                        setConnectedWallet(null);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

