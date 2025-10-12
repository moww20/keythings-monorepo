export interface DocsNavItem {
  href: string;
  label: string;
  description?: string;
}

export interface DocsSection {
  label: string;
  children: DocsNavItem[];
}

// Hierarchical structure used for sidebar, breadcrumbs, and next/prev
export const docsItems: DocsSection[] = [
  {
    label: "User Guide",
    children: [
      { href: "/docs/introduction", label: "Introduction", description: "Overview of Keythings Wallet and the Keeta Network." },
      { href: "/docs/getting-started", label: "Getting Started", description: "Install and set up your Keythings Wallet." },
      { href: "/docs/security", label: "Security Guide", description: "Best practices for keeping your wallet secure." },
      { href: "/docs/privacy-policy", label: "Privacy Policy", description: "How we protect your privacy and data." },
    ],
  },
  {
    label: "Developers Guide",
    children: [
      { href: "/docs/developer/api-reference", label: "API Reference", description: "Complete API documentation for dApp integration." },
      { href: "/docs/developer/integration", label: "Integration Guide", description: "Build dApps that work with Keythings Wallet." },
      {
        href: "/docs/developer/integration/smart-accounts",
        label: "Smart Account Architecture",
        description: "Phase 3 storage accounts and delegated permission workflows.",
      },
      {
        href: "/docs/developer/integration/implementation-roadmap",
        label: "Implementation Roadmap",
        description: "Phase 6 16-week delivery schedule for the hybrid DEX rollout.",
      },
      { href: "/docs/developer/security", label: "Security for Developers", description: "Security considerations for dApp development." },
    ],
  },
  {
    label: "Project",
    children: [
      { href: "/docs/licensing", label: "Licensing", description: "Open source licenses and code usage." },
    ],
  },
];

// Flattened list for next/prev ordering
export const flatDocs: DocsNavItem[] = docsItems.flatMap((section) => section.children);


