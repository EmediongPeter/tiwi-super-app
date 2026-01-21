'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { type WalletAccount } from '../utils/wallet-detector';

interface SecondaryWalletContextType {
  secondaryWallet: WalletAccount | null;
  setSecondaryWallet: (account: WalletAccount | null) => void;
  secondaryAddress: string | null;
  secondaryWalletType: string | null;
  isSecondaryConnected: boolean;
}

const SecondaryWalletContext = createContext<SecondaryWalletContextType | undefined>(undefined);

const SECONDARY_WALLET_STORAGE_KEY = 'lifi_secondary_wallet';

// Helper to load secondary wallet from localStorage
const loadSecondaryWalletFromStorage = (): WalletAccount | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(SECONDARY_WALLET_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as WalletAccount;
    }
  } catch (error) {
    console.error('Error loading secondary wallet from storage:', error);
  }
  return null;
};

// Helper to save secondary wallet to localStorage
const saveSecondaryWalletToStorage = (account: WalletAccount | null) => {
  if (typeof window === 'undefined') return;
  
  try {
    if (account) {
      localStorage.setItem(SECONDARY_WALLET_STORAGE_KEY, JSON.stringify(account));
    } else {
      localStorage.removeItem(SECONDARY_WALLET_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Error saving secondary wallet to storage:', error);
  }
};

export const SecondaryWalletProvider = ({ children }: { children: ReactNode }) => {
  const [secondaryWallet, setSecondaryWalletState] = useState<WalletAccount | null>(null);

  // Clear secondary wallet storage on mount/refresh
  useEffect(() => {
    // Clear localStorage on page load/refresh
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SECONDARY_WALLET_STORAGE_KEY);
    }
  }, []);

  // Persist secondary wallet state to localStorage whenever it changes (but clear on refresh)
  useEffect(() => {
    saveSecondaryWalletToStorage(secondaryWallet);
  }, [secondaryWallet]);

  // Wrapper for setSecondaryWallet that also saves to localStorage
  const setSecondaryWallet = (account: WalletAccount | null) => {
    setSecondaryWalletState(account);
    saveSecondaryWalletToStorage(account);
  };

  const secondaryAddress = secondaryWallet?.address || null;
  const secondaryWalletType = secondaryWallet?.provider || null;
  const isSecondaryConnected = !!secondaryWallet;

  return (
    <SecondaryWalletContext.Provider value={{ 
      secondaryWallet, 
      setSecondaryWallet,
      secondaryAddress,
      secondaryWalletType,
      isSecondaryConnected,
    }}>
      {children}
    </SecondaryWalletContext.Provider>
  );
};

export const useSecondaryWallet = () => {
  const context = useContext(SecondaryWalletContext);
  if (context === undefined) {
    throw new Error('useSecondaryWallet must be used within a SecondaryWalletProvider');
  }
  return context;
};


