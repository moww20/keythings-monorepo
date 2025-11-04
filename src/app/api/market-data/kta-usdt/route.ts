import { NextResponse } from 'next/server';
import { z } from 'zod';

const timeframeSchema = z.enum(['1D', '7D', '30D', '90D']);

const querySchema = z.object({
  timeframe: timeframeSchema.default('1D'),
});

const candleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

const chartSchema = z.object({
  pair: z.string(),
  timeframe: timeframeSchema,
  granularitySeconds: z.number(),
  updatedAt: z.string(),
  source: z.string(),
  candles: z.array(candleSchema),
});

const DEFAULT_BACKEND_BASE_URL = 'http://localhost:8080/api';

function resolveBackendBaseUrl(): string {
  const raw = process.env.MARKET_DATA_API_BASE_URL ?? process.env.RFQ_API_BASE_URL;
  const fallback = process.env.NEXT_PUBLIC_RFQ_API_URL;
  const base = raw ?? fallback ?? DEFAULT_BACKEND_BASE_URL;
  return base.replace(/\/$/, '');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  const parsedQuery = querySchema.safeParse(params);
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }

  const { timeframe } = parsedQuery.data;
  const backendBaseUrl = resolveBackendBaseUrl();
  const backendUrl = `${backendBaseUrl}/market-data/v1/charts/kta-usdt?timeframe=${encodeURIComponent(timeframe)}`;

  try {
    const response = await fetch(backendUrl, {
      headers: {
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        {
          error: 'Backend request failed',
          status: response.status,
          message: errorBody.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const payload = await response.json();
    const validated = chartSchema.safeParse(payload);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Unexpected backend response',
          details: validated.error.flatten(),
        },
        { status: 502 },
      );
    }

    return NextResponse.json(validated.data, { status: 200 });
  } catch (error) {
    console.error('[market-data/kta-usdt] Failed to fetch chart data', error);
    return NextResponse.json(
      {
        error: 'Failed to reach backend service',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 },
    );
  }
}
