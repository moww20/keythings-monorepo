"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import type { QueryClientConfig } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ToastProvider, ToastViewport } from "@radix-ui/react-toast";

import WalletEventsManager from "./WalletEventsManager";
import WalletAutoConnect from "./WalletAutoConnect";
import { WalletProvider } from "../contexts/WalletContext";
import { isRateLimitedError } from "../lib/wallet-throttle";
import { ToastBridge } from "./Toast";

const defaultQueryOptions: QueryClientConfig["defaultOptions"] = {
  queries: {
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // For rate-limited errors, retry with exponential backoff
      if (isRateLimitedError(error)) {
        return failureCount < 3; // Retry up to 3 times for throttling
      }
      // For other errors, don't retry
      return false;
    },
    retryDelay: (attemptIndex, error) => {
      // For rate-limited errors, use exponential backoff starting at 2 seconds
      if (isRateLimitedError(error)) {
        return Math.min(1000 * (2 ** attemptIndex), 10000); // Max 10 seconds
      }
      return 1000;
    },
  },
};

interface AppProvidersProps {
  children: ReactNode;
}

const noopStorage: Storage = {
  length: 0,
  clear() {},
  getItem() {
    return null;
  },
  key() {
    return null;
  },
  removeItem() {},
  setItem() {},
};

export default function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: defaultQueryOptions,
  }));

  const persister = useMemo(
    () =>
      createSyncStoragePersister({
        storage:
          typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
            ? window.localStorage
            : noopStorage,
      }),
    [],
  );

  return (
    <ToastProvider swipeDirection="right">
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          dehydrateOptions: {
            shouldDehydrateQuery: (q: { queryKey: unknown }) => Array.isArray(q.queryKey as unknown[]) && (q.queryKey as unknown[])[0] === 'history',
          },
          maxAge: 1000 * 60 * 60 * 24,
        }}
      >
        <WalletEventsManager />
        <WalletProvider>
          <WalletAutoConnect />
          <ToastBridge />
          {children}
        </WalletProvider>
      </PersistQueryClientProvider>

      <ToastViewport className="fixed bottom-4 right-4 z-[100] flex w-[320px] flex-col gap-3" />
    </ToastProvider>
  );
}
