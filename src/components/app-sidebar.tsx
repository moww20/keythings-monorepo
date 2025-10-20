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
      name: "Portfolio",
      icon: IconTrendingUp,
      url: "/portfolio",
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
      name: "Backup & Recovery",
      url: "/backup",
      icon: IconDatabase,
    },
    {
      name: "Private Keys",
      url: "/keys",
      icon: IconKey,
    },
    {
      name: "Account Info",
      url: "/account",
      icon: IconUser,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
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
    if (typeof window === "undefined") return

    const provider = await waitForWallet()

    if (!provider) {
      const retry = window.confirm(
        "Keythings Wallet not detected.\n\n"
          + "If you have the extension installed, please refresh the page.\n\n"
          + "Otherwise, click OK to visit the installation page.",
      )
      if (retry) {
        window.open("https://docs.keythings.xyz/docs/introduction", "_blank")
      }
      return
    }

    try {
      const accounts = await provider.requestAccounts()
      if (accounts && accounts.length > 0) {
        setWalletConnected(true)
        setWalletAddress(accounts[0] ?? null)
        redirectToDashboard()
      }
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
  }, [redirectToDashboard, waitForWallet])

  const disconnectWallet = useCallback(() => {
    setWalletConnected(false)
    setWalletAddress(null)
    if (typeof window !== "undefined" && window.keeta) {
      console.log("Wallet disconnected from app")
    }
  }, [])

  const formatAddress = useCallback((address: string | null): string => {
    if (!address) return ""
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }, [])

  const checkWalletConnection = useCallback(async () => {
    if (typeof window === "undefined") return
    if (typeof window.keeta === "undefined") return

    try {
      const accounts = await window.keeta.getAccounts()
      if (accounts && accounts.length > 0) {
        setWalletConnected(true)
        setWalletAddress(accounts[0] ?? null)
        redirectToDashboard()
      }
    } catch (error) {
      console.log("No wallet connected", error)
    }
  }, [redirectToDashboard])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void checkWalletConnection()
    }, 800)

    let detachListeners: (() => void) | undefined

    if (typeof window !== "undefined" && window.keeta) {
      const provider = window.keeta

      const handleAccountsChanged = (...args: unknown[]) => {
        const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : []
        if (accounts.length > 0) {
          setWalletConnected(true)
          setWalletAddress(accounts[0] ?? null)
          redirectToDashboard()
        } else {
          setWalletConnected(false)
          setWalletAddress(null)
        }
      }

      const handleDisconnect = () => {
        setWalletConnected(false)
        setWalletAddress(null)
      }

      provider.on?.("accountsChanged", handleAccountsChanged)
      provider.on?.("disconnect", handleDisconnect)

      detachListeners = () => {
        const remove = provider.removeListener?.bind(provider)
        if (remove) {
          remove("accountsChanged", handleAccountsChanged)
          remove("disconnect", handleDisconnect)
        }
      }
    }

    return () => {
      window.clearTimeout(timeoutId)
      detachListeners?.()
    }
  }, [checkWalletConnection, redirectToDashboard])

  const isDocsRoute = pathname.startsWith("/docs")

  const hydratedWalletConnected = hasHydrated && walletConnected
  const hydratedWalletAddress = hasHydrated ? walletAddress : null

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
                className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-surface"
              >
                <BookOpen className="h-4 w-4" />
                Docs
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
