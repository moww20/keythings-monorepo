import React from "react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import DocsShell from "./DocsShell";

export const metadata: Metadata = {
  title: "Keythings Website Docs",
  description: "Documentation for Keythings - The world's most advanced cryptocurrency wallet.",
  openGraph: {
    title: "Keythings Website Docs",
    description: "Documentation for Keythings - The world's most advanced cryptocurrency wallet.",
    url: "/docs",
    siteName: "Keythings Website Docs",
    images: [
      { url: "/icons/kethingslogopng.png", width: 1200, height: 630, alt: "Keythings Website" },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Keythings Website Docs",
    description: "Documentation for Keythings - The world's most advanced cryptocurrency wallet.",
    images: ["/icons/kethingslogopng.png"],
  },
};

interface DocsLayoutProps {
  children: ReactNode;
}

export default function DocsLayout({ children }: DocsLayoutProps): React.JSX.Element {
  return (
    <main className="min-h-[80vh] max-w-7xl mx-auto px-6 py-10" role="main">
      <DocsShell>{children}</DocsShell>
    </main>
  );
}


