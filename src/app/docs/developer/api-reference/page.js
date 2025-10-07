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
          Keythings Wallet exposes a secure API through the <code>window.keeta</code> global object, following the
          Keeta Wallet standard. This API provides methods for account management, transaction signing,
          and blockchain interactions.
        </p>

        <h2>Connection & Setup</h2>

        <h3>Check if Keythings Wallet is Available</h3>
        <CodeBlock
          language="javascript"
          code={`// Check if Keythings Wallet is installed and available
if (typeof window.keeta !== 'undefined') {
  console.log('Keythings Wallet is available');
} else {
  console.log('Keythings Wallet not detected');
}`}
        />

        <h3>Request Connection</h3>
        <CodeBlock
          language="javascript"
          code={`// Request to connect to Keythings Wallet
try {
  const accounts = await window.keeta.request({
    method: 'eth_requestAccounts'
  });
  console.log('Connected accounts:', accounts);
} catch (error) {
  console.error('Connection failed:', error);
}`}
        />

        <h2>Account Management</h2>

        <h3>Get Connected Accounts</h3>
        <CodeBlock
          language="javascript"
          code={`// Get currently connected accounts
const accounts = await window.keeta.request({
  method: 'eth_accounts'
});
console.log('Connected accounts:', accounts);`}
        />

        <h3>Get Current Account</h3>
        <CodeBlock
          language="javascript"
          code={`// Get the currently selected account
const currentAccount = await window.keeta.request({
  method: 'eth_coinbase'
});
console.log('Current account:', currentAccount);`}
        />

        <h2>Network Information</h2>

        <h3>Get Current Network</h3>
        <CodeBlock
          language="javascript"
          code={`// Get current network information
const network = await window.keeta.request({
  method: 'net_version'
});
console.log('Current network ID:', network);`}
        />

        <h3>Switch Network</h3>
        <CodeBlock
          language="javascript"
          code={`// Switch to Keeta Mainnet
await window.keeta.request({
  method: 'wallet_switchEthereumChain',
  params: [{ chainId: '0x4d85' }] // 19845 in decimal
});`}
        />

        <h3>Add Custom Network</h3>
        <CodeBlock
          language="javascript"
          code={`// Add a custom Keeta network
await window.keeta.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x4d86', // 19846 in hex
    chainName: 'Keeta Testnet',
    rpcUrls: ['https://testnet.keeta.network/rpc'],
    nativeCurrency: {
      name: 'Test KEETA',
      symbol: 'TKEETA',
      decimals: 18
    },
    blockExplorerUrls: ['https://testnet.explorer.keeta.network']
  }]
});`}
        />

        <h2>Balance & State</h2>

        <h3>Get Account Balance</h3>
        <CodeBlock
          language="javascript"
          code={`// Get KEETA balance for an account
const balance = await window.keeta.request({
  method: 'eth_getBalance',
  params: ['0xAccountAddress', 'latest']
});
console.log('Balance (wei):', balance);

// Convert to KEETA
const balanceInKeeta = parseInt(balance) / Math.pow(10, 18);
console.log('Balance (KEETA):', balanceInKeeta);`}
        />

        <h3>Get All Account Balances</h3>
        <CodeBlock
          language="javascript"
          code={`// Get balances for all tokens
const balances = await window.keeta.request({
  method: 'keeta_getAllBalances',
  params: ['0xAccountAddress']
});
console.log('Token balances:', balances);`}
        />

        <h2>Transaction Management</h2>

        <h3>Send Transaction</h3>
        <CodeBlock
          language="javascript"
          code={`// Send KEETA to another address
const txHash = await window.keeta.request({
  method: 'eth_sendTransaction',
  params: [{
    from: '0xYourAccountAddress',
    to: '0xRecipientAddress',
    value: '0x2386f26fc10000', // 0.01 KEETA in wei
    gas: '0x5208' // 21000 gas
  }]
});
console.log('Transaction hash:', txHash);`}
        />

        <h3>Sign Transaction (No Broadcast)</h3>
        <CodeBlock
          language="javascript"
          code={`// Sign a transaction without broadcasting
const signedTx = await window.keeta.request({
  method: 'eth_signTransaction',
  params: [{
    from: '0xYourAccountAddress',
    to: '0xRecipientAddress',
    value: '0x2386f26fc10000',
    gas: '0x5208',
    gasPrice: '0x4a817c800' // 20 gwei
  }]
});
console.log('Signed transaction:', signedTx);`}
        />

        <h3>Estimate Gas</h3>
        <CodeBlock
          language="javascript"
          code={`// Estimate gas for a transaction
const gasEstimate = await window.keeta.request({
  method: 'eth_estimateGas',
  params: [{
    from: '0xYourAccountAddress',
    to: '0xRecipientAddress',
    value: '0x2386f26fc10000'
  }]
});
console.log('Estimated gas:', gasEstimate);`}
        />

        <h2>Message Signing</h2>

        <h3>Personal Sign</h3>
        <CodeBlock
          language="javascript"
          code={`// Sign a message with the user's private key
const signature = await window.keeta.request({
  method: 'personal_sign',
  params: ['Hello, Keeta!', '0xYourAccountAddress']
});
console.log('Signature:', signature);`}
        />

        <h3>Eth Sign (Structured Data)</h3>
        <CodeBlock
          language="javascript"
          code={`// Sign structured data (EIP-712)
const typedData = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' }
    ],
    Message: [
      { name: 'content', type: 'string' },
      { name: 'timestamp', type: 'uint256' }
    ]
  },
  primaryType: 'Message',
  domain: {
    name: 'My dApp',
    version: '1.0',
    chainId: 19845
  },
  message: {
    content: 'Hello from Keeta!',
    timestamp: Date.now()
  }
};

const signature = await window.keeta.request({
  method: 'eth_signTypedData_v4',
  params: ['0xYourAccountAddress', typedData]
});
console.log('Typed signature:', signature);`}
        />

        <h2>Capabilities & Permissions</h2>

        <h3>Request Capabilities</h3>
        <CodeBlock
          language="javascript"
          code={`// Request specific capabilities from the wallet
const capabilities = await window.keeta.request({
  method: 'keeta_requestCapabilities',
  params: [{
    accounts: ['0xYourAccountAddress'],
    capabilities: [
      'eth_accounts',
      'eth_sendTransaction',
      'personal_sign'
    ]
  }]
});
console.log('Granted capabilities:', capabilities);`}
        />

        <h3>Check Capabilities</h3>
        <CodeBlock
          language="javascript"
          code={`// Check current capabilities for an origin
const currentCapabilities = await window.keeta.request({
  method: 'keeta_getCapabilities'
});
console.log('Current capabilities:', currentCapabilities);`}
        />

        <h2>Advanced Features</h2>

        <h3>Transaction Simulation</h3>
        <CodeBlock
          language="javascript"
          code={`// Simulate a transaction before signing
const simulation = await window.keeta.request({
  method: 'keeta_simulateTransaction',
  params: [{
    from: '0xYourAccountAddress',
    to: '0xContractAddress',
    data: '0xContractCallData',
    value: '0x0'
  }]
});
console.log('Simulation result:', simulation);`}
        />

        <h3>Batch Requests</h3>
        <CodeBlock
          language="javascript"
          code={`// Send multiple requests in a batch
const batchResults = await window.keeta.request({
  method: 'keeta_batch',
  params: [[
    { method: 'eth_accounts' },
    { method: 'net_version' },
    { method: 'eth_getBalance', params: ['0xAccountAddress'] }
  ]]
});
console.log('Batch results:', batchResults);`}
        />

        <h2>Error Handling</h2>

        <h3>Common Error Codes</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Error Code</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Solution</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2">4001</td>
                <td className="border border-gray-300 px-4 py-2">User rejected the request</td>
                <td className="border border-gray-300 px-4 py-2">Ask user to approve the request</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">4100</td>
                <td className="border border-gray-300 px-4 py-2">Unauthorized</td>
                <td className="border border-gray-300 px-4 py-2">Request proper permissions first</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">4200</td>
                <td className="border border-gray-300 px-4 py-2">Unsupported method</td>
                <td className="border border-gray-300 px-4 py-2">Check method name spelling</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">4900</td>
                <td className="border border-gray-300 px-4 py-2">Disconnected</td>
                <td className="border border-gray-300 px-4 py-2">Reconnect to the wallet</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">4901</td>
                <td className="border border-gray-300 px-4 py-2">Chain disconnected</td>
                <td className="border border-gray-300 px-4 py-2">Switch to correct network</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Error Handling Example</h3>
        <CodeBlock
          language="javascript"
          code={`try {
  const result = await window.keeta.request({
    method: 'eth_sendTransaction',
    params: [transaction]
  });
  console.log('Success:', result);
} catch (error) {
  console.error('Error:', error);

  switch (error.code) {
    case 4001:
      console.log('User rejected the request');
      break;
    case 4100:
      console.log('Unauthorized - request permissions first');
      break;
    case 4200:
      console.log('Unsupported method');
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
          code={`// Core Keeta Wallet API interface
interface KeetaWallet {
  request(args: {
    method: string;
    params?: any[];
  }): Promise<any>;

  on(event: string, handler: Function): void;
  removeListener(event: string, handler: Function): void;
}

// Transaction object
interface TransactionObject {
  from: string;
  to?: string;
  value?: string;
  data?: string;
  gas?: string;
  gasPrice?: string;
  nonce?: string;
}

// Network configuration
interface NetworkConfig {
  chainId: string;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls?: string[];
}`}
        />

        <h2>Best Practices</h2>

        <h3>Security Considerations</h3>
        <ul>
          <li>Always validate user input before sending to the wallet</li>
          <li>Request only the minimum permissions needed</li>
          <li>Handle errors gracefully and provide user feedback</li>
          <li>Never store sensitive data in localStorage or sessionStorage</li>
          <li>Use HTTPS for all dApp communications</li>
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
