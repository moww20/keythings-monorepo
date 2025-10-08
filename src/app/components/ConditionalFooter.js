"use client"

import { usePathname } from "next/navigation"
import Footer from "./Footer"

export default function ConditionalFooter() {
  const pathname = usePathname()
  
  // Pages where footer should NOT be shown
  const noFooterPages = [
    '/home',
    // Add other dashboard/admin pages here if needed
  ]
  
  // Check if current page should not have footer
  const shouldHideFooter = noFooterPages.some(page => pathname === page)
  
  // Don't render footer on specified pages
  if (shouldHideFooter) {
    return null
  }
  
  // Show footer on all other pages (splash, docs, etc.)
  return <Footer />
}
