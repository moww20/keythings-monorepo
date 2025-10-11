export const metadata = {
  title: "Introduction — Keythings Wallet Docs",
  description: "The gateway to all things Keeta. A secure, non-custodial browser extension wallet for the Keeta Network.",
  alternates: { canonical: "/docs/introduction" },
}

export default function IntroductionPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Introduction</h1>
      <div className="docs-prose">
        <p><em>The gateway to all things Keeta. A secure, non-custodial browser extension wallet for the Keeta Network.</em></p>

        <h2>Overview</h2>
        <p>
          Keythings Wallet is your secure gateway to the Keeta Network ecosystem. Built as a production-ready
          Chrome Manifest V3 browser extension, it provides a non-custodial wallet experience that puts you in
          complete control of your digital assets, identity, and transactions on the Keeta blockchain.
        </p>
        <p>
          Unlike traditional wallet solutions, Keythings Wallet is designed with security, privacy, and user
          sovereignty as first-class citizens. Built with modern web technologies including React, TypeScript,
          and Redux Toolkit, it delivers enterprise-grade security without compromising on user experience.
        </p>

        <blockquote>
          Your keys, your crypto, your control. Keythings Wallet brings the future of decentralized finance
          to your browser with uncompromising security and user experience.
        </blockquote>

        <h2>Core Features</h2>
        <p>Keythings Wallet redefines wallet security and usability with these breakthrough capabilities:</p>
        <ul>
          <li><strong>Non-Custodial Architecture</strong>: Your private keys never leave your device—stored securely in the extension's isolated environment.</li>
          <li><strong>Keeta SDK Integration</strong>: Native integration with the official Keeta SDK for seamless blockchain interactions.</li>
          <li><strong>Multi-Network Support</strong>: Connect to multiple Keeta Network environments including mainnet, testnet, and custom RPC endpoints.</li>
          <li><strong>Advanced Security</strong>: Industry-leading cryptographic implementations with AES-GCM encryption and Argon2id key derivation.</li>
        </ul>

        <h2>Technical Excellence</h2>
        <h3>Modern Architecture</h3>
        <p>
          Keythings Wallet leverages cutting-edge web extension technology to deliver unparalleled security and performance:
        </p>
        <ul>
          <li>Chrome Manifest V3 for enhanced security and performance</li>
          <li>React 18 with TypeScript for type-safe, maintainable code</li>
          <li>Redux Toolkit for predictable state management</li>
          <li>Vite for lightning-fast development and optimized builds</li>
          <li>Comprehensive testing framework with security validation</li>
        </ul>

        <h3>Security-First Design</h3>
        <p>
          Security isn't an afterthought—it's built into every layer of Keythings Wallet:
        </p>
        <ul>
          <li>Seeds stored only in volatile service worker memory</li>
          <li>Capability-based authorization system for granular permissions</li>
          <li>Origin isolation preventing cross-site request forgery</li>
          <li>Progressive security delays on failed unlock attempts</li>
        </ul>

        <h3>Developer Experience</h3>
        <p>
          Built by developers, for developers. Keythings Wallet provides a solid foundation for Keeta integration:
        </p>
        <ul>
          <li>Comprehensive SDK integration examples and documentation</li>
          <li>Modular architecture with clear separation of concerns</li>
          <li>Extensive TypeScript definitions for better development experience</li>
          <li>Automated security validation and manifest compatibility checks</li>
        </ul>

        <h2>The Keeta Advantage</h2>
        <p>
          The Keeta Network represents the next evolution of blockchain technology, and Keythings Wallet is your key to accessing it:
        </p>
        <ul>
          <li><strong>High Performance</strong>: Sub-second transaction confirmations with low fees</li>
          <li><strong>Developer Friendly</strong>: Comprehensive SDK and tooling for seamless integration</li>
          <li><strong>Interoperability</strong>: Works with existing Ethereum tooling and standards</li>
          <li><strong>Scalability</strong>: Designed to handle global adoption with enterprise-grade infrastructure</li>
        </ul>

        <h2>User Experience Innovation</h2>
        <p>
          Keythings Wallet sets new standards for wallet usability and security:
        </p>
        <ul>
          <li><strong>Intuitive Interface</strong>: Clean, modern design that makes complex operations simple</li>
          <li><strong>Transaction Simulation</strong>: Preview transactions before signing to prevent costly mistakes</li>
          <li><strong>Risk Assessment</strong>: Built-in security scoring for transaction risk evaluation</li>
          <li><strong>Multi-Device Sync</strong>: Secure session management across browser instances</li>
        </ul>

        <h2>Why Keythings Wallet?</h2>
        <ul>
          <li><strong>Security</strong>: Industry-leading security practices with comprehensive audit coverage</li>
          <li><strong>Privacy</strong>: Zero data collection—your activities stay private and under your control</li>
          <li><strong>Reliability</strong>: Production-tested architecture ready for enterprise deployment</li>
          <li><strong>Community</strong>: Built by and for the decentralized finance community</li>
        </ul>

        <h2>TL; DR</h2>
        <p>
          Keythings Wallet is the secure, non-custodial gateway to the Keeta Network ecosystem. Experience the
          freedom of self-sovereign finance with the security and reliability that enterprise applications demand.
          Join the revolution in decentralized wallet technology.
        </p>
      </div>
    </div>
  )
}


