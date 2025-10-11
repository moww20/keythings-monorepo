"use client";

import React from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from "lucide-react";

import type { ProcessedToken } from "../lib/token-utils";

interface KtaPriceData {
  usd: number;
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
}

export default function EstimatedBalance({
  balance,
  onReceive,
  onSend,
  onTransfer,
  tokens = [],
  ktaPriceData = null,
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

  return (
    <div className="mb-8 glass rounded-lg p-6 border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Estimated Balance</h2>
          <button className="p-1">
            <svg className="h-5 w-5 text-muted" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
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

        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={onReceive}
            className="inline-flex items-center justify-center gap-2 bg-accent text-white px-6 py-2.5 rounded-md font-medium hover:bg-accent/90 hover:shadow-lg transition-all duration-200 min-w-[120px]"
          >
            <ArrowDownLeft className="h-4 w-4" />
            Receive
          </button>
          <button 
            onClick={onSend}
            className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong hover:border-soft transition-all duration-200 min-w-[120px]"
          >
            <ArrowUpRight className="h-4 w-4" />
            Send
          </button>
          <button 
            onClick={onTransfer}
            className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong hover:border-soft transition-all duration-200 min-w-[120px]"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
