"use client";

import React from "react";
import { usePathname } from "next/navigation";

import Footer from "./Footer";

export default function ConditionalFooter(): React.JSX.Element | null {
  const pathname = usePathname();

  // Pages where footer should NOT be shown
  const noFooterPages: readonly string[] = [
    "/dashboard",
    "/assets",
    "/settings",
    "/trade",
    "/explorer",
    "/profile",
    "/send",
    "/history",
    // Add other dashboard/admin pages here if needed
  ];

  // Check if current page should not have footer
  const shouldHideFooter = noFooterPages.some((page) => 
    pathname === page || pathname.startsWith(page + "/")
  );

  // Don't render footer on specified pages
  if (shouldHideFooter) {
    return null;
  }

  // Show footer on all other pages (splash, docs, etc.)
  return <Footer />;
}
