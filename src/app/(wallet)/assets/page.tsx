'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Search, Eye, EyeOff } from 'lucide-react';
import EstimatedBalance from '../../components/EstimatedBalance';
import { useWallet } from '../../contexts/WalletContext';

export default function AssetsPage() {
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
  const [hideSmallAssets, setHideSmallAssets] = useState(false);

  const isWalletBusy = isWalletLoading || isWalletFetching;

  const handleConnectWallet = useCallback(async () => {
    if (isConnecting) {
      return;
    }

    setIsConnecting(true);

    try {
      await connectWallet();
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

  // Action handlers for EstimatedBalance component
  const handleReceive = useCallback(() => {
    console.log('Receive clicked');
    // TODO: Implement receive functionality
  }, []);

  const handleSend = useCallback(() => {
    console.log('Send clicked');
    // TODO: Implement send functionality
  }, []);

  const handleTransfer = useCallback(() => {
    console.log('Transfer clicked');
    // TODO: Implement transfer functionality
  }, []);


  if (isDisconnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--background)] text-center p-6">
        <h1 className="text-4xl font-bold text-foreground mb-4">Connect Your Keeta Wallet</h1>
        <p className="text-lg text-muted mb-8">
          Please connect your Keeta Wallet to access your assets.
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
      {/* Estimated Balance Component */}
            <EstimatedBalance
              balance={wallet.balance}
              isConnecting={isConnecting}
              onConnect={handleConnectWallet}
              tokens={[]}
              ktaPriceData={null}
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
                          Coin Price / Total Value
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
                        <div className="text-muted text-sm">$129.83</div>
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
                        <div className="text-muted text-sm">$0.02</div>
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
                        <div className="text-muted text-sm">$0.00</div>
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
                        <div className="text-muted text-sm">$0.00</div>
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
  );
}
