"use client";

import React from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, TrendingUp, AlertCircle } from "lucide-react";

import type { ProcessedToken } from "../lib/token-utils";

interface KtaPriceData {
  usd: number;
  usd_market_cap?: number;
  usd_24h_vol?: number;
}

interface EstimatedBalanceProps {
  balance: string | number | bigint | null;
  isConnecting?: boolean;
  onConnect?: () => void;
  onReceive?: () => void;
  onSend?: () => void;
  onTransfer?: () => void;
  tokens?: ProcessedToken[];
  ktaPriceData?: KtaPriceData | null;
  // Trading status props (for display only)
  isTradingEnabled?: boolean;
  tradingError?: string | null;
}

export default function EstimatedBalance({
  balance,
  onReceive,
  onSend,
  onTransfer,
  tokens = [],
  ktaPriceData = null,
  isTradingEnabled = false,
  tradingError = null,
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
    <div className="mb-2 glass rounded-lg p-4 border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Estimated Balance</h2>
          <button className="p-1" aria-label="Toggle balance visibility">
            <svg className="h-5 w-5 text-muted" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
        
        {/* Market Cap and Volume */}
        {ktaPriceData && (ktaPriceData.usd_market_cap || ktaPriceData.usd_24h_vol) && (
          <div className="flex items-center gap-4 text-sm text-muted">
            {ktaPriceData.usd_market_cap && (
              <span>MC: ${formatLargeNumber(ktaPriceData.usd_market_cap)}</span>
            )}
            {ktaPriceData.usd_24h_vol && (
              <span>24h Vol: ${formatLargeNumber(ktaPriceData.usd_24h_vol)}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            {balance === null ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-lg text-muted">Connecting...</span>
              </div>
            ) : (
              <>
                <span className="text-3xl font-bold text-foreground">
                  {calculateKtaEquivalent()}
                </span>
                <span className="text-lg text-muted">KTA</span>
                <svg className="h-4 w-4 text-muted" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </>
            )}
          </div>
          <div className="text-sm text-muted mb-2">
            ~ ${calculateTotalUsdValue().toFixed(2)}
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted">Today&apos;s PnL</span>
            <span className="text-red-500">-$0.18(0.02%)</span>
            <svg className="h-4 w-4 text-muted" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* Trading Error Message */}
          {tradingError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-500">{tradingError}</p>
            </div>
          )}
          
          {/* Trading Status Banner */}
          {isTradingEnabled && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-500 font-medium">Trading Enabled</p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={onReceive}
              className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-surface-strong transition-colors duration-200 min-w-[120px]"
            >
              <ArrowDownLeft className="h-4 w-4" />
              Receive
            </button>
            <button 
              onClick={onSend}
              className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-surface-strong transition-colors duration-200 min-w-[120px]"
            >
              <ArrowUpRight className="h-4 w-4" />
              Send
            </button>
            <button 
              onClick={onTransfer}
              className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-surface-strong transition-colors duration-200 min-w-[120px]"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transfer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
