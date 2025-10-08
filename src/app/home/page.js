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
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-hairline bg-surface p-6">
          <div className="sticky top-24">
            {/* Wallet Info */}
            <div className="mb-8">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-xs uppercase tracking-[0.25em] text-faint">Connected</span>
              </div>
              <div className="rounded-2xl border border-hairline bg-[color:var(--background)] p-4">
                <p className="mb-2 font-mono text-xs text-foreground break-all">
                  {formatAddress(walletState.accounts[0])}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-semibold text-foreground">
                    {formatBalance(walletState.balance)}
                  </span>
                  <span className="text-sm text-subtle">KTA</span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-2">
              <a
                href="#dashboard"
                className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-foreground transition hover:bg-white/15"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </a>
              
              <a
                href="#transactions"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-subtle transition hover:bg-white/5 hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Transactions
              </a>

              <a
                href="#tokens"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-subtle transition hover:bg-white/5 hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tokens
              </a>

              <a
                href="#nfts"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-subtle transition hover:bg-white/5 hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                NFTs
              </a>

              <a
                href="#settings"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-subtle transition hover:bg-white/5 hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </a>
            </nav>

            {/* Network Badge */}
            <div className="mt-8 rounded-xl border border-hairline bg-[color:var(--background)] p-4">
              <span className="text-xs uppercase tracking-[0.25em] text-faint">Network</span>
              <p className="mt-1 text-sm font-medium text-foreground">
                {walletState.network?.name || 'Unknown'}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted">
                {walletState.network?.chainId || 'N/A'}
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 py-12 px-8">
          {/* Header */}
          <div className="mb-8 space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-subtle">Your Keeta Network overview</p>
          </div>

        {/* Account Info Card */}
        <div className="glass mb-8 overflow-hidden rounded-3xl border border-hairline p-6 shadow-[0_30px_70px_rgba(5,6,11,0.55)]">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Account Address */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-xs uppercase tracking-[0.25em] text-faint">Connected Account</span>
              </div>
              <div className="rounded-2xl border border-hairline bg-surface p-4">
                <p className="font-mono text-sm text-foreground break-all">
                  {walletState.accounts[0]}
                </p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(walletState.accounts[0])}
                className="text-xs text-subtle hover:text-foreground transition"
              >
                Click to copy address
              </button>
            </div>

            {/* Balance */}
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.25em] text-faint">Balance</span>
              <div className="rounded-2xl border border-hairline bg-surface p-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-foreground">
                    {formatBalance(walletState.balance)}
                  </span>
                  <span className="text-lg text-subtle">KTA</span>
                </div>
              </div>
              <p className="text-xs text-muted">Keeta base token</p>
            </div>
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

