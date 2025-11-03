"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ToastProvider, ToastViewport } from "@radix-ui/react-toast";

import WalletEventsManager from "./WalletEventsManager";
import WalletAutoConnect from "./WalletAutoConnect";
import { WalletProvider } from "../contexts/WalletContext";
import { ToastBridge } from "./Toast";
import { defaultQueryOptions } from "@/lib/react-query/config";

type AppHydrationState = Parameters<typeof HydrationBoundary>[0]["state"];

interface AppProvidersProps {
  children: ReactNode;
  dehydratedState?: AppHydrationState;
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

export default function AppProviders({ children, dehydratedState }: AppProvidersProps) {
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
        <HydrationBoundary state={dehydratedState}>
          <WalletEventsManager />
          <WalletProvider>
            <WalletAutoConnect />
            <ToastBridge />
            {children}
          </WalletProvider>
        </HydrationBoundary>
      </PersistQueryClientProvider>

      <ToastViewport className="fixed bottom-4 right-4 z-[100] flex w-[320px] flex-col gap-3" />
    </ToastProvider>
  );
}
