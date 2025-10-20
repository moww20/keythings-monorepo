import Link from "next/link";

import { fetchTransactions, parseExplorerOperations } from "@/lib/explorer/client";

import ExplorerOperationsTable from "../components/ExplorerOperationsTable";
import { formatRelativeTime, parseExplorerDate } from "../utils/operation-format";

interface TransactionsPageProps {
  searchParams?: {
    cursor?: string;
    depth?: string;
  };
}

const DEFAULT_DEPTH = 20;

export default async function TransactionsPage(
  { searchParams }: TransactionsPageProps,
): Promise<React.JSX.Element> {
  const depthParam = Number(searchParams?.depth ?? DEFAULT_DEPTH);
  const depth = Number.isFinite(depthParam) && depthParam > 0 ? depthParam : DEFAULT_DEPTH;
  const cursor = searchParams?.cursor;

  const data = await fetchTransactions({
    startBlock: cursor,
    depth,
  });

  const operations = parseExplorerOperations(data.stapleOperations);
  const nextCursor = data.nextCursor;
  const lastUpdated = operations[0]
    ? formatRelativeTime(parseExplorerDate(operations[0].block.date))
    : null;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.3em] text-muted">Explorer</p>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Network Transactions</h1>
            <p className="text-base text-subtle">
              Stream of recent Keeta operations. Use search or pagination to inspect deeper history.
            </p>
            {lastUpdated && (
              <p className="text-xs text-faint">Last update {lastUpdated}</p>
            )}
          </header>

          <section className="space-y-4">
            <ExplorerOperationsTable operations={operations} emptyLabel="No transactions found." />

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted">
                Showing up to {depth} operations per page.
              </div>
              {nextCursor ? (
                <Link
                  href={`/explorer/transactions?cursor=${nextCursor}&depth=${depth}`}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90"
                >
                  View older operations
                </Link>
              ) : (
                <span className="text-sm text-muted">No more operations.</span>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
