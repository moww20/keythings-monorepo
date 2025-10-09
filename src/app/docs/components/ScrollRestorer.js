"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

export default function ScrollRestorer() {
  const pathname = usePathname()
  const isPopRef = useRef(false)

  useEffect(() => {
    const onPop = () => { isPopRef.current = true }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    // Save scroll on scroll (throttled)
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        try { sessionStorage.setItem(`keythings.scroll:${pathname}`, String(window.scrollY)) } catch {}
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  useEffect(() => {
    const key = `keythings.scroll:${pathname}`
    const raw = sessionStorage.getItem(key)
    const y = raw ? parseInt(raw, 10) : 0
    if (isPopRef.current && !Number.isNaN(y)) {
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }))
    }
    isPopRef.current = false
  }, [pathname])

  return null
}


