'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, ShoppingCart, UserCircle, Settings, ArrowLeftRight, TrendingUp, Rocket, Image, Droplets } from 'lucide-react';

export default function WalletLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path) => pathname === path;

  const menuItems = [
    { path: '/home', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
    { path: '/assets', label: 'Assets', icon: Wallet, enabled: true },
    { path: null, label: 'Open Orders', icon: ShoppingCart, enabled: false },
    { path: null, label: 'OTC Swap', icon: ArrowLeftRight, enabled: false },
    { path: null, label: 'Trade', icon: TrendingUp, enabled: false },
    { path: null, label: 'Launchpad', icon: Rocket, enabled: false },
    { path: null, label: 'NFT Marketplace', icon: Image, enabled: false },
    { path: null, label: 'Liquidity Pools (Beta)', icon: Droplets, enabled: false },
    { path: null, label: 'Account', icon: UserCircle, enabled: false },
    { path: '/settings', label: 'Settings', icon: Settings, enabled: true },
  ];

  const handleMenuClick = (item) => {
    if (!item.enabled) return;
    
    if (item.path) {
      router.push(item.path);
      setIsMobileMenuOpen(false);
    } else if (item.onClick) {
      item.onClick();
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <main className="relative overflow-hidden min-h-screen bg-[color:var(--background)]">
      <div className="absolute inset-0 -z-10 bg-[color:var(--background)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[-20%] z-0 h-[480px] bg-gradient-to-b from-[color:color-mix(in_oklab,var(--foreground)_18%,transparent)] via-transparent to-transparent blur-3xl" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[16rem_minmax(0,1fr)] xl:h-[calc(100vh-8rem)] xl:overflow-hidden">
          {/* Left Sidebar */}
          <aside className="hidden xl:block sticky top-[8rem] h-[calc(100vh-8rem)] w-64 flex-shrink-0 overflow-auto glass border border-hairline rounded-2xl">
            <div className="p-4">
              <nav className="space-y-1">
                {menuItems.map((item, index) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handleMenuClick(item)}
                      disabled={!item.enabled}
                      className={`flex items-center gap-2 px-3 py-2 text-base font-medium rounded-lg w-full text-left transition-none ${
                        !item.enabled
                          ? 'text-muted/40 cursor-not-allowed opacity-50'
                          : active
                          ? 'text-foreground bg-surface-strong'
                          : 'text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong group'
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0 group-hover:text-foreground transition-none" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content Panel */}
          <div className="flex-1 min-w-0 h-full overflow-auto xl:w-full flex flex-col">
            {/* Mobile Menu Button */}
            <div className="xl:hidden mb-4">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="glass rounded-lg border border-hairline p-3 text-foreground hover:bg-surface transition-colors"
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Mobile Sidebar */}
            {isMobileMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 bg-black/50 z-40 xl:hidden"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
                <div className="fixed inset-y-0 left-0 w-64 glass border-r border-hairline z-50 xl:hidden overflow-auto">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-foreground">Menu</h2>
                      <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="p-2 hover:bg-surface rounded-lg transition-colors"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <nav className="space-y-1">
                      {menuItems.map((item, index) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);
                        
                        return (
                          <button
                            key={index}
                            onClick={() => handleMenuClick(item)}
                            disabled={!item.enabled}
                            className={`flex items-center gap-2 px-3 py-2 text-base font-medium rounded-lg w-full text-left transition-none ${
                              !item.enabled
                                ? 'text-muted/40 cursor-not-allowed opacity-50'
                                : active
                                ? 'text-foreground bg-surface-strong'
                                : 'text-muted hover:text-foreground hover:bg-surface-strong hover:border hover:border-hairline-strong group'
                            }`}
                          >
                            <Icon className="h-5 w-5 flex-shrink-0 group-hover:text-foreground transition-none" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                </div>
              </>
            )}

            {/* Page Content */}
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

