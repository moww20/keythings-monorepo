'use client';

import { useMemo, useState } from 'react';
import { z } from 'zod';

import type { OrderRequestPayload, OrderSide, OrderType } from '@/app/types/trading';

const decimalRegex = /^\d+(\.\d+)?$/;

const OrderSchema = z.object({
  market: z.string().min(1),
  side: z.enum(['buy', 'sell']),
  price: z.string().regex(decimalRegex, 'Invalid price'),
  quantity: z.string().regex(decimalRegex, 'Invalid quantity'),
  type: z.enum(['limit', 'market']).default('limit'),
});

export type OrderParams = OrderRequestPayload;

interface OrderPanelProps {
  pair: string;
  onPlaceOrder: (order: OrderParams) => Promise<void> | void;
  disabled?: boolean;
}

export function OrderPanel({ pair, onPlaceOrder, disabled = false }: OrderPanelProps) {
  const [side, setSide] = useState<OrderSide>('buy');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const buttonLabel = useMemo(() => {
    const action = side === 'buy' ? 'Buy' : 'Sell';
    const asset = pair.split('/')[0] ?? 'Asset';
    return `${action} ${asset}`;
  }, [pair, side]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const result = OrderSchema.safeParse({
      market: pair,
      side,
      price: orderType === 'market' ? '0' : price,
      quantity,
      type: orderType,
    });

    if (!result.success) {
      const issues = result.error.issues.map((issue) => issue.message).join(', ');
      setError(issues || 'Invalid order parameters');
      return;
    }

    setIsSubmitting(true);
    try {
      await onPlaceOrder(result.data as OrderRequestPayload);
      setPrice('');
      setQuantity('');
    } catch (submissionError) {
      const message =
        submissionError instanceof Error ? submissionError.message : 'Failed to place order';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['buy', 'sell'] as OrderSide[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSide(value)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              side === value
                ? value === 'buy'
                  ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white'
                : 'bg-surface text-muted hover:bg-surface-strong'
            }`}
            disabled={disabled || isSubmitting}
          >
            {value === 'buy' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      <div className="flex gap-2 text-xs font-medium">
        {(['limit', 'market'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setOrderType(value)}
            className={`rounded px-3 py-1 transition-colors ${
              orderType === value ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
            }`}
            disabled={disabled || isSubmitting}
          >
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {orderType === 'limit' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Price</label>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-hairline bg-surface px-4 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              disabled={disabled || isSubmitting}
              aria-label="Order price"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Quantity</label>
          <input
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-hairline bg-surface px-4 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            disabled={disabled || isSubmitting}
            aria-label="Order quantity"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={disabled || isSubmitting}
          className={`w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            side === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {isSubmitting ? 'Submitting...' : buttonLabel}
        </button>
      </form>

      {disabled && !isSubmitting && (
        <p className="text-center text-xs text-muted">Connect your wallet to place orders.</p>
      )}
    </div>
  );
}

export default OrderPanel;
