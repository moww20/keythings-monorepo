"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const description = "Interactive wallet analytics charts"

// Portfolio value over time data
const portfolioData = [
  { date: "2024-01-01", value: 8500, keeta: 3200, btc: 2800, eth: 1800, others: 700 },
  { date: "2024-01-02", value: 9200, keeta: 3500, btc: 3000, eth: 1900, others: 800 },
  { date: "2024-01-03", value: 8800, keeta: 3300, btc: 2900, eth: 1850, others: 750 },
  { date: "2024-01-04", value: 10500, keeta: 4000, btc: 3200, eth: 2100, others: 1200 },
  { date: "2024-01-05", value: 11200, keeta: 4200, btc: 3400, eth: 2200, others: 1400 },
  { date: "2024-01-06", value: 10800, keeta: 4100, btc: 3300, eth: 2150, others: 1250 },
  { date: "2024-01-07", value: 12450, keeta: 4500, btc: 3600, eth: 2400, others: 1950 },
  { date: "2024-01-08", value: 11800, keeta: 4300, btc: 3500, eth: 2300, others: 1700 },
  { date: "2024-01-09", value: 13200, keeta: 4800, btc: 3800, eth: 2600, others: 2000 },
  { date: "2024-01-10", value: 12800, keeta: 4600, btc: 3700, eth: 2500, others: 2000 },
  { date: "2024-01-11", value: 13500, keeta: 5000, btc: 3900, eth: 2700, others: 1900 },
  { date: "2024-01-12", value: 13100, keeta: 4800, btc: 3800, eth: 2600, others: 1900 },
  { date: "2024-01-13", value: 14200, keeta: 5200, btc: 4100, eth: 2800, others: 2100 },
  { date: "2024-01-14", value: 13800, keeta: 5000, btc: 4000, eth: 2700, others: 2100 },
  { date: "2024-01-15", value: 14500, keeta: 5300, btc: 4200, eth: 2900, others: 2100 },
  { date: "2024-01-16", value: 14100, keeta: 5100, btc: 4100, eth: 2800, others: 2100 },
  { date: "2024-01-17", value: 15200, keeta: 5500, btc: 4400, eth: 3000, others: 2300 },
  { date: "2024-01-18", value: 14800, keeta: 5300, btc: 4300, eth: 2900, others: 2300 },
  { date: "2024-01-19", value: 15500, keeta: 5600, btc: 4500, eth: 3100, others: 2300 },
  { date: "2024-01-20", value: 15100, keeta: 5400, btc: 4400, eth: 3000, others: 2300 },
  { date: "2024-01-21", value: 16200, keeta: 5800, btc: 4700, eth: 3200, others: 2500 },
  { date: "2024-01-22", value: 15800, keeta: 5600, btc: 4600, eth: 3100, others: 2500 },
  { date: "2024-01-23", value: 16500, keeta: 5900, btc: 4800, eth: 3300, others: 2500 },
  { date: "2024-01-24", value: 16100, keeta: 5700, btc: 4700, eth: 3200, others: 2500 },
  { date: "2024-01-25", value: 17200, keeta: 6100, btc: 5000, eth: 3400, others: 2700 },
  { date: "2024-01-26", value: 16800, keeta: 5900, btc: 4900, eth: 3300, others: 2700 },
  { date: "2024-01-27", value: 17500, keeta: 6200, btc: 5100, eth: 3500, others: 2700 },
  { date: "2024-01-28", value: 17100, keeta: 6000, btc: 5000, eth: 3400, others: 2700 },
  { date: "2024-01-29", value: 18200, keeta: 6400, btc: 5300, eth: 3600, others: 2900 },
  { date: "2024-01-30", value: 17800, keeta: 6200, btc: 5200, eth: 3500, others: 2900 },
]

// Token distribution data
const tokenDistributionData = [
  { name: "Keeta", value: 12450, color: "#8b5cf6" },
  { name: "Bitcoin", value: 1250, color: "#f59e0b" },
  { name: "Ethereum", value: 6250, color: "#3b82f6" },
  { name: "Others", value: 4500, color: "#10b981" },
]

// Transaction volume data
const transactionData = [
  { month: "Jan", transactions: 45, volume: 12500 },
  { month: "Feb", transactions: 52, volume: 15200 },
  { month: "Mar", transactions: 38, volume: 9800 },
  { month: "Apr", transactions: 61, volume: 18700 },
  { month: "May", transactions: 47, volume: 14200 },
  { month: "Jun", transactions: 55, volume: 16800 },
]

const chartConfig = {
  value: {
    label: "Portfolio Value",
    color: "var(--primary)",
  },
  keeta: {
    label: "Keeta",
    color: "#8b5cf6",
  },
  btc: {
    label: "Bitcoin",
    color: "#f59e0b",
  },
  eth: {
    label: "Ethereum",
    color: "#3b82f6",
  },
  others: {
    label: "Others",
    color: "#10b981",
  },
} satisfies ChartConfig

export function WalletChart() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("30d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const filteredData = portfolioData.filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date("2024-01-30")
    let daysToSubtract = 30
    if (timeRange === "7d") {
      daysToSubtract = 7
    } else if (timeRange === "90d") {
      daysToSubtract = 90
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Portfolio Analytics</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Track your portfolio performance and token distribution
          </span>
          <span className="@[540px]/card:hidden">Portfolio overview</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="90d">Last 90 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 30 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="90d" className="rounded-lg">
                Last 90 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <Tabs defaultValue="portfolio" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="portfolio" className="mt-4">
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[250px] w-full"
            >
              <AreaChart data={filteredData}>
                <defs>
                  <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-value)"
                      stopOpacity={1.0}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-value)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => {
                        return new Date(value).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      }}
                      indicator="dot"
                    />
                  }
                />
                <Area
                  dataKey="value"
                  type="natural"
                  fill="url(#fillValue)"
                  stroke="var(--color-value)"
                  stackId="a"
                />
              </AreaChart>
            </ChartContainer>
          </TabsContent>
          
          <TabsContent value="distribution" className="mt-4">
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[250px] w-full"
            >
              <PieChart>
                <Pie
                  data={tokenDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {tokenDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`$${value}`, "Value"]}
                    />
                  }
                />
              </PieChart>
            </ChartContainer>
          </TabsContent>
          
          <TabsContent value="transactions" className="mt-4">
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[250px] w-full"
            >
              <BarChart data={transactionData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [
                        name === "transactions" ? `${value} txns` : `$${value}`,
                        name === "transactions" ? "Transactions" : "Volume"
                      ]}
                    />
                  }
                />
                <Bar dataKey="transactions" fill="var(--color-keeta)" radius={4} />
                <Bar dataKey="volume" fill="var(--color-btc)" radius={4} />
              </BarChart>
            </ChartContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

