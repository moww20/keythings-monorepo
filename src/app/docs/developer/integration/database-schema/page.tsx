import CodeBlock from "@/app/components/CodeBlock";

export const metadata = {
  title: "Database Schema — Keythings Wallet Docs",
  description: "Phase 7 relational schema for the Keeta hybrid DEX ledger, reconciliation, and audit surfaces.",
  alternates: { canonical: "/docs/developer/integration/database-schema" },
};

export default function DatabaseSchemaPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Phase 7 — Database Schema</h1>
      <div className="docs-prose">
        <p>
          <em>
            Phase 7 hardens the hybrid DEX with a relational ledger that mirrors on-chain storage accounts, captures trade
            execution, and powers continuous reconciliation.
          </em>
        </p>

        <h2>Core tables</h2>
        <p>
          The schema stays deliberately compact so each table maps to a single operational concern. All balances reference Keeta
          storage accounts and preserve the <code>OWNER</code> withdrawal path for end users.
        </p>
        <ul>
          <li>
            <strong>users:</strong> Wallet-linked identities with keys for audit trails and capability scoping.
          </li>
          <li>
            <strong>balances:</strong> Internal ledger tracking available and reserved amounts per asset.
          </li>
          <li>
            <strong>orders:</strong> Live order book entries with price-time priority metadata.
          </li>
          <li>
            <strong>fills:</strong> Immutable trade history derived from matched orders.
          </li>
          <li>
            <strong>deposits / withdrawals:</strong> Fiat and on-chain movements awaiting settlement confirmation.
          </li>
          <li>
            <strong>reconciliations:</strong> Snapshots of on-chain vs. internal totals with drift calculations.
          </li>
        </ul>

        <h2>Column design highlights</h2>
        <ul>
          <li>
            Use <code>NUMERIC(38, 0)</code> for token balances to match on-chain integer precision.
          </li>
          <li>Store every amount as smallest unit (e.g. lamports) and keep display conversions in application code.</li>
          <li>
            Persist the originating Keeta storage account, operator delegate, and transaction signature for every balance
            mutation.
          </li>
          <li>
            Timestamp columns use <code>TIMESTAMPTZ</code> to guarantee ordering across availability zones.
          </li>
        </ul>
      </div>

      <div className="docs-prose mt-6">
        <h2>DDL blueprint</h2>
        <p>
          Start with explicit schemas and foreign keys. The sample below omits non-essential columns for brevity but captures the
          invariants required for reconciliation and incident response.
        </p>
      </div>

      <div className="not-prose mt-4">
        <CodeBlock
          language="sql"
          code={`CREATE TABLE users (
  id UUID PRIMARY KEY,
  keeta_storage_account TEXT NOT NULL UNIQUE,
  owner_pubkey TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE balances (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  asset_symbol TEXT NOT NULL,
  total NUMERIC(38, 0) NOT NULL,
  available NUMERIC(38, 0) NOT NULL,
  reserved NUMERIC(38, 0) NOT NULL,
  keeta_tx TEXT,
  last_reconciled_at TIMESTAMPTZ,
  UNIQUE (user_id, asset_symbol)
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  price NUMERIC(38, 8) NOT NULL,
  size NUMERIC(38, 0) NOT NULL,
  filled NUMERIC(38, 0) NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  time_in_force TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fills (
  id UUID PRIMARY KEY,
  maker_order_id UUID NOT NULL REFERENCES orders(id),
  taker_order_id UUID NOT NULL REFERENCES orders(id),
  asset_symbol TEXT NOT NULL,
  size NUMERIC(38, 0) NOT NULL,
  price NUMERIC(38, 8) NOT NULL,
  fee NUMERIC(38, 0) NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deposits (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  asset_symbol TEXT NOT NULL,
  amount NUMERIC(38, 0) NOT NULL,
  tx_signature TEXT,
  status TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE withdrawals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  asset_symbol TEXT NOT NULL,
  amount NUMERIC(38, 0) NOT NULL,
  destination_pubkey TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE reconciliations (
  id UUID PRIMARY KEY,
  asset_symbol TEXT NOT NULL,
  internal_total NUMERIC(38, 0) NOT NULL,
  onchain_total NUMERIC(38, 0) NOT NULL,
  drift NUMERIC(38, 0) NOT NULL,
  snapshot_block_height BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`}
        />
      </div>

      <div className="docs-prose mt-6">
        <h2>Indices and retention</h2>
        <ul>
          <li>
            Create partial indexes on <code>orders</code> for <code>status = 'open'</code> to accelerate matching and cancellations.
          </li>
          <li>
            Use composite indexes on <code>fills</code> (<code>maker_order_id</code>, <code>occurred_at</code>) so trade exports
            stream efficiently.
          </li>
          <li>
            Archive completed deposits and withdrawals into partitioned history tables every 30 days to keep hot data lean.
          </li>
          <li>Retain reconciliation snapshots for at least two years to satisfy regulatory audit trails.</li>
        </ul>

        <h2>Ledger invariants</h2>
        <ul>
          <li>
            Total internal balances per asset must equal the latest reconciliation <code>onchain_total</code>; drift other than
            dust triggers incident response.
          </li>
          <li>
            Orders can only reserve funds via transactional updates that decrement <code>available</code> and increment
            <code>reserved</code> atomically.
          </li>
          <li>Fills release maker and taker reservations in the same transaction that logs the fill row.</li>
          <li>
            Withdrawals progress through <code>queued → signing → submitted → settled</code> states and never skip steps.
          </li>
        </ul>

        <h2>Reconciliation workflow</h2>
        <ol>
          <li>Fetch on-chain balances for every user storage account through the Keeta indexer.</li>
          <li>Aggregate internal <code>balances</code> by asset and compare to the on-chain totals.</li>
          <li>Persist the comparison in <code>reconciliations</code>, including the block height and signer that ran the job.</li>
          <li>Generate alerts when drift exceeds configured thresholds and automatically freeze new withdrawals on that asset.</li>
          <li>Document remediation steps in the reconciliation runbook and link incident IDs back to this snapshot.</li>
        </ol>
      </div>
    </div>
  );
}
