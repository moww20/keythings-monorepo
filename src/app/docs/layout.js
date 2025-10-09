import DocsShell from "./DocsShell"

export const metadata = {
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
}

export default function DocsLayout({ children }) {
  return (
    <main className="min-h-[80vh] max-w-7xl mx-auto px-6 py-10" role="main">
      <DocsShell>{children}</DocsShell>
    </main>
  )
}


