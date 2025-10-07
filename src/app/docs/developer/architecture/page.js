import CodeBlock from "@/app/components/CodeBlock"

export const metadata = {
  title: "Architecture Deep Dive — Keythings Wallet Docs",
  description: "Comprehensive architectural overview of the Keythings Extension Wallet platform.",
  alternates: { canonical: "/docs/developer/architecture" },
}

export default function ArchitecturePage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Architecture Deep Dive</h1>
      <div className="docs-prose">
        <p>
          <em>
            Understand how the Keythings Extension Wallet is assembled from the ground up—from repository layout,
            through build tooling, to the runtime execution contexts that keep user keys safe while powering
            dApp integrations.
          </em>
        </p>

        <h2>Repository Topology</h2>
        <p>
          The project is organized as a modern TypeScript monorepo that separates extension code from shared
          libraries and automation. The high-level layout looks like this:
        </p>
        <CodeBlock
          language="text"
          code={`keythings-extension-wallet/
├── apps/
│   └── extension/           # Browser extension source (UI, background, content, inpage provider)
├── packages/
│   ├── core/                # Domain logic, key management, transaction builders
│   ├── shared/              # Cross-context utilities, constants, and schema definitions
│   ├── keeta-sdk/           # Typed client wrappers around the Keeta RPC interface
│   └── testing/             # Test helpers, fixtures, and security harnesses
├── scripts/                 # Release automation, manifest builders, lint helpers
├── configs/                 # Shared ESLint, TypeScript, Tailwind, and Vite configuration
├── pnpm-workspace.yaml      # Workspace definition for pnpm
├── package.json             # Root scripts for linting, testing, building, and formatting
└── turbo.json               # Task graph configuration for deterministic builds`}
        />
        <p>
          Each workspace exposes its own <code>package.json</code> with precise build steps, enabling reproducible
          builds and isolated testing. Shared linting and TypeScript configurations ensure that all packages adhere
          to a single source of truth for compiler options and stylistic rules.
        </p>

        <h2>Build & Tooling Pipeline</h2>
        <ul>
          <li>
            <strong>Bundler:</strong> Vite drives the multi-entry build for UI, content scripts, service worker, and
            the inpage provider, emitting production-ready bundles compliant with Chrome Manifest V3.
          </li>
          <li>
            <strong>Package Manager:</strong> pnpm workspaces orchestrate dependency hoisting while keeping package
            boundaries explicit.
          </li>
          <li>
            <strong>Type System:</strong> TypeScript strict mode (<code>strict: true</code>) is enforced across the
            monorepo with project references to accelerate incremental builds.
          </li>
          <li>
            <strong>Linting & Formatting:</strong> ESLint (with the Next.js and security plugin presets) and Prettier
            run as part of the CI pipeline and the <code>pnpm lint</code> script.
          </li>
          <li>
            <strong>Testing:</strong> Vitest powers unit and integration tests, while Playwright covers end-to-end
            extension scenarios under a hardened Chromium profile.
          </li>
          <li>
            <strong>Security Scans:</strong> Custom scripts in <code>scripts/security</code> audit dependency integrity,
            enforce lockfile signing, and validate manifest permissions before release.
          </li>
        </ul>

        <h2>Runtime Execution Contexts</h2>
        <p>
          Manifest V3 splits the wallet into isolated execution environments. Each context is bundled separately and
          communicates through hardened messaging channels.
        </p>

        <h3>1. Service Worker (Background)</h3>
        <ul>
          <li>Acts as the single source of truth for wallet state, encryption, and network connectivity.</li>
          <li>Hosts the Redux store with slices for <em>accounts</em>, <em>network</em>, <em>permissions</em>,
            <em>settings</em>, and <em>activity</em>.</li>
          <li>Manages secure key vault operations—seed import, derivation (BIP-39 + BIP-44), account discovery,
            and transaction signing.</li>
          <li>Implements the JSON-RPC bridge that proxies dApp requests to the Keeta network via the SDK.</li>
          <li>Applies rate limiting, capability checks, and risk scoring before presenting requests to the UI shell.</li>
        </ul>

        <h3>2. UI Shell</h3>
        <ul>
          <li>Built with React 18, Tailwind, and Headless UI components rendered inside a responsive popup and full-tab view.</li>
          <li>Connects to the service worker via a persistent <code>browser.runtime.connect</code> port that streams state
            updates using Redux Toolkit Query selectors.</li>
          <li>Provides onboarding, account dashboard, token portfolio, activity history, and dApp approval modals.</li>
          <li>Handles biometric unlock, password prompts, and secure clipboard operations using the Web Authentication API.</li>
        </ul>

        <h3>3. Content Script</h3>
        <ul>
          <li>Injects the inpage provider into dApp pages while remaining isolated from the page context.</li>
          <li>Validates origin, frame hierarchy, and security posture before forwarding messages to the service worker.</li>
          <li>Performs structured cloning and schema validation for every RPC payload to prevent prototype pollution.</li>
        </ul>

        <h3>4. Inpage Provider</h3>
        <ul>
          <li>Implements the <code>window.keeta</code> API surface compatible with EIP-1193 and the Keeta-specific extensions.</li>
          <li>Queues JSON-RPC requests, multiplexes responses, and exposes event emitters for account and network changes.</li>
          <li>Negotiates capability tokens during the initial <code>keeta_requestPermissions</code> handshake.</li>
        </ul>

        <h2>State & Data Flow</h2>
        <p>
          Redux Toolkit powers a deterministic data flow shared across contexts via message passing:
        </p>
        <ul>
          <li><strong>Key Derivation:</strong> Passwords are stretched with Argon2id (64&nbsp;MiB, 6 iterations) to produce
            AES-GCM keys used to encrypt the seed phrase before it is persisted in extension storage.</li>
          <li><strong>Session Unlock:</strong> The service worker decrypts secrets into volatile memory, issues a session token,
            and clears memory on lock, timeout, or browser shutdown.</li>
          <li><strong>Transaction Pipeline:</strong> Requests travel from inpage provider → content script → service worker →
            UI approval. After user consent, the service worker signs via WebCrypto and submits to the Keeta RPC endpoint.</li>
          <li><strong>Activity Journal:</strong> Structured logs capture approvals, rejections, and risk scores with timestamps
            for later display in the UI and export.</li>
        </ul>

        <h2>Capability & Permission Model</h2>
        <p>
          Keythings Wallet employs a capability-based authorization system that binds permissions to dApp origins and
          user accounts.
        </p>
        <ul>
          <li>
            During onboarding, dApps request capabilities such as <code>eth_accounts</code>,
            <code>keeta_signTypedData</code>, or <code>keeta_watchAsset</code>. The service worker persists approvals with
            expiration timestamps and per-origin metadata (<code>approvedAt</code>, <code>lastUsed</code>, scopes).
          </li>
          <li>
            Capabilities are stored encrypted and revalidated on every request. Revocation is instantaneous and propagated
            to connected ports via state change broadcasts.
          </li>
          <li>
            Background alarms sweep expired capabilities and trigger UI notifications prompting re-authorization when necessary.
          </li>
        </ul>

        <h2>Networking & RPC Resilience</h2>
        <ul>
          <li>RPC calls route through the Keeta SDK, which provides typed clients, automatic retries, and exponential backoff.</li>
          <li>Multi-endpoint failover allows wallets to fall back from mainnet → backup → custom RPC endpoints.
          </li>
          <li>All requests enforce HTTPS, certificate pinning (via SPKI hashes configured per network), and strict timeout budgets.</li>
          <li>Gas price, nonce, and chain data are cached in-memory with stale-while-revalidate semantics to minimize RPC load.</li>
        </ul>

        <h2>Testing Strategy</h2>
        <ul>
          <li><strong>Unit Tests:</strong> Vitest covers reducers, selectors, cryptographic helpers, and RPC adapters.</li>
          <li><strong>Integration Tests:</strong> Playwright launches the extension, simulates dApp connections, and asserts UI flows.</li>
          <li><strong>Security Harness:</strong> Automated suites stress test unlock throttling, CSRF protections, and malformed payload handling.</li>
          <li><strong>Continuous Integration:</strong> Turbo orchestrates lint → test → typecheck → build pipelines with caching for fast feedback.</li>
        </ul>

        <h2>Local Development Recipes</h2>
        <p>Common workflows are exposed through pnpm scripts:</p>
        <CodeBlock
          language="bash"
          code={`pnpm install              # Install workspace dependencies
pnpm dev                  # Run vite in watch mode for all extension entries
pnpm lint                 # ESLint + TypeScript project references
pnpm test                 # Vitest unit/integration suites
pnpm build                # Production bundles + manifest validation
pnpm build --filter ui    # Build only the popup UI bundle`}
        />
        <p>
          Development builds emit artifacts into <code>apps/extension/dist</code> with source maps enabled. Load the
          unpacked directory via <em>chrome://extensions</em> to iterate on UI and background changes simultaneously.
        </p>

        <h2>Release Engineering</h2>
        <ul>
          <li><strong>Versioning:</strong> Changesets annotate packages; releases are generated by <code>pnpm release</code>
            which bumps versions, updates changelogs, and tags git commits.</li>
          <li><strong>Manifest Hardening:</strong> The <code>scripts/prepare-manifest.ts</code> step minifies permissions,
            injects build hashes, and validates host permissions against allowlists.</li>
          <li><strong>Artifact Signing:</strong> Build output is signed and zipped for distribution to the Chrome Web Store
            and manual sideloading.</li>
          <li><strong>Post-Release Monitoring:</strong> Telemetry-free health checks rely on RPC success metrics and automated
            smoke tests executed via scheduled CI runs.</li>
        </ul>

        <blockquote>
          A disciplined architecture—clear separation of contexts, strict security boundaries, and reproducible builds—ensures
          that Keythings Wallet remains trustworthy infrastructure for the Keeta ecosystem.
        </blockquote>
      </div>
    </div>
  )
}
