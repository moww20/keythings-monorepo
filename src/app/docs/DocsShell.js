"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import DocsSidebar from "./toc/DocsSidebar"
import RightToc from "./toc/RightToc"
import DocNav from "./components/DocNav"
import Breadcrumbs from "./components/Breadcrumbs"
import HeadingAnchors from "./components/HeadingAnchors"
import ScrollRestorer from "./components/ScrollRestorer"

export default function DocsShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div>
      <ScrollRestorer />
      <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[10rem_minmax(0,60rem)_10rem] xl:h-[calc(100vh-9rem)] xl:overflow-hidden">
        <div className="hidden xl:block sticky top-[9rem] h-[calc(100vh-9rem)] w-40 flex-shrink-0 overflow-auto"><DocsSidebar /></div>
        <div className="flex-1 min-w-0 h-full overflow-auto xl:max-w-[60rem] xl:w-full">
          <div className="xl:hidden mb-4 hidden">
            <button className="px-3 py-2 rounded-full hairline hover:bg-white/5" onClick={() => setMobileOpen(true)}>Docs menu</button>
          </div>
          <Breadcrumbs />
          <HeadingAnchors />
          <div id="docs-main" className="origin-top animate-fadein-500">
            {children}
          </div>
          <div className="mt-8 pt-6">
            <DocNav />
          </div>
        </div>
        <div className="hidden xl:block sticky top-[9rem] h-[calc(100vh-9rem)] w-40 flex-shrink-0 overflow-auto"><RightToc /></div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] xl:hidden">
          <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={()=>setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-40 max-w-[85vw] bg-[#0b0b0b] shadow-2xl hairline-r overflow-auto scroll-y-subtle p-2">
            <DocsSidebar />
          </div>
        </div>
      )}
    </div>
  )
}


