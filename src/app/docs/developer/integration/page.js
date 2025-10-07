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
            Use this guide to connect your dApp to Keythings Wallet with minimal setup, robust permission management, and
            security-aware UX patterns.
          </em>
        </p>

        <h2>Detect Wallet</h2>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

if (!provider) {
  throw new Error('Keythings Wallet not found');
}`}
        />

        <h2>Request Capabilities</h2>
        <p>
          Keythings Wallet uses a capability-based permission model. Always request only the capabilities you need and surface
          clear context to the user before invoking the wallet prompt.
        </p>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

// Request specific capabilities
const capabilities = await provider.requestCapabilities(['read', 'sign', 'transact']);

// Each capability token contains:
// - capability: the permission type
// - token: authorization token
// - grantedAt: timestamp
// - expiresAt: expiration (null if no expiration)`}
        />

        <h2>Request Accounts</h2>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

const accounts = await provider.requestAccounts();
console.log('Connected accounts:', accounts);`}
        />

        <h2>Listen for Changes</h2>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

provider?.on('accountsChanged', (accounts) => {
  // handle account switch
});

provider?.on('chainChanged', (chainId) => {
  // handle network switch
});

provider?.on('disconnect', () => {
  // handle wallet disconnect
});`}
        />

        <h2>Send Transaction</h2>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;
const accounts = await provider.getAccounts();

const transaction = {
  to: 'recipient_address_here',
  amount: '1000000', // Amount in smallest unit
  token: 'token_address_here', // Optional: specific token
};

const txHash = await provider.sendTransaction(transaction);
console.log('Transaction hash:', txHash);`}
        />

        <h2>Surface Risk Feedback</h2>
        <p>
          Wallet confirmations include a risk score derived from simulation, heuristics, and allowlist checks. To improve
          user trust, reflect the score in your dApp before the user even opens the wallet dialog.
        </p>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

const transaction = {
  to: 'recipient_address_here',
  amount: '1000000',
  token: 'token_address_here',
};

// Simulate transaction to get risk assessment
const simulation = await provider.simulateTransaction(transaction);

console.log('Risk level:', simulation.riskLevel);
console.log('Risk message:', simulation.riskMessage);
console.log('Estimated fee:', simulation.estimatedFee);

if (simulation.riskLevel === 'high') {
  // Display an explicit warning before asking the user to confirm in the wallet UI
  alert('High risk transaction: ' + simulation.riskMessage);
}`}
        />

        <h2>Handle Revocations</h2>
        <p>
          Capabilities can expire or be revoked manually. Subscribe to provider changes and re-fetch capabilities to
          downgrade your UI gracefully.
        </p>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

async function refreshCapabilities() {
  try {
    const capabilities = await provider.refreshCapabilities();
    const hasRead = capabilities.some(cap => cap.capability === 'read');
    const hasSign = capabilities.some(cap => cap.capability === 'sign');
    const hasTransact = capabilities.some(cap => cap.capability === 'transact');
    
    updateConnectionState({ 
      connected: hasRead, 
      canSign: hasSign, 
      canTransact: hasTransact 
    });
  } catch (error) {
    // Capabilities expired or revoked
    updateConnectionState({ connected: false, canSign: false, canTransact: false });
  }
}

provider?.on('accountsChanged', refreshCapabilities);
provider?.on('chainChanged', refreshCapabilities);
provider?.on('disconnect', () => {
  updateConnectionState({ connected: false, canSign: false, canTransact: false });
});`}
        />

        <h2>Recommended UX Patterns</h2>
        <ul>
          <li>Preflight transactions with <code>simulateTransaction</code> to show fee impact and risk.</li>
          <li>Persist the latest approved account + network locally so users return to a coherent state on reload.</li>
          <li>Offer a prominent “Reconnect” call-to-action after capability loss.</li>
          <li>Throttle repeated permission prompts—wait for explicit user action before requesting capabilities again.</li>
        </ul>

        <h2>Troubleshooting Checklist</h2>
        <ul>
          <li><strong>Account array empty?</strong> Ensure the capability request included <code>eth_accounts</code>.</li>
          <li><strong>Requests hanging?</strong> Verify the page is served over HTTPS and the origin matches the approved entry.</li>
          <li>
            <strong>Transaction rejected?</strong> Inspect <code>error.code</code> and transaction simulation output for
            mitigation guidance.
          </li>
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


