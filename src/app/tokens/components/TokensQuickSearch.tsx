"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import Toast from "@/app/components/Toast";

import { resolveTokenTarget } from "../utils/resolveTokenPath";

export default function TokensQuickSearch(): React.JSX.Element {
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
    
    const target = resolveTokenTarget(trimmed);

    if (!target) {
      const message = "Enter a valid token address, symbol, or metadata identifier.";
      setError(message);
      Toast.error(message);
      return;
    }

    setIsSubmitting(true);

    try {
      let destination = target.path;

      if (target.type === "token") {
        
        // Prefer client-side wallet lookup via Keeta provider to avoid server 404s
        const keeta = typeof window !== 'undefined' ? (window as typeof window & { keeta?: { getAccountInfo?: (addr: string) => Promise<unknown> } }).keeta : undefined;
        
        if (keeta?.getAccountInfo) {
          try {
            const info = await keeta.getAccountInfo(trimmed);
            
            const token: any = info ?? {};
            const tokenType = String(token?.type ?? '').toUpperCase();

            if (tokenType === 'TOKEN') {
              destination = `/tokens/token/${trimmed}`;
            } else {
              destination = `/tokens/token/${trimmed}`;
            }
          } catch (e) {
            // If lookup fails, still navigate to the token view
            destination = `/tokens/token/${trimmed}`;
          }
        } else {
          // Fallback: navigate directly; the page will handle fetching/empty states
          destination = `/tokens/token/${trimmed}`;
        }
      }

      setError(null);
      router.push(destination);
    } catch (lookupError) {
      const message = "Unable to resolve token resource. Please try again.";
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
        <label htmlFor="token-search" className="text-xs font-medium text-muted">
          Search for tokens
        </label>
        <div className="flex flex-col gap-2 rounded-xl border border-soft bg-[color:color-mix(in_oklab,var(--foreground)_4%,transparent)] p-2">
          <input
            id="token-search"
            name="token-search"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Search by token address, symbol, or metadata"
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

