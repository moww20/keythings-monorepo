"use client"

import { useCallback, useMemo, useState } from "react"

import {
  IconCreditCard,
  IconDotsVertical,
  IconLogout,
  IconNotification,
  IconUserCircle,
} from "@tabler/icons-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
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
}

export function NavUser({
  user,
  walletConnected = false,
  walletAddress = null,
  onConnectWallet,
  onDisconnectWallet,
  formatAddress,
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
          {walletConnected ? (
            // Connected state: show user info and dropdown
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg text-sm font-semibold uppercase">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">
                      {user.name}
                    </span>
                    <span className="text-xs text-muted">
                      {statusLine}
                    </span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface"
                        aria-label="Wallet actions"
                      >
                        <IconDotsVertical className="h-4 w-4" />
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
                          <IconUserCircle />
                          Account
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <IconCreditCard />
                          Billing
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <IconNotification />
                          Notifications
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault()
                          void handlePrimaryAction()
                        }}
                      >
                        <IconLogout />
                        Disconnect wallet
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ) : (
            // Disconnected state: show only connect button
            <div className="flex flex-col items-center gap-3">
              <div className="text-center">
                <p className="text-sm text-muted mb-2">
                  Connect your wallet to get started
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handlePrimaryAction()
                }}
                disabled={isProcessing || !onConnectWallet}
                className="inline-flex w-full items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-[color:var(--background)] transition disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90"
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
