import { notFound } from "next/navigation";

import {
  fetchToken,
  fetchTransactions,
  parseExplorerOperations,
} from "@/lib/explorer/client";

import ExplorerOperationsTable from "../../components/ExplorerOperationsTable";
import {
  formatRelativeTime,
  parseExplorerDate,
} from "../../utils/operation-format";
import { truncateIdentifier } from "../../utils/resolveExplorerPath";

interface TokenPageProps {
  params: {
    publicKey: string;
  };
}

function formatSupply(value: unknown, decimals?: number | null): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  if (value && typeof value === "object" && "toString" in value) {
    try {
      return String((value as { toString: () => string }).toString());
    } catch (error) {
      console.warn("Unable to format token supply", error);
    }
  }
  if (typeof decimals === "number" && decimals > 0) {
    return Number(0).toLocaleString();
  }
  return "—";
}

function formatPermissions(permissions?: string[]): string {
  if (!permissions || permissions.length === 0) {
    return "—";
  }
  return permissions.join(", ");
}

export default async function TokenPage({ params }: TokenPageProps): Promise<React.JSX.Element> {
  const { publicKey: tokenPublicKey } = await params;

  const [token, transactions] = await Promise.all([
    fetchToken(tokenPublicKey),
    fetchTransactions({ publicKey: tokenPublicKey, depth: 20 }),
  ]);

  if (!token) {
    notFound();
  }

  const operations = parseExplorerOperations(transactions.stapleOperations);
  const lastUpdated = operations[0]
    ? formatRelativeTime(parseExplorerDate(operations[0].block.date))
    : null;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3">
            <p className="text-sm uppercase tracking-[0.3em] text-muted">Explorer Token</p>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
                {token.name ?? token.currencyCode ?? truncateIdentifier(token.publicKey)}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-subtle">
                <span className="font-semibold text-foreground/80">{token.currencyCode ?? "—"}</span>
                <span>{truncateIdentifier(token.publicKey, 16, 12)}</span>
              </div>
              {lastUpdated && (
                <p className="text-xs text-faint">Last activity {lastUpdated}</p>
              )}
            </div>
          </header>

          <section className="grid gap-4 rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)] md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Total Supply</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatSupply(token.supply ?? token.totalSupply, token.decimalPlaces ?? token.decimals)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Decimals</p>
              <p className="text-2xl font-semibold text-foreground">
                {token.decimalPlaces ?? token.decimals ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Access Mode</p>
              <p className="text-2xl font-semibold text-foreground">
                {token.accessMode ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Default Permissions</p>
              <p className="text-sm text-subtle">
                {formatPermissions(token.defaultPermissions)}
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Recent Transactions</h2>
            <ExplorerOperationsTable
              operations={operations}
              emptyLabel="No recent token operations."
            />
          </section>
        </div>
      </div>
    </div>
  );
}
