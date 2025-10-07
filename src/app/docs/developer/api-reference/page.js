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
          Keythings Wallet exposes an{' '}
          <code>EIP-1193</code>
          -compatible provider through the <code>window.keythings</code> global object. It mirrors the behaviour of
          <code>window.ethereum</code> while adding Keythings-specific polish like network presets and hardened
          permission flows.
        </p>

        <h2>Connection &amp; Setup</h2>

        <h3>Check if Keythings Wallet is Available</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;

if (!provider) {
  console.error('Keythings Wallet not detected');
} else {
  console.log('Keythings Wallet provider ready', provider);
}`}
        />

        <h3>Request Connection</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;

try {
  const accounts = await provider.request({
    method: 'eth_requestAccounts',
  });

  console.log('Connected account:', accounts[0]);
} catch (error) {
  console.error('Connection failed:', error);
}`}
        />

        <h2>Account Management</h2>

        <h3>Get Connected Accounts</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;

const accounts = await provider.request({
  method: 'eth_accounts',
});

console.log('Connected accounts:', accounts);`}
        />

        <h3>Get Primary Account</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;

const [primaryAccount] = await provider.request({
  method: 'eth_accounts',
});

if (primaryAccount) {
  console.log('Primary account:', primaryAccount);
}`}
        />

        <h2>Network Information</h2>

        <h3>Get Current Network</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;

const chainId = await provider.request({
  method: 'eth_chainId',
});

console.log('Connected chain ID:', chainId);`}
        />

        <h3>Switch Network</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;

await provider.request({
  method: 'wallet_switchEthereumChain',
  params: [{ chainId: '0x4d85' }], // 19845 in decimal
});`}
        />

        <h3>Add Custom Network</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;

await provider.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x4d86', // 19846 in hex
    chainName: 'Keythings Testnet',
    rpcUrls: ['https://rpc.testnet.keythings.example'],
    nativeCurrency: {
      name: 'Test KEY',
      symbol: 'tKEY',
      decimals: 18,
    },
    blockExplorerUrls: ['https://explorer.testnet.keythings.example'],
  }],
});`}
        />

        <h2>Balance &amp; State</h2>

        <h3>Get Account Balance</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;
const [account] = await provider.request({ method: 'eth_requestAccounts' });

const balanceHex = await provider.request({
  method: 'eth_getBalance',
  params: [account, 'latest'],
});

const balanceInEth = Number.parseInt(balanceHex, 16) / 1e18;
console.log('Balance (ETH):', balanceInEth);`}
        />

        <h3>Watch an ERC-20 Asset</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;

await provider.request({
  method: 'wallet_watchAsset',
  params: {
    type: 'ERC20',
    options: {
      address: '0xTokenAddress',
      symbol: 'TOK',
      decimals: 18,
    },
  },
});`}
        />

        <h2>Transaction Management</h2>

        <h3>Send Transaction</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;
const [from] = await provider.request({ method: 'eth_requestAccounts' });

const txHash = await provider.request({
  method: 'eth_sendTransaction',
  params: [{
    from,
    to: '0xRecipientAddress',
    value: '0x2386f26fc10000', // 0.01 KEY in wei
  }],
});

console.log('Transaction hash:', txHash);`}
        />

        <h3>Sign Transaction (No Broadcast)</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;
const [from] = await provider.request({ method: 'eth_requestAccounts' });

const unsignedTx = {
  from,
  to: '0xRecipientAddress',
  value: '0x2386f26fc10000',
  gas: '0x5208',
};

const signedTx = await provider.request({
  method: 'eth_signTransaction',
  params: [unsignedTx],
});

console.log('Signed transaction:', signedTx);`}
        />

        <h3>Estimate Gas</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;
const [from] = await provider.request({ method: 'eth_requestAccounts' });

const gasEstimate = await provider.request({
  method: 'eth_estimateGas',
  params: [{
    from,
    to: '0xRecipientAddress',
    value: '0x2386f26fc10000',
  }],
});

console.log('Estimated gas:', Number.parseInt(gasEstimate, 16));`}
        />

        <h2>Message Signing</h2>

        <h3>Personal Sign</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;
const [from] = await provider.request({ method: 'eth_requestAccounts' });

const signature = await provider.request({
  method: 'personal_sign',
  params: ['Hello, Keythings!', from],
});

console.log('Signature:', signature);`}
        />

        <h3>Eth Sign (Structured Data)</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;
const [from] = await provider.request({ method: 'eth_requestAccounts' });

const typedData = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
    ],
    Message: [
      { name: 'content', type: 'string' },
      { name: 'timestamp', type: 'uint256' },
    ],
  },
  primaryType: 'Message',
  domain: {
    name: 'My dApp',
    version: '1.0',
    chainId: 19845,
  },
  message: {
    content: 'Hello from Keythings!',
    timestamp: Date.now(),
  },
};

const signature = await provider.request({
  method: 'eth_signTypedData_v4',
  params: [from, JSON.stringify(typedData)],
});

console.log('Typed signature:', signature);`}
        />

        <h2>Capabilities &amp; Permissions</h2>

        <h3>Request Capabilities</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;

const permissions = await provider.request({
  method: 'wallet_requestPermissions',
  params: [{
    eth_accounts: {},
  }],
});

console.log('Granted permissions:', permissions);`}
        />

        <h3>Check Capabilities</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;

const permissions = await provider.request({
  method: 'wallet_getPermissions',
});

const hasAccounts = permissions.some(
  (permission) => permission.parentCapability === 'eth_accounts',
);

console.log('Has eth_accounts:', hasAccounts);`}
        />

        <h2>Advanced Features</h2>

        <h3>Transaction Simulation</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;
const [from] = await provider.request({ method: 'eth_requestAccounts' });

const simulationResult = await provider.request({
  method: 'eth_call',
  params: [{
    from,
    to: '0xContractAddress',
    data: '0xContractCallData',
  }, 'pending'],
});

console.log('Simulation result:', simulationResult);`}
        />

        <h3>Batch Requests</h3>
        <CodeBlock
          language="javascript"
          code={`const provider = window.keythings ?? window.ethereum;
const [account] = await provider.request({ method: 'eth_requestAccounts' });

const [accounts, chainId, balance] = await Promise.all([
  provider.request({ method: 'eth_accounts' }),
  provider.request({ method: 'eth_chainId' }),
  provider.request({
    method: 'eth_getBalance',
    params: [account, 'latest'],
  }),
]);

console.log({ accounts, chainId, balance });`}
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
          code={`const provider = window.keythings ?? window.ethereum;

try {
  const result = await provider.request({
    method: 'eth_sendTransaction',
    params: [transaction],
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
          code={`interface RequestArguments {
  readonly method: string;
  readonly params?: readonly unknown[] | Record<string, unknown>;
}

interface KeythingsProvider {
  request<T = unknown>(args: RequestArguments): Promise<T>;
  on(event: 'accountsChanged' | 'chainChanged' | 'message' | 'disconnect', listener: (...args: unknown[]) => void): void;
  removeListener(
    event: 'accountsChanged' | 'chainChanged' | 'message' | 'disconnect',
    listener: (...args: unknown[]) => void,
  ): void;
}

interface AddEthereumChainParameter {
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
          <li>Install dependencies with <code>bun install</code> or <code>npm install</code></li>
          <li>Run <code>bun run dev</code> (or <code>npm run dev</code>) to start the development server</li>
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
