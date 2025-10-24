"use client";

import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExplorerOperation } from "@/lib/explorer/client";

import {
  formatRelativeTime,
  summarizeOperation,
} from "../utils/operation-format";
import {
  resolveExplorerPath,
  truncateIdentifier,
} from "../utils/resolveExplorerPath";

interface ExplorerOperationsTableProps {
  operations: ExplorerOperation[];
  emptyLabel?: string;
}

function resolveLink(
  identifier: string | null | undefined,
): { href: string; label: string } | null {
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
      <div className="rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-6 text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_3%,transparent)]">
      <div className="min-w-[720px]">
        <Table className="w-full">
          <TableHeader className="bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] text-xs uppercase tracking-[0.3em] text-muted">
            <TableRow className="border-hairline text-muted">
              <TableHead className="px-6 py-3">Block</TableHead>
              <TableHead className="px-6 py-3">Type</TableHead>
              <TableHead className="px-6 py-3">Participants</TableHead>
              <TableHead className="px-6 py-3">Token</TableHead>
              <TableHead className="px-6 py-3">Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operations.map((operation) => {
              const summary = summarizeOperation(operation);
              const blockLink = `/explorer/block/${operation.block.$hash}`;
              const fromLink = resolveLink(summary.participants.from ?? null);
              const toLink = resolveLink(summary.participants.to ?? null);
              const relative = formatRelativeTime(summary.timestamp) ?? "Just now";

              const primaryOp = operation.operation ?? {};
              const sendOp = operation.operationSend ?? {};
              const receiveOp = operation.operationReceive ?? {};

              const resolvedAmount =
                (typeof primaryOp.amount === "string" && primaryOp.amount) ? primaryOp.amount :
                (typeof sendOp.amount === "string" && sendOp.amount) ? sendOp.amount :
                (typeof receiveOp.amount === "string" && receiveOp.amount) ? receiveOp.amount :
                null;

              const resolvedToken =
                (typeof primaryOp.token === "string" && primaryOp.token) ? primaryOp.token :
                (typeof sendOp.token === "string" && sendOp.token) ? sendOp.token :
                (typeof receiveOp.token === "string" && receiveOp.token) ? receiveOp.token :
                operation.token;

              const formattedAmount = (operation as any).formattedAmount && typeof (operation as any).formattedAmount === "string" && (operation as any).formattedAmount.trim().length > 0
                ? (operation as any).formattedAmount
                : resolvedAmount && (operation as any).tokenTicker
                  ? `${resolvedAmount} ${(operation as any).tokenTicker}`
                  : resolvedAmount && resolvedToken
                    ? `${resolvedAmount} ${resolvedToken}`
                    : resolvedAmount ?? resolvedToken ?? "—";

              return (
                <TableRow
                  key={`${operation.block.$hash}-${operation.voteStapleHash ?? operation.type}`}
                  className="border-hairline text-sm text-foreground"
                >
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <Link
                        href={blockLink}
                        className="font-medium text-accent hover:text-foreground"
                      >
                        {truncateIdentifier(operation.block.$hash, 12, 8)}
                      </Link>
                      {operation.block.account ? (
                        <span className="text-xs text-muted">
                          {truncateIdentifier(operation.block.account)}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                    {operation.type}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col gap-1 text-sm text-subtle">
                      <span>
                        From{" "}
                        {fromLink ? (
                          <Link href={fromLink.href} className="text-accent hover:text-foreground">
                            {fromLink.label}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </span>
                      <span>
                        To{" "}
                        {toLink ? (
                          <Link href={toLink.href} className="text-accent hover:text-foreground">
                            {toLink.label}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-subtle">
                    {formattedAmount}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-muted">
                    {relative}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
