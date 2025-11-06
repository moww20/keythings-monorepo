import { z } from 'zod';

export const TradeTickSchema = z.object({
  t: z.number().int(), // epoch millis
  p: z.number(),       // price in KTA
  v: z.number().optional(), // volume (optional)
});
export type TradeTick = z.infer<typeof TradeTickSchema>;

export const CandleSchema = z.object({
  t: z.number().int(), // epoch millis (open time)
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number().optional(),
});
export type Candle = z.infer<typeof CandleSchema>;

export const TicksResponseSchema = z.object({
  address: z.string(),
  ticks: z.array(TradeTickSchema),
});
export type TicksResponse = z.infer<typeof TicksResponseSchema>;

export const CandlesResponseSchema = z.object({
  address: z.string(),
  timeframe: z.string(),
  candles: z.array(CandleSchema),
});
export type CandlesResponse = z.infer<typeof CandlesResponseSchema>;







