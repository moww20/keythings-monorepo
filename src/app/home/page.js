'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LayoutDashboard, Wallet, ShoppingCart, UserCircle, Settings } from 'lucide-react';
import EstimatedBalance from '../components/EstimatedBalance';
import { throttleBalanceCheck, markBalanceCheckComplete } from '../lib/wallet-throttle';
import { processTokenForDisplay } from '../lib/token-utils';

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
  const [tokens, setTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [activeTab, setActiveTab] = useState('holding');

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

  const fetchTokens = useCallback(async () => {
    if (!walletState.connected || !walletState.accounts || walletState.accounts.length === 0) {
      setTokens([]);
      return;
    }

    // Don't fetch if we're already loading
    if (loadingTokens) {
      return;
    }

    if (typeof window === 'undefined' || !window.keeta) {
      setTokens([]);
      return;
    }

    setLoadingTokens(true);
    const provider = window.keeta;

    try {
      // Use getAllBalances from the wallet provider
      // This is cached by the extension and doesn't trigger rate limiting
      const balances = await provider.getAllBalances?.();
      
      if (!balances || balances.length === 0) {
        setTokens([]);
        setLoadingTokens(false);
        return;
      }

      // Filter balances > 0
      const nonZeroBalances = balances.filter(entry => {
        try {
          return entry.balance && BigInt(entry.balance) > 0n;
        } catch {
          return false;
        }
      });

      if (nonZeroBalances.length === 0) {
        setTokens([]);
        setLoadingTokens(false);
        return;
      }

      // Get base token address from network
      const baseTokenAddress = walletState.network?.baseToken || null;

      // Process each token
      const processedTokens = await Promise.all(
        nonZeroBalances.map(async (entry) => {
          try {
            const tokenData = await processTokenForDisplay(
              entry.token,
              entry.balance,
              entry.metadata,
              baseTokenAddress
            );
            return tokenData;
          } catch (error) {
            console.error('Failed to process token:', entry.token, error);
            return null;
          }
        })
      );

      // Filter out failed tokens and sort (base token first, then by name)
      const validTokens = processedTokens.filter(token => token !== null);
      validTokens.sort((a, b) => {
        if (a.isBaseToken) return -1;
        if (b.isBaseToken) return 1;
        return a.name.localeCompare(b.name);
      });

      setTokens(validTokens);
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
      setTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  }, [walletState.connected, walletState.accounts, walletState.network, loadingTokens]);

  const checkWalletConnection = useCallback(async (forceCheck = false, shouldFetchTokens = false) => {
    if (typeof window === 'undefined' || !window.keeta) {
      setWalletState(prevState => ({ ...prevState, connected: false, loading: false }));
      return;
    }

    // Use shared throttling mechanism with source tracking
    if (!throttleBalanceCheck(forceCheck, 'home-page')) {
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
        
        // Fetch tokens after successful connection if requested
        if (shouldFetchTokens) {
          setTimeout(() => fetchTokens(), 1000);
        }
      } else {
        setWalletState(prevState => ({ ...prevState, connected: false, loading: false }));
      }
    } catch (error) {
      // Silently ignore throttling errors - they're expected in dev mode due to React Strict Mode
      if (!error.message || !error.message.includes('throttled')) {
        console.error('Error checking wallet connection:', error);
        setWalletState(prevState => ({ ...prevState, connected: false, loading: false }));
      }
    } finally {
      // Mark balance check as complete
      markBalanceCheckComplete();
    }
  }, [fetchTokens]);

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
        if (throttleBalanceCheck(true, 'connect-wallet')) {
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
      } else {
        alert('Failed to connect wallet. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    // Initial check with force to ensure we get data on mount, and fetch tokens
    checkWalletConnection(true, true);

    if (typeof window !== 'undefined' && window.keeta) {
      const provider = window.keeta;

      const handleAccountsChanged = (accounts) => {
        if (accounts && accounts.length > 0) {
          // Use setTimeout to debounce the check - longer delay to avoid rate limiting
          setTimeout(() => {
            checkWalletConnection(true, true);
          }, 2500);
        } else {
          setWalletState(prevState => ({ ...prevState, connected: false, accounts: [], balance: null }));
          setTokens([]);
        }
      };

      const handleChainChanged = () => {
        // Use setTimeout to debounce the check - longer delay to avoid rate limiting
        setTimeout(() => {
          checkWalletConnection(true, true);
        }, 2500);
      };

      const handleDisconnect = () => {
        setWalletState(prevState => ({ ...prevState, connected: false, accounts: [], balance: null }));
        setTokens([]);
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
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-surface-strong rounded-lg w-full text-left transition-none"
              >
                <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Dashboard</span>
              </button>
              
              <button
                onClick={() => router.push('/assets')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
              >
                <Wallet className="h-4 w-4 flex-shrink-0 group-hover:text-foreground transition-none" />
                <span className="truncate">Assets</span>
              </button>

              <button
                onClick={() => console.log('Orders clicked - TODO: implement')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
              >
                <ShoppingCart className="h-4 w-4 flex-shrink-0 group-hover:text-foreground transition-none" />
                <span className="truncate">Orders</span>
              </button>

              <button
                onClick={() => console.log('Account clicked - TODO: implement')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
              >
                <UserCircle className="h-4 w-4 flex-shrink-0 group-hover:text-foreground transition-none" />
                <span className="truncate">Account</span>
              </button>

              <button
                onClick={() => router.push('/settings')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
              >
                <Settings className="h-4 w-4 flex-shrink-0 group-hover:text-foreground transition-none" />
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
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-surface-strong rounded-lg w-full text-left transition-none"
                      >
                        <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Dashboard</span>
                      </button>
                      
                              <button
                                onClick={() => { router.push('/assets'); setIsMobileMenuOpen(false); }}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
                              >
                                <Wallet className="h-4 w-4 flex-shrink-0 group-hover:text-foreground transition-none" />
                                <span className="truncate">Assets</span>
                              </button>

                              <button
                                onClick={() => { console.log('Orders clicked - TODO: implement'); setIsMobileMenuOpen(false); }}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
                              >
                                <ShoppingCart className="h-4 w-4 flex-shrink-0 group-hover:text-foreground transition-none" />
                                <span className="truncate">Orders</span>
                              </button>

                              <button
                                onClick={() => { console.log('Account clicked - TODO: implement'); setIsMobileMenuOpen(false); }}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
                              >
                                <UserCircle className="h-4 w-4 flex-shrink-0 group-hover:text-foreground transition-none" />
                                <span className="truncate">Account</span>
                              </button>

                              <button
                                onClick={() => { router.push('/settings'); setIsMobileMenuOpen(false); }}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong rounded-lg w-full text-left group transition-none"
                              >
                                <Settings className="h-4 w-4 flex-shrink-0 group-hover:text-foreground transition-none" />
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
                <button 
                  onClick={() => setActiveTab('holding')}
                  className={`font-medium border-b-2 pb-2 transition-colors ${
                    activeTab === 'holding' ? 'text-accent border-accent' : 'text-muted hover:text-foreground border-transparent'
                  }`}
                >
                  Holding
                </button>
                <button 
                  onClick={() => setActiveTab('hot')}
                  className={`font-medium border-b-2 pb-2 transition-colors ${
                    activeTab === 'hot' ? 'text-accent border-accent' : 'text-muted hover:text-foreground border-transparent'
                  }`}
                >
                  Hot
                </button>
                <button 
                  onClick={() => setActiveTab('new-listing')}
                  className={`font-medium border-b-2 pb-2 transition-colors ${
                    activeTab === 'new-listing' ? 'text-accent border-accent' : 'text-muted hover:text-foreground border-transparent'
                  }`}
                >
                  New Listing
                </button>
                <button 
                  onClick={() => setActiveTab('favorite')}
                  className={`font-medium border-b-2 pb-2 transition-colors ${
                    activeTab === 'favorite' ? 'text-accent border-accent' : 'text-muted hover:text-foreground border-transparent'
                  }`}
                >
                  Favorite
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
                  {loadingTokens ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <svg className="animate-spin h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-muted">Loading tokens...</span>
                        </div>
                      </td>
                    </tr>
                  ) : tokens.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Wallet className="h-12 w-12 text-muted opacity-50" />
                          <span className="text-muted">No tokens found in your wallet</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tokens.map((token, index) => (
                      <tr 
                        key={token.address} 
                        className={`hover:bg-surface/50 transition-colors ${index !== tokens.length - 1 ? 'border-b border-hairline' : ''}`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {token.icon ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={token.icon} alt={token.ticker} className="w-8 h-8 rounded-full" />
                            ) : token.fallbackIcon ? (
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{ 
                                  backgroundColor: token.fallbackIcon.bgColor,
                                  color: token.fallbackIcon.textColor
                                }}
                              >
                                <span className="text-xs font-bold">{token.fallbackIcon.letter}</span>
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">?</span>
                              </div>
                            )}
                            <div>
                              <div className="text-foreground font-medium">{token.ticker || 'Unknown'}</div>
                              <div className="text-muted text-sm">{token.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="text-foreground font-medium">{token.formattedAmount}</div>
                          <div className="text-muted text-sm">{token.ticker}</div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="text-foreground font-medium">—</div>
                          <div className="text-muted text-sm">—</div>
                        </td>
                        <td className="py-4 px-6 text-right text-muted font-medium">
                          —
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button className="text-accent hover:text-foreground transition-colors">
                            Send
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
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

