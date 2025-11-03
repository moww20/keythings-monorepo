"use client"

import React, { useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Wallet, Coins, BarChart3, LayoutDashboard, History, Settings, HelpCircle, Send, Download, ArrowLeftRight, TrendingUp, User, Key, Database, Mail, Globe2, FileText } from "lucide-react"
import { BookOpen } from "lucide-react"
import { siX, siDiscord } from "simple-icons"

import SearchBar from "@/app/components/SearchBar"
import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavTransactions } from "@/components/nav-transactions"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import Toast from "@/app/components/Toast"
import { useWallet } from "@/app/contexts/WalletContext"

const data = {
  user: {
    name: "Wallet User",
    email: "user@keeta.network",
    avatar: "/icons/TLEOfKos_400x400.jpg",
  },
  navPortfolio: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "History",
      url: "/history",
      icon: History,
    },
  ],
  navNetwork: [
    {
      title: "Network Explorer",
      url: "/explorer",
      icon: TrendingUp,
    },
    {
      title: "Token Sniffer",
      url: "/tokens",
      icon: Coins,
    },
    {
      title: "Network Analytics",
      url: "/analytics",
      icon: BarChart3,
      disabled: true,
    },
  ],
  navTransactions: [
    {
      name: "Send",
      icon: Send,
      url: "/send",
    },
    {
      name: "Receive",
      icon: Download,
      url: "/receive",
      disabled: true,
    },
    {
      name: "Request for Quote",
      icon: ArrowLeftRight,
      url: "/trade",
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
    {
      title: "About Us",
      url: "/about",
      icon: HelpCircle,
    },
  ],
  documents: [
    {
      name: "Feed",
      url: "/feed",
      icon: TrendingUp,
      disabled: true,
    },
    {
      name: "Messages",
      url: "/messages",
      icon: Mail,
      disabled: true,
    },
    {
      name: "World Chat",
      url: "/world-chat",
      icon: Globe2,
      disabled: true,
    },
    {
      name: "Articles",
      url: "/articles",
      icon: FileText,
      disabled: true,
    },
    {
      name: "Profile",
      url: "/profile",
      icon: User,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const walletContext = useWallet()
  const walletState = walletContext.wallet

  const redirectToDashboard = useCallback(() => {
    if (typeof window === "undefined") return
    if (window.location.pathname === "/" || window.location.pathname === "") {
      router.push("/dashboard")
    }
  }, [router])

  const connectWallet = useCallback(async () => {
    try {
      // Connect wallet and automatically request read capabilities for explorer functionality
      await walletContext.connectWallet(true) // Pass true to request read capabilities
      redirectToDashboard()
    } catch (error) {
      console.error("Connection failed:", error)
      if (
        error instanceof Error
        && (error.message.includes("User rejected") || error.message.includes("rejected"))
      ) {
        Toast.warning("Connection request rejected. Please approve the connection in your wallet.")
      } else if (
        error instanceof Error
        && error.message.includes("Wallet is locked")
      ) {
        Toast.warning("Wallet is locked. Please unlock your wallet first.")
      } else if (
        error instanceof Error
        && error.message.includes("No accounts found")
      ) {
        Toast.warning("No accounts found. Please ensure your wallet is unlocked and has accounts.")
      } else {
        Toast.error("Failed to connect wallet. Please try again.")
      }
    }
  }, [walletContext, redirectToDashboard])

  const disconnectWallet = useCallback(() => {
    // The wallet context handles disconnection automatically
    // No need for local state management
  }, [])

  const formatAddress = useCallback((address: string | null): string => {
    if (!address) return ""
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }, [])

  // Wallet connection state is now managed by the centralized wallet context

  const isDocsRoute = pathname.startsWith("/docs")

  const isWalletLoading = walletContext.isLoading || walletState.isInitializing
  const hydratedWalletConnected = !isWalletLoading && walletState.connected && !walletState.isLocked
  const hydratedWalletAddress = walletState.connected ? walletContext.publicKey : null
  const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.keythings.xyz"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="gap-4">
        <div className="flex items-center justify-start gap-3 rounded-lg bg-[color:var(--background)]/60 px-2 py-2">
          <Link href="/dashboard" className="flex items-center gap-2 text-foreground">
            <Wallet className="h-5 w-5" />
            <span className="text-base font-semibold">Keythings Wallet</span>
          </Link>
        </div>

        <div className="w-full">
          <SearchBar />
        </div>


        <div />
      </SidebarHeader>

      <SidebarContent>
        <div className="px-2 py-1">
          <h2 className="mb-2 text-xs font-semibold text-muted tracking-wider">My Wallet</h2>
          <NavMain items={data.navPortfolio} />
        </div>
        <div className="px-2 py-1">
          <h2 className="mb-2 text-xs font-semibold text-muted tracking-wider">Network</h2>
          <NavMain items={data.navNetwork} />
        </div>
        <div className="px-2 py-1">
          <h2 className="mb-2 text-xs font-semibold text-muted tracking-wider">Transactions</h2>
          <NavTransactions items={data.navTransactions} />
        </div>
        <div className="px-2 py-1">
          <h2 className="mb-2 text-xs font-semibold text-muted tracking-wider">Social</h2>
          <NavDocuments items={data.documents} />
        </div>
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col gap-4">
          {/* Social Icons and Docs */}
          <div className="flex items-center justify-center gap-2">
            <a
              href="https://x.com/keythings"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/85 transition hover:bg-surface"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true">
                <path d={siX.path} />
              </svg>
            </a>
            <a
              href="https://discord.gg/keythings"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/85 transition hover:bg-surface"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true">
                <path d={siDiscord.path} />
              </svg>
            </a>
            {!isDocsRoute && (
              <Link
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/85 transition hover:bg-surface"
                aria-label="Documentation"
              >
                <BookOpen className="h-4 w-4" />
              </Link>
            )}
          </div>
          
          <NavUser
            user={data.user}
            walletConnected={hydratedWalletConnected}
            walletAddress={hydratedWalletAddress}
            onConnectWallet={connectWallet}
            onDisconnectWallet={disconnectWallet}
            formatAddress={formatAddress}
            isLoading={isWalletLoading}
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
