"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

export interface KtaPriceSnapshot {
  usd: number;
  usd_market_cap?: number;
  usd_24h_vol?: number;
  usd_24h_change?: number;
}

interface SharedState {
  data: KtaPriceSnapshot | null;
  error: Error | null;
  loading: boolean;
}

type Listener = (state: SharedState) => void;

const REFRESH_INTERVAL_MS = 30_000;

let cachedState: SharedState = {
  data: null,
  error: null,
  loading: false,
};

let lastFetched = 0;
let inflight: Promise<KtaPriceSnapshot | null> | null = null;
const listeners = new Set<Listener>();

function notify(next: SharedState) {
  cachedState = next;
  for (const listener of listeners) {
    listener(next);
  }
}

async function fetchPriceFromProvider(): Promise<KtaPriceSnapshot | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const provider = window.keeta;
  if (!provider) {
    return null;
  }

  let raw: unknown = null;
  if (typeof provider.getKtaPrice === "function") {
    raw = await provider.getKtaPrice();
  } else if (typeof provider.request === "function") {
    try {
      raw = await provider.request({ method: "keeta_getKtaPrice" });
    } catch (error) {

      raw = null;
    }
  }

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  if (typeof record.usd !== "number") {
    return null;
  }

  return {
    usd: record.usd,
    usd_market_cap: typeof record.usd_market_cap === "number" ? record.usd_market_cap : undefined,
    usd_24h_vol: typeof record.usd_24h_vol === "number" ? record.usd_24h_vol : undefined,
    usd_24h_change: typeof record.usd_24h_change === "number" ? record.usd_24h_change : undefined,
  } satisfies KtaPriceSnapshot;
}

async function loadPrice(forceRefresh = false): Promise<KtaPriceSnapshot | null> {
  const now = Date.now();
  if (!forceRefresh && cachedState.data && now - lastFetched < REFRESH_INTERVAL_MS) {
    return cachedState.data;
  }

  if (!forceRefresh && inflight) {
    return inflight;
  }

  const promise = fetchPriceFromProvider()
    .then((result) => {
      lastFetched = Date.now();
      notify({ data: result, error: null, loading: false });
      return result;
    })
    .catch((error: unknown) => {
      const normalized = error instanceof Error ? error : new Error(String(error ?? "Failed to fetch KTA price"));
      notify({ data: null, error: normalized, loading: false });
      throw normalized;
    })
    .finally(() => {
      inflight = null;
    });

  inflight = promise;
  notify({ ...cachedState, loading: true });
  return promise;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(cachedState);
  return () => {
    listeners.delete(listener);
  };
}

export function useKtaPrice(options?: { refreshIntervalMs?: number }) {
  const refreshInterval = options?.refreshIntervalMs ?? REFRESH_INTERVAL_MS;
  const [state, setState] = useState<SharedState>(() => ({ ...cachedState }));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return subscribe(setState);
  }, []);

  useEffect(() => {
    if (!state.data && !state.loading) {
      void loadPrice();
    } else if (state.data && Date.now() - lastFetched >= refreshInterval) {
      void loadPrice(true);
    }
  }, [state.data, state.loading, refreshInterval]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      void loadPrice();
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshInterval]);

  const refresh = useCallback(async (force?: boolean) => {
    try {
      return await loadPrice(Boolean(force));
    } catch (error) {
      return null;
    }
  }, []);

  return useMemo(
    () => ({
      data: state.data,
      isLoading: state.loading,
      error: state.error,
      refresh,
    }),
    [state.data, state.loading, state.error, refresh],
  );
}

export function primeKtaPriceCache(snapshot: KtaPriceSnapshot | null, timestamp = Date.now()) {
  cachedState = { data: snapshot, error: null, loading: false };
  lastFetched = timestamp;
}
