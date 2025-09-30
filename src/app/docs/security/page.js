export const metadata = {
  title: "Security — Keythings Wallet Docs",
  description: "Comprehensive security overview and best practices for Keythings Wallet users and developers.",
  alternates: { canonical: "/docs/security" },
}

export default function SecurityPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Security Overview</h1>
      <div className="docs-prose">
        <p><em>Security-first design with industry-leading cryptographic implementations and user protection mechanisms.</em></p>

        <h2>Security Philosophy</h2>
        <p>
          Keythings Wallet is built with security as the foundational principle. Every feature, implementation,
          and interaction is designed to protect your digital assets while maintaining the highest standards
          of user experience and privacy.
        </p>

        <h2>Core Security Features</h2>

        <h3>🔐 Non-Custodial Architecture</h3>
        <p>
          Your private keys never leave your device. Keythings Wallet operates as a true non-custodial wallet,
          meaning you maintain complete control and ownership of your cryptographic keys and digital assets.
        </p>
        <ul>
          <li>Private keys generated and stored locally in your browser extension</li>
          <li>Seeds stored only in volatile service worker memory</li>
          <li>No server-side key storage or backup capabilities</li>
          <li>You control your keys, your crypto, your responsibility</li>
        </ul>

        <h3>🛡️ Advanced Cryptography</h3>
        <p>
          Industry-standard cryptographic implementations ensure your data remains secure against sophisticated attacks:
        </p>
        <ul>
          <li><strong>AES-GCM</strong>: Authenticated encryption for stored secrets</li>
          <li><strong>Argon2id</strong>: Memory-hard key derivation with secure parameters (64 MiB, 6 iterations)</li>
          <li><strong>WebCrypto API</strong>: Secure random number generation and cryptographic operations</li>
          <li><strong>Secure memory management</strong>: Explicit zeroing of sensitive data</li>
        </ul>

        <h3>🔑 Capability-Based Authorization</h3>
        <p>
          OAuth2-like capability system provides granular permissions and origin isolation:
        </p>
        <ul>
          <li>Per-origin, per-capability access control</li>
          <li>Automatic token expiration and refresh mechanisms</li>
          <li>Secure token generation using crypto.randomUUID()</li>
          <li>Multi-layer permission validation</li>
        </ul>

        <h3>🌐 Origin Isolation</h3>
        <p>
          Strict isolation between extension and web page contexts prevents cross-site attacks:
        </p>
        <ul>
          <li>Content script properly isolated from page JavaScript</li>
          <li>Same-origin message validation</li>
          <li>Extension ID verification for all communications</li>
          <li>Top-level frame enforcement</li>
        </ul>

        <h2>User Protection Mechanisms</h2>

        <h3>Approval Workflows</h3>
        <p>
          Every sensitive operation requires explicit user confirmation:
        </p>
        <ul>
          <li>Transaction signing requests with clear risk assessment</li>
          <li>Origin display for transparency</li>
          <li>Timeout protection (30 seconds default)</li>
          <li>Progressive security delays on failed attempts</li>
        </ul>

        <h3>Session Management</h3>
        <p>
          Secure session handling with automatic protection:
        </p>
        <ul>
          <li>Auto-lock after inactivity (5 minutes default)</li>
          <li>Progressive delays on unlock attempts (exponential backoff)</li>
          <li>Strong password requirements (12+ characters, complexity)</li>
          <li>Secure logout with memory cleanup</li>
        </ul>

        <h3>Input Validation</h3>
        <p>
          Comprehensive validation prevents malicious inputs:
        </p>
        <ul>
          <li>Address format validation (hex, checksum)</li>
          <li>Amount bounds checking</li>
          <li>Message length limits</li>
          <li>Transaction data validation</li>
        </ul>

        <h2>Developer Security</h2>

        <h3>Rate Limiting</h3>
        <p>
          Protection against denial-of-service and abuse:
        </p>
        <ul>
          <li>API request rate limiting (100 requests/minute)</li>
          <li>Balance query throttling (1/second)</li>
          <li>Pending request queue limits (10 max)</li>
          <li>Progressive backoff for violations</li>
        </ul>

        <h3>Error Handling</h3>
        <p>
          Secure error handling prevents information leakage:
        </p>
        <ul>
          <li>No sensitive data in error messages</li>
          <li>Secure logger with data redaction</li>
          <li>Proper timeout handling for all operations</li>
          <li>Error recovery mechanisms</li>
        </ul>

        <h2>Network Security</h2>

        <h3>HTTPS-Only</h3>
        <p>
          All communications use secure protocols:
        </p>
        <ul>
          <li>HTTPS-only for production environments</li>
          <li>Certificate pinning for RPC endpoints</li>
          <li>Secure WebSocket connections</li>
          <li>Origin allowlisting for development</li>
        </ul>

        <h2>Security Best Practices</h2>

        <h3>For Users</h3>

        <h4>Seed Phrase Security</h4>
        <ul>
          <li>Never share your seed phrase with anyone</li>
          <li>Store offline in a secure location (not on digital devices)</li>
          <li>Use a hardware wallet for large amounts</li>
          <li>Test recovery on a separate device first</li>
        </ul>

        <h4>Password Security</h4>
        <ul>
          <li>Use strong, unique passwords (12+ characters)</li>
          <li>Enable biometric authentication when available</li>
          <li>Set auto-lock timeout appropriately</li>
          <li>Never reuse passwords across services</li>
        </ul>

        <h4>Browser Security</h4>
        <ul>
          <li>Keep browser and extensions updated</li>
          <li>Use HTTPS-only mode</li>
          <li>Review connected dApps regularly</li>
          <li>Revoke unused permissions</li>
        </ul>

        <h3>For Developers</h3>

        <h4>dApp Integration</h4>
        <ul>
          <li>Always validate inputs before sending to wallet</li>
          <li>Request minimum necessary permissions</li>
          <li>Handle errors gracefully with user feedback</li>
          <li>Use HTTPS for all communications</li>
        </ul>

        <h4>Testing Security</h4>
        <ul>
          <li>Test with both mainnet and testnet</li>
          <li>Validate error handling for edge cases</li>
          <li>Test rate limiting and abuse scenarios</li>
          <li>Regular security audits of integrations</li>
        </ul>

        <h2>Security Monitoring</h2>

        <h3>Audit Trail</h3>
        <p>
          Comprehensive logging for security analysis:
        </p>
        <ul>
          <li>Origin tracking (approvedAt, lastUsed)</li>
          <li>Request logging with sensitive data redaction</li>
          <li>Transaction risk scoring</li>
          <li>Approval/rejection tracking</li>
        </ul>

        <h3>Incident Response</h3>
        <p>
          Prepared response procedures for security incidents:
        </p>
        <ul>
          <li>Immediate patch deployment for critical issues</li>
          <li>User notification for affected users</li>
          <li>Coordinated disclosure with security community</li>
          <li>Post-incident analysis and improvements</li>
        </ul>

        <h2>Compliance & Standards</h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Standard</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Compliance</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2">OWASP Top 10</td>
                <td className="border border-gray-300 px-4 py-2">✅ Good</td>
                <td className="border border-gray-300 px-4 py-2">No major vulnerabilities identified</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">OWASP ASVS Level 2</td>
                <td className="border border-gray-300 px-4 py-2">✅ Good</td>
                <td className="border border-gray-300 px-4 py-2">Most requirements met</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">NIST SP 800-63B</td>
                <td className="border border-gray-300 px-4 py-2">✅ Good</td>
                <td className="border border-gray-300 px-4 py-2">Password & auth compliant</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Web Extension Security</td>
                <td className="border border-gray-300 px-4 py-2">✅ Excellent</td>
                <td className="border border-gray-300 px-4 py-2">MV3 best practices followed</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Chrome Store Policies</td>
                <td className="border border-gray-300 px-4 py-2">✅ Good</td>
                <td className="border border-gray-300 px-4 py-2">No violations identified</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Security Features Comparison</h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Feature</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Keythings Wallet</th>
                <th className="border border-gray-300 px-4 py-2 text-left">MetaMask</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Phantom</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Seed Security</td>
                <td className="border border-gray-300 px-4 py-2">✅ RAM-only</td>
                <td className="border border-gray-300 px-4 py-2">✅ Encrypted</td>
                <td className="border border-gray-300 px-4 py-2">✅ Encrypted</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Capability System</td>
                <td className="border border-gray-300 px-4 py-2">✅ Advanced</td>
                <td className="border border-gray-300 px-4 py-2">⚠️ Basic</td>
                <td className="border border-gray-300 px-4 py-2">⚠️ Basic</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Input Validation</td>
                <td className="border border-gray-300 px-4 py-2">✅ Comprehensive</td>
                <td className="border border-gray-300 px-4 py-2">✅ Good</td>
                <td className="border border-gray-300 px-4 py-2">✅ Good</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Rate Limiting</td>
                <td className="border border-gray-300 px-4 py-2">✅ Advanced</td>
                <td className="border border-gray-300 px-4 py-2">✅ Good</td>
                <td className="border border-gray-300 px-4 py-2">⚠️ Limited</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Origin Isolation</td>
                <td className="border border-gray-300 px-4 py-2">✅ Strict</td>
                <td className="border border-gray-300 px-4 py-2">✅ Good</td>
                <td className="border border-gray-300 px-4 py-2">✅ Good</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Common Attack Vectors (Mitigated)</h2>

        <h3>Cross-Site Scripting (XSS)</h3>
        <p>
          <strong>Mitigation:</strong> Strict content script isolation and input validation prevent XSS attacks.
        </p>

        <h3>Cross-Site Request Forgery (CSRF)</h3>
        <p>
          <strong>Mitigation:</strong> Origin validation and capability tokens prevent unauthorized requests.
        </p>

        <h3>Phishing Attacks</h3>
        <p>
          <strong>Mitigation:</strong> Origin display, user approval workflows, and domain verification.
        </p>

        <h3>Brute Force Attacks</h3>
        <p>
          <strong>Mitigation:</strong> Progressive delays and secure password requirements.
        </p>

        <h3>Session Hijacking</h3>
        <p>
          <strong>Mitigation:</strong> Extension-only storage and secure session management.
        </p>

        <h2>Reporting Security Issues</h2>

        <h3>For Users</h3>
        <p>
          If you discover a security issue, please report it responsibly:
        </p>
        <ul>
          <li><strong>GitHub Issues:</strong> Create a security report in the repository</li>
          <li><strong>Email:</strong> security@keeta.network</li>
          <li><strong>Discord:</strong> Message a maintainer in the official server</li>
        </ul>

        <h3>For Developers</h3>
        <p>
          Security researchers and developers can contribute to security:
        </p>
        <ul>
          <li>Submit security improvements via pull requests</li>
          <li>Report vulnerabilities through proper channels</li>
          <li>Participate in security audits and reviews</li>
          <li>Join the security discussion in the community</li>
        </ul>

        <h2>Security Updates</h2>

        <h3>Automatic Updates</h3>
        <p>
          Keythings Wallet automatically updates to ensure you have the latest security patches:
        </p>
        <ul>
          <li>Chrome Web Store updates push automatically</li>
          <li>Critical security patches deploy within 24 hours</li>
          <li>Users notified of major security updates</li>
          <li>Gradual rollout to minimize disruption</li>
        </ul>

        <h3>Manual Updates</h3>
        <p>
          For development or custom installations:
        </p>
        <ul>
          <li>Regularly update from the official repository</li>
          <li>Review changelogs for security improvements</li>
          <li>Test updates in a safe environment first</li>
          <li>Backup your seed phrase before updating</li>
        </ul>

        <blockquote>
          Security is not a feature—it's the foundation. Keythings Wallet is built with security-first
          principles to protect your digital sovereignty in the decentralized economy.
        </blockquote>
      </div>
    </div>
  )
}
