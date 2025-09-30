export const metadata = {
  title: "Privacy Policy — Keythings Wallet Docs",
  description: "Privacy policy for Keythings Wallet - zero data collection, maximum user control.",
  alternates: { canonical: "/docs/privacy-policy" },
}

export default function PrivacyPolicyPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Privacy Policy</h1>
      <div className="docs-prose">
        <p><em>Your privacy is paramount. We collect zero personal data.</em></p>

        <h2>Our Pledge: Zero Data Collection</h2>
        <p>
          Keythings Wallet is designed to be a non‑custodial, privacy‑respecting browser extension. We do not collect,
          store, transmit, sell, or otherwise process personal data about you. We do not run analytics, telemetry,
          tracking pixels, cookies, or fingerprinting.
        </p>

        <h2>What We Don't Collect</h2>
        <p>We explicitly do not collect:</p>
        <ul>
          <li>Personal identification information (name, email, phone number)</li>
          <li>Usage analytics or behavioral data</li>
          <li>IP addresses or location information</li>
          <li>Cookies, tracking pixels, or browser fingerprinting</li>
          <li>Transaction history or balance information</li>
          <li>Wallet addresses or cryptographic keys</li>
        </ul>

        <h2>On-Device Data (Local Only)</h2>
        <p>
          The extension may create data on your device strictly for functionality you request:
        </p>
        <ul>
          <li>Key material and seed phrases that you generate</li>
          <li>Session tokens or settings necessary for operation</li>
          <li>Cached metadata or UI preferences</li>
        </ul>
        <p>
          This data remains on your device and is not transmitted to us. You control, export, and delete it
          using your browser's extension management tools. If enabled by configuration, sensitive data is
          encrypted at rest using platform‑appropriate mechanisms.
        </p>

        <h2>Network Requests and Third Parties</h2>
        <p>
          Keythings Wallet does not send any data to us. However, when you choose to connect to
          blockchain networks or dapps, your browser communicates directly with those third parties. Information
          such as your IP address, requested resources, and on‑chain addresses may be visible to them per
          normal internet operation. Those third parties' privacy policies govern their handling of data.
          Review and trust third‑party providers before use.
        </p>

        <h2>Third-Party Services</h2>
        <p>
          Keythings Wallet enables connections to various blockchain networks and services:
        </p>
        <ul>
          <li><strong>Keeta Network</strong>: Mainnet and testnet RPC endpoints</li>
          <li><strong>dApps</strong>: Decentralized applications you choose to interact with</li>
          <li><strong>Block Explorers</strong>: Public blockchain data viewers</li>
        </ul>
        <p>
          These services operate independently and have their own privacy policies. We do not share
          personal data with third parties as we collect none.
        </p>

        <h2>Data Security</h2>
        <p>
          While we don't collect personal data, we implement industry-leading security practices:
        </p>
        <ul>
          <li>Seeds stored only in volatile service worker memory</li>
          <li>AES-GCM authenticated encryption for stored secrets</li>
          <li>Argon2id key derivation with secure parameters</li>
          <li>Origin isolation and capability-based authorization</li>
          <li>Regular security audits and penetration testing</li>
        </ul>

        <h2>Children's Privacy</h2>
        <p>
          Keythings Wallet is not directed to children and should not be used by individuals under the
          age of majority in their jurisdiction.
        </p>

        <h2>Your Rights</h2>
        <p>
          Since we collect no personal data, traditional data subject rights do not apply. You maintain
          complete control over:
        </p>
        <ul>
          <li>Your private keys and seed phrases</li>
          <li>Your wallet connections and permissions</li>
          <li>Your transaction history (visible on public blockchains)</li>
          <li>Your extension settings and preferences</li>
        </ul>

        <h2>Policy Updates</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be reflected by
          updating the effective date. Continued use after changes constitutes acceptance.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this Privacy Policy can be directed to the project maintainers via the
          repository's issue tracker or community channels.
        </p>

        <blockquote>
          Privacy by design, not by accident. Your financial sovereignty is fundamental to the decentralized economy.
        </blockquote>
      </div>
    </div>
  )
}