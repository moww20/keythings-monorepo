'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Bell, Globe, Clock, Zap } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';

export default function SettingsPage() {
  const router = useRouter();
  const {
    wallet,
    isWalletLoading,
    isWalletFetching,
    walletError,
    connectWallet,
    isDisconnected,
    isLocked,
    isUnlocked,
  } = useWallet();

  const [isConnecting, setIsConnecting] = useState(false);

  const isWalletBusy = isWalletLoading || isWalletFetching;

  const handleConnectWallet = useCallback(async () => {
    if (isConnecting) {
      return;
    }

    setIsConnecting(true);

    try {
      // Connect wallet and automatically request read capabilities for explorer functionality
      await connectWallet(true); // Pass true to request read capabilities
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      const message = (error as Error)?.message ?? '';
      if (!/rejected|denied/i.test(message)) {
        alert('Failed to connect wallet. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [connectWallet, isConnecting]);

  useEffect(() => {
    if (walletError) {
      console.error('Wallet query error:', walletError);
    }
  }, [walletError]);


  if (isDisconnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--background)] text-center p-6">
        <h1 className="text-4xl font-bold text-foreground mb-4">Connect Your Keeta Wallet</h1>
        <p className="text-lg text-muted mb-8">
          Please connect your Keeta Wallet to access settings.
        </p>
        <button
          onClick={handleConnectWallet}
          disabled={isConnecting}
          className="mb-6 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_20px_50px_rgba(15,15,20,0.35)] transition-all duration-200 hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isConnecting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Connecting...
            </>
          ) : (
            'Connect Wallet'
          )}
        </button>
        <p className="text-xs text-muted">
          Don&apos;t have a wallet?{' '}
          <a
            href="https://chromewebstore.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:underline"
          >
            Install Keythings Wallet
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Settings Content */}
            <div className="space-y-8">
              {/* Profile Section */}
              <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
                <div className="p-6 border-b border-hairline">
                  <h2 className="text-xl font-bold text-foreground">Profile</h2>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Nickname & Avatar */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">Nickname & Avatar</h3>
                      <p className="text-sm text-muted mb-4">
                        Set up an avatar and nickname, it is suggested not to use your real name or the name of your social account as a nickname.
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-foreground font-medium">User-b9a60</span>
                      </div>
                    </div>
                    <button className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong transition-colors min-w-[120px]">
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              {/* Notifications Section */}
              <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
                <div className="p-6 border-b border-hairline">
                  <h2 className="text-xl font-bold text-foreground">Notifications</h2>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Notification Language */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">Notification Language</h3>
                      <p className="text-sm text-muted mb-4">
                        This will affect the language settings of E-mail and App push.
                      </p>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted" />
                        <span className="text-foreground">English</span>
                      </div>
                    </div>
                    <button className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong transition-colors min-w-[120px]">
                      Edit
                    </button>
                  </div>

                  {/* Notification Preferences */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">Notification Preferences</h3>
                      <p className="text-sm text-muted mb-4">
                        Once configured, you will receive relevant on-site inbox notifications within the app and website.
                      </p>
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-muted" />
                        <span className="text-foreground text-sm">Activities, Trade Notification, Binance News, System Messages</span>
                      </div>
                    </div>
                    <button className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong transition-colors min-w-[120px]">
                      Manage
                    </button>
                  </div>

                  {/* Auto Price Alert */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">Auto Price Alert</h3>
                      <p className="text-sm text-muted mb-4">
                        Once configured, you will receive alerts on the price changes of major and holding cryptos.
                      </p>
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-muted" />
                        <span className="text-foreground">Notification On, Sound On</span>
                      </div>
                    </div>
                    <button className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong transition-colors min-w-[120px]">
                      Manage
                    </button>
                  </div>
                </div>
              </div>

              {/* Preferences Section */}
              <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
                <div className="p-6 border-b border-hairline">
                  <h2 className="text-xl font-bold text-foreground">Preferences</h2>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Language */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">Language</h3>
                      <p className="text-sm text-muted mb-4">
                        Choose your preferred language for the interface.
                      </p>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted" />
                        <span className="text-foreground">English</span>
                      </div>
                    </div>
                    <button className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong transition-colors min-w-[120px]">
                      Edit
                    </button>
                  </div>

                  {/* UTC Time Zone */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">UTC Time Zone</h3>
                      <p className="text-sm text-muted mb-4">
                        Set your timezone for accurate time display.
                      </p>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted" />
                        <span className="text-foreground">Last 24 hours</span>
                      </div>
                    </div>
                    <button className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong transition-colors min-w-[120px]">
                      Edit
                    </button>
                  </div>
                </div>
              </div>
      </div>
    </div>
  );
}
