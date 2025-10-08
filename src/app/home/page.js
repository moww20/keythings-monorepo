'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Wallet, ShoppingCart, Gift, Users, UserCircle, Users2, Settings } from 'lucide-react';
import EstimatedBalance from '../components/EstimatedBalance';

export default function HomePage() {
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
  const lastBalanceCheck = useRef(0);
  const BALANCE_CHECK_THROTTLE = 1500; // 1.5 seconds to be safe

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance) => {
    if (balance === null) return '0.00';
    return (Number(balance) / 10 ** 18).toFixed(2);
  };

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

  const checkWalletConnection = useCallback(async (forceCheck = false) => {
    if (typeof window === 'undefined' || !window.keeta) {
      setWalletState(prevState => ({ ...prevState, connected: false, loading: false }));
      return;
    }

    // Throttle balance checks to avoid rate limiting
    const now = Date.now();
    const timeSinceLastCheck = now - lastBalanceCheck.current;
    
    if (!forceCheck && timeSinceLastCheck < BALANCE_CHECK_THROTTLE) {
      console.log('Throttling balance check, waiting...', Math.ceil((BALANCE_CHECK_THROTTLE - timeSinceLastCheck) / 1000), 'seconds');
      return;
    }

    const provider = window.keeta;
    try {
      const accounts = await provider.getAccounts();
      if (accounts && accounts.length > 0) {
        lastBalanceCheck.current = now;
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
        lastBalanceCheck.current = Date.now();
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

  useEffect(() => {
    // Initial check with force to ensure we get data on mount
    checkWalletConnection(true);

    if (typeof window !== 'undefined' && window.keeta) {
      const provider = window.keeta;

      const handleAccountsChanged = (accounts) => {
        if (accounts && accounts.length > 0) {
          // Use setTimeout to debounce the check
          setTimeout(() => checkWalletConnection(true), 200);
        } else {
          setWalletState(prevState => ({ ...prevState, connected: false, accounts: [], balance: null }));
        }
      };

      const handleChainChanged = () => {
        // Use setTimeout to debounce the check
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
          Please connect your Keeta Wallet to access the dashboard.
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
          <aside className="hidden xl:block sticky top-[8rem] h-[calc(100vh-8rem)] w-64 flex-shrink-0 overflow-auto glass border border-hairline rounded-2xl">
          <div className="p-4">
            <nav className="space-y-1">
              <button
                onClick={() => router.push('/home')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-surface-strong rounded-lg transition-all duration-200 hover:bg-surface-strong/80 w-full text-left"
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
                onClick={() => console.log('Rewards clicked - TODO: implement')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
              >
                <Gift className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Rewards Hub</span>
              </button>

              <button
                onClick={() => console.log('Referral clicked - TODO: implement')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Referral</span>
              </button>

              <button
                onClick={() => console.log('Account clicked - TODO: implement')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
              >
                <UserCircle className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Account</span>
              </button>

              <button
                onClick={() => console.log('Sub Accounts clicked - TODO: implement')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
              >
                <Users2 className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Sub Accounts</span>
              </button>

              <button
                onClick={() => console.log('Settings clicked - TODO: implement')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
              >
                <Settings className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Settings</span>
              </button>
            </nav>
          </div>
        </aside>

        <div className="flex-1 min-w-0 h-full overflow-auto xl:w-full">
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
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-surface-strong rounded-lg transition-all duration-200 hover:bg-surface-strong/80 w-full text-left"
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
                        onClick={() => { console.log('Rewards clicked - TODO: implement'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
                      >
                        <Gift className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Rewards Hub</span>
                      </button>

                      <button
                        onClick={() => { console.log('Referral clicked - TODO: implement'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
                      >
                        <Users className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Referral</span>
                      </button>

                      <button
                        onClick={() => { console.log('Account clicked - TODO: implement'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
                      >
                        <UserCircle className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Account</span>
                      </button>

                      <button
                        onClick={() => { console.log('Sub Accounts clicked - TODO: implement'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
                      >
                        <Users2 className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Sub Accounts</span>
                      </button>

                      <button
                        onClick={() => { console.log('Settings clicked - TODO: implement'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all duration-200 w-full text-left"
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

            <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
              <div className="p-6 border-b border-hairline">
                <h2 className="text-xl font-bold text-foreground">Markets</h2>
              </div>

            <div className="px-6 py-4 border-b border-hairline">
              <div className="flex flex-wrap gap-4 lg:gap-8">
                <button className="text-accent font-medium border-b-2 border-accent pb-2">
                  Holding
                </button>
                <button className="text-muted hover:text-foreground transition-colors">
                  Hot
                </button>
                <button className="text-muted hover:text-foreground transition-colors">
                  New Listing
                </button>
                <button className="text-muted hover:text-foreground transition-colors">
                  Favorite
                </button>
                <button className="text-muted hover:text-foreground transition-colors">
                  Top Gainers
                </button>
                <button className="text-muted hover:text-foreground transition-colors">
                  24h Volume
                </button>
                <button className="text-muted hover:text-foreground transition-colors lg:ml-auto">
                  More &gt;
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className="text-left py-4 px-6 text-muted text-sm font-medium">
                      <div className="flex items-center gap-1">
                        Coin
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M7 14l5-5 5 5z" />
                        </svg>
                      </div>
                    </th>
                    <th className="text-right py-4 px-6 text-muted text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        Amount
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M7 14l5-5 5 5z" />
                        </svg>
                      </div>
                    </th>
                    <th className="text-right py-4 px-6 text-muted text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        Coin Price / Cost Price
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </th>
                    <th className="text-right py-4 px-6 text-muted text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        24H Change
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M7 14l5-5 5 5z" />
                        </svg>
                      </div>
                    </th>
                    <th className="text-right py-4 px-6 text-muted text-sm font-medium">
                      Trade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-hairline hover:bg-surface/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">U</span>
                        </div>
                        <div>
                          <div className="text-foreground font-medium">USDT</div>
                          <div className="text-muted text-sm">TetherUS</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-foreground font-medium">1,000.00</div>
                      <div className="text-muted text-sm">$1,000.00</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-foreground font-medium">$1.0000</div>
                      <div className="text-muted text-sm">$1.0000</div>
                    </td>
                    <td className="py-4 px-6 text-right text-red-500 font-medium">
                      -0.02%
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-accent hover:text-foreground transition-colors">
                        Trade
                      </button>
                    </td>
                  </tr>

                  <tr className="border-b border-hairline hover:bg-surface/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">S</span>
                        </div>
                        <div>
                          <div className="text-foreground font-medium">SUI</div>
                          <div className="text-muted text-sm">Sui</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-foreground font-medium">500.00</div>
                      <div className="text-muted text-sm">$500.00</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-foreground font-medium">$1.0000</div>
                      <div className="text-muted text-sm">$0.9800</div>
                    </td>
                    <td className="py-4 px-6 text-right text-green-500 font-medium">
                      +2.42%
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-accent hover:text-foreground transition-colors">
                        Trade
                      </button>
                    </td>
                  </tr>

                  <tr className="border-b border-hairline hover:bg-surface/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">G</span>
                        </div>
                        <div>
                          <div className="text-foreground font-medium">GLMR</div>
                          <div className="text-muted text-sm">Moonbeam</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-foreground font-medium">2,000.00</div>
                      <div className="text-muted text-sm">$2,000.00</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-foreground font-medium">$1.0000</div>
                      <div className="text-muted text-sm">$0.9800</div>
                    </td>
                    <td className="py-4 px-6 text-right text-green-500 font-medium">
                      +2.12%
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-accent hover:text-foreground transition-colors">
                        Trade
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-surface/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">A</span>
                        </div>
                        <div>
                          <div className="text-foreground font-medium">ADA</div>
                          <div className="text-muted text-sm">Cardano</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-foreground font-medium">3,000.00</div>
                      <div className="text-muted text-sm">$3,000.00</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-foreground font-medium">$1.0000</div>
                      <div className="text-muted text-sm">$0.9850</div>
                    </td>
                    <td className="py-4 px-6 text-right text-green-500 font-medium">
                      +1.61%
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-accent hover:text-foreground transition-colors">
                        Trade
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>
      </div>
    </main>
  );
}

