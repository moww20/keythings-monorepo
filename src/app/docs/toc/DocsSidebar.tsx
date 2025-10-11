"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { docsItems } from "./items";

type OpenState = Record<string, boolean>;

export default function DocsSidebar(): JSX.Element {
  const pathname = usePathname();
  const [open, setOpen] = useState<OpenState>({});

  // Restore persisted state on mount (client-only) to avoid SSR mismatch
  useEffect(() => {
    try {
      const raw = localStorage.getItem("keythings.docs.open");
      if (raw) {
        const parsed = JSON.parse(raw) as OpenState;
        if (parsed && typeof parsed === "object") {
          setOpen(parsed);
        }
      }
    } catch {
      // Ignore malformed persisted state
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("keythings.docs.open", JSON.stringify(open));
    } catch {
      // Ignore persistence errors (e.g., private mode)
    }
  }, [open]);

  // Auto-open the section containing the current page
  useEffect(() => {
    setOpen((prev) => {
      const next: OpenState = { ...prev };
      for (const section of docsItems) {
        const has = section.children.some((child) => pathname.startsWith(child.href));
        if (has) next[section.label] = true;
      }
      return next;
    });
  }, [pathname]);

  return (
    <aside className="w-48 max-w-[70vw] shrink-0">
      <div>
        <div className="mb-6 text-xs font-semibold uppercase tracking-wider text-[--color-muted]">Documentation</div>
        <div className="grid gap-2">
          {docsItems.map((section) => (
            <div key={section.label}>
              <button
                onClick={() => setOpen((current) => ({ ...current, [section.label]: !current[section.label] }))}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 flex items-center justify-between group"
                aria-expanded={open[section.label] ? "true" : "false"}
              >
                <span className="text-sm font-semibold text-foreground group-hover:text-foreground transition-colors">{section.label}</span>
                <svg className={`w-3.5 h-3.5 transition-transform duration-200 text-foreground/60 group-hover:text-foreground/80 ${open[section.label] ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 10l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {open[section.label] && (
                <nav className="mt-2 pl-3 grid gap-0.5">
                  {section.children.map((item) => {
                    const active = pathname.startsWith(item.href)
                    return (
                      <Link key={item.href} href={item.href}
                        className={`toc-item px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                          active 
                            ? "is-active text-foreground bg-white/10" 
                            : "text-foreground/70 hover:text-foreground hover:bg-white/5"
                        }`}>
                        {item.label}
                      </Link>
                    )
                  })}
                </nav>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}


