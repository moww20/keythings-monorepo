import CodeBlock from "@/app/components/CodeBlock"

export const metadata = {
  title: "Integration Guide — Keythings Wallet Docs",
  description: "How to integrate your dApp with Keythings Wallet.",
  alternates: { canonical: "/docs/developer/integration" },
}

export default function IntegrationGuidePage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Integration Guide</h1>
      <div className="docs-prose">
        <p>
          <em>
            Use this guide to connect your dApp to Keythings Wallet with minimal setup, robust permission management,
            and security-aware UX patterns.
          </em>
        </p>

        <h2>Detect Wallet</h2>
        <CodeBlock
          language="javascript"
          code={`if (typeof window.keeta === 'undefined') {
  throw new Error('Keythings Wallet not found');
}`}
        />

        <h2>Request Capabilities</h2>
        <p>
          Keythings Wallet uses a capability-based permission model. Always request only the scopes you need and surface
          clear context to the user before invoking the wallet prompt.
        </p>
        <CodeBlock
          language="javascript"
          code={`const permissions = await window.keeta.request({
  method: 'keeta_requestPermissions',
  params: [{
    eth_accounts: {},
    keeta_signTypedData: {},
    keeta_watchAsset: {
      type: 'ERC20',
      options: {
        address: '0xTokenAddress',
        symbol: 'TOK',
        decimals: 18,
      },
    },
  }],
});`}
        />

        <h2>Request Accounts</h2>
        <CodeBlock
          language="javascript"
          code={`const accounts = await window.keeta.request({ method: 'eth_requestAccounts' });`}
        />

        <h2>Listen for Changes</h2>
        <CodeBlock
          language="javascript"
          code={`window.keeta.on('accountsChanged', (accounts) => {
  // handle account switch
});
window.keeta.on('chainChanged', (chainId) => {
  // handle network switched
});`}
        />

        <h2>Send Transaction</h2>
        <CodeBlock
          language="javascript"
          code={`await window.keeta.request({
  method: 'eth_sendTransaction',
  params: [{ from, to, value }]
});`}
        />

        <h2>Surface Risk Feedback</h2>
        <p>
          Wallet confirmations include a risk score derived from simulation, heuristics, and allowlist checks. To improve
          user trust, reflect the score in your dApp before the user even opens the wallet dialog.
        </p>
        <CodeBlock
          language="javascript"
          code={`const assessment = await window.keeta.request({
  method: 'keeta_simulateTransaction',
  params: [{ from, to, value, data }],
});

if (assessment.risk === 'high') {
  // Display an explicit warning before asking the user to confirm in the wallet UI
}`}
        />

        <h2>Handle Revocations</h2>
        <p>
          Capabilities can expire or be revoked manually. Subscribe to permission updates and downgrade your UI gracefully.
        </p>
        <CodeBlock
          language="javascript"
          code={`window.keeta.on('permissionsChanged', ({ origin, capabilities }) => {
  const hasAccounts = Boolean(capabilities?.eth_accounts);
  updateConnectionState({ connected: hasAccounts });
});`}
        />

        <h2>Recommended UX Patterns</h2>
        <ul>
          <li>Preflight transactions with <code>keeta_simulateTransaction</code> to show gas impact and risk.</li>
          <li>Persist the latest approved account + chain locally so users return to a coherent state on reload.</li>
          <li>Offer a prominent “Reconnect” call-to-action when <code>permissionsChanged</code> removes required scopes.</li>
          <li>Throttle repeated permission prompts—wait for explicit user action before requesting capabilities again.</li>
        </ul>

        <h2>Local Development Setup</h2>
        <p>
          For deeper testing, run the extension locally and point your dApp to a development RPC endpoint:
        </p>
        <CodeBlock
          language="bash"
          code={`# Clone and bootstrap the wallet
git clone https://github.com/moww20/keythings-extension-wallet.git
cd keythings-extension-wallet
pnpm install
pnpm dev

# In Chrome, load apps/extension/dist as an unpacked extension.`}
        />
        <p>
          When sideloaded, the extension exposes verbose logs in the <em>service worker</em> console. Use them to validate
          the full lifecycle of requests originating from your integration.
        </p>

        <h2>Troubleshooting Checklist</h2>
        <ul>
          <li><strong>Account array empty?</strong> Ensure the capability request included <code>eth_accounts</code>.</li>
          <li><strong>Requests hanging?</strong> Verify the page is served over HTTPS and the origin matches the approved entry.</li>
          <li><strong>Transaction rejected?</strong> Inspect <code>assessment.risk</code> and <code>error.code</code> for mitigation guidance.</li>
          <li><strong>Chain mismatch?</strong> Listen for <code>chainChanged</code> and call <code>wallet_switchEthereumChain</code> proactively.</li>
        </ul>

        <h2>Best Practices</h2>
        <ul>
          <li>Gracefully handle missing wallet and user rejection.</li>
          <li>Request only the permissions you need.</li>
          <li>Show clear UX for pending actions and confirmations.</li>
          <li>Persist user consent logs so you can support audits and dispute resolution.</li>
        </ul>
      </div>
    </div>
  )
}


