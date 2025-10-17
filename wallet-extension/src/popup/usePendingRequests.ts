import { useEffect, useState } from "react";
import {
  PendingDappRequest,
  PendingRequestRecord,
} from "../types/dapp-requests";
import {
  PENDING_REQUESTS_KEY,
  loadPendingRequests,
  sanitizeLegacyRequest as internalSanitize,
} from "../background/wallet-provider-handler";

declare const chrome: {
  storage?: {
    onChanged?: {
      addListener?(callback: (changes: Record<string, unknown>, areaName: string) => void): void;
      removeListener?(callback: (changes: Record<string, unknown>, areaName: string) => void): void;
    };
  };
};

const FALLBACK_RECORD: PendingRequestRecord = {};

export async function readPendingRequestsFromStorage(): Promise<PendingDappRequest[]> {
  try {
    return await loadPendingRequests();
  } catch (error) {
    console.error("[usePendingRequests] Failed to load pending requests", error);
    return [];
  }
}

export function usePendingRequests(): PendingDappRequest[] {
  const [requests, setRequests] = useState<PendingDappRequest[]>([]);

  useEffect(() => {
    let active = true;

    async function sync() {
      const data = await readPendingRequestsFromStorage();
      if (active) {
        setRequests(data);
      }
    }

    sync();

    const handleChange = (changes: Record<string, unknown>, areaName: string) => {
      if (areaName !== "session") {
        return;
      }

      if (!Object.hasOwn(changes, PENDING_REQUESTS_KEY)) {
        return;
      }

      void sync();
    };

    chrome?.storage?.onChanged?.addListener?.(handleChange);

    return () => {
      active = false;
      chrome?.storage?.onChanged?.removeListener?.(handleChange);
    };
  }, []);

  return requests;
}

export function sanitizePendingRequests(raw: unknown): PendingRequestRecord {
  if (!raw || typeof raw !== "object") {
    return FALLBACK_RECORD;
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  return entries.reduce<PendingRequestRecord>((acc, [id, value]) => {
    const request = internalSanitize(value);
    if (request) {
      acc[id] = request;
    }
    return acc;
  }, {});
}
