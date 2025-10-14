'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Droplets, Info, AlertCircle, TrendingUp } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';

interface AddLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pool: {
    id: string;
    token_a: string;
    token_b: string;
    reserve_a: string;
    reserve_b: string;
    pool_type: string;
    fee_rate: string;
  } | null;
}

export default function AddLiquidityModal({ isOpen, onClose, onSuccess, pool }: AddLiquidityModalProps) {
  const { tokens, publicKey } = useWallet(); // Get wallet address and tokens
  const [amountA, setAmountA] = useState<string>('');
  const [amountB, setAmountB] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slippage, setSlippage] = useState<number>(0.5);

  // Get user balances for the pool tokens
  const tokenABalance = useMemo(() => {
    if (!pool) return '0';
    const token = tokens.find(t => t.ticker === pool.token_a || t.name === pool.token_a);
    return token?.formattedAmount || '0';
  }, [tokens, pool]);

  const tokenBBalance = useMemo(() => {
    if (!pool) return '0';
    const token = tokens.find(t => t.ticker === pool.token_b || t.name === pool.token_b);
    return token?.formattedAmount || '0';
  }, [tokens, pool]);

  // Reset form when modal closes or pool changes
  useEffect(() => {
    if (!isOpen) {
      setAmountA('');
      setAmountB('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, pool]);

  if (!isOpen || !pool) return null;

  const currentPrice = parseFloat(pool.reserve_b) / parseFloat(pool.reserve_a);

  // Auto-calculate amountB when amountA changes
  const handleAmountAChange = (value: string) => {
    setAmountA(value);
    if (value && parseFloat(value) > 0) {
      const calculatedB = parseFloat(value) * currentPrice;
      setAmountB(calculatedB.toFixed(6));
    } else {
      setAmountB('');
    }
  };

  // Auto-calculate amountA when amountB changes
  const handleAmountBChange = (value: string) => {
    setAmountB(value);
    if (value && parseFloat(value) > 0) {
      const calculatedA = parseFloat(value) / currentPrice;
      setAmountA(calculatedA.toFixed(6));
    } else {
      setAmountA('');
    }
  };

  const calculateShare = () => {
    if (!amountA || !amountB) return '0';
    const a = parseFloat(amountA);
    const b = parseFloat(amountB);
    const reserveA = parseFloat(pool.reserve_a);
    const reserveB = parseFloat(pool.reserve_b);
    
    const share = ((a / reserveA) + (b / reserveB)) / 2 * 100;
    return share.toFixed(4);
  };

  const handleAddLiquidity = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Ensure wallet is connected
      if (!publicKey) {
        throw new Error('Wallet not connected. Please connect your Keeta wallet first.');
      }

      const minAmountA = (parseFloat(amountA) * (100 - slippage) / 100).toFixed(6);
      const minAmountB = (parseFloat(amountB) * (100 - slippage) / 100).toFixed(6);

      const response = await fetch('http://localhost:8080/api/pools/add-liquidity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: publicKey,  // Send real wallet address
          pool_id: pool.id,
          amount_a_desired: amountA,
          amount_b_desired: amountB,
          amount_a_min: minAmountA,
          amount_b_min: minAmountB,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add liquidity');
      }

      const result = await response.json();
      console.log('Liquidity added:', result);
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error adding liquidity:', err);
      setError(err instanceof Error ? err.message : 'Failed to add liquidity. Is the backend running?');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = amountA && amountB && parseFloat(amountA) > 0 && parseFloat(amountB) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)] w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-hairline">
          <div className="flex items-center gap-3">
            <Droplets className="h-6 w-6 text-accent" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Add Liquidity</h2>
              <p className="text-sm text-muted">{pool.token_a}/{pool.token_b}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            </div>
          )}

          {/* Current Pool Info */}
          <div className="mb-6 p-4 rounded-lg bg-surface border border-hairline">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted">Current Price</span>
              <span className="text-sm font-medium text-foreground">
                1 {pool.token_a} = {currentPrice.toFixed(6)} {pool.token_b}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Pool Reserves</span>
              <span className="text-xs text-muted">
                {parseFloat(pool.reserve_a).toLocaleString()} {pool.token_a} + {parseFloat(pool.reserve_b).toLocaleString()} {pool.token_b}
              </span>
            </div>
          </div>

          {/* Amount Inputs */}
          <div className="space-y-4 mb-6">
            {/* Token A Amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">
                  {pool.token_a} Amount
                </label>
                <span className="text-xs text-muted">
                  Balance: {parseFloat(tokenABalance).toLocaleString()}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={amountA}
                  onChange={(e) => handleAmountAChange(e.target.value)}
                  placeholder="0.0"
                  max={tokenABalance}
                  className="w-full px-4 py-3 rounded-lg border border-hairline bg-surface text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAmountAChange(tokenABalance)}
                    className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                  >
                    MAX
                  </button>
                  <span className="text-sm font-medium text-muted">{pool.token_a}</span>
                </div>
              </div>
            </div>

            {/* Plus Icon */}
            <div className="flex justify-center">
              <div className="h-8 w-8 rounded-full bg-surface border border-hairline flex items-center justify-center text-muted">
                +
              </div>
            </div>

            {/* Token B Amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">
                  {pool.token_b} Amount
                </label>
                <span className="text-xs text-muted">
                  Balance: {parseFloat(tokenBBalance).toLocaleString()}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={amountB}
                  onChange={(e) => handleAmountBChange(e.target.value)}
                  placeholder="0.0"
                  max={tokenBBalance}
                  className="w-full px-4 py-3 rounded-lg border border-hairline bg-surface text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAmountBChange(tokenBBalance)}
                    className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                  >
                    MAX
                  </button>
                  <span className="text-sm font-medium text-muted">{pool.token_b}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          {canSubmit && (
            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-lg bg-surface border border-hairline space-y-3">
                <h3 className="text-sm font-medium text-muted mb-3">Summary</h3>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Your {pool.token_a}</span>
                  <span className="text-sm font-medium text-foreground">{parseFloat(amountA).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Your {pool.token_b}</span>
                  <span className="text-sm font-medium text-foreground">{parseFloat(amountB).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-hairline">
                  <span className="text-sm text-muted">Share of Pool</span>
                  <span className="text-sm font-medium text-accent">+{calculateShare()}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Slippage Tolerance</span>
                  <span className="text-sm font-medium text-foreground">{slippage}%</span>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-muted leading-relaxed">
                    You&apos;ll receive LP tokens proportional to your share. LP tokens earn {parseFloat(pool.fee_rate) * 100}% fees from all swaps.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Slippage Settings */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-3">
              Slippage Tolerance
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[0.1, 0.5, 1.0].map((value) => (
                <button
                  key={value}
                  onClick={() => setSlippage(value)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    slippage === value
                      ? 'bg-accent text-white'
                      : 'bg-surface border border-hairline text-foreground hover:bg-surface-strong'
                  }`}
                >
                  {value}%
                </button>
              ))}
              <input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
                placeholder="Custom"
                className="px-3 py-2 rounded-md border border-hairline bg-surface text-foreground text-sm text-center focus:border-accent focus:outline-none"
                step="0.1"
                min="0.1"
                max="50"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-hairline bg-surface/30">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-md font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleAddLiquidity}
            disabled={!canSubmit || isSubmitting}
            className="px-6 py-2.5 rounded-md font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding...
              </>
            ) : (
              <>
                <Droplets className="h-4 w-4" />
                Add Liquidity
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

