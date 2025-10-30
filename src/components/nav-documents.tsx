"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavDocuments({
  items,
}: {
  items: {
    name: string
    url: string
    icon: LucideIcon
    disabled?: boolean
  }[]
}) {
  const pathname = usePathname()
  const isActivePath = (url: string) => {
    if (url === "/") {
      return pathname === url
    }
    return pathname === url || pathname.startsWith(`${url}/`)
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton 
              asChild={!item.disabled}
              isActive={isActivePath(item.url)}
              disabled={item.disabled}
              className={item.disabled ? "opacity-50 cursor-not-allowed" : ""}
            >
              {item.disabled ? (
                <div className="flex items-center gap-2">
                  <item.icon />
                  <span>{item.name}</span>
                </div>
              ) : (
                <Link
                  href={item.url}
                  prefetch
                  aria-current={isActivePath(item.url) ? "page" : undefined}
                >
                  <item.icon />
                  <span>{item.name}</span>
                </Link>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
