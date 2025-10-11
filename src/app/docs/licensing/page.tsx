export const metadata = {
  title: "Licensing — Keythings Website Docs",
  description: "Open source licenses for Keythings code, documentation, and dependencies.",
  alternates: { canonical: "/docs/licensing" },
}

export default function LicensingPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Licensing</h1>
      <div className="docs-prose">
        <h2>Overview</h2>
        <p>
          Keythings is committed to open source and transparency. This page outlines the licensing
          for our code, documentation, and third-party dependencies. All licenses are designed to
          promote collaboration and innovation in the decentralized social space.
        </p>

        <h2>Main Application Code</h2>
        <p>
          The Keythings web application is released under the <strong>MIT License</strong>, a
          permissive open-source license that allows for:
        </p>
        <ul>
          <li>Free use, modification, and distribution</li>
          <li>Commercial and non-commercial applications</li>
          <li>Private and public deployments</li>
          <li>No requirement to share modifications</li>
        </ul>

        <h2>Documentation & Content</h2>
        <p>
          All documentation, including this site and its content, is licensed under <strong>CC BY-SA 4.0</strong>:
        </p>
        <ul>
          <li>You may share and adapt the content</li>
          <li>Attribution to Keythings is required</li>
          <li>Derivative works must be shared under the same license</li>
          <li>Commercial use is permitted with attribution</li>
        </ul>

        <h2>Third-Party Dependencies</h2>
        <p>Keythings relies on several open-source libraries and frameworks:</p>

        <h3>Core Dependencies</h3>
        <ul>
          <li><strong>Next.js</strong> - MIT License</li>
          <li><strong>React</strong> - MIT License</li>
          <li><strong>TypeScript</strong> - Apache 2.0</li>
          <li><strong>Tailwind CSS</strong> - MIT License</li>
          <li><strong>Framer Motion</strong> - MIT License</li>
        </ul>

        <h3>Nostr-Specific Libraries</h3>
        <ul>
          <li><strong>nostr-tools</strong> - MIT License</li>
          <li><strong>@noble/secp256k1</strong> - MIT License</li>
          <li><strong>@noble/hashes</strong> - MIT License</li>
        </ul>

        <h3>WebAuthn & Security</h3>
        <ul>
          <li><strong>@simplewebauthn/browser</strong> - MIT License</li>
          <li><strong>@simplewebauthn/server</strong> - MIT License</li>
        </ul>

        <h2>Contributing & Forks</h2>
        <p>
          When contributing to Keythings or creating derivative works:
        </p>
        <ul>
          <li>All contributions are subject to the MIT License</li>
          <li>Contributors retain copyright of their work</li>
          <li>The project maintainers have the right to use contributed code</li>
          <li>Significant contributors may be added to project acknowledgments</li>
        </ul>

        <h2>Trademark & Branding</h2>
        <p>
          The Keythings name and logo are trademarks of the project. Usage guidelines:
        </p>
        <ul>
          <li>Do not use Keythings branding to mislead users</li>
          <li>Personal and non-commercial use is permitted</li>
          <li>Commercial use requires written permission</li>
          <li>Fair use for commentary and news reporting is allowed</li>
        </ul>

        <h2>Contact & Legal Questions</h2>
        <p>
          For licensing questions, legal concerns, or trademark inquiries:
        </p>
        <ul>
          <li><strong>Email:</strong> legal@keythings.com</li>
          <li><strong>Nostr:</strong> Direct message project maintainers</li>
          <li><strong>GitHub:</strong> Open an issue in the repository</li>
          <li><strong>Discord:</strong> <a href="https://discord.gg/keythings" className="text-accent-gradient hover:underline">Community server</a></li>
        </ul>

        <blockquote>
          Open source is at the heart of Keythings's mission to democratize social networking.
          We believe in transparency, collaboration, and giving users control over their digital lives.
        </blockquote>

        <h2>License Text</h2>
        <p>For the full MIT License text, see the LICENSE file in our GitHub repository.</p>
      </div>
    </div>
  )
}