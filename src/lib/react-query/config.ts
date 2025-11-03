import { isRateLimitedError } from "@/app/lib/wallet-throttle";
import type { QueryClientConfig } from "@tanstack/react-query";

export const defaultQueryOptions: QueryClientConfig["defaultOptions"] = {
  queries: {
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (isRateLimitedError(error)) {
        return failureCount < 3;
      }
      return false;
    },
    retryDelay: (attemptIndex, error) => {
      if (isRateLimitedError(error)) {
        return Math.min(1000 * 2 ** attemptIndex, 10000);
      }
      return 1000;
    },
  },
};

export const defaultQueryClientConfig: QueryClientConfig = {
  defaultOptions: defaultQueryOptions,
};
