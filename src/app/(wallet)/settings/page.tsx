'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Bell, Globe, Clock, Zap } from 'lucide-react';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import { useWallet } from '../../contexts/WalletContext';
import ThemeToggle from '@/app/components/ThemeToggle';
import { getPreferredNetwork, setPreferredNetwork } from '@/lib/explorer/sdk-read-client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SettingsPage() {
  const {
    walletError,
    connectWallet,
    isDisconnected,
  } = useWallet();

  const [isConnecting, setIsConnecting] = useState(false);
  const [network, setNetwork] = useState<'test' | 'main'>(() => {
    try {
      return getPreferredNetwork();
    } catch {
      return 'test';
    }
  });

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


  const sidebarStyles = {
    "--sidebar-width": "calc(var(--spacing) * 72)",
    "--header-height": "calc(var(--spacing) * 12)",
  } as CSSProperties;

  const connectPrompt = (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-foreground">Connect Your Keeta Wallet</h1>
          <p className="text-base text-muted">Please connect your Keeta Wallet to access settings.</p>
        </div>

        <button
          onClick={handleConnectWallet}
          disabled={isConnecting}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_20px_50px_rgba(15,15,20,0.35)] transition-all duration-200 hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isConnecting ? (
            <>
              <svg className="h-4 w-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
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
          <Link
            href="https://chromewebstore.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:underline"
          >
            Install Keythings Wallet
          </Link>
        </p>
      </div>
    </div>
  );

  const settingsContent = (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Account settings</h1>
        <p className="text-muted">Manage your profile, notifications, and preferences.</p>
      </div>

      {/* Notifications Section */}
      <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
        <div className="border-b border-hairline p-6">
          <h2 className="text-xl font-bold text-foreground">Notifications</h2>
        </div>

        <div className="space-y-6 p-6">
          {/* Notification Language */}
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="mb-2 text-lg font-semibold text-foreground">Notification Language</h3>
              <p className="mb-4 text-sm text-muted">This will affect the language settings of E-mail and App push.</p>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted" />
                <span className="text-foreground">English</span>
              </div>
            </div>
            <button className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-md border border-hairline bg-surface px-6 py-2.5 font-medium text-foreground transition-colors hover:bg-surface-strong">
              Edit
            </button>
          </div>

          {/* Notification Preferences */}
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="mb-2 text-lg font-semibold text-foreground">Notification Preferences</h3>
              <p className="mb-4 text-sm text-muted">Once configured, you will receive relevant on-site inbox notifications within the app and website.</p>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted" />
                <span className="text-sm text-foreground">Activities, Trade Notification, Binance News, System Messages</span>
              </div>
            </div>
            <button className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-md border border-hairline bg-surface px-6 py-2.5 font-medium text-foreground transition-colors hover:bg-surface-strong">
              Manage
            </button>
          </div>

          {/* Auto Price Alert */}
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="mb-2 text-lg font-semibold text-foreground">Auto Price Alert</h3>
              <p className="mb-4 text-sm text-muted">Once configured, you will receive alerts on the price changes of major and holding cryptos.</p>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted" />
                <span className="text-foreground">Notification On, Sound On</span>
              </div>
            </div>
            <button className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-md border border-hairline bg-surface px-6 py-2.5 font-medium text-foreground transition-colors hover:bg-surface-strong">
              Manage
            </button>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
        <div className="border-b border-hairline p-6">
          <h2 className="text-xl font-bold text-foreground">Preferences</h2>
        </div>

        <div className="space-y-6 p-6">
          {/* Appearance (Theme) */}
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="mb-2 text-lg font-semibold text-foreground">Appearance</h3>
              <p className="mb-4 text-sm text-muted">Switch between light and dark modes.</p>
              <ThemeToggle />
            </div>
          </div>

          {/* Network Selection */}
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="mb-2 text-lg font-semibold text-foreground">Network</h3>
              <p className="mb-4 text-sm text-muted">Choose which Keeta network to interact with.</p>
              <div className="w-[220px]">
                <Select
                  value={network}
                  onValueChange={(val) => {
                    const v = (val === 'main' ? 'main' : 'test') as 'test' | 'main';
                    setNetwork(v);
                    setPreferredNetwork(v);
                  }}
                >
                  <SelectTrigger className="bg-surface border-hairline text-foreground">
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Testnet</SelectItem>
                    <SelectItem value="main">Mainnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="mb-2 text-lg font-semibold text-foreground">Language</h3>
              <p className="mb-4 text-sm text-muted">Choose your preferred language for the interface.</p>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted" />
                <span className="text-foreground">English</span>
              </div>
            </div>
            <button className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-md border border-hairline bg-surface px-6 py-2.5 font-medium text-foreground transition-colors hover:bg-surface-strong">
              Edit
            </button>
          </div>

          {/* UTC Time Zone */}
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="mb-2 text-lg font-semibold text-foreground">UTC Time Zone</h3>
              <p className="mb-4 text-sm text-muted">Set your timezone for accurate time display.</p>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted" />
                <span className="text-foreground">Last 24 hours</span>
              </div>
            </div>
            <button className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-md border border-hairline bg-surface px-6 py-2.5 font-medium text-foreground transition-colors hover:bg-surface-strong">
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-background">
      <SidebarProvider style={sidebarStyles}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <div className="flex h-full flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2 overflow-auto">
              <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="px-4 lg:px-6">
                  {isDisconnected ? connectPrompt : settingsContent}
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
