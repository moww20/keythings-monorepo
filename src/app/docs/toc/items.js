// Hierarchical structure used for sidebar, breadcrumbs, and next/prev
export const docsItems = [
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
    label: "Developer Documentation",
    children: [
      { href: "/docs/developer/api-reference", label: "API Reference", description: "Complete API documentation for dApp integration." },
      { href: "/docs/developer/integration", label: "Integration Guide", description: "Build dApps that work with Keythings Wallet." },
      { href: "/docs/developer/security", label: "Security for Developers", description: "Security considerations for dApp development." },
    ],
  },
  {
    label: "Project",
    children: [
      { href: "/docs/brand-guides", label: "Brand Guidelines", description: "Keythings Wallet brand identity and usage." },
      { href: "/docs/licensing", label: "Licensing", description: "Open source licenses and code usage." },
    ],
  },
]

// Flattened list for next/prev ordering
export const flatDocs = docsItems.flatMap(section => section.children)


