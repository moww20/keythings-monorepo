import CodeBlock from "@/app/components/CodeBlock";
import PermissionViewer from "@/app/components/PermissionViewer";

export const metadata = {
  title: "Smart Account Architecture — Keythings Wallet Docs",
  description: "Phase 3 implementation details for Keeta hybrid DEX smart accounts, delegated permissions, and emergency exits.",
  alternates: { canonical: "/docs/developer/integration/smart-accounts" },
};

export default function SmartAccountArchitecturePage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Phase 3 — Smart Account Architecture</h1>
      <div className="docs-prose">
        <p>
          <em>
            Phase 3 establishes the smart account scaffolding that keeps Keeta hybrid DEX flows non-custodial while enabling the
            exchange operator to orchestrate settlement with scoped permissions.
          </em>
        </p>

        <h2>Storage account model</h2>
        <ul>
          <li>Each trader owns a dedicated storage account and retains OWNER privileges for emergency withdrawals.</li>
          <li>
            The exchange operator receives <code>SEND_ON_BEHALF</code> permissions scoped per token to settle matched orders
            quickly.
          </li>
          <li>Default storage metadata enables deposits from any counterparty while keeping custody in the user&apos;s control.</li>
        </ul>

        <h2>Instantiate the storage account manager</h2>
        <p>
          The <code>StorageAccountManager</code> helper wraps the Keeta user client builder interface so the frontend can create
          and manage storage accounts without duplicating low-level ACL calls.
        </p>

        <CodeBlock
          language="typescript"
          code={`import { useWallet } from "@/app/contexts/WalletContext";
import { StorageAccountManager } from "@/app/lib/storage-account-manager";

function useStorageManager() {
  const { userClient } = useWallet();
  if (!userClient) {
    throw new Error("Wallet session is missing Keeta user client support");
  }
  return new StorageAccountManager(userClient);
}

async function bootstrapStorageAccount() {
  const manager = useStorageManager();
  const storageAccount = await manager.createStorageAccount(
    "EXCHANGE_OPERATOR_PUBKEY",
    ["USDX_TOKEN_PUBKEY", "KTA_TOKEN_PUBKEY"],
  );
  console.log("Storage account ready:", storageAccount);
}`} 
        />

        <h3>Grant and revoke delegated access</h3>
        <p>
          Scope SEND permissions to specific tokens for market makers and revoke them instantly if an operator key is rotated or
          compromised.
        </p>

        <CodeBlock
          language="typescript"
          code={`const manager = new StorageAccountManager(userClient);

await manager.grantTokenPermission(
  storageAccountPubkey,
  operatorPubkey,
  usdxTokenPubkey,
);

// Later, disable access for the same operator
await manager.revokeOperatorPermissions(storageAccountPubkey, operatorPubkey);

// Users can always exit on their own path
await manager.selfWithdraw(
  storageAccountPubkey,
  coldWalletPubkey,
  usdxTokenPubkey,
  1_000_000n,
);`}
        />

        <h2>Live permission viewer</h2>
        <p>
          Surface the current ACL configuration directly in the dashboard so operations and compliance teams can audit delegated
          powers in real time. The component below uses the same user client APIs exposed by the wallet provider.
        </p>
      </div>

      <div className="not-prose mt-6">
        <div className="glass rounded-2xl border border-hairline p-6">
          <PermissionViewer />
        </div>
      </div>

      <div className="docs-prose mt-6">
        <h2>Operational safeguards</h2>
        <ul>
          <li>Schedule reconciliation to compare on-chain balances with the internal ledger every five minutes.</li>
          <li>Alert on any non-zero drift and auto-correct dust-level differences while flagging large gaps for manual review.</li>
          <li>Document self-withdraw procedures so traders can exit even if the exchange infrastructure is offline.</li>
        </ul>
      </div>
    </div>
  );
}
