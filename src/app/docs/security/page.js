import CodeBlock from "@/app/components/CodeBlock"

export const metadata = {
  title: "Security — Keythings Wallet Docs",
  description:
    "Comprehensive security overview, lifecycle documentation, and audit guidance for the Keythings Extension Wallet.",
  alternates: { canonical: "/docs/security" },
}

export default function SecurityPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Security Overview</h1>
      <div className="docs-prose">
        <p>
          <em>
            Security-first design backed by transparent engineering practices. This page documents the controls that ship
            with Keythings Wallet and how to audit them effectively.
          </em>
        </p>

        <h2>Security Philosophy</h2>
        <p>
          Keythings Wallet is architected as a non-custodial wallet. Secrets never leave the user&rsquo;s device, operations are
          explicit, and every security-relevant subsystem is covered by automated tests. The following sections capture the
          protections in place today and highlight where to inspect the implementation inside the
          <code>keythings-extension-wallet</code> codebase.
        </p>

        <h2>Key Lifecycle</h2>
        <p>
          Understanding how secrets are generated, stored, and destroyed is central to any audit. The wallet&rsquo;s key lifecycle
          follows the sequence below.
        </p>
        <ol>
          <li><strong>Generation:</strong> A 256-bit entropy buffer produced via <code>crypto.getRandomValues</code> is mapped to
            a BIP-39 mnemonic. Optional imports validate checksum and wordlist membership.</li>
          <li><strong>Derivation:</strong> User-provided passwords are stretched with Argon2id (64&nbsp;MiB memory, 6 iterations,
            parallelism 2) to yield an encryption key.</li>
          <li><strong>Encryption at Rest:</strong> The mnemonic/seed is wrapped with AES-GCM (96-bit nonce, 256-bit key) and
            persisted to extension storage alongside metadata (salt, iterations, version).</li>
          <li><strong>Unlock:</strong> On unlock, the encrypted blob is decrypted inside the service worker and loaded into
            volatile memory that is cleared on lock, timeout, or process exit.</li>
          <li><strong>Derivation for Use:</strong> Child keys follow hardened derivation paths (BIP-32/BIP-44) scoped to the active
            network.</li>
          <li><strong>Lock/Destroy:</strong> Secrets are wiped from memory using explicit zeroisation before the vault is
            considered locked.</li>
        </ol>
        <CodeBlock
          language="ts"
          code={`// Key lifecycle (conceptual excerpt)
async function createVault(password: string, mnemonic = generateMnemonic(256)) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const masterKey = await argon2id(password, { salt, memoryMiB: 64, iterations: 6, parallelism: 2 })
  const encrypted = await aesGcmEncrypt(masterKey, mnemonic)
  await storage.set({ encrypted, salt, version: VAULT_VERSION })
  return unlock(password)
}

async function unlock(password: string) {
  const vault = await storage.get()
  const masterKey = await argon2id(password, vault.kdf)
  const mnemonic = await aesGcmDecrypt(masterKey, vault.encrypted)
  memory.load(bip39.mnemonicToSeed(mnemonic))
}

function lock() {
  memory.zero() // explicit zeroisation of seeds & derived keys
}`}
        />
        <p>
          <strong>Audit checklist:</strong> verify Argon2id parameters, nonce uniqueness, mnemonic checksum validation, and
          zeroisation routines. Confirm unit tests fail on parameter regression.
        </p>

        <h2>Defense-in-Depth Controls</h2>

        <h3>Cryptography</h3>
        <ul>
          <li><strong>AES-GCM sealed storage:</strong> Encrypted vault payloads include authentication tags to detect tampering.</li>
          <li><strong>Argon2id key stretching:</strong> Memory-hard derivation mitigates GPU/ASIC brute force attacks.</li>
          <li><strong>HD Wallet derivation:</strong> Hardened derivation paths isolate accounts; account discovery obeys
            BIP-44 gap limits.</li>
          <li><strong>Entropy hygiene:</strong> All randomness is sourced from the Web Crypto API; no deterministic PRNGs are used.</li>
        </ul>

        <h3>Capability-Based Authorization</h3>
        <p>
          The wallet mediates dApp access through per-origin capability grants. Requests enumerate scopes (e.g.,
          <code>eth_accounts</code>, <code>keeta_signTypedData</code>) and receive expiring tokens tied to both origin and account.
          Revocation propagates instantly to content scripts and inpage contexts.
        </p>
        <CodeBlock
          language="ts"
          code={`// Capability grant outline
const capability = {
  origin,
  scopes,
  issuedAt: Date.now(),
  expiresAt: Date.now() + resolveTtl(scopes),
}
registry.set(origin, capability)

if (!rateLimiter.allow(origin)) {
  throw new Error('RATE_LIMITED')
}`}
        />

        <h3>Context Isolation</h3>
        <ul>
          <li>Content scripts validate <code>sender.origin</code>, enforce top-level frame execution, and use structured cloning to
            avoid prototype pollution.</li>
          <li>Inpage provider messages pass through schema validation (Zod) before reaching the service worker.</li>
          <li>Service worker ports authenticate the extension ID to mitigate spoofed messages.</li>
        </ul>

        <h3>Runtime Guardrails</h3>
        <ul>
          <li><strong>Approval workflow:</strong> Each signing or transaction request requires explicit confirmation via modal with
            human-readable payloads and risk scoring.</li>
          <li><strong>Session hygiene:</strong> Auto-lock defaults to 5 minutes of inactivity; unlock attempts incur exponential
            backoff with progressive delays.</li>
          <li><strong>Input validation:</strong> Addresses, chain IDs, amounts, and message lengths undergo strict validation before
            being forwarded to signing routines.</li>
          <li><strong>Rate limiting:</strong> Origin-scoped token buckets cap JSON-RPC throughput and pending approval counts.</li>
        </ul>

        <h3>Network Security</h3>
        <ul>
          <li>HTTPS-only RPC endpoints with certificate pinning/allowlisting per network configuration.</li>
          <li>WebSocket subscriptions verify TLS state and origin allowlists.</li>
          <li>Build pipelines lint manifests to ensure no extra host permissions are shipped.</li>
        </ul>

        <h2>Audit Readiness</h2>
        <p>
          The documentation below is intended to make third-party audits efficient once the repository is open sourced.
        </p>
        <ul>
          <li><strong>Threat model:</strong> Review the architecture and threat model documents under <code>docs/</code> in the wallet
            repository. They outline trust boundaries, attacker assumptions, and mitigations.</li>
          <li><strong>Test evidence:</strong> Automated suites cover crypto helpers, permission guards, and session policies. Run
            <code>pnpm test</code> (or <code>pnpm test --filter extension</code>) to view coverage reports.</li>
          <li><strong>Static analysis:</strong> ESLint security rules and TypeScript strict mode execute via <code>pnpm lint</code>.
            Review CI logs for enforcement details.</li>
          <li><strong>Configuration review:</strong> Inspect Manifest V3 permissions, CSP, and host allowlists in the build output
            directory before releasing.</li>
          <li><strong>Logging:</strong> Sensitive data is redacted before writing to diagnostic logs; redaction helpers include unit
            tests that fail if new fields bypass scrubbing.</li>
        </ul>

        <h2>Compliance &amp; Standards Alignment</h2>
        <p>
          Keythings Wallet targets alignment with industry standards to simplify organisational governance.
        </p>
        <ul>
          <li><strong>OWASP MASVS:</strong> Architecture (MASVS-ARCH), authentication (MASVS-AUTH), and cryptography
            (MASVS-CRYPTO) requirements are mapped to wallet controls such as isolated execution contexts, unlock gating, and
            audited encryption routines.</li>
          <li><strong>OWASP ASVS:</strong> Level 2 controls are used as a benchmark for secure storage (V7), communication (V10), and
            error handling (V9). Documentation annotates which modules satisfy each control.</li>
          <li><strong>SOC 2 readiness:</strong> CI/CD hardening, dependency review, and access controls support eventual SOC 2 Type
            1/Type 2 assessments.</li>
          <li><strong>Privacy obligations:</strong> The wallet collects no personal data or telemetry by default, aligning with GDPR
            data minimisation principles.</li>
        </ul>

        <h2>User &amp; Developer Best Practices</h2>

        <h3>For Users</h3>
        <h4>Seed Phrase Security</h4>
        <ul>
          <li>Never share your seed phrase with anyone.</li>
          <li>Store mnemonics offline in tamper-evident, redundant locations.</li>
          <li>Perform recovery drills on a secondary device in a safe environment.</li>
          <li>Use hardware signing for large balances or institutional custody requirements.</li>
        </ul>

        <h4>Password &amp; Biometric Hygiene</h4>
        <ul>
          <li>Use strong, unique passwords (12+ characters, varied character classes).</li>
          <li>Enable biometric unlock where available.</li>
          <li>Configure auto-lock timers to match personal or organisational risk tolerance.</li>
          <li>Protect password managers with MFA.</li>
        </ul>

        <h4>Browser Security</h4>
        <ul>
          <li>Keep the browser and Keythings extension patched.</li>
          <li>Only interact with trusted networks and verified URLs.</li>
          <li>Beware of screen-sharing or remote-assistance attacks during signing.</li>
        </ul>

        <h3>For Developers</h3>
        <h4>Secure Integration</h4>
        <ul>
          <li>Validate all inputs before sending requests to <code>window.keeta</code>.</li>
          <li>Display complete transaction payloads to users to maintain transparency.</li>
          <li>Leverage <code>keeta_simulateTransaction</code> to preflight complex interactions.</li>
          <li>Keep dependencies patched and monitor upstream advisories.</li>
        </ul>

        <h4>Security Reviews</h4>
        <ul>
          <li>Perform peer review on wallet integration code paths.</li>
          <li>Use static analysis tooling and run <code>pnpm lint</code> before release.</li>
          <li>Document assumptions and edge cases in the integration runbooks.</li>
          <li>Engage with the Keythings security team for coordinated audits.</li>
        </ul>

        <h2>Incident Response</h2>

        <h3>Security Contact</h3>
        <p>If you discover a potential security issue, contact the security team:</p>
        <ul>
          <li><strong>Email:</strong> security@keeta.network</li>
          <li><strong>PGP:</strong> Public key fingerprint published in <code>SECURITY.md</code> (rotate annually).</li>
          <li><strong>Response target:</strong> Initial acknowledgment within 24 hours, mitigation updates within 72 hours.</li>
        </ul>

        <h3>Disclosure Policy</h3>
        <ul>
          <li>Responsible disclosure is encouraged; coordinated releases minimise end-user risk.</li>
          <li>Severity scoring follows CVSS v3.1 and drives remediation SLAs.</li>
          <li>Researchers are credited in advisories and eligible for the bug bounty programme.</li>
          <li>Impacted users receive notification via in-app banners, RSS feeds, and mailing lists.</li>
        </ul>

        <h2>Continuous Improvement</h2>
        <p>
          Security is never &ldquo;done&rdquo;. Regression tests, dependency audits, and manual reviews run before each release cycle.
          The team tracks industry developments (OWASP, NIST, browser security updates) and iterates on mitigations accordingly.
        </p>

        <blockquote>
          Maintain vigilance, keep the extension updated, and leverage the documented controls when performing audits or building
          on top of Keythings Wallet.
        </blockquote>
      </div>
    </div>
  )
}
