"use client"

import { IconTrendingUp } from "@tabler/icons-react"

import EstimatedBalance, { type EstimatedBalanceProps, type KtaPriceData } from "@/app/components/EstimatedBalance"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { QuickActionsCard, RecentActivityCard } from "@/components/wallet-quick-actions"

interface SectionCardsProps {
  estimatedBalance: EstimatedBalanceProps
  tokensCount: number
  ktaPriceData?: KtaPriceData | null
}

export function SectionCards({ estimatedBalance, tokensCount, ktaPriceData }: SectionCardsProps) {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <div data-slot="card" className="@container/card">
        <EstimatedBalance {...estimatedBalance} className="h-full" />
      </div>
      <KtaSummaryCard ktaPriceData={ktaPriceData} tokensCount={tokensCount} />
      <QuickActionsCard />
      <RecentActivityCard />
    </div>
  )
}

function formatMetric(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return "--";
  }
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function KtaSummaryCard({
  ktaPriceData,
  tokensCount,
}: {
  ktaPriceData?: KtaPriceData | null
  tokensCount: number
}) {
  const price = ktaPriceData?.usd;
  const marketCap = ktaPriceData?.usd_market_cap;
  const volume = ktaPriceData?.usd_24h_vol;
  const change = ktaPriceData?.usd_24h_change;

  return (
    <Card className="@container/card h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">KTA Summary</CardTitle>
            <CardDescription>Network token performance</CardDescription>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <IconTrendingUp className="h-4 w-4" />
            <span>Live</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">Market Cap</span>
            <div className="text-foreground font-semibold text-base">{formatMetric(marketCap)}</div>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">Price</span>
            <div className="text-foreground font-semibold text-base">
              {price === undefined ? "--" : `$${price.toFixed(4)}`}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">24h Vol</span>
            <div className="text-foreground font-semibold text-base">{formatMetric(volume)}</div>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">24h Change</span>
            <div
              className={`font-semibold text-base ${
                typeof change === "number"
                  ? change >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                  : "text-foreground"
              }`}
            >
              {typeof change === "number" ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "--"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
