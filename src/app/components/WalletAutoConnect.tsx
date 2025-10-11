"use client";

import { useEffect, useRef } from "react";

import { useWalletData } from "../hooks/useWalletData";

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
    if (typeof window === 'undefined') {
      return;
    }
    
    if (!window.keeta) {
      return;
    }

    const attemptAutoConnect = async () => {
      hasAttemptedAutoConnect.current = true;

      try {
        const provider = window.keeta;

        // Quick check: if accounts already exist, we're good
        if (provider && typeof provider.getAccounts === 'function') {
          try {
            const accounts = await provider.getAccounts();
            
            if (Array.isArray(accounts) && accounts.length > 0) {
              return;
            }
          } catch (error) {
            console.debug('Auto-connect: getAccounts check failed:', error);
          }
        }

        // Check if the wallet was previously connected
        let shouldAttemptConnect = false;

        // Method 1: Check if provider has isConnected method
        if (provider && typeof provider.isConnected === 'function') {
          try {
            shouldAttemptConnect = await provider.isConnected();
          } catch (error) {
            console.debug('Auto-connect: isConnected check failed:', error);
          }
        } else if (provider && typeof provider.isConnected === 'boolean') {
          shouldAttemptConnect = provider.isConnected;
        }

        if (shouldAttemptConnect) {
          await connectWallet();
        }
      } catch (error) {
        console.debug('Auto-connect attempt failed:', error);
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

