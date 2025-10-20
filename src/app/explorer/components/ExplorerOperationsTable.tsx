import Link from "next/link";

import type { ExplorerOperation } from "@/lib/explorer/client";

import { formatRelativeTime, summarizeOperation } from "../utils/operation-format";
import { resolveExplorerPath, truncateIdentifier } from "../utils/resolveExplorerPath";

interface ExplorerOperationsTableProps {
  operations: ExplorerOperation[];
  emptyLabel?: string;
}

function resolveLink(identifier: string | null | undefined): { href: string; label: string } | null {
  if (!identifier) {
    return null;
  }
  const path = resolveExplorerPath(identifier);
  if (!path) {
    return null;
  }
  return {
    href: path,
    label: truncateIdentifier(identifier, 10, 8),
  };
}

export default function ExplorerOperationsTable(
  { operations, emptyLabel = "No operations available." }: ExplorerOperationsTableProps,
): React.JSX.Element {
  if (!operations.length) {
    return (
      <div className="rounded-xl border border-hairline bg-surface p-6 text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="hidden grid-cols-[1.5fr_1fr_1fr_2fr_1fr] gap-4 border-b border-hairline px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-muted md:grid">
        <span>Block</span>
        <span>Type</span>
        <span>Participants</span>
        <span>Details</span>
        <span>Age</span>
      </div>
      <div className="divide-y divide-hairline">
        {operations.map((operation) => {
          const summary = summarizeOperation(operation);
          const blockLink = `/explorer/block/${operation.block.$hash}`;
          const fromLink = resolveLink(summary.participants.from ?? null);
          const toLink = resolveLink(summary.participants.to ?? null);
          const relative = formatRelativeTime(summary.timestamp) ?? "Just now";

          return (
            <div
              key={`${operation.block.$hash}-${operation.voteStapleHash ?? operation.type}`}
              className="grid gap-6 px-6 py-4 text-sm text-foreground md:grid-cols-[1.5fr_1fr_1fr_2fr_1fr]"
            >
              <div className="flex flex-col gap-1">
                <Link href={blockLink} className="font-medium text-accent hover:text-foreground">
                  {truncateIdentifier(operation.block.$hash, 12, 8)}
                </Link>
                {operation.block.account && (
                  <span className="text-xs text-muted">{truncateIdentifier(operation.block.account)}</span>
                )}
              </div>
              <div className="font-medium uppercase tracking-[0.3em] text-muted">
                {operation.type}
              </div>
              <div className="flex flex-col gap-1 text-sm text-subtle">
                {fromLink ? (
                  <Link href={fromLink.href} className="hover:text-accent">
                    From {fromLink.label}
                  </Link>
                ) : (
                  <span>From —</span>
                )}
                {toLink ? (
                  <Link href={toLink.href} className="hover:text-accent">
                    To {toLink.label}
                  </Link>
                ) : (
                  <span>To —</span>
                )}
              </div>
              <div className="text-sm text-subtle">
                {summary.description}
              </div>
              <div className="text-sm text-muted">
                {relative}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
