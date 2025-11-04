'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { useTokenMetadata } from '@/app/hooks/useTokenMetadata';
import { getTokenIconFromMetadata, getTokenIconDataUrl, createFallbackTokenIcon } from '@/app/lib/token-utils';

export interface TokenIconProps {
  address: string;
  symbol: string;
  size?: number;
}

export function TokenIcon({ address, symbol, size = 24 }: TokenIconProps): React.JSX.Element {
  const { metadata } = useTokenMetadata(address);
  
  const { iconUrl, fallbackIcon } = useMemo(() => {
    // Extract icon from metadata
    const iconFromMetadata = metadata?.metadata ? getTokenIconFromMetadata(metadata.metadata) : null;
    const iconDataUrl = iconFromMetadata ? getTokenIconDataUrl(iconFromMetadata) : '';
    
    // Create fallback icon if no metadata icon
    const fallback = iconDataUrl ? null : createFallbackTokenIcon(symbol);
    
    return {
      iconUrl: iconDataUrl || undefined,
      fallbackIcon: fallback,
    };
  }, [metadata?.metadata, symbol]);

  if (iconUrl) {
    return (
      <Image
        src={iconUrl}
        alt={symbol}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  if (fallbackIcon) {
    return (
      <span
        className="flex items-center justify-center rounded-full text-xs font-semibold"
        style={{
          width: size,
          height: size,
          backgroundColor: fallbackIcon.bgColor ?? 'rgba(255,255,255,0.08)',
          color: fallbackIcon.textColor ?? 'var(--foreground)',
          fontSize: size * 0.4,
        }}
      >
        {fallbackIcon.letter ?? symbol.charAt(0).toUpperCase()}
      </span>
    );
  }

  // Ultimate fallback
  return (
    <span
      className="flex items-center justify-center rounded-full bg-surface-strong text-xs font-semibold text-foreground"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {symbol.charAt(0).toUpperCase() || '?'}
    </span>
  );
}

