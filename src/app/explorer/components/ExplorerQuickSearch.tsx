"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import Toast from "@/app/components/Toast";

import { useExplorerSearchHistory } from "../hooks/useExplorerSearchHistory";
import { resolveExplorerTarget, truncateIdentifier } from "../utils/resolveExplorerPath";
import { getAccountState } from "@/lib/explorer/sdk-read-client";

export default function ExplorerQuickSearch(): React.JSX.Element {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { history, addEntry: addHistoryEntry } = useExplorerSearchHistory();

  const resolvedTarget = useMemo(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return null;
    }
    return resolveExplorerTarget(trimmed);
  }, [inputValue]);

  const handleNavigate = useCallback(
    (path: string, historyEntry?: string) => {
      if (!path) return;
      setError(null);
      if (historyEntry) {
        addHistoryEntry(historyEntry);
      }
      try {
        void router.prefetch(path);
      } catch {
        // ignore prefetch failures – navigation will still proceed
      }
      router.push(path);
    },
    [router, addHistoryEntry],
  );

  const refineAccountDestination = useCallback(
    async (publicKey: string) => {
      const keeta =
        typeof window !== "undefined"
          ? (window as typeof window & {
              keeta?: { getAccountInfo?: (addr: string) => Promise<unknown> };
            }).keeta
          : undefined;

      if (!keeta?.getAccountInfo) {
        // Fall through to SDK lookup when the wallet provider is unavailable
      } else {
        try {
          const info = await keeta.getAccountInfo(publicKey);
          const account: any = info ?? {};
          const accountType = String(account?.type ?? account?.info?.type ?? "").toUpperCase();
          if (accountType === "STORAGE") {
            return `/explorer/storage/${publicKey}`;
          }
          if (accountType === "TOKEN") {
            return `/explorer/token/${publicKey}`;
          }
          if (accountType && accountType !== "ACCOUNT") {
            return null;
          }
        } catch (walletError) {

        }
      }

      try {
        const rawState = await getAccountState(publicKey);
        if (!rawState || typeof rawState !== "object") {
          return null;
        }

        const candidates: Array<Record<string, unknown>> = [];
        const baseState = rawState as Record<string, unknown>;
        candidates.push(baseState);
        if (baseState.account && typeof baseState.account === "object") {
          candidates.push(baseState.account as Record<string, unknown>);
        }

        for (const candidate of candidates) {
          const typeValue = candidate.type ?? (candidate.info as Record<string, unknown> | undefined)?.type;
          const accountType = typeof typeValue === "string" ? typeValue.toUpperCase() : null;
          if (!accountType) {
            continue;
          }

          if (accountType === "STORAGE") {
            return `/explorer/storage/${publicKey}`;
          }
          if (accountType === "TOKEN") {
            return `/explorer/token/${publicKey}`;
          }
          if (accountType === "ACCOUNT") {
            return null;
          }
        }
      } catch (sdkError) {

      }
      return null;
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) {
        return;
      }

      const trimmed = inputValue.trim();
      if (!trimmed) {
        return;
      }

      const target = resolveExplorerTarget(trimmed);
      if (!target) {
        const message =
          "Enter a valid block hash, account, storage identifier, or token address.";
        setError(message);
        Toast.error(message);
        return;
      }

      try {
        setIsSubmitting(true);
        let destination = target.path;

        if (target.type === "account") {
          const refined = await refineAccountDestination(trimmed);
          if (refined) {
            destination = refined;
          }
        }

        handleNavigate(destination, trimmed);
      } catch (lookupError) {
        console.error(
          "[EXPLORER_SEARCH] Failed to resolve explorer resource",
          lookupError,
        );
        const message =
          "Unable to resolve explorer resource. Please try again.";
        setError(message);
        Toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [handleNavigate, inputValue, isSubmitting, refineAccountDestination],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="explorer-command"
          className="text-xs font-medium uppercase tracking-[0.3em] text-muted"
        >
          Search the network
        </label>
        <div className="rounded-xl border border-hairline bg-card/80 p-3 backdrop-blur-xl">
          <Command className="rounded-lg border border-transparent bg-card text-foreground shadow-sm">
            <CommandInput
              ref={inputRef}
              id="explorer-command"
              value={inputValue}
              onValueChange={setInputValue}
              placeholder="Search by block hash, address, storage identifier, or token…"
              className="h-11 rounded-lg text-sm text-foreground placeholder:text-muted"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                  void handleSubmit(event as unknown as FormEvent<HTMLFormElement>);
                }
              }}
            />
              <CommandList className="max-h-64">
              {resolvedTarget ? (
                <CommandGroup heading="Detected">
                  <CommandItem
                    value={`navigate-${resolvedTarget.type}`}
                    onSelect={() => void handleNavigate(resolvedTarget.path, inputValue.trim())}
                    className="flex flex-col items-start gap-1"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {resolvedTarget.type === "block"
                        ? "View Block"
                        : resolvedTarget.type === "token"
                          ? "View Token"
                          : "View Account"}
                    </span>
                    <span className="text-xs text-muted break-all">
                      {inputValue.trim()}
                    </span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {history.length > 0 ? (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Recent">
                    {history.map((entry) => {
                      const target = resolveExplorerTarget(entry);
                      const label = target?.type === "block"
                        ? `Block ${truncateIdentifier(entry, 6, 4)}`
                        : target?.type === "token"
                          ? `Token ${truncateIdentifier(entry, 6, 4)}`
                          : target?.type === "account"
                            ? `Account ${truncateIdentifier(entry, 6, 4)}`
                            : entry;
                      return (
                        <CommandItem
                          key={entry}
                          value={entry}
                          onSelect={() => {
                            if (target) {
                              void handleNavigate(target.path, entry);
                            } else {
                              setInputValue(entry);
                            }
                          }}
                          className="flex flex-col items-start gap-1"
                        >
                          <span className="text-sm font-medium text-foreground">
                            {label}
                          </span>
                          <span className="text-xs text-muted break-all">
                            {entry}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              ) : null}
            </CommandList>
          </Command>
          <div className="mt-3 flex items-center justify-between gap-3">
            <Button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || !inputValue.trim()}
            >
              Search
            </Button>
            <div className="hidden items-center gap-2 rounded-full border border-soft px-3 py-1 text-xs text-muted sm:flex">
              <span>Press</span>
              <code className="rounded-md bg-[color:var(--surface-tint)] px-2 py-0.5 text-foreground">
                /
              </code>
              <span>to focus</span>
            </div>
          </div>
        </div>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </form>
  );
}
