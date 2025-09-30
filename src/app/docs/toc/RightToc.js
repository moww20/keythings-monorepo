"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

export default function RightToc() {
  const [headings, setHeadings] = useState([])
  const [active, setActive] = useState(null)
  const pathname = usePathname()

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll("main h2, main h3"))
    // Generate unique IDs with suffixes if duplicates appear
    const used = new Map()
    const mapped = nodes.map((n) => {
      const base = (n.id || n.textContent?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "").replace(/(^-|-$)/g, "")
      const count = (used.get(base) || 0) + 1
      used.set(base, count)
      const id = count > 1 ? `${base}-${count}` : base
      return { id, text: n.textContent || "" }
    })
    // Ensure IDs exist on DOM nodes (match mapped ordering)
    nodes.forEach((n, i) => { if (!n.id || n.id !== mapped[i].id) n.id = mapped[i].id })
    setHeadings(mapped)

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)
      if (visible[0]) setActive(visible[0].target.id)
    }, { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] })
    nodes.forEach(n => observer.observe(n))

    const onHash = () => {
      const id = location.hash.replace('#','')
      if (!id) return
      setActive(id)
    }
    window.addEventListener('hashchange', onHash)
    return () => {
      observer.disconnect()
      window.removeEventListener('hashchange', onHash)
    }
  }, [pathname])

  if (headings.length === 0) return null

  return (
    <div className="w-64 max-xl:hidden">
      <div className="mb-2 text-sm text-[--color-muted]">On this page</div>
      <nav className="grid gap-1 text-sm">
        {headings.map((h) => (
          <a key={h.id} href={`#${h.id}`} className={`toc-item px-2 py-1 rounded-full ${active===h.id? 'is-active' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              const el = document.getElementById(h.id)
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              history.replaceState(null, '', `#${h.id}`)
              setActive(h.id)
            }}
          >{h.text}</a>
        ))}
      </nav>
    </div>
  )
}


