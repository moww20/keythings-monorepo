import { QueryClient, dehydrate } from "@tanstack/react-query";
import { defaultQueryOptions } from "./config";

export function createServerQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: defaultQueryOptions,
  });
}

export type DehydratedState = ReturnType<typeof dehydrate>;

export { dehydrate };
