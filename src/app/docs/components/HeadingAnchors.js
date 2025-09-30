"use client"

import { useEffect } from "react"

function slugify(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

export default function HeadingAnchors() {
  useEffect(() => {
    try {
      const headings = Array.from(document.querySelectorAll("main h2, main h3"))
      const usedIds = new Map()
      headings.forEach((h) => {
        if (!h.id) h.id = slugify(h.textContent)
        // Ensure uniqueness by appending a numeric suffix when needed
        let base = h.id
        let count = usedIds.get(base) || 0
        if (count > 0) {
          h.id = `${base}-${count + 1}`
        }
        usedIds.set(base, count + 1)
        h.classList.add("group", "relative", "pr-8")
        // Avoid duplicating button
        if (h.querySelector('[data-anchor-btn]')) return
        const btn = document.createElement("button")
        btn.setAttribute("data-anchor-btn", "")
        btn.setAttribute("aria-label", "Copy link to heading")
        btn.className = "absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition text-[--color-muted] hover:text-foreground"
        const svgNS = "http://www.w3.org/2000/svg"
        const svg = document.createElementNS(svgNS, "svg")
        svg.setAttribute("width", "16")
        svg.setAttribute("height", "16")
        svg.setAttribute("viewBox", "0 0 24 24")
        svg.setAttribute("fill", "none")
        const path = document.createElementNS(svgNS, "path")
        path.setAttribute("d", "M10 14l4-4m-7 7a4 4 0 010-6l1-1m8 8a4 4 0 010-6l-1-1")
        path.setAttribute("stroke", "currentColor")
        path.setAttribute("stroke-width", "1.6")
        path.setAttribute("stroke-linecap", "round")
        path.setAttribute("stroke-linejoin", "round")
        svg.appendChild(path)
        btn.appendChild(svg)
        btn.addEventListener("click", async (e) => {
          e.preventDefault()
          const url = `${location.origin}${location.pathname}#${h.id}`
          try { await navigator.clipboard.writeText(url) } catch {}
          history.replaceState(null, "", `#${h.id}`)
        })
        h.appendChild(btn)
      })
    } catch {}
  })
  return null
}


