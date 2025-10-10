'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WalletEventsManager from './WalletEventsManager';
import WalletAutoConnect from './WalletAutoConnect';
import { isRateLimitedError } from '../lib/wallet-throttle';

const defaultQueryOptions = {
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

export default function AppProviders({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: defaultQueryOptions,
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <WalletEventsManager />
      <WalletAutoConnect />
      {children}
    </QueryClientProvider>
  );
}
