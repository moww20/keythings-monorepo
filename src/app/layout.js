import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

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
        <div className="pt-16 min-h-screen flex flex-col">
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
