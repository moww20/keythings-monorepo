'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PoolsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/home');
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="glass rounded-lg border border-hairline p-8 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">Liquidity Pools Unavailable</h1>
        <p className="text-sm text-muted">
          The Liquidity Pools beta has been retired. Please explore the latest trading features from your dashboard.
        </p>
      </div>
    </div>
  );
}

