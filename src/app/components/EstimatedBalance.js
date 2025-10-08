'use client';

import { ArrowDownToLine, ArrowUpFromLine, Banknote } from 'lucide-react';

export default function EstimatedBalance({ 
  balance, 
  isConnecting, 
  onConnect, 
  onDeposit, 
  onWithdraw, 
  onCashIn 
}) {
  const formatBalance = (balance) => {
    if (balance === null) return '0.00';
    return (Number(balance) / 10 ** 18).toFixed(2);
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
            <span className="text-3xl font-bold text-foreground">
              {formatBalance(balance)}
            </span>
            <span className="text-lg text-muted">KTA</span>
            <svg className="h-4 w-4 text-muted" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </div>
          <div className="text-sm text-muted mb-2">
            ~ $237.65
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
            onClick={onDeposit}
            className="inline-flex items-center justify-center gap-2 bg-accent text-white px-6 py-2.5 rounded-md font-medium hover:bg-accent/90 transition-colors min-w-[120px]"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Deposit
          </button>
          <button 
            onClick={onWithdraw}
            className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong transition-colors min-w-[120px]"
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Withdraw
          </button>
          <button 
            onClick={onCashIn}
            className="inline-flex items-center justify-center gap-2 bg-surface border border-hairline text-foreground px-6 py-2.5 rounded-md font-medium hover:bg-surface-strong transition-colors min-w-[120px]"
          >
            <Banknote className="h-4 w-4" />
            Cash In
          </button>
        </div>
      </div>
    </div>
  );
}
