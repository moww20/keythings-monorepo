export const metadata = {
  title: "Authentication — Keythings Website Docs",
  description: "Learn about passkeys, WebAuthn, and wallet integration for secure, passwordless authentication.",
  alternates: { canonical: "/docs/authentication" },
}

export default function AuthenticationPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Authentication</h1>
      <div className="docs-prose">
        <p><em>Secure, passwordless authentication with cutting-edge cryptography and seamless wallet integration.</em></p>

        <h2>Authentication Methods</h2>
        <p>Keythings offers multiple authentication options to suit different user preferences and security needs:</p>

        <h3>1. Passkeys (WebAuthn) - Recommended</h3>
        <p>The most secure and user-friendly option for new users.</p>

        <h4>How Passkeys Work</h4>
        <p>
          Passkeys use public-key cryptography to create a unique key pair for each website. Instead of passwords,
          you authenticate using your device's built-in security features.
        </p>

        <h4>Supported Authenticators</h4>
        <ul>
          <li><strong>Biometric sensors</strong>: TouchID, FaceID, fingerprint readers</li>
          <li><strong>Device PIN/pattern</strong>: Screen lock authentication</li>
          <li><strong>Hardware security keys</strong>: YubiKey, Titan Security Key</li>
          <li><strong>Platform authenticators</strong>: Windows Hello, Android biometric</li>
        </ul>

        <h4>Setting Up Passkeys</h4>
        <ol>
          <li>Visit <a href="https://keythings.com" className="text-accent-gradient hover:underline">keythings.com</a></li>
          <li>Click "Sign Up" or "Create Account"</li>
          <li>Choose a username (this becomes your Nostr public key identifier)</li>
          <li>When prompted, use your device's biometric authentication</li>
          <li>Your account is instantly created with a cryptographically secure key pair</li>
        </ol>

        <h4>Passkey Security Benefits</h4>
        <ul>
          <li><strong>Phishing resistant</strong>: Keys only work on the original domain</li>
          <li><strong>No passwords to remember</strong>: Authentication is built into your device</li>
          <li><strong>Hardware-backed security</strong>: Keys are stored in secure enclaves</li>
          <li><strong>Cross-device sync</strong>: Some platforms sync passkeys across your devices</li>
        </ul>

        <h3>2. External Wallet Integration</h3>
        <p>For users who already have Nostr identities or prefer wallet-based authentication.</p>

        <h4>Supported Wallets</h4>
        <p>Keythings integrates with all NIP-07 compatible wallets:</p>
        <ul>
          <li><strong>Alby</strong>: Popular browser extension with built-in Lightning Network</li>
          <li><strong>nos2x</strong>: Simple, open-source Nostr wallet extension</li>
          <li><strong>Nostr Wallet ID</strong>: Browser extension for Nostr key management</li>
          <li><strong>Snort</strong>: Desktop wallet with Nostr integration</li>
        </ul>

        <h4>Connecting an External Wallet</h4>
        <ol>
          <li>Install your preferred NIP-07 wallet extension</li>
          <li>Create or import your Nostr key pair in the wallet</li>
          <li>Visit Keythings and click "Connect Wallet"</li>
          <li>Approve the connection in your wallet popup</li>
          <li>You can now post, follow, and interact using your existing identity</li>
        </ol>

        <h4>Wallet Authentication Flow</h4>
        <p>When you connect a wallet:</p>
        <ul>
          <li>Keythings requests permission to sign events with your key</li>
          <li>Your wallet shows what permissions are being requested</li>
          <li>You approve or deny the connection</li>
          <li>If approved, Keythings can sign posts and other events on your behalf</li>
        </ul>

        <h3>3. Session Management</h3>
        <p>How Keythings handles authentication sessions for security and convenience.</p>

        <h4>Server-Verified Sessions</h4>
        <p>
          Unlike many web applications, Keythings uses server-side session verification:
        </p>
        <ul>
          <li><strong>HttpOnly cookies</strong>: Session tokens are stored server-side only</li>
          <li><strong>Secure flags</strong>: Cookies require HTTPS and can't be accessed by JavaScript</li>
          <li><strong>SameSite protection</strong>: Prevents cross-site request forgery attacks</li>
          <li><strong>Short expiration</strong>: Sessions expire quickly for security</li>
        </ul>

        <h4>Automatic Reconnection</h4>
        <p>Keythings intelligently handles authentication state:</p>
        <ul>
          <li><strong>Graceful reconnects</strong>: Automatically reconnect after network interruptions</li>
          <li><strong>Session persistence</strong>: Stay logged in across browser sessions</li>
          <li><strong>Smart timeouts</strong>: Extend sessions for active users</li>
          <li><strong>Manual disconnect</strong>: Easy logout option when needed</li>
        </ul>

        <h2>Security Architecture</h2>
        <p>Keythings's authentication system is built on enterprise-grade security:</p>

        <h3>Cryptographic Foundations</h3>
        <ul>
          <li><strong>Ed25519 signatures</strong>: For all Nostr events and authentication</li>
          <li><strong>SHA-256 hashing</strong>: For challenge-response authentication</li>
          <li><strong>AES-256 encryption</strong>: For storing sensitive data at rest</li>
          <li><strong>TLS 1.3</strong>: End-to-end encrypted connections</li>
        </ul>

        <h3>WebAuthn Implementation</h3>
        <p>Our passkey implementation follows security best practices:</p>
        <ul>
          <li><strong>Attestation verification</strong>: Ensures authenticators are genuine</li>
          <li><strong>User verification</strong>: Requires biometric confirmation for each use</li>
          <li><strong>Origin validation</strong>: Prevents phishing attacks</li>
          <li><strong>Counter tracking</strong>: Prevents signature replay attacks</li>
        </ul>

        <h3>Privacy Protection</h3>
        <ul>
          <li><strong>No password storage</strong>: We never store passwords or private keys</li>
          <li><strong>Minimal data collection</strong>: Only collect what's necessary for functionality</li>
          <li><strong>Encrypted storage</strong>: All sensitive data is encrypted at rest</li>
          <li><strong>No tracking</strong>: We don't track users across the platform</li>
        </ul>

        <h2>Migrating Between Methods</h2>
        <p>You can switch authentication methods at any time:</p>

        <h3>From Passkeys to Wallet</h3>
        <ol>
          <li>Connect your preferred wallet to Keythings</li>
          <li>Both authentication methods will be available</li>
          <li>Your posts and followers remain unchanged</li>
          <li>You can use either method going forward</li>
        </ol>

        <h3>From Wallet to Passkeys</h3>
        <ol>
          <li>Create a new passkey account (different username)</li>
          <li>Follow users and build your network with the new account</li>
          <li>Your old wallet account remains accessible</li>
          <li>Consider cross-posting or announcing your migration</li>
        </ol>

        <h2>Troubleshooting</h2>
        <p>Common authentication issues and solutions:</p>

        <h3>Passkey Issues</h3>
        <h4>"Authenticator not found"</h4>
        <ul>
          <li>Ensure your device has biometric authentication enabled</li>
          <li>Try using a different browser or device</li>
          <li>Check if your security settings allow WebAuthn</li>
        </ul>

        <h4>"Origin not allowed"</h4>
        <ul>
          <li>Make sure you're accessing Keythings from the correct domain</li>
          <li>Check that you're not using an outdated bookmark</li>
          <li>Try clearing your browser cache</li>
        </ul>

        <h3>Wallet Connection Issues</h3>
        <h4>"Wallet not detected"</h4>
        <ul>
          <li>Ensure your wallet extension is installed and enabled</li>
          <li>Try refreshing the page and reconnecting</li>
          <li>Check that your browser supports the wallet extension</li>
        </ul>

        <h4>"Permission denied"</h4>
        <ul>
          <li>Check your wallet's permission settings</li>
          <li>Try disconnecting and reconnecting the wallet</li>
          <li>Ensure you're using the latest version of your wallet</li>
        </ul>

        <h3>Session Issues</h3>
        <h4>"Session expired"</h4>
        <ul>
          <li>This is normal security behavior</li>
          <li>Simply log back in with your preferred method</li>
          <li>Your data and connections remain intact</li>
        </ul>

        <h4>"Can't stay logged in"</h4>
        <ul>
          <li>Check your browser's cookie settings</li>
          <li>Ensure you're not in incognito/private mode</li>
          <li>Try using a different browser</li>
        </ul>

        <h2>Best Practices</h2>
        <p>Security recommendations for Keythings users:</p>

        <h3>General Security</h3>
        <ul>
          <li><strong>Use strong usernames</strong>: Choose memorable but not easily guessable names</li>
          <li><strong>Enable two-factor where possible</strong>: Use passkeys with biometric verification</li>
          <li><strong>Keep software updated</strong>: Regular browser and wallet updates</li>
          <li><strong>Use reputable relays</strong>: Choose well-maintained Nostr relays</li>
        </ul>

        <h3>Privacy Tips</h3>
        <ul>
          <li><strong>Review permissions</strong>: Only grant necessary permissions to applications</li>
          <li><strong>Use privacy-focused browsers</strong>: Consider browsers with built-in privacy features</li>
          <li><strong>Be mindful of metadata</strong>: Timestamps and interaction patterns can be revealing</li>
          <li><strong>Consider VPN usage</strong>: For enhanced network privacy</li>
        </ul>

        <h2>Advanced Topics</h2>

        <h3>Key Management</h3>
        <p>Understanding Nostr key pairs:</p>
        <ul>
          <li><strong>Public keys</strong>: Your identity, safe to share (npub format)</li>
          <li><strong>Private keys</strong>: Never share, used for signing posts</li>
          <li><strong>Key derivation</strong>: Deterministic key generation from seed phrases</li>
          <li><strong>Hardware security</strong>: Store keys on dedicated hardware devices</li>
        </ul>

        <h3>NIP-05 Verification</h3>
        <p>Associate your identity with a domain:</p>
        <ul>
          <li><strong>Domain ownership</strong>: Prove you control a domain name</li>
          <li><strong>Identity verification</strong>: Get a ✓ badge next to your username</li>
          <li><strong>Trust signals</strong>: Help others verify your authenticity</li>
          <li><strong>Custom addresses</strong>: Use yourname@yourdomain.com format</li>
        </ul>

        <h2>Support</h2>
        <p>Need help with authentication?</p>
        <ul>
          <li><a href="/docs/getting-started" className="text-accent-gradient hover:underline">Quick Start Guide</a></li>
          <li><a href="https://discord.gg/keythings" className="text-accent-gradient hover:underline">Community Discord</a></li>
          <li><a href="/docs/privacy" className="text-accent-gradient hover:underline">Privacy & Security</a></li>
          <li><strong>Email</strong>: security@keythings.com (for security-related concerns)</li>
        </ul>

        <blockquote>
          Security isn't just a feature—it's the foundation of everything we build.
          Keythings combines cutting-edge cryptography with user-friendly design to make
          decentralized social networking both powerful and accessible.
        </blockquote>
      </div>
    </div>
  )
}
