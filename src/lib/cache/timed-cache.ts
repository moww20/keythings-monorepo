export interface TimedCacheEntry<Value> {
  value: Value;
  expiresAt: number;
}

export interface TimedCacheGetOptions {
  forceRefresh?: boolean;
}

export interface TimedCache<Key, Value> {
  get(
    key: Key,
    loader: (key: Key) => Promise<Value>,
    options?: TimedCacheGetOptions,
  ): Promise<Value>;
  peek(key: Key): Value | undefined;
  set(key: Key, value: Value, ttlMs?: number): void;
  delete(key: Key): void;
  clear(): void;
}

export function createTimedCache<Key, Value>(ttlMs: number): TimedCache<Key, Value> {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("Timed cache ttlMs must be a positive number");
  }

  const store = new Map<Key, TimedCacheEntry<Value>>();
  const inflight = new Map<Key, Promise<Value>>();

  const resolve = async (
    key: Key,
    loader: (key: Key) => Promise<Value>,
    forceRefresh: boolean,
  ): Promise<Value> => {
    const now = Date.now();
    const entry = store.get(key);

    if (!forceRefresh && entry && entry.expiresAt > now) {
      return entry.value;
    }

    if (!forceRefresh) {
      const pending = inflight.get(key);
      if (pending) {
        return pending;
      }
    }

    const promise = loader(key);
    inflight.set(key, promise);
    try {
      const result = await promise;
      store.set(key, { value: result, expiresAt: now + ttlMs });
      return result;
    } finally {
      inflight.delete(key);
    }
  };

  return {
    async get(key, loader, options) {
      return resolve(key, loader, Boolean(options?.forceRefresh));
    },
    peek(key) {
      const entry = store.get(key);
      if (!entry) {
        return undefined;
      }
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value, customTtlMs) {
      const ttl = Number.isFinite(customTtlMs) && Number(customTtlMs) > 0 ? Number(customTtlMs) : ttlMs;
      store.set(key, { value, expiresAt: Date.now() + ttl });
    },
    delete(key) {
      store.delete(key);
      inflight.delete(key);
    },
    clear() {
      store.clear();
      inflight.clear();
    },
  };
}
