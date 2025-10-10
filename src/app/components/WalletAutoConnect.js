'use client';

import { useEffect, useRef } from 'react';
import { useWalletData } from '../hooks/useWalletData';

/**
 * WalletAutoConnect - Automatically attempts to connect to the wallet on page load
 * if the user has previously granted permission.
 */
export default function WalletAutoConnect() {
  const { wallet, connectWallet } = useWalletData();
  const hasAttemptedAutoConnect = useRef(false);

  useEffect(() => {
    console.log('🔍 WalletAutoConnect: useEffect triggered');
    console.log('🔍 WalletAutoConnect: Current wallet state:', {
      connected: wallet.connected,
      isLocked: wallet.isLocked,
      accounts: wallet.accounts?.length || 0,
      isInitializing: wallet.isInitializing
    });

    // Only attempt auto-connect once
    if (hasAttemptedAutoConnect.current) {
      console.log('🔍 WalletAutoConnect: Auto-connect already attempted, skipping');
      return;
    }

    // Don't auto-connect if already connected
    if (wallet.connected) {
      console.log('🔍 WalletAutoConnect: Wallet already connected, skipping auto-connect');
      return;
    }

    // Check if wallet provider exists
    console.log('🔍 WalletAutoConnect: Checking window.keeta...');
    console.log('🔍 WalletAutoConnect: typeof window:', typeof window);
    console.log('🔍 WalletAutoConnect: window.keeta:', window?.keeta);
    
    if (typeof window === 'undefined') {
      console.log('🔍 WalletAutoConnect: Window is undefined (SSR)');
      return;
    }
    
    if (!window.keeta) {
      console.log('🔍 WalletAutoConnect: window.keeta not found - wallet extension not installed');
      return;
    }

    const attemptAutoConnect = async () => {
      hasAttemptedAutoConnect.current = true;
      console.log('🔍 WalletAutoConnect: Starting attemptAutoConnect...');

      try {
        const provider = window.keeta;
        console.log('🔍 WalletAutoConnect: Provider object:', provider);
        console.log('🔍 WalletAutoConnect: Provider methods:', {
          getAccounts: typeof provider.getAccounts,
          isConnected: typeof provider.isConnected,
          requestAccounts: typeof provider.requestAccounts
        });

        // Quick check: if accounts already exist, we're good
        if (typeof provider.getAccounts === 'function') {
          try {
            console.log('🔍 WalletAutoConnect: Calling provider.getAccounts()...');
            const accounts = await provider.getAccounts();
            console.log('🔍 WalletAutoConnect: getAccounts() result:', accounts);
            
            if (Array.isArray(accounts) && accounts.length > 0) {
              console.log('🔍 WalletAutoConnect: Already connected with accounts, no need to auto-connect');
              return;
            } else {
              console.log('🔍 WalletAutoConnect: No accounts found, continuing with connection check...');
            }
          } catch (error) {
            console.log('🔍 WalletAutoConnect: getAccounts() check failed:', error);
          }
        }

        // Check if the wallet was previously connected
        let shouldAttemptConnect = false;

        // Method 1: Check if provider has isConnected method
        if (typeof provider.isConnected === 'function') {
          try {
            console.log('🔍 WalletAutoConnect: Calling provider.isConnected()...');
            shouldAttemptConnect = await provider.isConnected();
            console.log('🔍 WalletAutoConnect: isConnected() result:', shouldAttemptConnect);
          } catch (error) {
            console.log('🔍 WalletAutoConnect: isConnected() check failed:', error);
          }
        } else if (typeof provider.isConnected === 'boolean') {
          shouldAttemptConnect = provider.isConnected;
          console.log('🔍 WalletAutoConnect: isConnected (boolean) result:', shouldAttemptConnect);
        }

        console.log('🔍 WalletAutoConnect: shouldAttemptConnect:', shouldAttemptConnect);

        if (shouldAttemptConnect) {
          console.log('🔍 WalletAutoConnect: Attempting to auto-reconnect...');
          await connectWallet();
          console.log('🔍 WalletAutoConnect: Auto-reconnect completed');
        } else {
          console.log('🔍 WalletAutoConnect: Wallet not previously connected, no auto-connect needed');
        }
      } catch (error) {
        console.log('🔍 WalletAutoConnect: Error during auto-connect attempt:', error);
      }
    };

    // Wait a bit for the provider to be fully initialized
    const timeout = setTimeout(() => {
      void attemptAutoConnect();
    }, 500);

    return () => clearTimeout(timeout);
  }, [wallet.connected, wallet.isLocked, wallet.isInitializing, wallet.accounts?.length, connectWallet]);

  return null;
}

