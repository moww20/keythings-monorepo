import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const publicKey = searchParams.get('publicKey');
    if (!publicKey || typeof publicKey !== 'string' || publicKey.trim() === '') {
      return NextResponse.json({ error: 'Missing publicKey' }, { status: 400 });
    }

    // Proxy to local backend if available
    const depthParam = searchParams.get('depth');
    const limit = Math.max(1, Math.min(Number(depthParam ?? 25) || 25, 100));
    const backendUrl = `http://localhost:8080/api/ledger/v1/accounts/${encodeURIComponent(publicKey)}/history?limit=${limit}&includeOps=true`;

    const resp = await fetch(backendUrl, { method: 'GET' });
    if (!resp.ok) {
      return NextResponse.json({ error: `Backend responded ${resp.status}` }, { status: 502 });
    }
    const historyData = await resp.json();

    const records = Array.isArray(historyData?.relevantOps)
      ? historyData.relevantOps.map((op: any) => ({
          id: op.stapleHash || op.type || 'unknown',
          block: op.stapleHash || '',
          timestamp: op.timestamp || Date.now(),
          type: op.type || 'Transaction',
          amount: op.amount || '0',
          from: op.from || '',
          to: op.to || '',
          token: op.token || '',
          operationType: op.type || 'UNKNOWN',
        }))
      : [];

    return NextResponse.json({ records }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message || 'Failed to fetch history' }, { status: 500 });
  }
}
