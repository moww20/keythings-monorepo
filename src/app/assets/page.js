'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Wallet, ShoppingCart, UserCircle, Settings, ArrowDownToLine, ArrowUpFromLine, Banknote, Search, Eye, EyeOff } from 'lucide-react';
import EstimatedBalance from '../components/EstimatedBalance';
import { throttleBalanceCheck, markBalanceCheckComplete, isRateLimitedError } from '../lib/wallet-throttle';

export default function AssetsPage() {
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
  const [hideSmallAssets, setHideSmallAssets] = useState(false);

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const checkWalletConnection = useCallback(async (forceCheck = false) => {
    if (typeof window === 'undefined' || !window.keeta) {
      setWalletState(prevState => ({ ...prevState, connected: false, loading: false }));
      return;
    }

    // Use shared throttling mechanism with source tracking
    if (!throttleBalanceCheck(forceCheck, 'assets-page')) {
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
      // Handle throttling errors gracefully
      if (isRateLimitedError(error)) {
        console.debug('checkWalletConnection: Balance query rate-limited, will retry automatically');
        // Don't disconnect on rate-limited errors
      } else {
        console.error('Error checking wallet connection:', error);
        setWalletState(prevState => ({ ...prevState, connected: false, loading: false }));
      }
    } finally {
      // Mark balance check as complete
      markBalanceCheckComplete();
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
        // Use throttling for balance check during connection
        if (throttleBalanceCheck(true, 'connect-wallet-assets')) {
          try {
            const balance = await provider.getBalance(accounts[0]);
            const network = await provider.getNetwork();
            setWalletState({
              connected: true,
              accounts,
              balance,
              network,
              loading: false,
            });
            markBalanceCheckComplete();
          } catch (balanceError) {
            // If balance query is rate-limited, still connect but without balance
            if (isRateLimitedError(balanceError)) {
              console.debug('connectWallet: Balance query rate-limited, connected without balance');
              setWalletState({
                connected: true,
                accounts,
                balance: null,
                network: null,
                loading: false,
              });
            } else {
              throw balanceError; // Re-throw non-throttling errors
            }
          }
        } else {
          // If throttled, just set basic connection info
          setWalletState({
            connected: true,
            accounts,
            balance: null,
            network: null,
            loading: false,
          });
        }
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        // User rejected the connection, no need to show error
      } else if (!isRateLimitedError(error)) {
        // Don't show alert for rate-limited errors
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
          Please connect your Keeta Wallet to access your assets.
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
                          className="flex items-center gap-2 px-3 py-2 text-base font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
                        >
                          <LayoutDashboard className="h-5 w-5 flex-shrink-0 group-hover:text-foreground transition-none" />
                          <span className="truncate">Dashboard</span>
                        </button>
                        
                        <a
                          href="#assets"
                          className="flex items-center gap-2 px-3 py-2 text-base font-medium text-foreground bg-surface-strong rounded-lg w-full text-left transition-none"
                        >
                          <Wallet className="h-5 w-5 flex-shrink-0" />
                          <span className="truncate">Assets</span>
                        </a>

                        <button
                          onClick={() => console.log('Orders clicked - TODO: implement')}
                          className="flex items-center gap-2 px-3 py-2 text-base font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
                        >
                          <ShoppingCart className="h-5 w-5 flex-shrink-0 group-hover:text-foreground transition-none" />
                          <span className="truncate">Orders</span>
                        </button>

                        <button
                          onClick={() => console.log('Account clicked - TODO: implement')}
                          className="flex items-center gap-2 px-3 py-2 text-base font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
                        >
                          <UserCircle className="h-5 w-5 flex-shrink-0 group-hover:text-foreground transition-none" />
                          <span className="truncate">Account</span>
                        </button>

                        <button
                          onClick={() => router.push('/settings')}
                          className="flex items-center gap-2 px-3 py-2 text-base font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
                        >
                          <Settings className="h-5 w-5 flex-shrink-0 group-hover:text-foreground transition-none" />
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
                        className="flex items-center gap-2 px-3 py-2 text-base font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
                      >
                        <LayoutDashboard className="h-5 w-5 flex-shrink-0 group-hover:text-foreground transition-none" />
                        <span className="truncate">Dashboard</span>
                      </button>
                      
                      <a
                        href="#assets"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-base font-medium text-foreground bg-surface-strong rounded-lg w-full text-left transition-none"
                      >
                        <Wallet className="h-5 w-5 flex-shrink-0" />
                        <span className="truncate">Assets</span>
                      </a>

                      <button
                        onClick={() => { console.log('Orders clicked - TODO: implement'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-base font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
                      >
                        <ShoppingCart className="h-5 w-5 flex-shrink-0 group-hover:text-foreground transition-none" />
                        <span className="truncate">Orders</span>
                      </button>

                      <button
                        onClick={() => { console.log('Account clicked - TODO: implement'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-base font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
                      >
                        <UserCircle className="h-5 w-5 flex-shrink-0 group-hover:text-foreground transition-none" />
                        <span className="truncate">Account</span>
                      </button>

                      <button
                        onClick={() => { router.push('/settings'); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-base font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
                      >
                        <Settings className="h-5 w-5 flex-shrink-0 group-hover:text-foreground transition-none" />
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

            {/* My Assets Section */}
            <div className="mb-8 glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
              <div className="p-6 border-b border-hairline">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h2 className="text-xl font-bold text-foreground">My Assets</h2>
                  
                  <div className="flex items-center gap-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
                      <input
                        type="text"
                        placeholder="Search assets..."
                        className="pl-10 pr-4 py-2 bg-surface border border-hairline rounded-lg text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                    </div>
                    
                    {/* Hide small assets toggle */}
                    <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hideSmallAssets}
                        onChange={(e) => setHideSmallAssets(e.target.checked)}
                        className="rounded border-hairline bg-surface text-accent focus:ring-accent/50"
                      />
                      Hide assets &lt;1 USD
                    </label>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-6 py-4 border-b border-hairline">
                <div className="flex gap-4">
                  <button className="text-accent font-medium border-b-2 border-accent pb-2">
                    Coin View
                  </button>
                  <button className="text-muted hover:text-foreground transition-colors">
                    Account View
                  </button>
                </div>
              </div>

              {/* Assets Table */}
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
                            <path d="M7 14l5-5 5-5z" />
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
                          Today&apos;s PnL
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M7 14l5-5 5-5z" />
                          </svg>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* USDT */}
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
                        <div className="text-foreground font-medium">129.83252111</div>
                        <div className="text-muted text-sm">$129.83</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-foreground font-medium">$1.00</div>
                        <div className="text-muted text-sm">--</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-muted">--</div>
                      </td>
                    </tr>

                    {/* SUI */}
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
                        <div className="text-foreground font-medium">0.0048</div>
                        <div className="text-muted text-sm">$0.02</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-foreground font-medium">$3.53</div>
                        <div className="text-muted text-sm">$3.41</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-green-500 font-medium">+ $0.00</div>
                      </td>
                    </tr>

                    {/* GLMR */}
                    <tr className="border-b border-hairline hover:bg-surface/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">G</span>
                          </div>
                          <div>
                            <div className="text-foreground font-medium">GLMR</div>
                            <div className="text-muted text-sm">Glimmer</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-foreground font-medium">0.0118446</div>
                        <div className="text-muted text-sm">$0.00</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-foreground font-medium">$0.06</div>
                        <div className="text-muted text-sm">$0.35</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-green-500 font-medium">+ $0.00</div>
                      </td>
                    </tr>

                    {/* ADA */}
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
                        <div className="text-foreground font-medium">0.0007</div>
                        <div className="text-muted text-sm">$0.00</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-foreground font-medium">$0.84</div>
                        <div className="text-muted text-sm">$0.35</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-green-500 font-medium">+ $0.00</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Transactions Section */}
            <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
              <div className="p-6 border-b border-hairline">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">Recent Transactions</h2>
                  <button className="text-accent hover:text-foreground transition-colors">
                    More &gt;
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="text-left py-4 px-6 text-muted text-sm font-medium">
                        Transactions
                      </th>
                      <th className="text-right py-4 px-6 text-muted text-sm font-medium">
                        Amount
                      </th>
                      <th className="text-right py-4 px-6 text-muted text-sm font-medium">
                        Date
                      </th>
                      <th className="text-right py-4 px-6 text-muted text-sm font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Deposit USDT 1 */}
                    <tr className="border-b border-hairline hover:bg-surface/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                            <ArrowUpFromLine className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="text-foreground font-medium">Deposit USDT</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-green-500 font-medium">+105.71942325</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-foreground">10/08/2025</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-green-500 font-medium">Completed</div>
                      </td>
                    </tr>

                    {/* Deposit USDT 2 */}
                    <tr className="border-b border-hairline hover:bg-surface/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                            <ArrowUpFromLine className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="text-foreground font-medium">Deposit USDT</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-green-500 font-medium">+98.099302</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-foreground">09/30/2025</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-green-500 font-medium">Completed</div>
                      </td>
                    </tr>

                    {/* Deposit USDT 3 */}
                    <tr className="hover:bg-surface/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                            <ArrowUpFromLine className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="text-foreground font-medium">Deposit USDT</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-green-500 font-medium">+99.817582</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-foreground">09/22/2025</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-green-500 font-medium">Completed</div>
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
