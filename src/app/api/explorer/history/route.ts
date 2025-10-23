import { NextResponse } from 'next/server';

export async function GET() {
  // Explorer backend is disabled. Use wallet provider methods (keeta.history / keeta_getHistoryForAccount) from the client.
  return NextResponse.json({ error: 'Explorer backend disabled' }, { status: 501 });
}
