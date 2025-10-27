"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type ThemeMode = "light" | "dark";

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (theme === "light") {
    el.setAttribute("data-theme", "light");
    el.classList.remove("dark");
  } else {
    el.removeAttribute("data-theme");
    el.classList.add("dark");
  }
}

export default function ThemeToggle(): React.JSX.Element {
  // Important: Use a deterministic initial value for SSR to avoid hydration mismatch.
  // We then update to the actual user/system preference after the component mounts.
  const [theme, setTheme] = useState<ThemeMode>("dark");

  // On mount (client-only), resolve the real theme and apply it.
  useEffect(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
      const next = saved === "light" || saved === "dark" ? (saved as ThemeMode) : (getSystemPrefersDark() ? "dark" : "light");
      setTheme(next);
      applyTheme(next);
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  const isDark = theme === "dark";

  const trackClass = isDark
    ? "bg-white/5 hover:bg-white/10 border-white/10"
    : "bg-[#e9edf5] hover:bg-[#dce2ee] border-black/5 [html[data-theme='light']_&]:border-[#c7cedd]";

  return (
    <button
      type="button"
      aria-label="Toggle color mode"
      className={`relative inline-flex h-9 w-16 shrink-0 items-center rounded-full border border-transparent px-1.5 transition-colors duration-200 ${trackClass}`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <span className="sr-only">Toggle dark mode</span>

      <span
        className={`absolute inset-y-1 left-1 inline-block h-7 w-7 rounded-full bg-white shadow-md shadow-black/10 transition-transform duration-200 ease-out will-change-transform ${isDark ? "translate-x-7" : "translate-x-0"}`}
        aria-hidden="true"
      />

      <span className="relative z-[1] flex w-full items-center justify-between text-[0.75rem] font-medium">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-200 ${isDark ? "text-[--color-muted]" : "text-[#f59e0b]"}`}
          aria-hidden="true"
        >
          <Sun className="h-4 w-4" strokeWidth={2} />
        </span>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-200 ${isDark ? "text-[#93c5fd]" : "text-[--color-muted]"}`}
          aria-hidden="true"
        >
          <Moon className="h-4 w-4" strokeWidth={2} />
        </span>
      </span>
    </button>
  );
}


