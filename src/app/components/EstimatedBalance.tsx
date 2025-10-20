"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, AlertCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { ProcessedToken } from "../lib/token-utils";

export interface KtaPriceData {
  usd: number;
  usd_market_cap?: number;
  usd_24h_vol?: number;
  usd_24h_change?: number;
}

export interface EstimatedBalanceProps {
  balance: string | number | bigint | null;
  isConnecting?: boolean;
  onConnect?: () => void;
  tokens?: ProcessedToken[];
  ktaPriceData?: KtaPriceData | null;
  // Trading status props (for display only)
  isTradingEnabled?: boolean;
  tradingError?: string | null;
  className?: string;
  title?: string;
}

export default function EstimatedBalance({
  balance,
  tokens = [],
  ktaPriceData = null,
  isTradingEnabled = false,
  tradingError = null,
  className,
  title = "Estimated Balance",
}: EstimatedBalanceProps): React.JSX.Element {
  const calculateTotalUsdValue = (): number => {
    if (!tokens || tokens.length === 0) return 0;

    let total = 0;

    tokens.forEach((token) => {
      // Only calculate for KTA tokens if we have price data
      if (token.ticker === "KTA" && ktaPriceData) {
        const amount = parseFloat(token.formattedAmount.replace(/,/g, ""));
        const tokenValue = amount * ktaPriceData.usd;
        total += tokenValue;
      }
      // Add logic for other tokens here when price data becomes available
    });

    return total;
  };

  // Calculate KTA equivalent of total portfolio value
  const calculateKtaEquivalent = (): string => {
    const totalUsd = calculateTotalUsdValue();

    if (!ktaPriceData || ktaPriceData.usd === 0) {
      return "0.00";
    }

    const ktaEquivalent = totalUsd / ktaPriceData.usd;

    // Format with commas
    const formatted = ktaEquivalent.toFixed(2);
    const [integerPart, decimalPart] = formatted.split(".");
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
  };

  const formatLargeNumber = (num: number): string => {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
    } else {
      return num.toFixed(2);
    }
  };

  return (
    <Card className={cn("@container/card h-full", className)}>
      <CardHeader className="pb-3">
        <div className="space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>Across all tokens and assets</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-3">
        <div className="space-y-2">
          {balance === null ? (
            <div className="flex items-center gap-2 text-muted">
              <svg className="animate-spin h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Connecting...</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-foreground">{calculateKtaEquivalent()}</span>
                <span className="text-lg text-muted-foreground">KTA</span>
              </div>
              <div className="text-sm text-muted-foreground">~ ${calculateTotalUsdValue().toFixed(2)}</div>
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Today&apos;s PnL</span>
            <span className="text-red-500">-$0.18 (0.02%)</span>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          {tradingError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-500">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm">{tradingError}</p>
            </div>
          )}

          {isTradingEnabled && (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-emerald-400">
              <TrendingUp className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm font-medium">Trading Enabled</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
