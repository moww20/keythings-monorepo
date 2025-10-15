'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { Wallet } from 'lucide-react';
import EstimatedBalance from '../../components/EstimatedBalance';
import { useWallet } from '../../contexts/WalletContext';

function getTokenIconColors(bgColor: string, textColor: string) {
  return { backgroundColor: bgColor, color: textColor };
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
    isTradingEnabled,
    isTradingEnabling,
    tradingError,
    enableTrading,
  } = useWallet();

  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState('tokens');
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
  
  // Storage accounts state with enriched metadata
  const [storageAccounts, setStorageAccounts] = useState<Array<{
    entity: string;
    principal: string;
    target: string | null;
    permissions: string[];
    // Enriched metadata
    name?: string;
    description?: string;
    metadata?: string;
    ktaBalance?: string;
    otherTokenBalance?: string;
    otherTokenSymbol?: string;
    created?: number;
  }>>([]);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);

  const isWalletBusy = isWalletLoading || isWalletFetching;
  const tokensLoading = isTokensLoading || isTokensFetching;
  
  // Helper function to get token symbol from address
  const getTokenSymbolFromAddress = useCallback((address: string): string => {
    const token = tokens.find(t => t.address === address);
    return token?.ticker || address.slice(-4).toUpperCase();
  }, [tokens]);


  const handleReceive = useCallback(() => {
    console.log('Receive clicked');
  }, []);

  const handleSend = useCallback(() => {
    console.log('Send clicked');
  }, []);

  const handleTransfer = useCallback(() => {
    console.log('Transfer clicked');
  }, []);
  
  // Fetch storage accounts when Storage tab is active
  useEffect(() => {
    async function fetchStorageAccounts() {
      if (activeTab !== 'storage' || !isUnlocked) {
        return;
      }
      
      try {
        setIsLoadingStorage(true);
        const provider = typeof window !== 'undefined' ? window.keeta : null;
        
        if (!provider) {
          console.warn('Keeta provider not available');
          setStorageAccounts([]);
          return;
        }

        // Use provider's listStorageAccounts method directly
        if (typeof provider.listStorageAccounts !== 'function') {
          console.warn('[Storage] listStorageAccounts not available on provider');
          setStorageAccounts([]);
          return;
        }

        const acls = await provider.listStorageAccounts();
        console.log('[Storage] Total storage ACLs fetched:', Array.isArray(acls) ? acls.length : 0);
        console.log('[Storage] Raw ACL data:', acls);
        
        const enrichedAccounts = (Array.isArray(acls) ? acls : []).map((acl: any, index: number) => {
          try {
            // Extract entity address (storage account address)
            const entityStr = typeof acl.entity === 'string' 
              ? acl.entity 
              : (acl.entity?.publicKeyString?.get 
                  ? acl.entity.publicKeyString.get() 
                  : (acl.entity?.publicKeyString?.toString 
                      ? acl.entity.publicKeyString.toString() 
                      : 'unknown'));
            
            // Extract target address
          const targetStr = acl.target 
              ? (typeof acl.target === 'string'
                  ? acl.target
                  : (acl.target?.publicKeyString?.get 
                      ? acl.target.publicKeyString.get()
                      : (acl.target?.publicKeyString?.toString
                          ? acl.target.publicKeyString.toString()
                          : null)))
            : null;
          
            // Extract principal address (user's address)
            const principalStr = typeof acl.principal === 'string'
              ? acl.principal
              : (acl.principal?.publicKeyString?.get
                  ? acl.principal.publicKeyString.get()
                  : (acl.principal?.publicKeyString?.toString
                      ? acl.principal.publicKeyString.toString()
                      : ''));
            
            console.log(`[Storage] Account ${index + 1}:`, {
              entity: entityStr,
              principal: principalStr,
              target: targetStr,
              permissions: acl.permissions || [],
            });
          
          return {
            entity: entityStr,
              principal: principalStr,
            target: targetStr,
              permissions: Array.isArray(acl.permissions) ? acl.permissions : [],
              name: 'Storage Account',
            description: 'Storage account for trading operations',
              ktaBalance: '0.00',
              otherTokenBalance: '0.00',
              otherTokenSymbol: 'BASE', // Default to BASE, will be updated if other tokens found
            created: Date.now(),
          };
          } catch (mappingError) {
            console.error(`[Storage] Error mapping ACL ${index + 1}:`, mappingError);
            return null;
          }
        }).filter((account): account is NonNullable<typeof account> => account !== null);
        
        console.log('[Storage] Enriched accounts:', enrichedAccounts.length);
        console.log('[Storage] Available tokens in wallet:', tokens.map(t => ({ 
          address: t.address, 
          ticker: t.ticker, 
          isBaseToken: t.isBaseToken 
        })));
        
        // Analyze ACL data to determine which tokens are stored in each storage account
        const accountsWithBalances = await Promise.all(enrichedAccounts.map(async (account) => {
          try {
            // Get account info to fetch balances
            const accountInfo = await provider.getAccountInfo?.(account.entity);
            console.log(`[Storage] Account info for ${account.entity}:`, accountInfo);
            
            // Try to get actual balances from the storage account
            let ktaBalance = '0.00';
            let otherTokenBalance = '0.00';
            let otherTokenSymbol = 'Unknown';
            
            // Check if accountInfo contains balance information
            if (accountInfo && typeof accountInfo === 'object') {
              console.log(`[Storage] Parsing account info for ${account.entity}:`, accountInfo);
              console.log(`[Storage] Account info keys:`, Object.keys(accountInfo));
              console.log(`[Storage] Has balances?`, 'balances' in accountInfo);
              console.log(`[Storage] Has tokens?`, 'tokens' in accountInfo);
              
              // Try to extract balance information from accountInfo
              // This depends on the structure of the accountInfo object
              if ('balances' in accountInfo && Array.isArray((accountInfo as any).balances)) {
                const balances = (accountInfo as any).balances;
                
                // Find KTA balance (base token)
                const ktaToken = tokens.find(t => t.isBaseToken);
                if (ktaToken) {
                  const ktaBalanceEntry = balances.find((b: any) => 
                    b.token === ktaToken.address || b.tokenAddress === ktaToken.address
                  );
                  if (ktaBalanceEntry) {
                    ktaBalance = typeof ktaBalanceEntry.balance === 'string' 
                      ? ktaBalanceEntry.balance 
                      : ktaBalanceEntry.balance?.toString() || '0.00';
                  }
                }
                
                // Find other token balance (non-KTA)
                const otherTokenBalanceEntry = balances.find((b: any) => {
                  const tokenAddress = b.token || b.tokenAddress;
                  return tokenAddress && !tokens.find(t => t.address === tokenAddress)?.isBaseToken;
                });
                
                if (otherTokenBalanceEntry) {
                  const tokenAddress = otherTokenBalanceEntry.token || otherTokenBalanceEntry.tokenAddress;
                  otherTokenBalance = typeof otherTokenBalanceEntry.balance === 'string'
                    ? otherTokenBalanceEntry.balance
                    : otherTokenBalanceEntry.balance?.toString() || '0.00';
                  console.log(`[Storage] Other token address found:`, tokenAddress);
                  otherTokenSymbol = getTokenSymbolFromAddress(tokenAddress);
                  console.log(`[Storage] Resolved token symbol:`, otherTokenSymbol);
                }
              } else if ('tokens' in accountInfo && Array.isArray((accountInfo as any).tokens)) {
                // Alternative structure: tokens array
                const accountTokens = (accountInfo as any).tokens;
                
                // Find KTA
                const ktaToken = tokens.find(t => t.isBaseToken);
                if (ktaToken) {
                  const ktaEntry = accountTokens.find((t: any) => 
                    t.address === ktaToken.address || t.tokenAddress === ktaToken.address
                  );
                  if (ktaEntry) {
                    ktaBalance = typeof ktaEntry.balance === 'string' 
                      ? ktaEntry.balance 
                      : ktaEntry.balance?.toString() || '0.00';
                  }
                }
                
                // Find other token
                const otherTokenEntry = accountTokens.find((t: any) => {
                  const tokenAddress = t.address || t.tokenAddress;
                  return tokenAddress && !tokens.find(wt => wt.address === tokenAddress)?.isBaseToken;
                });
                
                if (otherTokenEntry) {
                  const tokenAddress = otherTokenEntry.address || otherTokenEntry.tokenAddress;
                  otherTokenBalance = typeof otherTokenEntry.balance === 'string'
                    ? otherTokenEntry.balance
                    : otherTokenEntry.balance?.toString() || '0.00';
                  console.log(`[Storage] Other token address found (tokens array):`, tokenAddress);
                  otherTokenSymbol = getTokenSymbolFromAddress(tokenAddress);
                  console.log(`[Storage] Resolved token symbol (tokens array):`, otherTokenSymbol);
                }
              }
            }
            
            // If no balance info in accountInfo, try to get pool information from backend
            // Storage accounts are typically associated with liquidity pools
            if (otherTokenSymbol === 'Unknown') {
              console.log(`[Storage] Attempting to fetch pool info for storage account: ${account.entity}`);
              
              try {
                // Query backend API for pool information
                const poolResponse = await fetch('http://localhost:8080/api/pools/list');
                
                // Check if response is OK and has content
                if (!poolResponse.ok) {
                  console.error(`[Storage] Backend API returned status ${poolResponse.status}`);
                } else {
                  // Check if response has content before parsing
                  const text = await poolResponse.text();
                  if (!text || text.trim() === '') {
                    console.warn(`[Storage] Backend API returned empty response`);
                  } else {
                
                const poolsData = JSON.parse(text);
                console.log(`[Storage] Pools data from backend:`, poolsData);
                console.log(`[Storage] Looking for storage account:`, account.entity);
                console.log(`[Storage] Available pool storage accounts:`, poolsData.pools?.map((p: any) => p.storage_account));
                
                // Find the pool that uses this storage account
                const matchingPool = poolsData.pools?.find((pool: any) => {
                  console.log(`[Storage] Checking pool:`, pool.id, 'storage_account:', pool.storage_account);
                  return pool.storage_account === account.entity || pool.pool_id === account.entity;
                });
                
                if (matchingPool) {
                  console.log(`[Storage] Found matching pool:`, matchingPool);
                  
                  // Helper function to format pool balance from base units to display units
                  const formatPoolBalance = (balance: string, decimals: number = 9): string => {
                    try {
                      const num = parseFloat(balance) / Math.pow(10, decimals);
                      return num.toFixed(2);
                    } catch {
                      return '0.00';
                    }
                  };
                  
                  // Extract token symbols from pool data
                  // token_a and token_b are token symbols (e.g., "KTA", "BASE"), not addresses
                  const tokenASymbol = matchingPool.token_a;
                  const tokenBSymbol = matchingPool.token_b;
                  
                  console.log(`[Storage] Token symbols from pool: ${tokenASymbol} / ${tokenBSymbol}`);
                  
                  // Determine which is KTA and which is the other token
                  const isTokenAKta = tokenASymbol === 'KTA';
                  const otherSymbol = isTokenAKta ? tokenBSymbol : tokenASymbol;
                  
                  otherTokenSymbol = otherSymbol;
                  console.log(`[Storage] Determined token pair: KTA / ${otherTokenSymbol}`);
                  
                  // Get balances from pool reserves (in base units)
                  const rawKtaBalance = (isTokenAKta ? matchingPool.reserve_a : matchingPool.reserve_b) || '0';
                  const rawOtherBalance = (isTokenAKta ? matchingPool.reserve_b : matchingPool.reserve_a) || '0';
                  
                  // Find token decimals for proper formatting
                  const ktaToken = tokens.find(t => t.ticker === 'KTA');
                  const otherToken = tokens.find(t => t.ticker === otherSymbol);
                  
                  ktaBalance = formatPoolBalance(rawKtaBalance, ktaToken?.decimals || 9);
                  otherTokenBalance = formatPoolBalance(rawOtherBalance, otherToken?.decimals || 9);
                  
                  console.log(`[Storage] Pool reserves: ${ktaBalance} KTA / ${otherTokenBalance} ${otherTokenSymbol}`);
                }
                  }
                }
              } catch (poolError) {
                console.error(`[Storage] Error fetching pool data:`, poolError);
              }
            }
            
            console.log(`[Storage] Final balances for ${account.entity}:`, {
              ktaBalance,
              otherTokenBalance,
              otherTokenSymbol
            });
            
            return {
              ...account,
              ktaBalance,
              otherTokenBalance,
              otherTokenSymbol,
            };
          } catch (balanceError) {
            console.error(`[Storage] Error fetching balance for ${account.entity}:`, balanceError);
            return account; // Return account without balance updates
          }
        }));
        
        setStorageAccounts(accountsWithBalances);
      } catch (error) {
        console.error('Failed to fetch storage accounts:', error);
        setStorageAccounts([]);
      } finally {
        setIsLoadingStorage(false);
      }
    }
    
    fetchStorageAccounts();
  }, [activeTab, isUnlocked, isTradingEnabled, tokens, getTokenSymbolFromAddress]);

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
          isTradingEnabled={isTradingEnabled}
          tradingError={tradingError}
        />
      </div>

      <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)] flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-hairline flex-shrink-0">
          <h2 className="text-xl font-bold text-foreground">Assets</h2>
        </div>

        <div className="px-6 py-4 border-b border-hairline flex-shrink-0">
          <div className="flex flex-wrap gap-4 lg:gap-8">
            <button 
              onClick={() => setActiveTab('tokens')}
              className={`font-medium border-b-2 pb-2 transition-colors ${
                activeTab === 'tokens' ? 'text-accent border-accent' : 'text-muted hover:text-foreground border-transparent'
              }`}
            >
              Tokens
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
          {/* Tokens Tab - Table View */}
          {activeTab === 'tokens' && (
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
              ) : activeTab === 'tokens' ? (
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
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={getTokenIconColors(token.fallbackIcon.bgColor || '#6aa8ff', token.fallbackIcon.textColor || '#ffffff')}
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
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Wallet className="h-12 w-12 text-muted opacity-50" />
                      <span className="text-muted">Select a tab to view your assets</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}

          {/* Storage Tab - Virtualized Card List */}
          {activeTab === 'storage' && isLoadingStorage ? (
            <div className="virtualized-card-list">
              <div className="token-card-list">
                <div className="virtual-table-empty flex items-center justify-center min-h-[300px]">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-muted">Loading storage accounts...</span>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'storage' && storageAccounts.length === 0 ? (
            <div className="virtualized-card-list">
              <div className="token-card-list">
                <div className="virtual-table-empty flex items-center justify-center min-h-[300px]">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Wallet className="h-12 w-12 text-muted opacity-50" />
                    <div>
                      <p className="text-muted mb-2">No storage accounts found</p>
                      <p className="text-sm text-faint">
                        {isTradingEnabled 
                          ? 'Your storage accounts will appear here' 
                          : 'Enable trading to create a storage account'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'storage' ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="text-left py-4 px-6 text-muted text-sm font-medium">
                    <div className="flex items-center gap-1">
                      Storage Account
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 14l5-5 5 5z" />
                      </svg>
                        </div>
                  </th>
                  <th className="text-right py-4 px-6 text-muted text-sm font-medium">
                    <div className="flex items-center justify-end gap-1">
                      Status
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 14l5-5 5 5z" />
                      </svg>
                      </div>
                  </th>
                  <th className="text-right py-4 px-6 text-muted text-sm font-medium">
                    <div className="flex items-center justify-end gap-1">
                      Balance
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 14l5-5 5 5z" />
                      </svg>
                        </div>
                  </th>
                  <th className="text-right py-4 px-6 text-muted text-sm font-medium">
                    <div className="flex items-center justify-end gap-1">
                      Permissions
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      </div>
                  </th>
                  <th className="text-right py-4 px-6 text-muted text-sm font-medium">
                    Owner
                  </th>
                  <th className="text-right py-4 px-6 text-muted text-sm font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoadingStorage ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <svg className="animate-spin h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-muted">Loading storage accounts...</span>
                    </div>
                    </td>
                  </tr>
                ) : storageAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Wallet className="h-12 w-12 text-muted opacity-50" />
                        <div className="text-center">
                          <p className="text-muted mb-2">No storage accounts found</p>
                          <p className="text-sm text-faint">
                            {isTradingEnabled 
                              ? 'Your storage accounts will appear here' 
                              : 'Enable trading to create a storage account'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  storageAccounts.map((account, index) => (
                    <tr 
                      key={account.entity} 
                      className={`hover:bg-surface/50 transition-colors ${index !== storageAccounts.length - 1 ? 'border-b border-hairline' : ''}`}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                            <Wallet className="h-4 w-4 text-accent" />
                          </div>
                          <div>
                            <div className="text-foreground font-medium">{account.name || 'Storage Account'}</div>
                            <div className="text-muted text-sm font-mono">
                              {account.entity.slice(0, 10)}...{account.entity.slice(-6)}
                            </div>
                        {account.description && (
                              <div className="text-xs text-faint mt-1">{account.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                            Active
                          </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="space-y-1">
                          <div className="text-foreground font-medium">
                            {account.ktaBalance || '0.00'} KTA
                        </div>
                          <div className="text-muted text-sm">
                            {account.otherTokenBalance || '0.00'} {account.otherTokenSymbol || 'BASE'}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex flex-wrap gap-1 justify-end">
                            {account.permissions.slice(0, 2).map((perm, idx) => (
                              <span 
                                key={idx}
                                className="inline-flex items-center px-2 py-1 rounded text-xs bg-surface text-muted border border-hairline"
                              >
                                {perm}
                              </span>
                            ))}
                            {account.permissions.length > 2 && (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs text-faint">
                                +{account.permissions.length - 2}
                              </span>
                            )}
                          </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-muted text-sm font-mono">
                          {account.principal ? `${account.principal.slice(0, 8)}...${account.principal.slice(-4)}` : '—'}
                          </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button className="text-accent hover:text-foreground transition-colors text-sm">
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : null}

          {/* Other Tabs */}
          {activeTab === 'nfts' && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Wallet className="h-12 w-12 text-muted opacity-50 mx-auto mb-4" />
                <p className="text-muted">NFT support coming soon</p>
              </div>
            </div>
          )}

          {activeTab === 'others' && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Wallet className="h-12 w-12 text-muted opacity-50 mx-auto mb-4" />
                <p className="text-muted">Other assets coming soon</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
