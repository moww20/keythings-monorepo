"use client"

import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
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
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                asChild={!item.disabled}
                isActive={isActivePath(item.url)}
                disabled={item.disabled}
                className={item.disabled ? "opacity-50 cursor-not-allowed" : ""}
              >
                {item.disabled ? (
                  <div className="flex items-center gap-2">
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </div>
                ) : (
                  <a
                    href={item.url}
                    aria-current={isActivePath(item.url) ? "page" : undefined}
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </a>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
