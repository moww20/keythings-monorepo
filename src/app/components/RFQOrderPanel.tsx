'use client';

import React, { useState } from 'react';

interface TradingPair {
  base: string;
  quote: string;
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  volume24hQuote: number;
}

interface RFQOrder {
  type: 'buy' | 'sell';
  amount: string;
  priceRange?: {
    min: number;
    max: number;
  };
  expiry: number; // minutes
  storageAccount?: string;
}

interface RFQOrderPanelProps {
  pair: TradingPair;
  onOrderSubmit: (order: RFQOrder) => void;
}

const formatPrice = (price: number) => {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function RFQOrderPanel({ pair, onOrderSubmit }: RFQOrderPanelProps): React.JSX.Element {
  const [orderType, setOrderType] = useState<'spot' | 'limit'>('limit');
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [buyPrice, setBuyPrice] = useState(formatPrice(pair.price));
  const [sellPrice, setSellPrice] = useState(formatPrice(pair.price));
  const [buyTotal, setBuyTotal] = useState('');
  const [sellTotal, setSellTotal] = useState('');
  const [priceRange, setPriceRange] = useState({
    min: pair.price * 0.98, // 2% below current price
    max: pair.price * 1.02, // 2% above current price
  });
  const [expiry, setExpiry] = useState(30); // 30 minutes default

  const handleBuyRFQ = () => {
    if (!buyAmount) return;

    const order: RFQOrder = {
      type: 'buy',
      amount: buyAmount,
      priceRange: {
        min: priceRange.min,
        max: priceRange.max,
      },
      expiry: expiry,
    };

    onOrderSubmit(order);
    setBuyAmount('');
  };

  const handleSellRFQ = () => {
    if (!sellAmount) return;

    const order: RFQOrder = {
      type: 'sell',
      amount: sellAmount,
      priceRange: {
        min: priceRange.min,
        max: priceRange.max,
      },
      expiry: expiry,
    };

    onOrderSubmit(order);
    setSellAmount('');
  };

  const handlePriceRangeChange = (field: 'min' | 'max', value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    setPriceRange(prev => ({
      ...prev,
      [field]: numValue,
    }));
  };

  return (
    <div className="flex flex-col">
      {/* Order Type Tabs */}
      <div className="mb-3 flex items-center gap-1 border-b border-hairline">
        <button
          onClick={() => setOrderType('limit')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            orderType === 'limit'
              ? 'text-accent border-accent'
              : 'text-muted hover:text-foreground border-transparent'
          }`}
        >
          Limit
        </button>
        <button
          onClick={() => setOrderType('spot')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            orderType === 'spot'
              ? 'text-accent border-accent'
              : 'text-muted hover:text-foreground border-transparent'
          }`}
        >
          Market
        </button>
        <button className="px-3 py-2 text-sm font-medium text-muted hover:text-foreground border-b-2 border-transparent flex items-center gap-1">
          Stop Limit
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </button>
      </div>


      {/* Buy/Sell Forms */}
      <div className="grid grid-cols-2 gap-3">
        {/* Buy Side */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-foreground">Buy {pair.base}</h4>
            <div className="flex items-center gap-1">
              <input 
                type="checkbox" 
                id="tp-sl-buy" 
                className="rounded" 
                aria-label="Enable Take Profit/Stop Loss for buy order"
              />
              <label htmlFor="tp-sl-buy" className="text-xs text-muted">TP/SL</label>
            </div>
          </div>
          
          <div className="space-y-1">
            {orderType === 'limit' && (
              <div>
                <label className="block text-xs text-muted mb-0.5">Price</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="0.00"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    className="w-full bg-background border border-hairline rounded-md px-2 py-1.5 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-transparent"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex flex-col">
                    <button className="text-xs text-muted hover:text-foreground">▲</button>
                    <button className="text-xs text-muted hover:text-foreground">▼</button>
                  </div>
                </div>
                <div className="text-xs text-muted mt-0.5">USDT</div>
              </div>
            )}

            <div>
              <label className="block text-xs text-muted mb-0.5">Amount</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="0.00"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  className="w-full bg-background border border-hairline rounded-md px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-transparent"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex flex-col">
                  <button className="text-xs text-muted hover:text-foreground">▲</button>
                  <button className="text-xs text-muted hover:text-foreground">▼</button>
                </div>
              </div>
              <div className="text-xs text-muted mt-0.5">{pair.base}</div>
            </div>

            {/* Allocation Slider */}
            <div className="flex items-center justify-center">
              <div className="flex gap-1">
                {[25, 50, 75, 100].map((percent) => (
                  <button
                    key={percent}
                    className="w-5 h-5 flex items-center justify-center text-xs text-muted hover:text-foreground border border-hairline rounded"
                  >
                    ◆
                  </button>
                ))}
              </div>
            </div>

            {orderType === 'limit' && (
              <div>
                <label className="block text-xs text-muted mb-0.5">Total</label>
                <input
                  type="text"
                  placeholder="0.00"
                  value={buyTotal}
                  onChange={(e) => setBuyTotal(e.target.value)}
                  className="w-full bg-background border border-hairline rounded-md px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-transparent"
                />
                <div className="text-xs text-muted mt-0.5">Minimum 5 USDT</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-0.5 text-xs text-muted">
              <div className="flex items-center gap-1">
                Avbl: 0.10357013 USDT
                <svg className="w-3 h-3 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>Est. Fee</div>
            </div>

            <div className="text-xs text-muted">Max Buy: 0.00000 {pair.base}</div>

            <button
              onClick={handleBuyRFQ}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-md transition-colors text-sm"
            >
              Buy {pair.base}
            </button>
          </div>
        </div>

        {/* Sell Side */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-foreground">Sell {pair.base}</h4>
            <div className="flex items-center gap-1">
              <input 
                type="checkbox" 
                id="tp-sl-sell" 
                className="rounded" 
                aria-label="Enable Take Profit/Stop Loss for sell order"
              />
              <label htmlFor="tp-sl-sell" className="text-xs text-muted">TP/SL</label>
            </div>
          </div>
          
          <div className="space-y-1">
            {orderType === 'limit' && (
              <div>
                <label className="block text-xs text-muted mb-0.5">Price</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="0.00"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className="w-full bg-background border border-hairline rounded-md px-2 py-1.5 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-transparent"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex flex-col">
                    <button className="text-xs text-muted hover:text-foreground">▲</button>
                    <button className="text-xs text-muted hover:text-foreground">▼</button>
                  </div>
                </div>
                <div className="text-xs text-muted mt-0.5">USDT</div>
              </div>
            )}

            <div>
              <label className="block text-xs text-muted mb-0.5">Amount</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="0.00"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  className="w-full bg-background border border-hairline rounded-md px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-transparent"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex flex-col">
                  <button className="text-xs text-muted hover:text-foreground">▲</button>
                  <button className="text-xs text-muted hover:text-foreground">▼</button>
                </div>
              </div>
              <div className="text-xs text-muted mt-0.5">{pair.base}</div>
            </div>

            {/* Allocation Slider */}
            <div className="flex items-center justify-center">
              <div className="flex gap-1">
                {[25, 50, 75, 100].map((percent) => (
                  <button
                    key={percent}
                    className="w-5 h-5 flex items-center justify-center text-xs text-muted hover:text-foreground border border-hairline rounded"
                  >
                    ◆
                  </button>
                ))}
              </div>
            </div>

            {orderType === 'limit' && (
              <div>
                <label className="block text-xs text-muted mb-0.5">Total</label>
                <input
                  type="text"
                  placeholder="0.00"
                  value={sellTotal}
                  onChange={(e) => setSellTotal(e.target.value)}
                  className="w-full bg-background border border-hairline rounded-md px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-transparent"
                />
                <div className="text-xs text-muted mt-0.5">Minimum 5 USDT</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-0.5 text-xs text-muted">
              <div className="flex items-center gap-1">
                Avbl: 0.00000000 {pair.base}
                <svg className="w-3 h-3 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>Est. Fee</div>
            </div>

            <div className="text-xs text-muted">Max Sell: 0 USDT</div>

            <button
              onClick={handleSellRFQ}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-md transition-colors text-sm"
            >
              Sell {pair.base}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
