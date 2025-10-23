'use client';

import type { CSSProperties } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SendModal from '@/app/components/SendModal';
import AirdropUpload from './components/AirdropUpload';

export default function SendPage() {
  return (
    <div className="h-screen bg-background">
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <div className="flex flex-1 flex-col h-full">
            <div className="@container/main flex flex-1 flex-col gap-2 overflow-auto">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="px-4 lg:px-6">
                  <div className="space-y-8">
                    <div>
                      <h1 className="mb-2 text-3xl font-bold text-foreground">Send Tokens</h1>
                      <p className="text-muted">Choose how you want to distribute your assets</p>
                    </div>

                    <Tabs defaultValue="single" className="space-y-6">
                      <TabsList>
                        <TabsTrigger value="single">Single recipient</TabsTrigger>
                        <TabsTrigger value="airdrop">Airdrop via CSV</TabsTrigger>
                      </TabsList>

                      <TabsContent value="single" className="space-y-6">
                        <SendModal
                          inline
                          className="w-full"
                          title="Single recipient"
                          description="Transfer tokens to one Keeta address."
                        />
                      </TabsContent>

                      <TabsContent value="airdrop" className="space-y-6">
                        <AirdropUpload />
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
