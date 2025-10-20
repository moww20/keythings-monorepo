"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { resolveExplorerPath } from "../utils/resolveExplorerPath";

export default function ExplorerQuickSearch(): React.JSX.Element {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPath = resolveExplorerPath(inputValue);
    if (!nextPath) {
      setError("Enter a valid block hash, account, storage, or token address.");
      return;
    }

    setError(null);
    router.push(nextPath);
  }, [inputValue, router]);

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
            className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90"
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
