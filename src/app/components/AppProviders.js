'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WalletEventsManager from './WalletEventsManager';

const defaultQueryOptions = {
  queries: {
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  },
};

export default function AppProviders({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: defaultQueryOptions,
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <WalletEventsManager />
      {children}
    </QueryClientProvider>
  );
}
