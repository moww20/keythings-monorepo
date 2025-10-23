"use client"

import { useCallback, useMemo, useState } from "react"

import { CreditCard, LogOut, Bell, UserCircle } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

type NavUserProps = {
  user: {
    name: string
    email: string
    avatar: string
  }
  walletConnected?: boolean
  walletAddress?: string | null
  onConnectWallet?: () => void | Promise<void>
  onDisconnectWallet?: () => void | Promise<void>
  formatAddress?: (address: string | null) => string
  isLoading?: boolean
}

export function NavUser({
  user,
  walletConnected = false,
  walletAddress = null,
  onConnectWallet,
  onDisconnectWallet,
  formatAddress,
  isLoading = false,
}: NavUserProps) {
  const { isMobile } = useSidebar()
  const [isProcessing, setIsProcessing] = useState(false)

  const initials = useMemo(() => {
    const name = user?.name ?? ""
    if (!name) return "WU"
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }, [user?.name])

  const formattedAddress = formatAddress?.(walletAddress) ?? walletAddress ?? ""

  const statusLine = walletConnected
    ? formattedAddress || "Connected"
    : "Connect your wallet to get started"

  const handlePrimaryAction = useCallback(async () => {
    const action = walletConnected ? onDisconnectWallet : onConnectWallet
    if (!action || isProcessing) return

    try {
      setIsProcessing(true)
      await Promise.resolve(action())
    } finally {
      setIsProcessing(false)
    }
  }, [walletConnected, onConnectWallet, onDisconnectWallet, isProcessing])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="glass rounded-lg border border-hairline p-3 shadow-[0_12px_32px_rgba(6,7,10,0.35)]">
          {isLoading ? (
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
            </div>
          ) : walletConnected ? (
            // Connected state: show user info and dropdown
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg text-left text-foreground outline-none transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  aria-label="Wallet actions"
                >
                  <Avatar className="h-10 w-10 rounded-lg">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg text-sm font-semibold uppercase">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex flex-1 items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">
                        {user.name}
                      </span>
                      <span className="text-xs text-muted">
                        {statusLine}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-muted">Manage</span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="rounded-lg uppercase">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium text-foreground">{user.name}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {statusLine}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <UserCircle />
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <CreditCard />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Bell />
                    Bells
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    void handlePrimaryAction()
                  }}
                >
                  <LogOut />
                  Disconnect wallet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // Disconnected state: show only connect button
            <div className="flex flex-col gap-3 text-center">
              <p className="text-sm text-muted">
                Connect your wallet to get started
              </p>
              <button
                type="button"
                onClick={() => {
                  void handlePrimaryAction()
                }}
                disabled={isProcessing || !onConnectWallet}
                className="inline-flex w-full items-center justify-center rounded-full border border-hairline bg-accent px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:border-hairline-strong hover:bg-accent/90 hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isProcessing ? "Please wait..." : "Connect Wallet"}
              </button>
            </div>
          )}
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
