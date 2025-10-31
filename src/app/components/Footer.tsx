"use client";

import React from "react";
import Link from "next/link";
import { siX, siDiscord, siGithub } from "simple-icons";

interface FooterLink {
  href: string;
  label: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

export default function Footer(): React.JSX.Element {
  const currentYear = new Date().getFullYear();
  const docsBase = process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.keythings.xyz";

  const footerSections: FooterSection[] = [
    {
      title: "Product",
      links: [
        { href: `${docsBase}/introduction`, label: "Getting Started" },
        { href: `${docsBase}/developer/integration`, label: "Integration Guide" },
        { href: `${docsBase}/developer/api-reference`, label: "API Reference" },
        { href: `${docsBase}/security`, label: "Security" },
      ],
    },
    {
      title: "Resources",
      links: [
        { href: `${docsBase}`, label: "Documentation" },
        { href: `${docsBase}/tutorials/setup`, label: "Tutorials" },
        { href: `${docsBase}/nostr-basics`, label: "Keeta Network Basics" },
        { href: "https://github.com/moww20/keythings-extension-wallet", label: "GitHub Repository" },
      ],
    },
    {
      title: "Support",
      links: [
        { href: `${docsBase}/privacy-policy`, label: "Privacy Policy" },
        { href: `${docsBase}/licensing`, label: "Licensing" },
        { href: "mailto:support@keythings.wallet", label: "Contact Support" },
        { href: "https://chromewebstore.google.com/", label: "Chrome Web Store" },
      ],
    },
    {
      title: "Community",
      links: [
        { href: "https://x.com/keythings_wallet", label: "X (Twitter)" },
        { href: "https://discord.gg/keythings", label: "Discord" },
        { href: "https://github.com/moww20/keythings-extension-wallet", label: "GitHub" },
        { href: `${docsBase}/authentication`, label: "Authentication" },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              <Link href="/" className="inline-flex items-center gap-3">
                <span className="text-xl font-semibold text-foreground">Keythings Wallet</span>
              </Link>
              <p className="max-w-md text-sm leading-relaxed text-foreground/70">
                Secure non-custodial browser extension for the Keeta Network. Built with enterprise-grade security and an intuitive glassmorphism interface.
              </p>
              <div className="flex items-center gap-4">
                <a
                  href="https://x.com/keythings_wallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X (Twitter)"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 text-foreground/70 hover:text-foreground transition-colors"
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
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 text-foreground/70 hover:text-foreground transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <path d={siDiscord.path} />
                  </svg>
                </a>
                <a
                  href="https://github.com/moww20/keythings-extension-wallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 text-foreground/70 hover:text-foreground transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <path d={siGithub.path} />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Links Sections */}
          {footerSections.map((section) => (
            <div key={section.title} className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {section.title}
              </h3>
              <nav className="space-y-3">
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block text-sm text-foreground/70 hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-foreground/60">
              © {currentYear} Keythings Wallet. All rights reserved.
            </div>
            <div className="flex flex-wrap items-center gap-6 text-xs text-foreground/60">
              <Link href={`${docsBase}/privacy-policy`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground/80 transition-colors">
                Privacy Policy
              </Link>
              <Link href={`${docsBase}/licensing`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground/80 transition-colors">
                Terms of Service
              </Link>
              <a
                href="https://chromewebstore.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground/80 transition-colors"
              >
                Install Extension
              </a>
            </div>
          </div>
          <div className="mt-4 text-xs text-foreground/50">
            Built for the Keeta Network • Non-custodial • Open Source
          </div>
        </div>
      </div>
    </footer>
  );
}
