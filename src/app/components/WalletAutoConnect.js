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
    // Only attempt auto-connect once
    if (hasAttemptedAutoConnect.current) {
      return;
    }

    // Don't auto-connect if already connected
    if (wallet.connected) {
      return;
    }

    // Check if wallet provider exists
    if (typeof window === 'undefined' || !window.keeta) {
      return;
    }

    const attemptAutoConnect = async () => {
      hasAttemptedAutoConnect.current = true;

      try {
        const provider = window.keeta;

        // Quick check: if accounts already exist, we're good
        if (typeof provider.getAccounts === 'function') {
          try {
            const accounts = await provider.getAccounts();
            if (Array.isArray(accounts) && accounts.length > 0) {
              // Already connected, no need to do anything
              return;
            }
          } catch (error) {
            console.debug('getAccounts() check failed:', error);
          }
        }

        // Check if the wallet was previously connected
        let shouldAttemptConnect = false;

        // Method 1: Check if provider has isConnected method
        if (typeof provider.isConnected === 'function') {
          try {
            shouldAttemptConnect = await provider.isConnected();
          } catch (error) {
            console.debug('isConnected() check failed:', error);
          }
        } else if (typeof provider.isConnected === 'boolean') {
          shouldAttemptConnect = provider.isConnected;
        }

        if (shouldAttemptConnect) {
          console.debug('Auto-reconnecting wallet...');
          await connectWallet();
        }
      } catch (error) {
        // Auto-connect failed, but this is expected if user hasn't granted permission
        console.debug('Auto-connect attempt failed (this is normal):', error);
      }
    };

    // Wait a bit for the provider to be fully initialized
    const timeout = setTimeout(() => {
      void attemptAutoConnect();
    }, 500);

    return () => clearTimeout(timeout);
  }, [wallet.connected, connectWallet]);

  return null;
}

