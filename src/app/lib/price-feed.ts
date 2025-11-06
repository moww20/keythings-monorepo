import { CandlesResponseSchema, TicksResponseSchema, type Candle, type TradeTick } from '@/app/types/trade'

export async function fetchTicks(address: string): Promise<TradeTick[]> {
  const res = await fetch(`/api/trades/${encodeURIComponent(address)}/ticks`, { cache: 'no-store' })
  if (!res.ok) {
    return []
  }
  const json = await res.json()
  const parsed = TicksResponseSchema.safeParse(json)
  if (!parsed.success) {
    return []
  }
  return parsed.data.ticks
}

export async function fetchCandles(address: string, timeframe: string): Promise<Candle[]> {
  const url = new URL(`/api/trades/${encodeURIComponent(address)}/candles`, window.location.origin)
  url.searchParams.set('timeframe', timeframe)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) {
    return []
  }
  const json = await res.json()
  const parsed = CandlesResponseSchema.safeParse(json)
  if (!parsed.success) {
    return []
  }
  return parsed.data.candles
}







