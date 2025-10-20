import { AppSidebar } from "@/components/app-sidebar"
import { WalletChart } from "@/components/wallet-chart"
import DashboardClient from "./dashboard-client"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function Page() {
  return (
    <div className="h-screen bg-background">
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <div className="flex flex-1 flex-col h-full">
            <div className="@container/main flex flex-1 flex-col gap-2 overflow-auto">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <DashboardClient />
                <div className="px-4 lg:px-6">
                  <WalletChart />
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
