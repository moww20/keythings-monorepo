"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import {
  fetchVoteStaple,
  parseExplorerOperations,
  type ExplorerVoteStapleResponse,
  type ExplorerOperation,
} from "@/lib/explorer/client";

import ExplorerOperationsTable from "../../components/ExplorerOperationsTable";
import {
  formatRelativeTime,
  parseExplorerDate,
  summarizeOperation,
} from "../../utils/operation-format";
import {
  resolveExplorerPath,
  truncateIdentifier,
} from "../../utils/resolveExplorerPath";

interface BlockState {
  response: ExplorerVoteStapleResponse;
  block: ExplorerVoteStapleResponse["voteStaple"]["blocks"][number];
  operations: ExplorerOperation[];
}

export default function BlockPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const blockhash = params.hash as string;

  const [state, setState] = useState<BlockState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchVoteStaple(blockhash);
        if (cancelled || !response?.voteStaple?.blocks?.length) {
          return;
        }

        const block = findBlock(response, blockhash);
        if (!block) {
          setError("Block not found.");
          return;
        }

        const operations = parseExplorerOperations(extractOperations(block));
        if (!cancelled) {
          setState({ response, block, operations });
        }
      } catch (err) {
        console.error("[BLOCK_PAGE] Failed to load block data", err);
        if (!cancelled) {
          setError("Unable to load block information. Connect your wallet and try again.");
          setState(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [blockhash]);

  const blockHash = useMemo(() => {
    if (!state?.block) return blockhash;
    return getBlockHash(state.block) || blockhash;
  }, [state, blockhash]);

  if (loading) {
    return <BlockPageSkeleton />;
  }

  if (error || !state?.block) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="px-4 py-6 lg:px-6">
          <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Unable to load block
              </CardTitle>
              <CardDescription>{error ?? "Block not found on the Keeta network."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted">
              <p>Confirm the hash and ensure your Keeta wallet connection is active.</p>
              <button
                type="button"
                className="text-accent hover:text-foreground"
                onClick={() => router.back()}
              >
                Go back
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { response, block, operations } = state;
  const timestamp = parseExplorerDate(
    (block as Record<string, unknown>).createdAt ?? (block as Record<string, unknown>).date,
  );
  const relativeTime = formatRelativeTime(timestamp);

  const totalOperations = operations.length;
  const rawTransactions = (block as Record<string, unknown>).transactions;
  const totalTransactions = Array.isArray(rawTransactions)
    ? rawTransactions.length
    : totalOperations;

  const account = typeof block.account === "string" ? block.account : undefined;
  const accountLink = account ? resolveExplorerPath(account) : null;

  const otherBlocks = response.voteStaple.blocks
    .filter((candidate) => getBlockHash(candidate) !== blockHash)
    .map((candidate) => getBlockHash(candidate))
    .filter((hashValue): hashValue is string => Boolean(hashValue));

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/explorer">Explorer</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/explorer/block">Block</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{truncateIdentifier(blockHash, 16, 12)}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <CardHeader className="space-y-3">
              <div>
                <span className="text-xs uppercase tracking-[0.3em] text-muted">
                  Explorer Block
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
                    {truncateIdentifier(blockHash, 18, 12)}
                  </h1>
                  <Badge variant="outline" className="text-xs uppercase tracking-[0.2em]">
                    Vote Staple
                  </Badge>
                </div>
                {timestamp ? (
                  <p className="mt-2 text-sm text-subtle">
                    {timestamp.toLocaleString()}{" "}
                    {relativeTime ? <>· <span>{relativeTime}</span></> : null}
                  </p>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SummaryMetric label="Operations" value={totalOperations} />
                <SummaryMetric label="Transactions" value={totalTransactions} />
                <SummaryMetric
                  label="Account"
                  value={
                    account && accountLink ? (
                      <Link
                        href={accountLink}
                        className="text-sm font-medium text-accent hover:text-foreground"
                      >
                        {truncateIdentifier(account, 12, 10)}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <SummaryMetric
                  label="Staple Blocks"
                  value={response.voteStaple.blocks.length}
                />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="overview" className="flex flex-col gap-6">
            <TabsList className="bg-[color:color-mix(in_oklab,var(--foreground)_5%,transparent)]">
              <TabsTrigger value="overview" className="px-4">
                Overview
              </TabsTrigger>
              <TabsTrigger value="operations" className="px-4">
                Operations
              </TabsTrigger>
              <TabsTrigger value="staple" className="px-4">
                Staple Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Block Summary
                  </CardTitle>
                  <CardDescription>
                    High-level context for block {truncateIdentifier(blockHash, 16, 12)}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-subtle">
                  <DetailRow
                    label="Block Hash"
                    value={truncateIdentifier(blockHash, 24, 18)}
                  />
                  <DetailRow
                    label="Total Operations"
                    value={totalOperations.toString()}
                  />
                  <DetailRow
                    label="Total Transactions"
                    value={totalTransactions.toString()}
                  />
                  <DetailRow
                    label="Account"
                    value={
                      account && accountLink ? (
                        <Link
                          href={accountLink}
                          className="font-medium text-accent hover:text-foreground"
                        >
                          {truncateIdentifier(account, 14, 12)}
                        </Link>
                      ) : (
                        "—"
                      )
                    }
                  />
                </CardContent>
              </Card>

              {otherBlocks.length > 0 ? (
                <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">
                      Related Blocks
                    </CardTitle>
                    <CardDescription>
                      Additional blocks contained within this vote staple.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {otherBlocks.map((hashValue) => (
                        <Link
                          key={hashValue}
                          href={`/explorer/block/${hashValue}`}
                          className="rounded-full border border-soft px-4 py-2 text-sm font-medium text-accent transition hover:text-foreground"
                        >
                          {truncateIdentifier(hashValue, 12, 10)}
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="operations">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Operations
                  </CardTitle>
                  <CardDescription>
                    Normalized operations captured in this block.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExplorerOperationsTable
                    operations={operations}
                    emptyLabel="No operations recorded for this block."
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="staple">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Staple Summary
                  </CardTitle>
                  <CardDescription>
                    Quick narrative for the first operations inside this vote staple.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {operations.length === 0 ? (
                    <div className="rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-6 text-sm text-muted">
                      No operations available to summarize.
                    </div>
                  ) : (
                    operations.slice(0, 3).map((operation) => {
                      const summary = summarizeOperation(operation);
                      const operationBlockLink = `/explorer/block/${operation.block.$hash}`;
                      return (
                        <div
                          key={`${operation.block.$hash}-${operation.voteStapleHash ?? operation.type}-summary`}
                          className="rounded-xl border border-soft bg-[color:color-mix(in_oklab,var(--foreground)_3%,transparent)] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Link
                              href={operationBlockLink}
                              className="text-sm font-medium text-accent hover:text-foreground"
                            >
                              {truncateIdentifier(operation.block.$hash, 12, 10)}
                            </Link>
                            <span className="text-xs uppercase tracking-[0.3em] text-muted">
                              {operation.type}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-subtle">
                            {summary.description}
                          </p>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function findBlock(
  response: ExplorerVoteStapleResponse,
  hash: string,
): ExplorerVoteStapleResponse["voteStaple"]["blocks"][number] | undefined {
  return response.voteStaple.blocks.find((candidate) => {
    const candidateHash = (candidate as Record<string, unknown>).$hash ?? candidate.hash;
    return typeof candidateHash === "string" && candidateHash === hash;
  });
}

function getBlockHash(
  block: ExplorerVoteStapleResponse["voteStaple"]["blocks"][number],
): string {
  const candidate = (block as Record<string, unknown>).$hash ?? block.hash;
  return typeof candidate === "string" ? candidate : "";
}

function extractOperations(
  block: ExplorerVoteStapleResponse["voteStaple"]["blocks"][number],
): unknown[] {
  const candidate =
    (block as Record<string, unknown>).operations ??
    (block as Record<string, unknown>).transactions ??
    [];
  return Array.isArray(candidate) ? candidate : [];
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-muted">{label}</p>
      <p className="text-2xl font-semibold text-foreground">
        {typeof value === "string" || typeof value === "number" ? value : value ?? "—"}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.3em] text-muted">{label}</p>
      <div className="text-sm text-foreground">{value ?? "—"}</div>
    </div>
  );
}

function BlockPageSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-4 w-48 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
          <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <CardHeader className="space-y-3">
              <Skeleton className="h-4 w-28 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
              <Skeleton className="h-9 w-64 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_14%,transparent)]" />
              <Skeleton className="h-4 w-40 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_10%,transparent)]" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-3 w-20 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_10%,transparent)]" />
                    <Skeleton className="h-7 w-16 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_14%,transparent)]" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-40 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
              <Skeleton className="h-4 w-64 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_10%,transparent)]" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-4 w-full rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_8%,transparent)]"
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

