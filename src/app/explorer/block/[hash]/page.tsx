import Link from "next/link";
import { notFound } from "next/navigation";

import {
  fetchVoteStaple,
  parseExplorerOperations,
  type ExplorerVoteStapleResponse,
} from "@/lib/explorer/client";

import ExplorerOperationsTable from "../../components/ExplorerOperationsTable";
import {
  formatRelativeTime,
  parseExplorerDate,
  summarizeOperation,
} from "../../utils/operation-format";
import { resolveExplorerPath, truncateIdentifier } from "../../utils/resolveExplorerPath";

interface BlockPageProps {
  params: {
    hash: string;
  };
}

function findBlock(
  response: ExplorerVoteStapleResponse,
  hash: string,
): ExplorerVoteStapleResponse["voteStaple"]["blocks"][number] | undefined {
  return response.voteStaple.blocks.find((block) => {
    const blockHash = (block as Record<string, unknown>).$hash ?? block.hash;
    return typeof blockHash === "string" && blockHash === hash;
  });
}

function getBlockHash(block: ExplorerVoteStapleResponse["voteStaple"]["blocks"][number]): string {
  const candidate = (block as Record<string, unknown>).$hash ?? block.hash;
  return typeof candidate === "string" ? candidate : "";
}

function extractOperations(block: ExplorerVoteStapleResponse["voteStaple"]["blocks"][number]) {
  const candidate =
    (block as Record<string, unknown>).operations
    ?? (block as Record<string, unknown>).transactions
    ?? [];
  return Array.isArray(candidate) ? candidate : [];
}

export default async function BlockPage({ params }: BlockPageProps): Promise<React.JSX.Element> {
  const blockhash = params.hash;
  const response = await fetchVoteStaple(blockhash);
  const block = findBlock(response, blockhash);

  if (!block) {
    notFound();
  }

  const currentBlockHash = getBlockHash(block!);
  const timestamp = parseExplorerDate((block as Record<string, unknown>).createdAt ?? (block as Record<string, unknown>).date);
  const relativeTime = formatRelativeTime(timestamp);

  const operations = parseExplorerOperations(extractOperations(block!));

  const totalOperations = operations.length;
  const rawTransactions = (block as Record<string, unknown>).transactions;
  const totalTransactions = Array.isArray(rawTransactions)
    ? rawTransactions.length
    : totalOperations;

  const account = typeof block.account === "string" ? block.account : undefined;
  const accountLink = account ? resolveExplorerPath(account) : null;

  const otherBlocks = response.voteStaple.blocks
    .filter((candidate) => getBlockHash(candidate) !== currentBlockHash)
    .map((candidate) => getBlockHash(candidate))
    .filter((hashValue): hashValue is string => Boolean(hashValue));

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-2">
                <p className="text-sm uppercase tracking-[0.3em] text-muted">Explorer Block</p>
                <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
                  {truncateIdentifier(currentBlockHash, 16, 12)}
                </h1>
                {timestamp && (
                  <p className="text-sm text-subtle">
                    {timestamp.toLocaleString()} {relativeTime ? `• ${relativeTime}` : ""}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={response.previousBlockHash ? `/explorer/block/${response.previousBlockHash}` : "#"}
                  aria-disabled={!response.previousBlockHash}
                  className={`rounded-full border border-soft px-4 py-2 text-sm font-medium transition ${response.previousBlockHash ? "text-accent hover:text-foreground" : "pointer-events-none text-muted"}`}
                >
                  Previous
                </Link>
                <Link
                  href={response.nextBlockHash ? `/explorer/block/${response.nextBlockHash}` : "#"}
                  aria-disabled={!response.nextBlockHash}
                  className={`rounded-full border border-soft px-4 py-2 text-sm font-medium transition ${response.nextBlockHash ? "text-accent hover:text-foreground" : "pointer-events-none text-muted"}`}
                >
                  Next
                </Link>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)] md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted">Operations</p>
                <p className="text-2xl font-semibold text-foreground">{totalOperations}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted">Transactions</p>
                <p className="text-2xl font-semibold text-foreground">{totalTransactions}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted">Account</p>
                {account && accountLink ? (
                  <Link href={accountLink} className="text-sm font-medium text-accent hover:text-foreground">
                    {truncateIdentifier(account, 10, 10)}
                  </Link>
                ) : (
                  <p className="text-sm text-subtle">—</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted">Staple Blocks</p>
                <p className="text-2xl font-semibold text-foreground">{response.voteStaple.blocks.length}</p>
              </div>
            </div>
          </header>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Operations</h2>
            <ExplorerOperationsTable
              operations={operations}
              emptyLabel="No operations recorded for this block."
            />
          </section>

          {otherBlocks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Related Blocks in Staple</h2>
              <div className="flex flex-wrap gap-2">
                {otherBlocks.map((hashValue) => (
                  hashValue ? (
                    <Link
                      key={hashValue}
                      href={`/explorer/block/${hashValue}`}
                      className="rounded-full border border-soft px-4 py-2 text-sm font-medium text-accent transition hover:text-foreground"
                    >
                      {truncateIdentifier(hashValue, 10, 8)}
                    </Link>
                  ) : null
                ))}
              </div>
            </section>
          )}

          {Array.isArray(response.voteStaple.blocks) && response.voteStaple.blocks.length > 0 && response.voteStaple.blocks[0] && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Staple Summary</h2>
              <div className="grid gap-3 rounded-2xl border border-hairline bg-surface p-6">
                <div className="text-sm text-subtle">
                  This vote staple contains {response.voteStaple.blocks.length} blocks and {operations.length} normalized operations.
                </div>
                {operations.slice(0, 3).map((operation) => {
                  const summary = summarizeOperation(operation);
                  const blockLink = `/explorer/block/${operation.block.$hash}`;
                  return (
                    <div
                      key={`${operation.block.$hash}-${operation.voteStapleHash ?? operation.type}-summary`}
                      className="rounded-xl border border-soft bg-[color:color-mix(in_oklab,var(--foreground)_3%,transparent)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={blockLink} className="text-sm font-medium text-accent hover:text-foreground">
                          {truncateIdentifier(operation.block.$hash, 12, 8)}
                        </Link>
                        <span className="text-xs uppercase tracking-[0.3em] text-muted">{operation.type}</span>
                      </div>
                      <p className="mt-2 text-sm text-subtle">{summary.description}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
