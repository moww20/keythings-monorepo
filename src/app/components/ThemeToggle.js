"use client"

import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

function getSystemPrefersDark() {
  if (typeof window === "undefined") return true
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
}

function applyTheme(theme) {
  if (typeof document === "undefined") return
  const el = document.documentElement
  if (theme === "light") {
    el.setAttribute("data-theme", "light")
  } else {
    el.removeAttribute("data-theme")
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState("dark")

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null
    const initial = saved || (getSystemPrefersDark() ? "dark" : "light")
    setTheme(initial)
    applyTheme(initial)
  }, [])

  useEffect(() => {
    applyTheme(theme)
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme)
    }
  }, [theme])

  const isDark = theme === "dark"

  const trackClass = isDark
    ? "bg-white/5 hover:bg-white/10"
    : "bg-[#d5d8df] hover:bg-[#cbd1db]"

  return (
    <button
      type="button"
      aria-label="Toggle color mode"
      aria-pressed={isDark}
      className={`relative inline-flex items-center justify-center flex-shrink-0 h-7 w-14 rounded-full hairline transition-colors ${trackClass}`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      style={{ minWidth: '3.5rem', minHeight: '1.75rem' }}
    >
      {/* Sun icon - left side */}
      <span 
        className={`absolute left-[0.875rem] top-1/2 -translate-x-1/2 -translate-y-1/2 transition-colors duration-200 z-[1] ${!isDark ? "text-[#6b7280]" : "text-[--color-muted] opacity-50"}`} 
        aria-hidden="true"
      >
        <Sun className="w-3.5 h-3.5" strokeWidth={2} style={{ display: 'block' }} />
      </span>
      
      {/* Moon icon - right side */}
      <span 
        className={`absolute right-[0.875rem] top-1/2 translate-x-1/2 -translate-y-1/2 transition-colors duration-200 z-[1] ${isDark ? "text-[#9ca3af]" : "text-[--color-muted] opacity-50"}`} 
        aria-hidden="true"
      >
        <Moon className="w-3.5 h-3.5" strokeWidth={2} style={{ display: 'block' }} />
      </span>
      
      {/* Sliding thumb */}
      <span
        className={`absolute inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out will-change-transform ${isDark ? "translate-x-[1.75rem]" : "translate-x-0"}`}
        style={{ top: '0.25rem', left: '0.25rem' }}
        aria-hidden="true"
      />
    </button>
  )
}


