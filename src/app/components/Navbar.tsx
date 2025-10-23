"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Wallet, LogOut, LayoutDashboard, ShoppingCart, ArrowLeftRight, TrendingUp, Rocket, Image, Droplets, UserCircle, Settings } from "lucide-react";
import { siX, siDiscord } from "simple-icons";

import type { KeetaProvider } from "@/types/keeta";
import SearchBar from "./SearchBar";
import ThemeToggle from "./ThemeToggle";
import Toast from "./Toast";
import { useWallet } from "@/app/contexts/WalletContext";

interface MenuItem {
  path: string | null;
  label: string;
  icon: React.ComponentType<any>;
  enabled: boolean;
  onClick?: () => void;
}

export default function Navbar(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const wallet = useWallet();
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const mobileOpen = openMenuPath === pathname;
  const openMobileMenu = useCallback(() => setOpenMenuPath(pathname), [pathname]);
  const closeMobileMenu = useCallback(() => setOpenMenuPath(null), []);
  const isClient = typeof window !== "undefined";
  const navRef = useRef<HTMLElement | null>(null);

  const updateNavHeight = useCallback(() => {
    if (typeof window === "undefined") return;
    const element = navRef.current;
    if (!element) return;
    document.documentElement.style.setProperty("--app-nav-height", `${element.offsetHeight}px`);
  }, []);

  const isActive = (path: string) => pathname === path;

  const menuItems: MenuItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
    { path: '/trade', label: 'Trade', icon: TrendingUp, enabled: true },
    { path: null, label: 'OTC Swap', icon: ArrowLeftRight, enabled: false },
    { path: null, label: 'Launchpad', icon: Rocket, enabled: false },
    { path: null, label: 'NFT Marketplace', icon: Image, enabled: false },
    { path: null, label: 'Account', icon: UserCircle, enabled: false },
    { path: null, label: 'Settings', icon: Settings, enabled: false },
  ];

  const handleMenuClick = (item: MenuItem) => {
    if (!item.enabled) return;
    
    if (item.path) {
      router.push(item.path);
    } else if (item.onClick) {
      item.onClick();
    }
  };

  const redirectToDashboard = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/dashboard") {
      router.push("/dashboard");
    }
  }, [router]);

  // Wallet connection state is now managed by the centralized wallet context

  useEffect(() => {
    updateNavHeight();
    if (typeof window === "undefined") return;

    const handleResize = () => updateNavHeight();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateNavHeight]);

  useEffect(() => {
    updateNavHeight();
  }, [updateNavHeight, wallet.isConnected, mobileOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeMobileMenu]);

  const waitForWallet = async (maxAttempts = 20): Promise<KeetaProvider | null> => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (typeof window.keeta !== "undefined" && window.keeta) {
        return window.keeta;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  };

  const connectWallet = async (): Promise<void> => {
    try {
      // Connect wallet and automatically request read capabilities for explorer functionality
      await wallet.connectWallet(true); // Pass true to request read capabilities
      // Only redirect to dashboard if we're on the root page
      if (window.location.pathname === "/" || window.location.pathname === "") {
        redirectToDashboard();
      }
    } catch (error) {
      console.error("Connection failed:", error);
      if (error instanceof Error && (error.message.includes("User rejected") || error.message.includes("rejected"))) {
        Toast.warning("Connection request rejected. Please approve the connection in your wallet.");
      } else {
        Toast.error("Failed to connect wallet. Please try again.");
      }
    }
  };

  const disconnectWallet = async (): Promise<void> => {
    // The wallet context handles disconnection automatically
    // No need for local state management
  };

  const formatAddress = (address: string | null): string => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const linkClass = (href: string): string =>
    `px-3 py-1.5 rounded-full text-sm transition ${pathname.startsWith(href) ? "bg-white/10 text-foreground" : "text-foreground/90 hover:bg-white/5"}`;
  return (
    <motion.nav
      ref={navRef}
      className="sticky top-0 z-50 backdrop-blur-sm hairline-b bg-[color:var(--background)]/90 [html[data-theme='light']_&]:bg-[color:var(--background)]/95"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* Top Row - Logo, Search, Actions */}
        <div className="grid grid-cols-3 items-center mb-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="text-lg tracking-tight font-semibold text-foreground">Keythings Wallet</span>
            </Link>
          </div>
          <div className="flex items-center justify-center">
            <SearchBar />
          </div>
          <div className="flex items-center justify-end gap-3 flex-shrink-0">
          <a
            href="https://x.com/keythings"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
            className="inline-flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-full hover:bg-white/5 text-foreground/90"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <path d={siX.path} />
            </svg>
          </a>
          <a
            href="https://discord.gg/keythings"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Discord"
            className="inline-flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-full hover:bg-white/5 text-foreground/90"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <path d={siDiscord.path} />
            </svg>
          </a>
          <ThemeToggle />
          <a 
            href="https://docs.keythings.xyz/docs/introduction" 
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Documentation"
            className="inline-flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-full hover:bg-white/5 text-foreground/90 max-[519px]:hidden"
          >
            <BookOpen className="w-5 h-5" />
          </a>
          {wallet.isConnected ? (
            <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0 rounded-full border border-hairline bg-white/10 text-foreground text-sm font-medium max-[519px]:hidden">
              <Wallet className="w-4 h-4" />
              <span>{formatAddress(wallet.publicKey)}</span>
              <button
                type="button"
                onClick={disconnectWallet}
                aria-label="Disconnect wallet"
                className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-white/20 text-foreground/70 hover:text-foreground transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={connectWallet}
              className="px-4 py-2 flex-shrink-0 rounded-full border border-transparent bg-white/10 hover:bg-white/20 hover:shadow-lg hover:shadow-white/10 text-foreground text-sm font-medium transition-all duration-200 max-[519px]:hidden [html[data-theme='light']_&]:border-gray-300 [html[data-theme='light']_&]:hover:shadow-gray-300/50"
            >
              Connect Wallet
            </button>
          )}
          <button
            type="button"
            aria-label="Open menu"
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/5 text-foreground/90"
            onClick={() => (mobileOpen ? closeMobileMenu() : openMobileMenu())}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          </div>
        </div>
        
        {/* Bottom Row - Navigation Tabs */}
        <div className="flex items-center justify-between overflow-x-auto gap-1">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const active = item.path ? isActive(item.path) : false;
            
            return (
              <button
                key={index}
                onClick={() => handleMenuClick(item)}
                disabled={!item.enabled}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
                  !item.enabled
                    ? 'text-muted/40 cursor-not-allowed opacity-50'
                    : active
                    ? 'text-foreground bg-surface-strong border border-hairline'
                    : 'text-muted hover:text-foreground hover:bg-white/10'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
      {isClient && createPortal(
        (
          <AnimatePresence>
            {mobileOpen && (
              <>
                <motion.button
                  aria-label="Close menu"
                  className="fixed inset-0 z-[100] bg-black/0 sm:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.45 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={closeMobileMenu}
                />
                <motion.div
                  className="fixed inset-y-0 right-0 z-[101] w-80 max-w-[85vw] bg-[#0b0b0b] shadow-2xl hairline-l sm:hidden p-4"
                  initial={{ x: 320 }}
                  animate={{ x: 0 }}
                  exit={{ x: 320 }}
                  transition={{ type: "spring", stiffness: 420, damping: 40 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[--color-muted]">Menu</span>
                    <button
                      aria-label="Close"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/5"
                      onClick={closeMobileMenu}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid gap-2">
                    <a 
                      href="https://docs.keythings.xyz/docs/introduction" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition bg-white/10 text-foreground hover:bg-white/15"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Docs</span>
                    </a>
                    {wallet.isConnected ? (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-hairline bg-white/10 text-foreground text-sm font-medium">
                        <Wallet className="w-4 h-4" />
                        <span className="flex-1">{formatAddress(wallet.publicKey)}</span>
                        <button
                          type="button"
                          onClick={disconnectWallet}
                          aria-label="Disconnect wallet"
                          className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-white/20 text-foreground/70 hover:text-foreground transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={connectWallet}
                        className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 hover:shadow-lg hover:shadow-white/10 text-foreground text-sm font-medium transition-all duration-200 text-left [html[data-theme='light']_&]:border [html[data-theme='light']_&]:border-gray-300 [html[data-theme='light']_&]:hover:shadow-gray-300/50"
                      >
                        Connect Wallet
                      </button>
                    )}
                    <div className="flex items-center gap-3 pt-2">
                      <a href="https://x.com/keythings" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/5 text-foreground/90">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d={siX.path} /></svg>
                      </a>
                      <a href="https://discord.gg/keythings" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/5 text-foreground/90">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d={siDiscord.path} /></svg>
                      </a>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        ),
        document.body
      )}
    </motion.nav>
  )
}


