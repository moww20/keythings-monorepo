import React from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

interface ExplorerLayoutProps {
  children: React.ReactNode;
}

export default function ExplorerLayout(
  { children }: ExplorerLayoutProps,
): React.JSX.Element {
  return (
    <div className="h-screen bg-background">
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <div className="flex h-full flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
