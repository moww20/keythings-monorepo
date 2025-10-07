import "./globals.css";
import Navbar from "./components/Navbar";

export const metadata = {
  title: "Keythings Wallet Docs",
  description: "Secure non-custodial browser extension for the Keeta Network. Complete documentation and developer guides.",
  metadataBase: new URL("https://docs.keythings.wallet"),
  icons: {
    icon: "/icons/keythingslogo.ico",
    shortcut: "/icons/keythingslogo.ico",
    apple: "/icons/keythings-logo.PNG",
  },
  openGraph: {
    title: "Keythings Wallet Documentation",
    description: "Secure non-custodial browser extension for the Keeta Network. Complete documentation and developer guides.",
    url: "https://docs.keythings.wallet",
    images: [{ url: "/icons/keythings-logo.PNG" }]
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`antialiased font-sans`}>
        <Navbar />
        <div className="pt-16">{children}</div>
      </body>
    </html>
  );
}
