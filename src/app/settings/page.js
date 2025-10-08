'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Wallet, ShoppingCart, UserCircle, Settings, User, Bell, Palette, Globe, Clock, Zap, Moon, Sun } from 'lucide-react';
import EstimatedBalance from '../components/EstimatedBalance';
import { throttleBalanceCheck } from '../lib/wallet-throttle';

export default function SettingsPage() {
  const router = useRouter();
  const [walletState, setWalletState] = useState({
    connected: false,
    accounts: [],
    balance: null,
    network: null,
    loading: true,
  });
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [shortcutsEnabled, setShortcutsEnabled] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const checkWalletConnection = useCallback(async (forceCheck = false) => {
    if (typeof window === 'undefined' || !window.keeta) {
      setWalletState(prevState => ({ ...prevState, connected: false, loading: false }));
      return;
    }

    // Use shared throttling mechanism
    if (!throttleBalanceCheck(forceCheck)) {
      return; // Throttled
    }

    const provider = window.keeta;
    try {
      const accounts = await provider.getAccounts();
      if (accounts && accounts.length > 0) {
        const balance = await provider.getBalance(accounts[0]);
        const network = await provider.getNetwork();
        setWalletState({
          connected: true,
          accounts,
          balance,
          network,
          loading: false,
        });
      } else {
        setWalletState(prevState => ({ ...prevState, connected: false, loading: false }));
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
      setWalletState(prevState => ({ ...prevState, connected: false, loading: false }));
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.keeta) {
      alert('Please install the Keythings wallet extension first!');
      return;
    }

    setIsConnecting(true);
    const provider = window.keeta;
    
    try {
      const accounts = await provider.requestAccounts();
      if (accounts && accounts.length > 0) {
        const balance = await provider.getBalance(accounts[0]);
        const network = await provider.getNetwork();
        setWalletState({
          connected: true,
          accounts,
          balance,
          network,
          loading: false,
        });
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        // User rejected the connection, no need to show error
      } else {
        alert('Failed to connect wallet. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Action handlers for EstimatedBalance component
  const handleDeposit = () => {
    console.log('Deposit clicked');
    // TODO: Implement deposit functionality
  };

  const handleWithdraw = () => {
    console.log('Withdraw clicked');
    // TODO: Implement withdraw functionality
  };

  const handleCashIn = () => {
    console.log('Cash In clicked');
    // TODO: Implement cash in functionality
  };

  useEffect(() => {
    checkWalletConnection(true);

    if (typeof window !== 'undefined' && window.keeta) {
      const provider = window.keeta;

      const handleAccountsChanged = (accounts) => {
        if (accounts && accounts.length > 0) {
          setTimeout(() => checkWalletConnection(true), 200);
        } else {
          setWalletState(prevState => ({ ...prevState, connected: false, accounts: [], balance: null }));
        }
      };

      const handleChainChanged = () => {
        setTimeout(() => checkWalletConnection(true), 200);
      };

      const handleDisconnect = () => {
        setWalletState(prevState => ({ ...prevState, connected: false, accounts: [], balance: null }));
      };

      provider.on?.('accountsChanged', handleAccountsChanged);
      provider.on?.('chainChanged', handleChainChanged);
      provider.on?.('disconnect', handleDisconnect);

      return () => {
        const remove = provider.removeListener?.bind(provider) || provider.off?.bind(provider);
        if (remove) {
          remove('accountsChanged', handleAccountsChanged);
          remove('chainChanged', handleChainChanged);
          remove('disconnect', handleDisconnect);
        }
      };
    }
  }, [checkWalletConnection]);

  if (walletState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[color:var(--background)]">
        <p className="text-foreground">Loading wallet data...</p>
      </div>
    );
  }

  if (!walletState.connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--background)] text-center p-6">
        <h1 className="text-4xl font-bold text-foreground mb-4">Connect Your Keeta Wallet</h1>
        <p className="text-lg text-muted mb-8">
          Please connect your Keeta Wallet to access settings.
        </p>
        <button
          onClick={connectWallet}
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
    <main className="relative overflow-hidden min-h-screen bg-[color:var(--background)]">
      <div className="absolute inset-0 -z-10 bg-[color:var(--background)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[-20%] z-0 h-[480px] bg-gradient-to-b from-[color:color-mix(in_oklab,var(--foreground)_18%,transparent)] via-transparent to-transparent blur-3xl" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[16rem_minmax(0,1fr)] xl:h-[calc(100vh-8rem)] xl:overflow-hidden">
          {/* Sidebar */}
          <aside className="hidden xl:block sticky top-[8rem] h-[calc(100vh-8rem)] w-64 flex-shrink-0 overflow-auto glass border border-hairline rounded-2xl">
            <div className="p-4">
              <nav className="space-y-1">
                <button
                  onClick={() => router.push('/home')}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
                >
                  <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Dashboard</span>
                </button>
                
                <button
                  onClick={() => router.push('/assets')}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
                >
                  <Wallet className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Assets</span>
                </button>

                <button
                  onClick={() => console.log('Orders clicked - TODO: implement')}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
                >
                  <ShoppingCart className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Orders</span>
                </button>

                <button
                  onClick={() => console.log('Account clicked - TODO: implement')}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
                >
                  <UserCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Account</span>
                </button>

                <button
                  onClick={() => router.push('/settings')}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-surface-strong rounded-lg transition-all duration-200 hover:bg-surface-strong/80 w-full text-left"
                >
                  <Settings className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Settings</span>
                </button>
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0 h-full overflow-auto xl:w-full">
            {/* Mobile Menu Toggle */}
            <div className="xl:hidden mb-4">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="glass rounded-lg border border-hairline p-3 text-foreground hover:bg-surface transition-colors"
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            
            {/* Mobile Sidebar */}
            {isMobileMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 bg-black/50 z-40 xl:hidden"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
                <div className="fixed inset-y-0 left-0 w-64 glass border-r border-hairline z-50 xl:hidden overflow-auto">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-foreground">Menu</h2>
                      <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="p-2 hover:bg-surface rounded-lg transition-colors"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <nav className="space-y-1">
                      <button
                        onClick={() => { router.push('/home'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
                      >
                        <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Dashboard</span>
                      </button>
                      
                      <button
                        onClick={() => { router.push('/assets'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
                      >
                        <Wallet className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Assets</span>
                      </button>

                      <button
                        onClick={() => { console.log('Orders clicked - TODO: implement'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
                      >
                        <ShoppingCart className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Orders</span>
                      </button>

                      <button
                        onClick={() => { console.log('Account clicked - TODO: implement'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
                      >
                        <UserCircle className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Account</span>
                      </button>

                      <button
                        onClick={() => { router.push('/settings'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-surface-strong rounded-lg transition-all duration-200 hover:bg-surface-strong/80 w-full text-left"
                      >
                        <Settings className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Settings</span>
                      </button>
                    </nav>
                  </div>
                </div>
              </>
            )}

            {/* Estimated Balance Component */}
            <EstimatedBalance 
              balance={walletState.balance}
              isConnecting={isConnecting}
              onConnect={connectWallet}
              onDeposit={handleDeposit}
              onWithdraw={handleWithdraw}
              onCashIn={handleCashIn}
            />

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

                  {/* C2C Profile */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">C2C Profile</h3>
                      <p className="text-sm text-muted mb-4">
                        Edit your C2C nickname, manage your payment methods and the list of users you follow.
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-white text-sm font-bold">U</span>
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
                  {/* Color Preference */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">Color Preference</h3>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                          <svg className="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M7 14l5-5 5 5z" />
                          </svg>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                          <svg className="h-3 w-3 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M7 10l5 5 5-5z" />
                          </svg>
                        </div>
                        <span className="text-foreground">Green Up / Red Down</span>
                      </div>
                    </div>
                    <button className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong transition-colors min-w-[120px]">
                      Edit
                    </button>
                  </div>

                  {/* Style Settings */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">Style Settings</h3>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                        <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                        <span className="text-foreground">Fresh</span>
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
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted" />
                        <span className="text-foreground">Last 24 hours</span>
                      </div>
                    </div>
                    <button className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong transition-colors min-w-[120px]">
                      Edit
                    </button>
                  </div>

                  {/* Shortcuts */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">Shortcuts</h3>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setShortcutsEnabled(!shortcutsEnabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            shortcutsEnabled ? 'bg-accent' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              shortcutsEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                    <button className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong transition-colors min-w-[120px]">
                      Edit
                    </button>
                  </div>

                  {/* Theme */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">Theme</h3>
                      <div className="flex items-center gap-3">
                        <span className="text-foreground">Dark</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setIsDarkTheme(false)}
                            className={`p-2 rounded-full transition-colors ${
                              !isDarkTheme ? 'bg-accent text-white' : 'bg-surface text-muted hover:bg-surface-strong'
                            }`}
                          >
                            <Sun className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setIsDarkTheme(true)}
                            className={`p-2 rounded-full transition-colors ${
                              isDarkTheme ? 'bg-accent text-white' : 'bg-surface text-muted hover:bg-surface-strong'
                            }`}
                          >
                            <Moon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
