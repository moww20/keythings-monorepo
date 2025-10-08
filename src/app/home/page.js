'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [walletState, setWalletState] = useState({
    connected: false,
    accounts: [],
    balance: null,
    network: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    // Check if Keeta wallet is installed and connected
    const checkWalletConnection = async () => {
      try {
        // Wait for wallet to be injected
        await new Promise(resolve => setTimeout(resolve, 500))

        if (typeof window.keeta === 'undefined') {
          setWalletState({
            connected: false,
            accounts: [],
            balance: null,
            network: null,
            loading: false,
            error: 'Keeta wallet not detected. Please install the Keythings wallet extension.'
          })
          return
        }

        // Check if already connected
        const accounts = await window.keeta.getAccounts()
        
        if (accounts.length === 0) {
          // Not connected, redirect to main page or show connect prompt
          setWalletState({
            connected: false,
            accounts: [],
            balance: null,
            network: null,
            loading: false,
            error: 'Not connected to wallet. Please connect your Keeta wallet.'
          })
          return
        }

        // Get network info
        const network = await window.keeta.getNetwork()

        // Get balance for the first account
        let balance = null
        try {
          balance = await window.keeta.getBalance(accounts[0])
        } catch (balanceError) {
          console.error('Failed to get balance:', balanceError)
        }

        // Successfully connected
        setWalletState({
          connected: true,
          accounts,
          balance,
          network,
          loading: false,
          error: null
        })

        // Setup event listeners
        window.keeta.on('accountsChanged', handleAccountsChanged)
        window.keeta.on('chainChanged', handleChainChanged)
        window.keeta.on('disconnect', handleDisconnect)

      } catch (error) {
        console.error('Wallet connection error:', error)
        setWalletState({
          connected: false,
          accounts: [],
          balance: null,
          network: null,
          loading: false,
          error: error.message || 'Failed to connect to wallet'
        })
      }
    }

    checkWalletConnection()

    // Cleanup event listeners
    return () => {
      if (typeof window.keeta !== 'undefined') {
        window.keeta.removeListener('accountsChanged', handleAccountsChanged)
        window.keeta.removeListener('chainChanged', handleChainChanged)
        window.keeta.removeListener('disconnect', handleDisconnect)
      }
    }
  }, [])

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      // Disconnected
      setWalletState(prev => ({
        ...prev,
        connected: false,
        accounts: [],
        balance: null
      }))
    } else {
      // Account changed
      const balance = await window.keeta.getBalance(accounts[0])
      setWalletState(prev => ({
        ...prev,
        accounts,
        balance
      }))
    }
  }

  const handleChainChanged = async (chainId) => {
    // Reload network info
    const network = await window.keeta.getNetwork()
    setWalletState(prev => ({
      ...prev,
      network
    }))
  }

  const handleDisconnect = () => {
    setWalletState({
      connected: false,
      accounts: [],
      balance: null,
      network: null,
      loading: false,
      error: 'Wallet disconnected'
    })
  }

  const handleConnect = async () => {
    try {
      if (typeof window.keeta === 'undefined') {
        alert('Please install the Keythings wallet extension first!')
        return
      }

      const accounts = await window.keeta.requestAccounts()
      const network = await window.keeta.getNetwork()
      const balance = await window.keeta.getBalance(accounts[0])

      setWalletState({
        connected: true,
        accounts,
        balance,
        network,
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('Failed to connect:', error)
      setWalletState(prev => ({
        ...prev,
        error: error.message || 'Failed to connect wallet'
      }))
    }
  }

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 12)}...${address.slice(-8)}`
  }

  const formatBalance = (balance) => {
    if (balance === null || balance === undefined) return '0'
    return balance
  }

  // Loading state
  if (walletState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[color:var(--background)]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto"></div>
          <p className="text-subtle">Connecting to Keeta wallet...</p>
        </div>
      </div>
    )
  }

  // Not connected state
  if (!walletState.connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[color:var(--background)]">
        <div className="max-w-md w-full mx-auto px-6">
          <div className="glass rounded-3xl border border-hairline p-8 shadow-[0_30px_80px_rgba(5,6,11,0.55)] text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[color:color-mix(in_oklab,var(--foreground)_20%,transparent)] to-[color:color-mix(in_oklab,var(--foreground)_5%,transparent)] flex items-center justify-center">
              <svg className="w-10 h-10 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">Wallet Connection Required</h1>
              <p className="text-subtle">
                {walletState.error || 'Connect your Keeta wallet to access the dashboard'}
              </p>
            </div>
            <button
              onClick={handleConnect}
              className="w-full inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_20px_50px_rgba(15,15,20,0.35)] transition hover:bg-white/90"
            >
              Connect Wallet
            </button>
            <div className="pt-4 border-t border-hairline">
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
          </div>
        </div>
      </div>
    )
  }

  // Connected state - Dashboard
  return (
    <main className="min-h-screen bg-[color:var(--background)]">
      <div className="flex min-h-screen">
        {/* Left Sidebar - Binance Style */}
        <aside className="w-64 bg-[#1e2329] border-r border-[#2b3139]">
          <div className="p-4">
            {/* Navigation */}
            <nav className="space-y-1">
              <a
                href="#dashboard"
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-[#fcd535] rounded-lg"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </a>
              
              <a
                href="#assets"
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#b7bdc6] hover:text-white hover:bg-[#2b3139] rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Assets
                <svg className="h-4 w-4 ml-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </a>

              <a
                href="#orders"
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#b7bdc6] hover:text-white hover:bg-[#2b3139] rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Orders
                <svg className="h-4 w-4 ml-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </a>

              <a
                href="#rewards"
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#b7bdc6] hover:text-white hover:bg-[#2b3139] rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Rewards Hub
              </a>

              <a
                href="#referral"
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#b7bdc6] hover:text-white hover:bg-[#2b3139] rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Referral
              </a>

              <a
                href="#account"
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#b7bdc6] hover:text-white hover:bg-[#2b3139] rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account
                <svg className="h-4 w-4 ml-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </a>

              <a
                href="#subaccounts"
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#b7bdc6] hover:text-white hover:bg-[#2b3139] rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Sub Accounts
              </a>

              <a
                href="#settings"
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#b7bdc6] hover:text-white hover:bg-[#2b3139] rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 00-1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </a>
            </nav>
          </div>
        </aside>

        {/* Main Content - Binance Style */}
        <div className="flex-1 bg-[#0b0e11] py-8 px-8">
          {/* Estimated Balance Section */}
          <div className="mb-8 bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Estimated Balance</h2>
                <button className="p-1">
                  <svg className="h-5 w-5 text-[#b7bdc6]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-white">
                    {formatBalance(walletState.balance)}
                  </span>
                  <span className="text-lg text-[#b7bdc6]">KTA</span>
                  <svg className="h-4 w-4 text-[#b7bdc6]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </div>
                <div className="text-sm text-[#b7bdc6] mb-2">
                  ≈ $237.65
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-[#b7bdc6]">Today&apos;s PnL</span>
                  <span className="text-red-500">-$0.18(0.02%)</span>
                  <svg className="h-4 w-4 text-[#b7bdc6]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="bg-[#fcd535] text-black px-6 py-2 rounded-md font-medium hover:bg-[#f5d536] transition-colors">
                  Deposit
                </button>
                <button className="bg-[#2b3139] text-white px-6 py-2 rounded-md font-medium hover:bg-[#3c434a] transition-colors">
                  Withdraw
                </button>
                <button className="bg-[#2b3139] text-white px-6 py-2 rounded-md font-medium hover:bg-[#3c434a] transition-colors">
                  Cash In
                </button>
              </div>
            </div>

            {/* Mini Chart Placeholder */}
            <div className="mt-4 h-12 bg-[#2b3139] rounded flex items-center justify-center">
              <div className="flex items-end gap-1 h-8">
                {[2, 4, 3, 6, 4, 7, 5, 8, 6, 4, 7, 9, 8, 6, 9, 7, 8, 10, 9, 7].map((height, i) => (
                  <div
                    key={i}
                    className="w-1 bg-[#fcd535] rounded-t"
                    style={{ height: `${height * 4}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Markets Section */}
          <div className="bg-[#1e2329] rounded-lg border border-[#2b3139]">
            <div className="p-6 border-b border-[#2b3139]">
              <h2 className="text-xl font-bold text-white">Markets</h2>
            </div>

            {/* Market Tabs */}
            <div className="px-6 py-4 border-b border-[#2b3139]">
              <div className="flex gap-8">
                <button className="text-[#fcd535] font-medium border-b-2 border-[#fcd535] pb-2">
                  Holding
                </button>
                <button className="text-[#b7bdc6] hover:text-white transition-colors">
                  Hot
                </button>
                <button className="text-[#b7bdc6] hover:text-white transition-colors">
                  New Listing
                </button>
                <button className="text-[#b7bdc6] hover:text-white transition-colors">
                  Favorite
                </button>
                <button className="text-[#b7bdc6] hover:text-white transition-colors">
                  Top Gainers
                </button>
                <button className="text-[#b7bdc6] hover:text-white transition-colors">
                  24h Volume
                </button>
                <button className="text-[#b7bdc6] hover:text-white transition-colors ml-auto">
                  More >
                </button>
              </div>
            </div>

            {/* Markets Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2b3139]">
                    <th className="text-left py-4 px-6 text-[#b7bdc6] text-sm font-medium">
                      <div className="flex items-center gap-1">
                        Coin
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M7 14l5-5 5 5z" />
                        </svg>
                      </div>
                    </th>
                    <th className="text-right py-4 px-6 text-[#b7bdc6] text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        Amount
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M7 14l5-5 5 5z" />
                        </svg>
                      </div>
                    </th>
                    <th className="text-right py-4 px-6 text-[#b7bdc6] text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        Coin Price / Cost Price
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </th>
                    <th className="text-right py-4 px-6 text-[#b7bdc6] text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        24H Change
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M7 14l5-5 5 5z" />
                        </svg>
                      </div>
                    </th>
                    <th className="text-right py-4 px-6 text-[#b7bdc6] text-sm font-medium">
                      Trade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* USDT Row */}
                  <tr className="border-b border-[#2b3139] hover:bg-[#2b3139]/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">U</span>
                        </div>
                        <div>
                          <div className="text-white font-medium">USDT</div>
                          <div className="text-[#b7bdc6] text-sm">TetherUS</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-white font-medium">1,000.00</div>
                      <div className="text-[#b7bdc6] text-sm">$1,000.00</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-white font-medium">$1.0000</div>
                      <div className="text-[#b7bdc6] text-sm">$1.0000</div>
                    </td>
                    <td className="py-4 px-6 text-right text-red-500 font-medium">
                      -0.02%
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-[#fcd535] hover:text-white transition-colors">
                        Trade
                      </button>
                    </td>
                  </tr>

                  {/* SUI Row */}
                  <tr className="border-b border-[#2b3139] hover:bg-[#2b3139]/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">S</span>
                        </div>
                        <div>
                          <div className="text-white font-medium">SUI</div>
                          <div className="text-[#b7bdc6] text-sm">Sui</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-white font-medium">500.00</div>
                      <div className="text-[#b7bdc6] text-sm">$500.00</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-white font-medium">$1.0000</div>
                      <div className="text-[#b7bdc6] text-sm">$0.9800</div>
                    </td>
                    <td className="py-4 px-6 text-right text-green-500 font-medium">
                      +2.42%
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-[#fcd535] hover:text-white transition-colors">
                        Trade
                      </button>
                    </td>
                  </tr>

                  {/* GLMR Row */}
                  <tr className="border-b border-[#2b3139] hover:bg-[#2b3139]/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">G</span>
                        </div>
                        <div>
                          <div className="text-white font-medium">GLMR</div>
                          <div className="text-[#b7bdc6] text-sm">Moonbeam</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-white font-medium">2,000.00</div>
                      <div className="text-[#b7bdc6] text-sm">$2,000.00</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-white font-medium">$1.0000</div>
                      <div className="text-[#b7bdc6] text-sm">$0.9800</div>
                    </td>
                    <td className="py-4 px-6 text-right text-green-500 font-medium">
                      +2.12%
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-[#fcd535] hover:text-white transition-colors">
                        Trade
                      </button>
                    </td>
                  </tr>

                  {/* ADA Row */}
                  <tr className="hover:bg-[#2b3139]/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">A</span>
                        </div>
                        <div>
                          <div className="text-white font-medium">ADA</div>
                          <div className="text-[#b7bdc6] text-sm">Cardano</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-white font-medium">3,000.00</div>
                      <div className="text-[#b7bdc6] text-sm">$3,000.00</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-white font-medium">$1.0000</div>
                      <div className="text-[#b7bdc6] text-sm">$0.9850</div>
                    </td>
                    <td className="py-4 px-6 text-right text-green-500 font-medium">
                      +1.61%
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-[#fcd535] hover:text-white transition-colors">
                        Trade
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button className="group rounded-2xl border border-hairline bg-surface p-6 text-left shadow-[0_18px_50px_rgba(5,6,9,0.45)] transition hover:border-[color:color-mix(in_oklab,var(--foreground)_24%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)]">
              <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-[color:color-mix(in_oklab,var(--foreground)_16%,transparent)] via-transparent to-transparent p-3">
                <svg className="h-6 w-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">Send Tokens</h3>
              <p className="text-xs text-muted">Transfer KTA or custom tokens</p>
            </button>

            <button className="group rounded-2xl border border-hairline bg-surface p-6 text-left shadow-[0_18px_50px_rgba(5,6,9,0.45)] transition hover:border-[color:color-mix(in_oklab,var(--foreground)_24%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)]">
              <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-[color:color-mix(in_oklab,var(--foreground)_16%,transparent)] via-transparent to-transparent p-3">
                <svg className="h-6 w-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">Receive</h3>
              <p className="text-xs text-muted">Get your account address</p>
            </button>

            <button className="group rounded-2xl border border-hairline bg-surface p-6 text-left shadow-[0_18px_50px_rgba(5,6,9,0.45)] transition hover:border-[color:color-mix(in_oklab,var(--foreground)_24%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)]">
              <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-[color:color-mix(in_oklab,var(--foreground)_16%,transparent)] via-transparent to-transparent p-3">
                <svg className="h-6 w-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">Create Token</h3>
              <p className="text-xs text-muted">Launch your own token</p>
            </button>

            <button className="group rounded-2xl border border-hairline bg-surface p-6 text-left shadow-[0_18px_50px_rgba(5,6,9,0.45)] transition hover:border-[color:color-mix(in_oklab,var(--foreground)_24%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)]">
              <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-[color:color-mix(in_oklab,var(--foreground)_16%,transparent)] via-transparent to-transparent p-3">
                <svg className="h-6 w-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">History</h3>
              <p className="text-xs text-muted">View transaction history</p>
            </button>
          </div>
        </div>

        {/* Network Info */}
        <div className="glass rounded-3xl border border-hairline p-6 shadow-[0_30px_70px_rgba(5,6,11,0.55)]">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Network Information</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-[0.25em] text-faint">Network</span>
              <p className="text-sm text-foreground">{walletState.network?.name || 'Unknown'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-[0.25em] text-faint">Chain ID</span>
              <p className="text-sm text-foreground font-mono">{walletState.network?.chainId || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-[0.25em] text-faint">Explorer</span>
              <a
                href={
                  walletState.network?.chainId === '0x1'
                    ? 'https://explorer.test.keeta.com'
                    : 'https://explorer.keeta.com'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-foreground hover:underline"
              >
                View on Explorer →
              </a>
            </div>
          </div>
        </div>

        {/* Resources */}
        <div className="mt-8 rounded-2xl border border-hairline bg-surface p-6">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Resources</h3>
          <div className="flex flex-wrap gap-4">
            <a
              href="/docs"
              className="text-sm text-subtle hover:text-foreground transition"
            >
              Documentation →
            </a>
            <a
              href="/docs/developer/api-reference"
              className="text-sm text-subtle hover:text-foreground transition"
            >
              API Reference →
            </a>
            <a
              href="https://faucet.test.keeta.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-subtle hover:text-foreground transition"
            >
              Test Faucet →
            </a>
          </div>
        </div>
        </div>
      </div>
    </main>
  )
}

