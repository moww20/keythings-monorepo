import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { ChartTimeframe } from './dto/chart-query.dto';

export interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketChartResponse {
  pair: string;
  timeframe: ChartTimeframe;
  granularitySeconds: number;
  updatedAt: string;
  source: string;
  candles: ChartCandle[];
}

interface TimeframeConfig {
  days: number;
  bucketMs: number;
  cacheTtlMs: number;
}

const timeframeConfig: Record<ChartTimeframe, TimeframeConfig> = {
  [ChartTimeframe.ONE_DAY]: { days: 1, bucketMs: 15 * 60 * 1000, cacheTtlMs: 60_000 },
  [ChartTimeframe.SEVEN_DAYS]: { days: 7, bucketMs: 60 * 60 * 1000, cacheTtlMs: 5 * 60 * 1000 },
  [ChartTimeframe.THIRTY_DAYS]: { days: 30, bucketMs: 4 * 60 * 60 * 1000, cacheTtlMs: 5 * 60 * 1000 },
  [ChartTimeframe.NINETY_DAYS]: { days: 90, bucketMs: 24 * 60 * 60 * 1000, cacheTtlMs: 10 * 60 * 1000 },
};

const coinGeckoMarketChartSchema = z.object({
  prices: z.array(z.tuple([z.number(), z.number()])),
  total_volumes: z.array(z.tuple([z.number(), z.number()])).default([]),
});

const USER_AGENT = 'Keythings-Backend/1.0 (+https://keythings.com)';
const DEFAULT_COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const MAX_CANDLES = 500;

interface CachedEntry {
  expiresAt: number;
  data: MarketChartResponse;
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly cache = new Map<ChartTimeframe, CachedEntry>();
  private readonly inflight = new Map<ChartTimeframe, Promise<MarketChartResponse>>();

  constructor(private readonly config: ConfigService) {}

  async getKtaUsdtChart(timeframe: ChartTimeframe): Promise<MarketChartResponse> {
    const now = Date.now();
    const cached = this.cache.get(timeframe);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const pending = this.inflight.get(timeframe);
    if (pending) {
      return pending;
    }

    const request = this.fetchKtaUsdtChart(timeframe)
      .then((data) => {
        const ttl = timeframeConfig[timeframe].cacheTtlMs;
        this.cache.set(timeframe, { data, expiresAt: Date.now() + ttl });
        return data;
      })
      .finally(() => {
        this.inflight.delete(timeframe);
      });

    this.inflight.set(timeframe, request);
    return request;
  }

  private async fetchKtaUsdtChart(timeframe: ChartTimeframe): Promise<MarketChartResponse> {
    const config = timeframeConfig[timeframe];
    const baseUrl = this.config.get<string>('COINGECKO_BASE_URL') ?? DEFAULT_COINGECKO_BASE_URL;
    const url = `${baseUrl}/coins/keeta/market_chart?vs_currency=usd&days=${config.days}`;

    this.logger.log(`Fetching CoinGecko chart for timeframe ${timeframe}: ${url}`);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': USER_AGENT,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to reach CoinGecko for timeframe ${timeframe}`, error);
      throw new Error('Unable to contact CoinGecko API');
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `CoinGecko responded with status ${response.status} for timeframe ${timeframe}: ${body.substring(0, 200)}`,
      );
      throw new Error(`CoinGecko request failed with status ${response.status}`);
    }

    let parsedBody: unknown;
    try {
      parsedBody = await response.json();
    } catch (error) {
      this.logger.error('Failed to parse CoinGecko response as JSON', error);
      throw new Error('Invalid CoinGecko response');
    }

    const validated = coinGeckoMarketChartSchema.safeParse(parsedBody);
    if (!validated.success) {
      this.logger.error('CoinGecko response validation failed', validated.error);
      throw new Error('Unexpected CoinGecko response structure');
    }

    const candles = buildCandles(validated.data.prices, validated.data.total_volumes, config.bucketMs);

    return {
      pair: 'KTA/USDT',
      timeframe,
      granularitySeconds: Math.round(config.bucketMs / 1000),
      updatedAt: new Date().toISOString(),
      source: 'coingecko',
      candles,
    } satisfies MarketChartResponse;
  }
}

function buildCandles(
  priceSeries: Array<[number, number]>,
  volumeSeries: Array<[number, number]>,
  bucketMs: number,
): ChartCandle[] {
  if (!priceSeries.length) {
    return [];
  }

  const sortedPrices = [...priceSeries].sort((a, b) => a[0] - b[0]);
  const sortedVolumes = [...volumeSeries].sort((a, b) => a[0] - b[0]);

  let volumeIndex = 0;
  const candlesByBucket = new Map<number, ChartCandle & { _count: number }>();

  for (const [timestampMs, price] of sortedPrices) {
    const bucketStart = Math.floor(timestampMs / bucketMs) * bucketMs;
    let candle = candlesByBucket.get(bucketStart);

    if (!candle) {
      candle = {
        time: Math.floor(bucketStart / 1000),
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
        _count: 0,
      } as ChartCandle & { _count: number };
      candlesByBucket.set(bucketStart, candle);
    }

    if (candle._count === 0) {
      candle.open = price;
    }

    candle.high = Math.max(candle.high, price);
    candle.low = Math.min(candle.low, price);
    candle.close = price;
    candle._count += 1;

    while (
      volumeIndex < sortedVolumes.length &&
      sortedVolumes[volumeIndex][0] <= timestampMs
    ) {
      const [volumeTimestampMs, volume] = sortedVolumes[volumeIndex];
      const volumeBucket = Math.floor(volumeTimestampMs / bucketMs) * bucketMs;
      const targetCandle = candlesByBucket.get(volumeBucket);
      if (targetCandle) {
        targetCandle.volume += Math.max(volume, 0);
      }
      volumeIndex += 1;
    }
  }

  const candles = Array.from(candlesByBucket.values())
    .sort((a, b) => a.time - b.time)
    .map((candle) => ({
      time: candle.time,
      open: normalizePrice(candle.open),
      high: normalizePrice(candle.high),
      low: normalizePrice(candle.low),
      close: normalizePrice(candle.close),
      volume: normalizeVolume(candle.volume),
    }));

  if (candles.length > MAX_CANDLES) {
    return candles.slice(candles.length - MAX_CANDLES);
  }

  return candles;
}

function normalizePrice(value: number): number {
  return Number.parseFloat(value.toFixed(8));
}

function normalizeVolume(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}
