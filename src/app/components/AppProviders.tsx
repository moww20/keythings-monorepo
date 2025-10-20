"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { QueryClientConfig } from "@tanstack/react-query";
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

export default function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: defaultQueryOptions,
  }));

  return (
    <ToastProvider swipeDirection="right">
      <QueryClientProvider client={queryClient}>
        <WalletEventsManager />
        <WalletAutoConnect />
        <WalletProvider>
          <ToastBridge />
          {children}
        </WalletProvider>
      </QueryClientProvider>

      <ToastViewport className="fixed bottom-4 right-4 z-[100] flex w-[320px] flex-col gap-3" />
    </ToastProvider>
  );
}
