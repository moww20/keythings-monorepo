'use client';

import { RFQTakerPanel } from '@/app/components/rfq/RFQTakerPanel';
import { RFQMakerPanel } from '@/app/components/rfq/RFQMakerPanel';
import { RFQOrdersPanel } from '@/app/components/rfq/RFQOrdersPanel';

interface RFQUnifiedPanelProps {
  mode: 'rfq_taker' | 'rfq_maker' | 'rfq_orders';
  onModeChange: (mode: 'rfq_taker' | 'rfq_maker' | 'rfq_orders') => void;
  onPairChange?: (pair: string) => void;
}

export function RFQUnifiedPanel({ mode, onModeChange, onPairChange }: RFQUnifiedPanelProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col glass rounded-lg border border-hairline bg-surface">
      {/* Unified Sticky Tab Navigation */}
      <div className="sticky top-0 z-10 border-b border-hairline bg-surface/95 backdrop-blur">
        <div className="flex items-center gap-0 px-4 md:px-6">
          <button
            type="button"
            onClick={() => onModeChange('rfq_taker')}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'rfq_taker' ? 'text-accent' : 'text-muted hover:text-foreground'
            }`}
          >
            RFQ Taker
            {mode === 'rfq_taker' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onModeChange('rfq_maker')}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'rfq_maker' ? 'text-accent' : 'text-muted hover:text-foreground'
            }`}
          >
            RFQ Maker
            {mode === 'rfq_maker' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onModeChange('rfq_orders')}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'rfq_orders' ? 'text-accent' : 'text-muted hover:text-foreground'
            }`}
          >
            RFQ Orders
            {mode === 'rfq_orders' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {mode === 'rfq_taker' && (
          <RFQTakerPanel mode={mode} onModeChange={onModeChange} onPairChange={onPairChange} hideInternalTabs />
        )}
        {mode === 'rfq_maker' && (
          <RFQMakerPanel mode={mode} onModeChange={onModeChange} hideInternalTabs />
        )}
        {mode === 'rfq_orders' && (
          <RFQOrdersPanel mode={mode} onModeChange={onModeChange} hideInternalTabs />
        )}
      </div>
    </div>
  );
}
