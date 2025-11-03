"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { explorerSearchHistoryQueryKey } from "@/lib/react-query/keys";

const STORAGE_KEY = "explorer-search-history";
const HISTORY_LIMIT = 3;

type MutationContext = {
  previousHistory: string[];
};

function readHistoryFromStorage(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function persistHistory(history: string[]): string[] {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
    } catch (error) {
      console.warn("[EXPLORER] Failed to persist search history", error);
    }
  }
  return history.slice(0, HISTORY_LIMIT);
}

function computeNextHistory(previous: string[], entry: string): string[] {
  const normalized = entry.trim();
  if (!normalized) {
    return previous.slice(0, HISTORY_LIMIT);
  }

  const deduped = previous.filter((value) => value !== normalized);
  return [normalized, ...deduped].slice(0, HISTORY_LIMIT);
}

export function useExplorerSearchHistory() {
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: explorerSearchHistoryQueryKey,
    queryFn: async () => readHistoryFromStorage(),
    initialData: [],
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  const addEntryMutation = useMutation<string[], unknown, string, MutationContext>({
    mutationFn: async (entry) => {
      const previous = readHistoryFromStorage();
      const next = computeNextHistory(previous, entry);
      return persistHistory(next);
    },
    onMutate: async (entry) => {
      await queryClient.cancelQueries({ queryKey: explorerSearchHistoryQueryKey });
      const previousHistory =
        queryClient.getQueryData<string[]>(explorerSearchHistoryQueryKey) ?? readHistoryFromStorage();
      const next = computeNextHistory(previousHistory, entry);
      queryClient.setQueryData(explorerSearchHistoryQueryKey, next);
      return { previousHistory };
    },
    onError: (_error, _entry, context) => {
      if (context?.previousHistory) {
        queryClient.setQueryData(explorerSearchHistoryQueryKey, context.previousHistory);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(explorerSearchHistoryQueryKey, data);
    },
  });

  const clearHistoryMutation = useMutation<string[], unknown, void, MutationContext>({
    mutationFn: async () => {
      persistHistory([]);
      return [] as string[];
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: explorerSearchHistoryQueryKey });
      const previousHistory =
        queryClient.getQueryData<string[]>(explorerSearchHistoryQueryKey) ?? readHistoryFromStorage();
      queryClient.setQueryData(explorerSearchHistoryQueryKey, []);
      const context: MutationContext = { previousHistory };
      return context;
    },
    onError: (_error, _variables, context) => {
      if (context?.previousHistory) {
        queryClient.setQueryData(explorerSearchHistoryQueryKey, context.previousHistory);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(explorerSearchHistoryQueryKey, data);
    },
  });

  const addEntry = useCallback(
    (entry: string) => {
      if (!entry) {
        return;
      }
      addEntryMutation.mutate(entry);
    },
    [addEntryMutation],
  );

  const clearHistory = useCallback(() => {
    clearHistoryMutation.mutate();
  }, [clearHistoryMutation]);

  return {
    history: historyQuery.data ?? [],
    isLoading: historyQuery.isLoading,
    isSaving: addEntryMutation.isPending || clearHistoryMutation.isPending,
    addEntry,
    addEntryAsync: addEntryMutation.mutateAsync,
    clearHistory,
  } as const;
}
