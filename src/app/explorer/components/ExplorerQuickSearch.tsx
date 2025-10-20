"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import Toast from "@/app/components/Toast";

import { resolveExplorerTarget } from "../utils/resolveExplorerPath";

export default function ExplorerQuickSearch(): React.JSX.Element {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const trimmed = inputValue.trim();
    const target = resolveExplorerTarget(trimmed);

    if (!target) {
      const message = "Enter a valid block hash, account, storage, or token address.";
      setError(message);
      Toast.error(message);
      return;
    }

    setIsSubmitting(true);

    try {
      let destination = target.path;

      if (target.type === "account") {
        const response = await fetch(`/api/explorer/account/${trimmed}`);

        if (response.status === 404) {
          const message = "Account not found on the explorer network.";
          setError(message);
          Toast.error(message);
          return;
        }

        if (!response.ok) {
          throw new Error(`Explorer lookup failed (${response.status})`);
        }

        const data = await response.json() as { account?: { type?: string } };
        const accountType = data?.account?.type;

        if (accountType === "STORAGE") {
          destination = `/explorer/storage/${trimmed}`;
        } else if (accountType === "TOKEN") {
          destination = `/explorer/token/${trimmed}`;
        } else {
          destination = `/explorer/account/${trimmed}`;
        }
      }

      setError(null);
      router.push(destination);
    } catch (lookupError) {
      console.error("Failed to resolve explorer resource", lookupError);
      const message = "Unable to resolve explorer resource. Please try again.";
      setError(message);
      Toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [inputValue, isSubmitting, router]);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="explorer-search" className="text-xs font-medium text-muted">
          Search the network
        </label>
        <div className="flex flex-col gap-2 rounded-xl border border-soft bg-[color:color-mix(in_oklab,var(--foreground)_4%,transparent)] p-2">
          <input
            id="explorer-search"
            name="explorer-search"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Search by block hash, address, storage identifier, or token"
            className="w-full rounded-lg border border-transparent bg-[color:color-mix(in_oklab,var(--background)_80%,transparent)] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent"
            autoComplete="off"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || !inputValue.trim()}
          >
            Search
          </button>
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </form>
  );
}
