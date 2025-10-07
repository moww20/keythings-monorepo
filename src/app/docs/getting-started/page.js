export const metadata = {
  title: "Getting Started — Keythings Wallet Docs",
  description: "Get up and running with Keythings Wallet in minutes. Complete installation and setup guide.",
  alternates: { canonical: "/docs/getting-started" },
}

export default function GettingStartedPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Getting Started Guide</h1>
      <div className="docs-prose">
        <p><em>Welcome to Keythings Wallet! This guide will get you up and running with your secure Keeta wallet in just a few minutes.</em></p>

        <h2>Prerequisites</h2>
        <p>Before you begin, make sure you have:</p>
        <ul>
          <li>A modern Chromium-based browser (Chrome, Edge, Brave, Opera)</li>
          <li>An internet connection</li>
        </ul>

        <h2>Step 1: Install Keythings Wallet</h2>
        <p>Install the Keythings Wallet extension from the Chrome Web Store:</p>
        <ol>
          <li>Navigate to the <a href="#" className="text-accent-gradient hover:underline">Keythings Wallet Chrome Web Store page</a></li>
          <li>Click "Add to Chrome"</li>
          <li>Confirm the installation when prompted</li>
          <li>The Keythings Wallet icon will appear in your browser toolbar</li>
        </ol>

        <h2>Step 2: Set Up Your Wallet</h2>
        <p>Once installed, you'll need to create or restore a wallet:</p>

        <h3>Create a New Wallet</h3>
        <ol>
          <li>Click the Keythings Wallet icon in your browser toolbar</li>
          <li>Click "Create New Wallet"</li>
          <li>Set a strong password (12+ characters recommended)</li>
          <li>Write down your seed phrase and store it securely</li>
          <li>Confirm your seed phrase by selecting words in the correct order</li>
          <li>Your wallet is now ready to use!</li>
        </ol>

        <h3>Restore from Seed Phrase</h3>
        <p>If you already have a Keeta wallet:</p>
        <ol>
          <li>Click the Keythings Wallet icon</li>
          <li>Select "Restore Wallet"</li>
          <li>Enter your 12 or 24-word seed phrase</li>
          <li>Set a password for the extension</li>
          <li>Your existing wallet will be restored</li>
        </ol>

        <h2>Step 3: Connect to dApps</h2>
        <p>Keythings Wallet integrates seamlessly with Keeta dApps:</p>

        <h3>Automatic Connection</h3>
        <p>When you visit a Keeta dApp:</p>
        <ol>
          <li>The dApp will prompt you to connect your wallet</li>
          <li>Select "Keythings Wallet" from the options</li>
          <li>Approve the connection request</li>
          <li>Grant specific permissions (view address, sign transactions, etc.)</li>
        </ol>

        <h3>Manual Connection</h3>
        <p>Connect to dApps manually:</p>
        <ol>
          <li>Open the wallet extension</li>
          <li>Click "Connected Sites"</li>
          <li>Click "Connect to dApp"</li>
          <li>Enter the dApp's URL</li>
          <li>Approve the connection</li>
        </ol>

        <h2>Security Best Practices</h2>
        <p>Keep your wallet secure:</p>

        <h3>Seed Phrase Security</h3>
        <ul>
          <li>Never share your seed phrase with anyone</li>
          <li>Store it offline in a secure location</li>
          <li>Consider using a hardware wallet for large amounts</li>
          <li>Test seed phrase recovery on a separate device first</li>
        </ul>

        <h3>Password Security</h3>
        <ul>
          <li>Use a strong, unique password (12+ characters)</li>
          <li>Enable biometric authentication if available</li>
          <li>Set up auto-lock after inactivity (5 minutes recommended)</li>
          <li>Never reuse passwords across services</li>
        </ul>

        <h3>Browser Security</h3>
        <ul>
          <li>Keep your browser updated</li>
          <li>Use HTTPS-only mode when available</li>
          <li>Be cautious of browser extensions from unknown sources</li>
          <li>Regularly review and revoke unused dApp connections</li>
        </ul>

        <h2>Troubleshooting</h2>
        <p>Common issues and solutions:</p>

        <h3>Extension not loading?</h3>
        <ul>
          <li>Check that Chrome extensions are enabled</li>
          <li>Try reloading the extension in chrome://extensions</li>
          <li>Restart your browser if issues persist</li>
        </ul>


        <h3>Transactions failing?</h3>
        <ul>
          <li>Ensure you have sufficient balance</li>
          <li>Check that you're on the correct network</li>
          <li>Verify gas fees are adequate</li>
        </ul>

        <h2>Next Steps</h2>
        <p>Now that you're set up, explore:</p>
        <ul>
          <li><a href="/docs/developer/integration" className="text-accent-gradient hover:underline">Integrate with dApps</a></li>
          <li><a href="/docs/developer/api-reference" className="text-accent-gradient hover:underline">API Reference</a></li>
          <li><a href="/docs/security" className="text-accent-gradient hover:underline">Security Guide</a></li>
          <li><a href="/docs/tutorials" className="text-accent-gradient hover:underline">Advanced Tutorials</a></li>
        </ul>

        <blockquote>
          Welcome to the Keeta ecosystem! You're now equipped with a secure, non-custodial wallet
          that puts you in complete control of your digital assets. Remember: your keys, your crypto, your control.
        </blockquote>
      </div>
    </div>
  )
}
