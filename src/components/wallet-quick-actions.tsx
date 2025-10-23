import { Send, Download, ArrowLeftRight, Plus, History, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
  return (
    <Card className="@container/card h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Recent Activity</CardTitle>
        <CardDescription>Latest transactions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span>Received 0.5 ETH</span>
            </div>
            <span className="text-muted-foreground">2h ago</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500"></div>
              <span>Sent 100 USDC</span>
            </div>
            <span className="text-muted-foreground">5h ago</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span>Swapped BTC → ETH</span>
            </div>
            <span className="text-muted-foreground">1d ago</span>
          </div>
        </div>
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
