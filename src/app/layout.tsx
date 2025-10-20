import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import AppProviders from "./components/AppProviders";
import WalletRedirector from "./components/WalletRedirector";
import ForceDarkTheme from "./components/ForceDarkTheme";

export const metadata: Metadata = {
  title: "Keythings Wallet",
  description: "Secure non-custodial browser extension for the Keeta Network. Complete documentation and developer guides.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://keythings.vercel.app"),
  icons: {
    icon: "/icons/keythingslogo.ico",
    shortcut: "/icons/keythingslogo.ico",
    apple: "/icons/keythings-logo.PNG",
  },
  openGraph: {
    title: "Keythings Wallet",
    description: "Secure non-custodial browser extension for the Keeta Network. Complete documentation and developer guides.",
    images: [{ url: "/icons/keythings-logo.PNG" }],
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <AppProviders>
          <ForceDarkTheme>
            <WalletRedirector />
            <main className="min-h-screen">
              {children}
            </main>
          </ForceDarkTheme>
        </AppProviders>
      </body>
    </html>
  );
}
