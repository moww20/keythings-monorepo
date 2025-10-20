"use client";

import { useEffect, useRef } from "react";

interface ThemeStateSnapshot {
  dataTheme: string | null;
  hasDarkClass: boolean;
}

interface ForceDarkThemeProps {
  children: React.ReactNode;
}

export default function ForceDarkTheme({ children }: ForceDarkThemeProps) {
  const previousThemeRef = useRef<ThemeStateSnapshot | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const element = document.documentElement;

    previousThemeRef.current = {
      dataTheme: element.getAttribute("data-theme"),
      hasDarkClass: element.classList.contains("dark"),
    };

    element.classList.add("dark");
    element.removeAttribute("data-theme");

    return () => {
      if (typeof document === "undefined") return;
      const previous = previousThemeRef.current;
      if (!previous) return;

      if (!previous.hasDarkClass) {
        element.classList.remove("dark");
      }

      if (previous.dataTheme) {
        element.setAttribute("data-theme", previous.dataTheme);
      } else {
        element.removeAttribute("data-theme");
      }
    };
  }, []);

  return <>{children}</>;
}
