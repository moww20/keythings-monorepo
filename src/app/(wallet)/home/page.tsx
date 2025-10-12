'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { Wallet } from 'lucide-react';
import EstimatedBalance from '../../components/EstimatedBalance';
import { useWallet } from '../../contexts/WalletContext';

function getTokenIconStyle(bgColor: string, textColor: string): React.CSSProperties {
  return {
    '--bg-color': bgColor,
    '--text-color': textColor,
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)'
  } as React.CSSProperties;
}

export default function HomePage() {
  const {
    wallet,
    tokens,
    isWalletLoading,
    isWalletFetching,
    walletError,
    isTokensLoading,
    isTokensFetching,
    tokensError,
    connectWallet,
    refreshWallet,
    isDisconnected,
    isLocked,
    isUnlocked,
  } = useWallet();

  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState('holding');
  const [showLockedNotification, setShowLockedNotification] = useState(false);
  const [showNullState, setShowNullState] = useState(false);
  const [ktaPriceData, setKtaPriceData] = useState<{ 
    usd: number; 
    usd_24h_change: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
  } | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const isFetchingPrice = useRef(false);

  const isWalletBusy = isWalletLoading || isWalletFetching;
  const tokensLoading = isTokensLoading || isTokensFetching;


  const handleReceive = useCallback(() => {
    console.log('Receive clicked');
  }, []);

  const handleSend = useCallback(() => {
    console.log('Send clicked');
  }, []);

  const handleTransfer = useCallback(() => {
    console.log('Transfer clicked');
  }, []);

  const fetchKtaPrice = useCallback(async () => {
    if (!window.keeta || isFetchingPrice.current) {
      console.debug('fetchKtaPrice: Skipping - no wallet or already fetching');
      return;
    }
    
    isFetchingPrice.current = true;
    setIsLoadingPrice(true);
    try {
      const priceData = await window.keeta?.getKtaPrice?.();
      console.log('Price data received:', priceData);
      if (priceData && typeof priceData === 'object' && priceData !== null) {
        // The API returns the full price object with usd, usd_24h_change, etc.
        const data = priceData as any;
        if ('usd' in data) {
          const transformedData = {
            usd: data.usd,
            usd_24h_change: data.usd_24h_change || 0,
            usd_market_cap: data.usd_market_cap,
            usd_24h_vol: data.usd_24h_vol,
          };
          console.log('Setting KTA price data:', transformedData);
          setKtaPriceData(transformedData);
        } else {
          console.log('No usd price in wallet API response');
        }
      } else {
        console.log('No price data received from wallet API');
      }
    } catch (error) {
      console.error('Failed to fetch KTA price:', error);
      setKtaPriceData(null);
    } finally {
      setIsLoadingPrice(false);
      isFetchingPrice.current = false;
    }
  }, []);

  const handleConnectWallet = useCallback(async () => {
    if (isConnecting) return;

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

  const handleUnlockWallet = useCallback(async () => {
    if (isConnecting) return;

    console.log('🔓 Attempting to unlock wallet...');
    setIsConnecting(true);
    
    try {
      // Check if wallet provider is available
      if (typeof window === 'undefined') {
        throw new Error('Window object not available (SSR)');
      }

      const provider = window.keeta;
      console.log('🔍 Wallet provider:', provider);
      
      if (!provider) {
        console.error('❌ Keeta wallet provider not found');
        throw new Error('Keeta wallet provider not found. Please make sure the Keeta wallet extension is installed and enabled.');
      }

      // Check if requestAccounts method exists
      if (typeof provider.requestAccounts !== 'function') {
        console.error('❌ requestAccounts method not available on provider');
        throw new Error('Wallet provider does not support requestAccounts method.');
      }

      // Check wallet lock status before attempting unlock
      try {
        const isLocked = await provider.isLocked?.();
        console.log('🔒 Wallet lock status:', isLocked);
      } catch (error) {
        console.log('⚠️ Could not check lock status:', error);
      }

      console.log('🚀 Calling provider.requestAccounts()...');
      console.log('⏰ Timestamp before requestAccounts:', new Date().toISOString());
      
      // Add a timeout to detect if the call is hanging
      const requestPromise = provider.requestAccounts();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('requestAccounts timeout after 30 seconds')), 30000)
      );
      
      console.log('🔄 Waiting for wallet popup...');
      console.log('💡 If no popup appears, check:');
      console.log('   1. Browser popup blocker settings');
      console.log('   2. Look for popup notifications in address bar');
      console.log('   3. Check if wallet extension is properly installed');
      
      // Test if we can access other wallet methods
      console.log('🧪 Testing wallet methods:');
      console.log('   - isAvailable:', provider.isAvailable);
      console.log('   - isConnected:', provider.isConnected);
      console.log('   - isKeeta:', provider.isKeeta);
      
      console.log('💡 MANUAL CHECK REQUIRED:');
      console.log('   1. Look for the Keeta wallet extension icon in your browser toolbar');
      console.log('   2. Click the extension icon directly');
      console.log('   3. See if the extension opens and shows an unlock interface');
      console.log('   4. If the extension opens, try unlocking it there first');
      console.log('   5. Then come back and try this button again');
      
      // Try multiple approaches to trigger the unlock popup
      let accounts = [];
      
      try {
        // Method 1: Direct requestAccounts call
        console.log('🔄 Method 1: Direct requestAccounts...');
        accounts = await Promise.race([requestPromise, timeoutPromise]) as string[];
        
        if (accounts.length === 0) {
          console.log('⚠️ Method 1 failed, trying Method 2...');
          
          // Method 2: Try calling getAccounts first to trigger unlock
          try {
            console.log('🔄 Method 2: Calling getAccounts to trigger unlock...');
            await provider.getAccounts();
            // Wait a moment for potential popup
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try requestAccounts again
            console.log('🔄 Method 2: Retrying requestAccounts...');
            accounts = await provider.requestAccounts();
          } catch (error) {
            console.log('⚠️ Method 2 failed:', error);
          }
        }
        
        if (accounts.length === 0) {
          console.log('⚠️ Both methods failed, trying Method 3...');
          
          // Method 3: Try to trigger unlock by calling a method that requires authentication
          try {
            console.log('🔄 Method 3: Trying to get balance to trigger unlock...');
            await provider.getBalance('0x0000000000000000000000000000000000000000');
          } catch (error) {
            console.log('⚠️ Method 3 failed (expected):', (error as Error).message);
            // This is expected to fail, but might trigger unlock popup
          }
        }
      } catch (error) {
        console.log('❌ All unlock methods failed:', error);
        throw error;
      }
      
      console.log('⏰ Timestamp after requestAccounts:', new Date().toISOString());
      
      console.log('✅ Wallet unlocked successfully, accounts:', accounts);
      console.log('📊 Accounts length:', accounts.length);
      
      // Check lock status again after unlock attempt
      try {
        const isLockedAfter = await provider.isLocked?.();
        console.log('🔓 Wallet lock status after unlock:', isLockedAfter);
      } catch (error) {
        console.log('⚠️ Could not check lock status after unlock:', error);
      }

      // Try to get accounts through getAccounts method as well
      try {
        const getAccountsResult = await provider.getAccounts();
        console.log('📋 getAccounts() result:', getAccountsResult);
      } catch (error) {
        console.log('⚠️ getAccounts() failed:', error);
      }
      
      // Refresh wallet state after successful unlock
      await refreshWallet();
      
      return accounts;
    } catch (error) {
      console.error('❌ Failed to unlock wallet:', error);
      const message = (error as Error)?.message ?? '';
      
      // Don't show alert for user rejection
      if (!/rejected|denied|cancelled/i.test(message)) {
        alert(`Failed to unlock wallet: ${message}`);
      } else {
        console.log('👤 User rejected or cancelled wallet unlock');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, refreshWallet]);

  useEffect(() => {
    if (walletError) {
      console.error('Wallet query error:', walletError);
    }
  }, [walletError]);

  useEffect(() => {
    if (tokensError) {
      console.error('Tokens query error:', tokensError);
    }
  }, [tokensError]);

  useEffect(() => {
    if (isUnlocked && tokens.length === 0 && !tokensLoading) {
      const timeoutId = setTimeout(() => {
        setShowNullState(true);
      }, 3000);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [isUnlocked, tokensLoading, tokens.length]);

  useEffect(() => {
    if (!isUnlocked) {
      return undefined;
    }

    fetchKtaPrice();
    const intervalId = setInterval(() => {
      fetchKtaPrice();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [isUnlocked, fetchKtaPrice]);

  useEffect(() => {
    if (!isLocked) {
      setShowLockedNotification(false);
      return undefined;
    }

    setShowLockedNotification(true);
    const timeout = setTimeout(() => {
      setShowLockedNotification(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isLocked]);

  if (isDisconnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)] p-8 max-w-md text-center">
          <Wallet className="mx-auto h-16 w-16 text-accent mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-4">Connect Your Wallet</h1>
          <p className="text-base text-muted mb-6">
            Please connect your Keeta Wallet to access the dashboard and manage your assets.
          </p>
          <button
            onClick={handleConnectWallet}
            disabled={isConnecting}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent text-white px-6 py-3 text-sm font-semibold shadow-[0_20px_50px_rgba(15,15,20,0.35)] transition-all duration-200 hover:bg-accent/90 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    );
  }

  // Show loading state during wallet initialization to prevent premature "locked" state
  if (wallet.isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)] p-8 max-w-md text-center">
          <div className="mx-auto h-16 w-16 text-accent mb-4 flex items-center justify-center">
            <svg className="animate-spin h-16 w-16 text-accent" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-4">Checking Wallet Status</h1>
          <p className="text-base text-muted mb-6">
            Verifying your Keeta Wallet connection and status...
          </p>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)] p-8 max-w-md">
          <div className="flex flex-col items-center text-center">
            <svg className="h-16 w-16 text-accent mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h1 className="text-2xl font-bold text-foreground mb-4">Wallet Locked</h1>
            <p className="text-base text-muted mb-6">
              Your Keeta Wallet is currently locked. Please unlock your wallet extension to access the dashboard.
            </p>
            <button
              onClick={handleUnlockWallet}
              disabled={isConnecting}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent text-white px-6 py-3 text-sm font-semibold shadow-[0_20px_50px_rgba(15,15,20,0.35)] transition-all duration-200 hover:bg-accent/90 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isConnecting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Unlocking...
                </>
              ) : (
                'Unlock Wallet'
              )}
            </button>
            <button
              onClick={() => {
                console.log('🔍 Wallet Debug Info:');
                console.log('Wallet object:', wallet);
                console.log('isDisconnected:', isDisconnected);
                console.log('isLocked:', isLocked);
                console.log('isUnlocked:', isUnlocked);
                console.log('isConnected:', wallet.connected);
                console.log('accounts:', wallet.accounts);
                console.log('Provider:', window.keeta);
                refreshWallet();
              }}
              className="mt-3 text-xs text-muted hover:text-foreground transition-colors"
            >
              🔍 Debug Wallet State
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-1">
      {showLockedNotification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)] p-4 max-w-md">
            <div className="flex items-start gap-3">
              <svg className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-1">Wallet Locked</h3>
                <p className="text-sm text-muted">
                  Please unlock your Keeta Wallet extension to view your balance and assets.
                </p>
              </div>
              <button
                onClick={() => setShowLockedNotification(false)}
                className="text-muted hover:text-foreground transition-colors"
                aria-label="Dismiss notification"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-shrink-0">
        <EstimatedBalance
          balance={wallet.balance}
          isConnecting={isConnecting}
          onConnect={handleConnectWallet}
          onReceive={handleReceive}
          onSend={handleSend}
          onTransfer={handleTransfer}
          tokens={tokens}
          ktaPriceData={ktaPriceData?.usd ? { 
            usd: ktaPriceData.usd,
            usd_market_cap: ktaPriceData.usd_market_cap,
            usd_24h_vol: ktaPriceData.usd_24h_vol
          } : null}
        />
      </div>

      <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)] flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-hairline flex-shrink-0">
          <h2 className="text-xl font-bold text-foreground">Assets</h2>
        </div>

        <div className="px-6 py-4 border-b border-hairline flex-shrink-0">
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
              onClick={() => setActiveTab('storage')}
              className={`font-medium border-b-2 pb-2 transition-colors ${
                activeTab === 'storage' ? 'text-accent border-accent' : 'text-muted hover:text-foreground border-transparent'
              }`}
            >
              Storage
            </button>
            <button 
              onClick={() => setActiveTab('nfts')}
              className={`font-medium border-b-2 pb-2 transition-colors ${
                activeTab === 'nfts' ? 'text-accent border-accent' : 'text-muted hover:text-foreground border-transparent'
              }`}
            >
              NFTs
            </button>
            <button 
              onClick={() => setActiveTab('others')}
              className={`font-medium border-b-2 pb-2 transition-colors ${
                activeTab === 'others' ? 'text-accent border-accent' : 'text-muted hover:text-foreground border-transparent'
              }`}
            >
              Others
            </button>
          </div>
        </div>

        <div className="overflow-auto flex-1">
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
                    Coin Price / Total Value
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {tokensLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="animate-spin h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-muted">Loading your assets...</span>
                    </div>
                  </td>
                </tr>
              ) : tokens.length === 0 && showNullState ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Wallet className="h-12 w-12 text-muted opacity-50" />
                      <span className="text-muted">No tokens found in your wallet</span>
                    </div>
                  </td>
                </tr>
              ) : tokens.length === 0 && !showNullState ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="animate-spin h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-muted">Loading your assets...</span>
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
                          <img src={token.icon} alt={token.ticker} className="w-8 h-8 rounded-full object-cover" />
                        ) : token.fallbackIcon ? (
                          <>
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center"
                              style={getTokenIconStyle(token.fallbackIcon.bgColor || '#6aa8ff', token.fallbackIcon.textColor || '#ffffff')}
                            >
                              <span className="text-xs font-bold">{token.fallbackIcon.letter}</span>
                            </div>
                          </>
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
                      {token.ticker === 'KTA' && ktaPriceData?.usd ? (
                        <>
                          <div className="text-foreground font-medium">
                            ${ktaPriceData.usd.toFixed(4)}
                          </div>
                          <div className="text-muted text-sm">
                            ${(parseFloat(token.formattedAmount.replace(/,/g, '')) * ktaPriceData.usd).toFixed(2)}
                          </div>
                        </>
                      ) : isLoadingPrice && token.ticker === 'KTA' ? (
                        <>
                          <div className="text-muted text-sm">Loading...</div>
                        </>
                      ) : (
                        <>
                          <div className="text-foreground font-medium">—</div>
                          <div className="text-muted text-sm">—</div>
                        </>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right font-medium">
                      {token.ticker === 'KTA' && ktaPriceData?.usd_24h_change ? (
                        <span className={ktaPriceData.usd_24h_change >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {ktaPriceData.usd_24h_change >= 0 ? '+' : ''}{ktaPriceData.usd_24h_change.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-accent hover:text-foreground transition-colors">
                        Trade
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
  );
}
