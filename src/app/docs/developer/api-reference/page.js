import CodeBlock from "@/app/components/CodeBlock"

export const metadata = {
  title: "API Reference — Keythings Wallet Docs",
  description: "Complete API reference for integrating with Keythings Wallet and the Keeta SDK.",
  alternates: { canonical: "/docs/developer/api-reference" },
}

export default function ApiReferencePage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">API Reference</h1>
      <div className="docs-prose">
        <p><em>Complete API reference for integrating with Keythings Wallet and building Keeta dApps.</em></p>

        <h2>Overview</h2>
        <p>
          Keythings Wallet exposes a Keeta-compatible provider through the <code>window.keeta</code> global object. 
          It provides native Keeta Network integration with secure capability-based permissions and 
          transaction simulation features.
        </p>

        <h2>Connection &amp; Setup</h2>

        <h3>Check if Keythings Wallet is Available</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

if (!provider) {
  console.error('Keythings Wallet not detected');
} else {
  console.log('Keythings Wallet provider ready', provider);
}`}
        />

        <h3>Request Connection</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

try {
  const accounts = await provider.requestAccounts();
  console.log('Connected account:', accounts[0]);
} catch (error) {
  console.error('Connection failed:', error);
}`}
        />

        <h2>Account Management</h2>

        <h3>Get Connected Accounts</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

const accounts = await provider.getAccounts();
console.log('Connected accounts:', accounts);`}
        />

        <h3>Get Primary Account</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

const accounts = await provider.getAccounts();
const primaryAccount = accounts[0];

if (primaryAccount) {
  console.log('Primary account:', primaryAccount);
}`}
        />

        <h2>Network Information</h2>

        <h3>Get Current Network</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

const network = await provider.getNetwork();
console.log('Connected network:', network.name);
console.log('Chain ID:', network.chainId);`}
        />

        <h3>Switch Network</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

// Switch to testnet
await provider.switchNetwork('test');

// Switch to mainnet
await provider.switchNetwork('main');`}
        />

        <h3>Network Information</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

// Get current network details
const network = await provider.getNetwork();
console.log('Network name:', network.name);
console.log('RPC URL:', network.rpcUrl);
console.log('Block explorer:', network.blockExplorerUrl);
console.log('Chain ID:', network.chainId);`}
        />

        <h2>Balance &amp; State</h2>

        <h3>Get Account Balance</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;
const accounts = await provider.getAccounts();
const account = accounts[0];

// Get balance for specific account
const balance = await provider.getBalance(account);
console.log('Account balance:', balance);

// Get all token balances
const allBalances = await provider.getAllBalances();
console.log('All balances:', allBalances);`}
        />

        <h3>Token Management</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

// Get all token balances for the connected account
const allBalances = await provider.getAllBalances();
console.log('Token balances:', allBalances);

// Each balance entry contains:
// - token: token address/identifier
// - balance: current balance amount
// - metadata: additional token information`}
        />

        <h2>Transaction Management</h2>

        <h3>Send Transaction</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;
const accounts = await provider.getAccounts();
const from = accounts[0];

const transaction = {
  to: 'recipient_address_here',
  amount: '1000000', // Amount in smallest unit
  token: 'token_address_here', // Optional: specific token
};

const txHash = await provider.sendTransaction(transaction);
console.log('Transaction hash:', txHash);`}
        />

        <h3>Simulate Transaction</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

const transaction = {
  to: 'recipient_address_here',
  amount: '1000000',
  token: 'token_address_here',
};

// Simulate transaction to get fee estimates and risk assessment
const simulation = await provider.simulateTransaction(transaction);
console.log('Estimated fee:', simulation.estimatedFee);
console.log('Risk level:', simulation.riskLevel);
console.log('Risk message:', simulation.riskMessage);`}
        />

        <h3>Transaction Simulation</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

const transaction = {
  to: 'recipient_address_here',
  amount: '1000000',
  token: 'token_address_here',
};

// Get detailed simulation results including fees
const simulation = await provider.simulateTransaction(transaction);
console.log('Estimated fee:', simulation.estimatedFee);
console.log('Estimated fee in KTA:', simulation.estimatedFeeKta);
console.log('Total cost:', simulation.estimatedTotal);
console.log('Risk assessment:', simulation.riskLevel);`}
        />

        <h2>Message Signing</h2>

        <h3>Sign Message</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

const message = 'Hello, Keythings!';
const signature = await provider.signMessage(message);

console.log('Message signature:', signature);`}
        />

        <h3>Message Signing with Capabilities</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

// Request signing capability
const capabilities = await provider.requestCapabilities(['sign']);
console.log('Granted capabilities:', capabilities);

// Sign a message (requires 'sign' capability)
const message = 'Hello from my Keeta dApp!';
const signature = await provider.signMessage(message);

console.log('Message signature:', signature);`}
        />

        <h2>Capabilities &amp; Permissions</h2>

        <h3>Request Capabilities</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

// Request specific capabilities
const capabilities = await provider.requestCapabilities(['read', 'sign', 'transact']);
console.log('Granted capabilities:', capabilities);

// Each capability token contains:
// - capability: the permission type ('read', 'sign', 'transact')
// - token: the capability token for authorization
// - grantedAt: timestamp when granted
// - expiresAt: expiration timestamp (null if no expiration)`}
        />

        <h3>Refresh Capabilities</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

// Refresh all capabilities
const refreshedCapabilities = await provider.refreshCapabilities();
console.log('Refreshed capabilities:', refreshedCapabilities);

// Refresh specific capabilities
const specificCapabilities = await provider.refreshCapabilities(['sign', 'transact']);
console.log('Refreshed specific capabilities:', specificCapabilities);`}
        />

        <h2>Advanced Features</h2>

        <h3>Advanced Transaction Simulation</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

const transaction = {
  to: 'recipient_address_here',
  amount: '1000000',
  token: 'token_address_here',
  operations: [
    {
      type: 'transfer',
      tokenAccount: 'token_address_here',
      amount: '500000',
      info: { memo: 'Partial payment' }
    }
  ]
};

// Get comprehensive simulation results
const simulation = await provider.simulateTransaction(transaction);
console.log('Simulation successful:', simulation.ok);
console.log('Estimated fee:', simulation.estimatedFee);
console.log('Risk assessment:', simulation.riskLevel);
console.log('Risk message:', simulation.riskMessage);`}
        />

        <h3>Batch Operations</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

// Perform multiple operations in parallel
const [accounts, network, balance, allBalances] = await Promise.all([
  provider.getAccounts(),
  provider.getNetwork(),
  provider.getBalance(),
  provider.getAllBalances(),
]);

console.log('Batch results:', { 
  accounts, 
  network: network.name, 
  balance, 
  tokenCount: allBalances.length 
});`}
        />

        <h2>Error Handling</h2>

        <h3>Common Error Codes</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-white/20">
            <thead>
              <tr className="bg-white/10">
                <th className="border border-white/20 px-4 py-2 text-left text-foreground font-semibold">Error Code</th>
                <th className="border border-white/20 px-4 py-2 text-left text-foreground font-semibold">Description</th>
                <th className="border border-white/20 px-4 py-2 text-left text-foreground font-semibold">Solution</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">4001</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">User rejected the request</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Ask user to approve the request</td>
              </tr>
              <tr>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">4100</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Unauthorized</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Request proper permissions first</td>
              </tr>
              <tr>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">4200</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Unsupported method</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Check method name spelling</td>
              </tr>
              <tr>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">4900</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Disconnected</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Reconnect to the wallet</td>
              </tr>
              <tr>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">4901</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Chain disconnected</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Switch to correct network</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Error Handling Example</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keeta;

try {
  const result = await provider.sendTransaction(transaction);
  console.log('Success:', result);
} catch (error) {
  console.error('Error:', error);

  switch (error.code) {
    case 4001:
      console.log('User rejected the request');
      break;
    case 4100:
      console.log('Unauthorized - request capabilities first');
      break;
    case 4200:
      console.log('Unsupported method');
      break;
    case 4900:
      console.log('Disconnected - reconnect to wallet');
      break;
    case 4901:
      console.log('Chain disconnected - switch network');
      break;
    default:
      console.log('Unknown error:', error.message);
  }
}`}
        />

        <h2>Type Definitions</h2>

        <h3>TypeScript Interfaces</h3>
        <CodeBlock
          language="typescript"
          code={`interface KeetaProvider {
  readonly isKeeta: true;
  readonly isAvailable: true;
  readonly isConnected: boolean;
  readonly selectedAddress: string | null;
  readonly network: 'test' | 'main';
  readonly chainId: string;

  getAccounts(): Promise<string[]>;
  getBalance(address?: string): Promise<string>;
  getAllBalances(): Promise<BalanceEntry[]>;
  sendTransaction(transaction: KeetaTransaction): Promise<string>;
  signMessage(message: string): Promise<string>;
  requestCapabilities(capabilities: KeetaCapability[]): Promise<CapabilityToken[]>;
  refreshCapabilities(capabilities?: KeetaCapability[]): Promise<CapabilityToken[]>;
  simulateTransaction(transaction: KeetaTransaction): Promise<TransactionSimulationResult>;
  getNetwork(): Promise<KeetaNetwork>;
  switchNetwork(network: 'test' | 'main'): Promise<void>;

  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
}

interface KeetaTransaction {
  to: string;
  from?: string;
  amount: string;
  token?: string;
  data?: string;
  gasLimit?: string;
  nonce?: string;
  operations?: KeetaTransactionOperation[];
}

interface KeetaNetwork {
  chainId: string;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
}

type KeetaCapability = 'read' | 'sign' | 'transact';`}
        />

        <h2>Best Practices</h2>

        <h3>Security Considerations</h3>
        <ul>
          <li>Always validate user input before sending to the wallet</li>
          <li>Request only the minimum capabilities needed ('read', 'sign', 'transact')</li>
          <li>Handle errors gracefully and provide user feedback</li>
          <li>Never store sensitive data in localStorage or sessionStorage</li>
          <li>Use HTTPS for all dApp communications</li>
          <li>Always simulate transactions before sending to show users estimated fees and risks</li>
          <li>Refresh capability tokens when they expire</li>
        </ul>

        <h3>Performance Optimization</h3>
        <ul>
          <li>Batch multiple requests when possible</li>
          <li>Cache network and balance data appropriately</li>
          <li>Use WebSockets for real-time updates when available</li>
          <li>Implement proper loading states for better UX</li>
        </ul>

        <h3>User Experience</h3>
        <ul>
          <li>Provide clear feedback for all wallet interactions</li>
          <li>Show transaction progress and confirmations</li>
          <li>Handle network switching gracefully</li>
          <li>Support both light and dark themes</li>
        </ul>

        <h2>Testing</h2>

        <h3>Local Development</h3>
        <p>For local testing, you can use the Keythings Wallet development build:</p>
        <ol>
          <li>Clone the Keythings Wallet repository</li>
          <li>Install dependencies with <code>bun install</code></li>
          <li>Run <code>bun run dev</code> to start the development server</li>
          <li>Load the unpacked extension in Chrome</li>
          <li>Set your dApp to development mode</li>
          <li>Test wallet interactions with your dApp</li>
        </ol>

        <h3>Automated Testing</h3>
        <p>For automated testing, consider using:</p>
        <ul>
          <li>Playwright or Puppeteer for browser automation</li>
          <li>Mock wallet implementations for unit tests</li>
          <li>Keeta testnet for integration testing</li>
        </ul>

        <h2>Support</h2>
        <p>
          For additional support or questions about the API, check the{' '}
          <a href="/docs/developer/integration" className="text-accent-gradient hover:underline">
            integration guide
          </a>{' '}
          or{' '}
          <a href="https://github.com/keeta/keethings-wallet/issues" className="text-accent-gradient hover:underline">
            open an issue
          </a>{' '}
          on GitHub.
        </p>
      </div>
    </div>
  )
}
