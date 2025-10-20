"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  IconWallet,
  IconCoins,
  IconChartBar,
  IconDashboard,
  IconHistory,
  IconSettings,
  IconHelp,
  IconShield,
  IconSend,
  IconReceipt,
  IconTrendingUp,
  IconUser,
  IconKey,
  IconDatabase,
  IconMail,
  IconWorld,
  IconFileText,
} from "@tabler/icons-react"
import { BookOpen } from "lucide-react"
import { siX, siDiscord } from "simple-icons"

import SearchBar from "@/app/components/SearchBar"
import ThemeToggle from "@/app/components/ThemeToggle"
import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavTransactions } from "@/components/nav-transactions"
import { NavUser } from "@/components/nav-user"
import type { KeetaProvider } from "@/types/keeta"
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
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Tokens",
      url: "/tokens",
      icon: IconCoins,
    },
    {
      title: "Explorer",
      url: "/explorer",
      icon: IconTrendingUp,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: IconChartBar,
    },
    {
      title: "History",
      url: "/history",
      icon: IconHistory,
    },
  ],
  navTransactions: [
    {
      name: "Send",
      icon: IconSend,
      url: "/send",
    },
    {
      name: "Receive",
      icon: IconReceipt,
      url: "/receive",
    },
    {
      name: "OTC Swap",
      icon: IconTrendingUp,
      url: "/otc-swap",
    },
  ],
  navSecondary: [
    {
      title: "Security",
      url: "/security",
      icon: IconShield,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: IconSettings,
    },
    {
      title: "Help",
      url: "/help",
      icon: IconHelp,
    },
  ],
  documents: [
    {
      name: "Feed",
      url: "/feed",
      icon: IconTrendingUp,
    },
    {
      name: "Messages",
      url: "/messages",
      icon: IconMail,
    },
    {
      name: "World Chat",
      url: "/world-chat",
      icon: IconWorld,
    },
    {
      name: "Articles",
      url: "/articles",
      icon: IconFileText,
    },
    {
      name: "Profile",
      url: "/profile",
      icon: IconUser,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const wallet = useWallet()
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  const redirectToDashboard = useCallback(() => {
    if (typeof window === "undefined") return
    if (window.location.pathname === "/" || window.location.pathname === "") {
      router.push("/dashboard")
    }
  }, [router])

  const waitForWallet = useCallback(async (maxAttempts = 20): Promise<KeetaProvider | null> => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (typeof window.keeta !== "undefined" && window.keeta) {
        return window.keeta
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return null
  }, [])

  const connectWallet = useCallback(async () => {
    try {
      await wallet.connectWallet()
      redirectToDashboard()
    } catch (error) {
      console.error("Connection failed:", error)
      if (
        error instanceof Error
        && (error.message.includes("User rejected") || error.message.includes("rejected"))
      ) {
        Toast.warning("Connection request rejected. Please approve the connection in your wallet.")
      } else {
        Toast.error("Failed to connect wallet. Please try again.")
      }
    }
  }, [wallet, redirectToDashboard])

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

  const hydratedWalletConnected = hasHydrated && wallet.isConnected
  const hydratedWalletAddress = hasHydrated ? wallet.publicKey : null

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="gap-4">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-[color:var(--background)]/60 px-2 py-2">
          <Link href="/dashboard" className="flex items-center gap-2 text-foreground">
            <IconWallet className="h-5 w-5" />
            <span className="text-base font-semibold">Keythings Wallet</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="w-full">
          <SearchBar />
        </div>


        <div />
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavTransactions items={data.navTransactions} />
        <NavDocuments items={data.documents} />
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
                href="/docs/introduction"
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
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
