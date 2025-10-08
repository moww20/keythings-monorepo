"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen } from "lucide-react"
// Connect button removed from header per request
import SearchBar from "./SearchBar"
import ThemeToggle from "./ThemeToggle"
import { siX, siDiscord } from "simple-icons"

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState(null)

  useEffect(() => {
    // Close mobile menu on route change
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    setMounted(true)
    
    // Check if already connected
    checkWalletConnection()

    // Listen for wallet events
    if (typeof window !== 'undefined' && window.keeta) {
      const provider = window.keeta

      provider.on?.('accountsChanged', (accounts) => {
        if (accounts && accounts.length > 0) {
          setWalletConnected(true)
          setWalletAddress(accounts[0])
        } else {
          setWalletConnected(false)
          setWalletAddress(null)
        }
      })

      provider.on?.('disconnect', () => {
        setWalletConnected(false)
        setWalletAddress(null)
      })
    }
  }, [])

  const checkWalletConnection = async () => {
    if (typeof window === 'undefined') return
    
    const provider = window.keeta
    if (provider && provider.isKeeta && provider.isAvailable) {
      try {
        const accounts = await provider.getAccounts()
        if (accounts && accounts.length > 0) {
          setWalletConnected(true)
          setWalletAddress(accounts[0])
        }
      } catch (error) {
        console.log('No wallet connected')
      }
    }
  }

  const waitForWallet = async (maxAttempts = 10) => {
    for (let i = 0; i < maxAttempts; i++) {
      if (window.keeta && window.keeta.isKeeta && window.keeta.isAvailable) {
        return window.keeta
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return null
  }

  const connectWallet = async () => {
    if (typeof window === 'undefined') return
    
    // Wait for wallet to be available (give extension time to inject)
    const provider = await waitForWallet()
    
    if (!provider) {
      const retry = confirm(
        'Keythings Wallet not detected.\n\n' +
        'If you have the extension installed, please refresh the page.\n\n' +
        'Otherwise, click OK to visit the installation page.'
      )
      if (retry) {
        window.open('https://docs.keythings.xyz/docs/introduction', '_blank')
      }
      return
    }

    try {
      console.log('🔄 Requesting wallet connection...')
      
      // Request connection
      const accounts = await provider.requestAccounts()
      if (accounts && accounts.length > 0) {
        setWalletConnected(true)
        setWalletAddress(accounts[0])
        console.log('✅ Connected to Keythings Wallet:', accounts[0])
        
        // Get network info
        try {
          const network = await provider.getNetwork()
          console.log('📊 Current network:', network.name, '(Chain ID:', network.chainId + ')')
        } catch (networkError) {
          console.log('Network info not available')
        }
      }
    } catch (error) {
      console.error('Connection failed:', error)
      if (error.message.includes('User rejected') || error.message.includes('rejected')) {
        alert('Connection request rejected. Please approve the connection in your wallet.')
      } else {
        alert('Failed to connect wallet. Please try again.')
      }
    }
  }

  const disconnectWallet = () => {
    setWalletConnected(false)
    setWalletAddress(null)
  }

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const linkClass = (href) =>
    `px-3 py-1.5 rounded-full text-sm transition ${pathname.startsWith(href) ? "bg-white/10 text-foreground" : "text-foreground/90 hover:bg-white/5"}`
  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm hairline-b"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-3 items-center">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-lg tracking-tight font-semibold text-foreground">Keythings Wallet</span>
          </Link>
        </div>
        <div className="flex items-center justify-center">
          <SearchBar />
        </div>
        <div className="flex items-center justify-end gap-3 flex-shrink-0">
          <a
            href="https://x.com/twatter_army"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
            className="inline-flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-full hover:bg-white/5 text-foreground/90"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <path d={siX.path} />
            </svg>
          </a>
          <a
            href="https://discord.gg/twatter"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Discord"
            className="inline-flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-full hover:bg-white/5 text-foreground/90"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <path d={siDiscord.path} />
            </svg>
          </a>
          <ThemeToggle />
          <a 
            href="https://docs.keythings.xyz/docs/introduction" 
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Documentation"
            className="inline-flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-full hover:bg-white/5 text-foreground/90 max-[519px]:hidden"
          >
            <BookOpen className="w-5 h-5" />
          </a>
          <button
            type="button"
            onClick={walletConnected ? disconnectWallet : connectWallet}
            className="px-4 py-2 flex-shrink-0 rounded-full bg-white/10 hover:bg-white/20 hover:shadow-lg hover:shadow-white/10 text-foreground text-sm font-medium transition-all duration-200 max-[519px]:hidden [html[data-theme='light']_&]:border [html[data-theme='light']_&]:border-gray-300 [html[data-theme='light']_&]:hover:shadow-gray-300/50"
          >
            {walletConnected ? formatAddress(walletAddress) : 'Connect Wallet'}
          </button>
          <button
            type="button"
            aria-label="Open menu"
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/5 text-foreground/90"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      {mounted && createPortal(
        (
          <AnimatePresence>
            {mobileOpen && (
              <>
                <motion.button
                  aria-label="Close menu"
                  className="fixed inset-0 z-[100] bg-black/0 sm:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.45 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setMobileOpen(false)}
                />
                <motion.div
                  className="fixed inset-y-0 right-0 z-[101] w-80 max-w-[85vw] bg-[#0b0b0b] shadow-2xl hairline-l sm:hidden p-4"
                  initial={{ x: 320 }}
                  animate={{ x: 0 }}
                  exit={{ x: 320 }}
                  transition={{ type: "spring", stiffness: 420, damping: 40 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[--color-muted]">Menu</span>
                    <button
                      aria-label="Close"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/5"
                      onClick={() => setMobileOpen(false)}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid gap-2">
                    <a 
                      href="https://docs.keythings.xyz/docs/introduction" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition bg-white/10 text-foreground hover:bg-white/15"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Docs</span>
                    </a>
                    <button
                      type="button"
                      onClick={walletConnected ? disconnectWallet : connectWallet}
                      className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 hover:shadow-lg hover:shadow-white/10 text-foreground text-sm font-medium transition-all duration-200 text-left [html[data-theme='light']_&]:border [html[data-theme='light']_&]:border-gray-300 [html[data-theme='light']_&]:hover:shadow-gray-300/50"
                    >
                      {walletConnected ? formatAddress(walletAddress) : 'Connect Wallet'}
                    </button>
                    <div className="flex items-center gap-3 pt-2">
                      <a href="https://x.com/twatter_army" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/5 text-foreground/90">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d={siX.path} /></svg>
                      </a>
                      <a href="https://discord.gg/twatter" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/5 text-foreground/90">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d={siDiscord.path} /></svg>
                      </a>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        ),
        document.body
      )}
    </motion.nav>
  )
}


