'use client';

import { useMemo } from 'react';
import { ShieldCheck, Loader2, Lock, Unlock, Zap } from 'lucide-react';

import { useWallet } from '@/app/contexts/WalletContext';
import { useRFQContext } from '@/app/contexts/RFQContext';

function shorten(pubkey: string | null | undefined, chars = 4): string {
  if (!pubkey) {
    return '—';
  }
  if (pubkey.length <= chars * 2) {
    return pubkey;
  }
  return `${pubkey.slice(0, chars)}…${pubkey.slice(-chars)}`;
}

export function RFQStatusBar(): React.JSX.Element {
  const {
    isConnected,
    isLocked,
    publicKey,
  } = useWallet();
  const {
    isFilling,
    lastFillResult,
    isVerifyingEscrow,
    lastEscrowVerification,
  } = useRFQContext();

  const fillStatus = useMemo(() => {
    if (isFilling) {
      return { label: 'Filling RFQ…', tone: 'text-accent', icon: <Loader2 className="h-4 w-4 animate-spin" /> };
    }
    if (lastFillResult) {
      if (lastFillResult.status === 'settled') {
        return {
          label: `Settled in ${lastFillResult.latencyMs} ms`,
          tone: 'text-green-300',
          icon: <ShieldCheck className="h-4 w-4" />,
        };
      }
      if (lastFillResult.status === 'rejected') {
        return {
          label: 'Maker rejected fill',
          tone: 'text-red-300',
          icon: <Zap className="h-4 w-4" />,
        };
      }
    }
    return { label: 'Idle', tone: 'text-muted', icon: <Zap className="h-4 w-4" /> };
  }, [isFilling, lastFillResult]);

  const escrowStatus = useMemo(() => {
    if (isVerifyingEscrow) {
      return { label: 'Verifying escrow…', tone: 'text-accent', icon: <Loader2 className="h-4 w-4 animate-spin" /> };
    }
    if (lastEscrowVerification) {
      return {
        label: `Verified at ${new Date(lastEscrowVerification).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        tone: 'text-green-300',
        icon: <ShieldCheck className="h-4 w-4" />,
      };
    }
    return { label: 'Escrow not verified yet', tone: 'text-muted', icon: <Zap className="h-4 w-4" /> };
  }, [isVerifyingEscrow, lastEscrowVerification]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-surface px-4 py-3 text-xs">
      <div className="flex items-center gap-2 text-muted">
        {isLocked ? (
          <Lock className="h-4 w-4 text-amber-400" />
        ) : (
          <Unlock className={`h-4 w-4 ${isConnected ? 'text-green-400' : 'text-muted'}`} />
        )}
        <span className="font-medium text-foreground">
          Wallet:
        </span>
        <span className="font-mono text-foreground">{isConnected ? shorten(publicKey) : 'Disconnected'}</span>
      </div>
      <div className={`flex items-center gap-2 ${escrowStatus.tone}`}>
        {escrowStatus.icon}
        <span className="font-medium text-foreground">Escrow:</span>
        <span>{escrowStatus.label}</span>
      </div>
      <div className={`flex items-center gap-2 ${fillStatus.tone}`}>
        {fillStatus.icon}
        <span className="font-medium text-foreground">Settlement:</span>
        <span>{fillStatus.label}</span>
      </div>
    </div>
  );
}

export default RFQStatusBar;
