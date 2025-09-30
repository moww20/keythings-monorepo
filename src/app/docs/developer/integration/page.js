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
        <p><em>Use this guide to connect your dApp to Keythings Wallet with minimal setup.</em></p>

        <h2>Detect Wallet</h2>
        <code className="language-javascript">{`if (typeof window.keeta === 'undefined') {
  throw new Error('Keythings Wallet not found');
}`}</code>

        <h2>Request Accounts</h2>
        <code className="language-javascript">{`const accounts = await window.keeta.request({ method: 'eth_requestAccounts' });`}</code>

        <h2>Listen for Changes</h2>
        <code className="language-javascript">{`window.keeta.on('accountsChanged', (accounts) => {
  // handle account switch
});
window.keeta.on('chainChanged', (chainId) => {
  // handle network switched
});`}</code>

        <h2>Send Transaction</h2>
        <code className="language-javascript">{`await window.keeta.request({
  method: 'eth_sendTransaction',
  params: [{ from, to, value }]
});`}</code>

        <h2>Best Practices</h2>
        <ul>
          <li>Gracefully handle missing wallet and user rejection.</li>
          <li>Request only the permissions you need.</li>
          <li>Show clear UX for pending actions and confirmations.</li>
        </ul>
      </div>
    </div>
  )
}


