import {
  PendingDappRequest,
  PendingRequestRecord,
  ProviderRequestPayload,
  RequestOperations,
  RequestSummary,
} from "../types/dapp-requests";

declare const chrome: any;

export const PENDING_REQUESTS_KEY = "keeta_pending_requests";

function getSessionStorage() {
  if (typeof chrome === "undefined" || !chrome.storage?.session) {
    throw new Error("chrome.storage.session is not available in this context");
  }

  return chrome.storage.session;
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in (value as Record<string, unknown>) &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

async function sessionGet(
  key?: string | string[] | Record<string, unknown> | null,
): Promise<Record<string, unknown>> {
  const storage = getSessionStorage();
  const result = storage.get(key);

  if (isPromiseLike<Record<string, unknown>>(result)) {
    return result;
  }

  return new Promise((resolve, reject) => {
    storage.get(key, (items: Record<string, unknown>) => {
      const error = chrome?.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(items);
    });
  });
}

async function sessionSet(items: Record<string, unknown>): Promise<void> {
  const storage = getSessionStorage();
  const result = storage.set(items);

  if (isPromiseLike<void>(result)) {
    await result;
    return;
  }

  await new Promise<void>((resolve, reject) => {
    storage.set(items, () => {
      const error = chrome?.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

async function sessionRemove(keys: string | string[]): Promise<void> {
  const storage = getSessionStorage();
  const result = storage.remove(keys);

  if (isPromiseLike<void>(result)) {
    await result;
    return;
  }

  await new Promise<void>((resolve, reject) => {
    storage.remove(keys, () => {
      const error = chrome?.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function normalizeOperations(payload: ProviderRequestPayload): RequestOperations {
  const fromSummary: RequestOperations = {
    sendOperations: payload.summary.sendOperations ?? [],
    receiveOperations: payload.summary.receiveOperations ?? [],
    otherOperations: payload.summary.otherOperations ?? [],
  };

  return {
    sendOperations: [...(payload.operations?.sendOperations ?? fromSummary.sendOperations)],
    receiveOperations: [...(payload.operations?.receiveOperations ?? fromSummary.receiveOperations)],
    otherOperations: [...(payload.operations?.otherOperations ?? fromSummary.otherOperations)],
  };
}

function normalizeSummary(summary: ProviderRequestPayload["summary"], operations: RequestOperations): RequestSummary {
  const totalOperations =
    summary.totalOperations ??
    operations.sendOperations.length +
      operations.receiveOperations.length +
      operations.otherOperations.length;

  return {
    hasSendOperations:
      summary.hasSendOperations ?? operations.sendOperations.length > 0,
    hasReceiveOperations:
      summary.hasReceiveOperations ?? operations.receiveOperations.length > 0,
    hasOtherOperations:
      summary.hasOtherOperations ?? operations.otherOperations.length > 0,
    totalOperations,
  };
}

export function sanitizeLegacyRequest(raw: unknown): PendingDappRequest | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const maybeRequest = raw as Partial<PendingDappRequest> & {
    summary?: RequestSummary & {
      sendOperations?: RequestOperations["sendOperations"];
      receiveOperations?: RequestOperations["receiveOperations"];
      otherOperations?: RequestOperations["otherOperations"];
      operationsKey?: string;
    };
  };

  if (!maybeRequest.id || typeof maybeRequest.id !== "string") {
    return null;
  }

  const operations: RequestOperations = {
    sendOperations: maybeRequest.operations?.sendOperations ?? maybeRequest.summary?.sendOperations ?? [],
    receiveOperations:
      maybeRequest.operations?.receiveOperations ?? maybeRequest.summary?.receiveOperations ?? [],
    otherOperations:
      maybeRequest.operations?.otherOperations ?? maybeRequest.summary?.otherOperations ?? [],
  };

  const summary: RequestSummary = {
    hasSendOperations:
      maybeRequest.summary?.hasSendOperations ?? operations.sendOperations.length > 0,
    hasReceiveOperations:
      maybeRequest.summary?.hasReceiveOperations ?? operations.receiveOperations.length > 0,
    hasOtherOperations:
      maybeRequest.summary?.hasOtherOperations ?? operations.otherOperations.length > 0,
    totalOperations:
      maybeRequest.summary?.totalOperations ??
      operations.sendOperations.length +
        operations.receiveOperations.length +
        operations.otherOperations.length,
  };

  return {
    id: maybeRequest.id,
    createdAt: maybeRequest.createdAt ?? Date.now(),
    summary,
    operations,
    metadata: maybeRequest.metadata ?? {},
  };
}

export function buildPendingRequest(payload: ProviderRequestPayload): PendingDappRequest {
  const operations = normalizeOperations(payload);
  const summary = normalizeSummary(payload.summary, operations);

  return {
    id: payload.id,
    createdAt: payload.createdAt ?? Date.now(),
    summary,
    operations,
    metadata: payload.metadata ?? {},
  };
}

export async function loadPendingRequests(): Promise<PendingDappRequest[]> {
  const raw = await sessionGet(PENDING_REQUESTS_KEY);
  const stored = raw?.[PENDING_REQUESTS_KEY];

  if (!stored || typeof stored !== "object") {
    return [];
  }

  const entries = Object.values(stored as PendingRequestRecord | Record<string, unknown>);
  const normalized = entries
    .map((entry) => sanitizeLegacyRequest(entry))
    .filter((entry): entry is PendingDappRequest => Boolean(entry));

  return normalized.sort((a, b) => b.createdAt - a.createdAt);
}

export async function persistPendingRequest(payload: ProviderRequestPayload): Promise<void> {
  const pending = await loadPendingRequests();
  const request = buildPendingRequest(payload);

  const record: PendingRequestRecord = pending.reduce<PendingRequestRecord>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  record[request.id] = request;

  await sessionSet({ [PENDING_REQUESTS_KEY]: record });
}

export async function clearPendingRequest(id: string): Promise<void> {
  const pending = await loadPendingRequests();

  const record = pending.reduce<PendingRequestRecord>((acc, item) => {
    if (item.id !== id) {
      acc[item.id] = item;
    }
    return acc;
  }, {});

  if (Object.keys(record).length === 0) {
    await sessionRemove(PENDING_REQUESTS_KEY);
    return;
  }

  await sessionSet({ [PENDING_REQUESTS_KEY]: record });
}

export function emptySummary(): RequestSummary {
  return {
    hasSendOperations: false,
    hasReceiveOperations: false,
    hasOtherOperations: false,
    totalOperations: 0,
  };
}

export function emptyRequest(id: string): PendingDappRequest {
  return {
    id,
    createdAt: Date.now(),
    summary: emptySummary(),
    operations: {
      sendOperations: [],
      receiveOperations: [],
      otherOperations: [],
    },
    metadata: {},
  };
}
