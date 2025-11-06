import { Send, Download, ArrowLeftRight, Plus, History, TrendingUp } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useWallet } from "@/app/contexts/WalletContext"
import {
  fetchRecentActivityItems,
  peekRecentActivityItems,
  type RecentActivityItem,
} from "@/lib/history/recent-activity"
import { formatRelativeTime, parseExplorerDate } from "@/app/explorer/utils/operation-format"

export function QuickActionsCard() {
  return (
    <Card className="@container/card h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Open Position</CardTitle>
        <CardDescription>Coming soon</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-center h-24 bg-surface rounded-lg border border-hairline">
          <div className="text-center">
            <TrendingUp className="h-8 w-8 text-muted mx-auto mb-2" />
            <p className="text-sm text-muted">Position management</p>
            <p className="text-xs text-faint">Feature coming soon</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RecentActivityCard() {
  const { publicKey } = useWallet()
  const [items, setItems] = useState<RecentActivityItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const RECENT_ACTIVITY_LIMIT = 3

  useEffect(() => {
    let cancelled = false

    const acct = typeof publicKey === "string" ? publicKey.trim() : ""

    if (!acct) {
      setItems([])
      setError("Connect your Keeta wallet to pull recent activity.")
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    const cached = peekRecentActivityItems(acct, { limit: RECENT_ACTIVITY_LIMIT })
    if (cached && !cancelled) {
      setItems(cached.items)
      setError(cached.items.length ? null : "No recent activity.")
      setLoading(false)
    } else {
      setLoading(true)
      setError(null)
    }

    async function load(forceRefresh: boolean) {
      try {
        const result = await fetchRecentActivityItems(acct, { limit: RECENT_ACTIVITY_LIMIT, forceRefresh })
        if (cancelled) {
          return
        }

        if (result.items.length > 0) {
          setItems(result.items)
          setError(null)
        } else {
          setItems([])
          setError("No recent activity.")
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[DASHBOARD] Failed to load recent activity", e)
          setItems([])
          setError("Unable to load recent activity.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load(!cached)

    return () => {
      cancelled = true
    }
  }, [publicKey])

  const rows = useMemo(() => {
    const toTitle = (t: string): string => {
      const up = (t || "").toUpperCase()
      if (up === "RECEIVE") return "Received"
      if (up === "SEND") return "Sent"
      if (up === "SWAP") return "Swapped"
      if (up === "SWAP_FORWARD") return "Swap Forward"
      return up.charAt(0) + up.slice(1).toLowerCase()
    }
    const dot = (t: string): string => {
      const up = (t || "").toUpperCase()
      if (up === "RECEIVE") return "bg-green-500"
      if (up === "SEND") return "bg-red-500"
      if (up === "SWAP" || up === "SWAP_FORWARD") return "bg-blue-500"
      return "bg-muted"
    }
    return items.map((it, index) => {
      const type = toTitle(it.type || "Transaction")
      const amountAndSymbol = it.formattedAmount
        ? it.formattedAmount
        : it.tokenTicker
          ? `${it.amount ?? "0"} ${it.tokenTicker}`
          : `${it.amount ?? "0"}`
      const dt = typeof it.timestampMs === "number" ? new Date(it.timestampMs) : parseExplorerDate(it.blockDate ?? null)
      const rel = formatRelativeTime(dt) ?? "just now"
      return {
        key: it.id || `${it.blockHash ?? "unknown"}:${it.timestampMs ?? Date.now()}:${index}`,
        dotClass: dot(it.type || ""),
        text: `${type} ${amountAndSymbol}`,
        age: rel,
      }
    })
  }, [items])

  return (
    <Card className="@container/card h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Recent Activity</CardTitle>
        <CardDescription>Latest transactions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : rows.length ? (
          <div className="space-y-2">
            {rows.slice(0, RECENT_ACTIVITY_LIMIT).map((row) => (
              <div key={row.key} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${row.dotClass}`}></div>
                  <span>{row.text}</span>
                </div>
                <span className="text-muted-foreground">{row.age}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{error ?? "No recent activity."}</div>
        )}
        <Button variant="outline" size="sm" className="w-full">
          <History className="mr-2 h-4 w-4" />
          View All
        </Button>
      </CardContent>
    </Card>
  )
}

export function WalletQuickActions() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <QuickActionsCard />
      <RecentActivityCard />
    </div>
  )
}
