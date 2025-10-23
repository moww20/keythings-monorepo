"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { docsItems, flatDocs, type DocsNavItem } from "../docs/toc/items";

// Build a quick lookup from href -> section label for breadcrumb-like hint
const hrefToSection = (() => {
  const map = new Map<string, string>();
  for (const section of docsItems) {
    for (const child of section.children ?? []) {
      map.set(child.href, section.label);
    }
  }
  return map;
})();

export default function SearchBar(): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo<DocsNavItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);

    const scored = flatDocs.map((item) => {
      const label = (item.label ?? "").toLowerCase();
      const description = (item.description ?? "").toLowerCase();
      let score = 0;

      for (const token of tokens) {
        if (!token) continue;
        if (label.startsWith(token)) score += 100;
        else if (label.includes(token)) score += 80;
        if (description.includes(token)) score += 40;
      }

      return { item, score };
    });

    return scored
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.length - b.item.label.length)
      .slice(0, 7)
      .map((entry) => entry.item);
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Quick open with '/'
      if (event.key === "/" && document.activeElement !== inputRef.current) {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  const onSelect = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <div ref={containerRef} className="w-full max-w-[20rem]">
      <div className="relative input-pill rounded-full hairline">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[--color-muted]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => {
                if (results.length === 0) return 0;
                return Math.min(index + 1, results.length - 1);
              });
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => {
                if (results.length === 0) return 0;
                return Math.max(index - 1, 0);
              });
            } else if (event.key === "Enter") {
              const target = results[activeIndex];
              if (target) onSelect(target.href);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          type="text"
          placeholder="Search docs..."
          className="w-full h-10 rounded-full bg-transparent pl-9 pr-10 text-sm placeholder:text-[--color-muted] focus:outline-none"
          suppressHydrationWarning
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[--color-muted]">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md hairline bg-white/5 text-[11px]">/</span>
        </span>

        {open && query && results.length > 0 && (
          <div className="absolute left-0 right-0 mt-2 z-[60] rounded-xl border border-white/10 shadow-xl overflow-hidden bg-[#1e1f23] [html[data-theme='light']_&]:bg-[#e7e9ee] search-dropdown">
            <ul className="py-1 max-h-72 overflow-auto">
              {results.map((res, idx) => {
                const section = hrefToSection.get(res.href);
                const isActive = idx === activeIndex;
                return (
                  <li key={res.href}>
                    <button
                      className={`w-full text-left px-3 py-2 text-sm search-item ${isActive ? "is-active" : ""}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onSelect(res.href)}
                    >
                      <div className="text-foreground/95">
                        {section ? `${section} / ${res.label}` : res.label}
                      </div>
                      {res.description && (
                        <div className="text-[12px] text-[--color-muted] line-clamp-1">{res.description}</div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}