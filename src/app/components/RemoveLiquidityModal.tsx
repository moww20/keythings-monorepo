'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Droplets, Info, AlertCircle } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext'; // Import useWallet

interface RemoveLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pool: {
    id: string;
    token_a: string;
    token_b: string;
    reserve_a: string;
    reserve_b: string;
    total_lp_supply: string;
    pool_type: string;
    fee_rate: string;
  } | null;
}

export default function RemoveLiquidityModal({ isOpen, onClose, onSuccess, pool }: RemoveLiquidityModalProps) {
  const { tokens, publicKey } = useWallet(); // Get wallet address and tokens
  const [lpTokens, setLpTokens] = useState<string>('');
  const [percentage, setPercentage] = useState<number>(25);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slippage, setSlippage] = useState<number>(0.5);

  // Get user's LP token balance from wallet
  const userLpBalance = useMemo(() => {
    if (!pool) return '0';
    const lpToken = tokens.find(t => t.ticker === `LP-${pool.token_a}-${pool.token_b}` || t.name === `LP-${pool.token_a}-${pool.token_b}`);
    return lpToken?.formattedAmount || '0';
  }, [tokens, pool]);

  useEffect(() => {
    if (!isOpen) {
      setLpTokens('');
      setPercentage(25);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, pool]);

  useEffect(() => {
    if (percentage > 0) {
      const calculated = (parseFloat(userLpBalance) * percentage / 100).toFixed(0);
      setLpTokens(calculated);
    } else {
      setLpTokens('');
    }
  }, [percentage, userLpBalance]);

  if (!isOpen || !pool) return null;

  const calculateTokenAmounts = () => {
    if (!lpTokens || parseFloat(lpTokens) === 0) {
      return { amountA: '0', amountB: '0' };
    }

    const lpAmount = parseFloat(lpTokens);
    const totalSupply = parseFloat(pool.total_lp_supply);
    const share = lpAmount / totalSupply;

    const amountA = (parseFloat(pool.reserve_a) * share).toFixed(6);
    const amountB = (parseFloat(pool.reserve_b) * share).toFixed(6);

    return { amountA, amountB };
  };

  const { amountA, amountB } = calculateTokenAmounts();

  const handleRemoveLiquidity = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Ensure wallet is connected
      if (!publicKey) {
        throw new Error('Wallet not connected. Please connect your Keeta wallet first.');
      }

      const minAmountA = (parseFloat(amountA) * (100 - slippage) / 100).toFixed(6);
      const minAmountB = (parseFloat(amountB) * (100 - slippage) / 100).toFixed(6);

      const response = await fetch('http://localhost:8080/api/pools/remove-liquidity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: publicKey,  // Send real wallet address
          pool_id: pool.id,
          lp_tokens: lpTokens,
          amount_a_min: minAmountA,
          amount_b_min: minAmountB,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove liquidity');
      }

      const result = await response.json();

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error removing liquidity:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove liquidity. Is the backend running?');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = lpTokens && parseFloat(lpTokens) > 0 && parseFloat(lpTokens) <= parseFloat(userLpBalance);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)] w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-hairline">
          <div className="flex items-center gap-3">
            <Droplets className="h-6 w-6 text-accent" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Remove Liquidity</h2>
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

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* LP Balance */}
          <div className="mb-6 p-4 rounded-lg bg-surface border border-hairline">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Your LP Tokens</span>
              <span className="text-sm font-medium text-foreground">{parseFloat(userLpBalance).toLocaleString()}</span>
            </div>
          </div>

          {/* Percentage Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-3">
              Amount to Remove
            </label>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[25, 50, 75, 100].map((value) => (
                <button
                  key={value}
                  onClick={() => setPercentage(value)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    percentage === value
                      ? 'bg-accent text-white'
                      : 'bg-surface border border-hairline text-foreground hover:bg-surface-strong'
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="relative">
              <input
                type="number"
                value={lpTokens}
                onChange={(e) => {
                  setLpTokens(e.target.value);
                  const pct = (parseFloat(e.target.value) / parseFloat(userLpBalance)) * 100;
                  setPercentage(Math.min(100, Math.max(0, pct)));
                }}
                placeholder="Enter LP tokens amount"
                className="w-full px-4 py-3 rounded-lg border border-hairline bg-surface text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
                LP Tokens
              </div>
            </div>
          </div>

          {/* You Will Receive */}
          {canSubmit && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-surface border border-hairline space-y-3">
                <h3 className="text-sm font-medium text-muted mb-3">You Will Receive</h3>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">{pool.token_a}</span>
                  <span className="text-sm font-medium text-foreground">{parseFloat(amountA).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">{pool.token_b}</span>
                  <span className="text-sm font-medium text-foreground">{parseFloat(amountB).toLocaleString()}</span>
                </div>
              </div>

              {/* Warning */}
              <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-muted leading-relaxed">
                    Removing liquidity will burn your LP tokens and return the underlying assets. Make sure you understand the current price before proceeding.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-hairline bg-surface/30">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-md font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleRemoveLiquidity}
            disabled={!canSubmit || isSubmitting}
            className="px-6 py-2.5 rounded-md font-medium bg-red-500 text-white hover:bg-red-500/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Removing...
              </>
            ) : (
              <>
                <X className="h-4 w-4" />
                Remove Liquidity
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

