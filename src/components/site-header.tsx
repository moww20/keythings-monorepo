import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { IconWallet, IconShield } from "@tabler/icons-react"

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">Wallet Dashboard</h1>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:flex">
            <IconShield className="mr-1 h-3 w-3" />
            Secure
          </Badge>
          <Button variant="ghost" asChild size="sm" className="hidden sm:flex">
            <a
              href="/settings"
              className="dark:text-foreground"
            >
              <IconWallet className="mr-1 h-3 w-3" />
              Settings
            </a>
          </Button>
        </div>
      </div>
    </header>
  )
}
