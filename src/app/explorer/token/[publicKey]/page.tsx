"use client";

import { useParams, useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
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

import {
  fetchToken,
  fetchTransactions,
  parseExplorerOperations,
  type ExplorerOperation,
} from "@/lib/explorer/client";

import ExplorerOperationsTable from "../../components/ExplorerOperationsTable";
import {
  formatRelativeTime,
  parseExplorerDate,
} from "../../utils/operation-format";
import { truncateIdentifier } from "../../utils/resolveExplorerPath";

type TokenResponse = Awaited<ReturnType<typeof fetchToken>>;

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
      console.warn("[TOKEN_PAGE] Unable to format token supply", error);
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

export default function TokenPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const tokenPublicKey = params.publicKey as string;

  const [token, setToken] = useState<TokenResponse | null>(null);
  const [operations, setOperations] = useState<ExplorerOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [tokenResponse, transactions] = await Promise.all([
          fetchToken(tokenPublicKey),
          fetchTransactions({ publicKey: tokenPublicKey, depth: 20 }),
        ]);

        if (cancelled) {
          return;
        }

        if (!tokenResponse) {
          setError("Token not found on the Keeta network.");
          setToken(null);
          setOperations([]);
          return;
        }

        setToken(tokenResponse);
        setOperations(parseExplorerOperations(transactions.stapleOperations));
      } catch (err) {
        console.error("[TOKEN_PAGE] Failed to fetch token information", err);
        if (!cancelled) {
          setError("Unable to load token data. Connect your wallet and try again.");
          setToken(null);
          setOperations([]);
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
  }, [tokenPublicKey]);

  const lastUpdated = useMemo(() => {
    const firstOperation = operations[0];
    if (!firstOperation) {
      return null;
    }
    return formatRelativeTime(parseExplorerDate(firstOperation.block.date));
  }, [operations]);

  if (loading) {
    return <TokenPageSkeleton />;
  }

  if (error || !token) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="px-4 py-6 lg:px-6">
          <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Unable to load token
              </CardTitle>
              <CardDescription>{error ?? "Token not found."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted">
              <p>Verify the token identifier and ensure your Keeta wallet connection is active.</p>
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
                <BreadcrumbLink href="/explorer/token">Token</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{truncateIdentifier(tokenPublicKey, 16, 12)}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <CardHeader className="space-y-3">
              <span className="text-xs uppercase tracking-[0.3em] text-muted">
                Explorer Token
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
                  {token.name ?? token.currencyCode ?? truncateIdentifier(token.publicKey)}
                </h1>
                <Badge variant="outline" className="text-xs uppercase tracking-[0.2em]">
                  {token.currencyCode ?? "TOKEN"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-subtle">
                <span>{truncateIdentifier(token.publicKey, 18, 14)}</span>
                {lastUpdated ? <span>· Last activity {lastUpdated}</span> : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SummaryMetric
                  label="Total Supply"
                  value={formatSupply(token.supply ?? token.totalSupply, token.decimalPlaces ?? token.decimals)}
                />
                <SummaryMetric
                  label="Decimals"
                  value={token.decimalPlaces ?? token.decimals ?? "—"}
                />
                <SummaryMetric label="Access Mode" value={token.accessMode ?? "—"} />
                <SummaryMetric
                  label="Default Permissions"
                  value={formatPermissions(token.defaultPermissions)}
                />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="overview" className="flex flex-col gap-6">
            <TabsList className="bg-[color:color-mix(in_oklab,var(--foreground)_5%,transparent)]">
              <TabsTrigger value="overview" className="px-4">
                Overview
              </TabsTrigger>
              <TabsTrigger value="activity" className="px-4">
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Token Metadata
                  </CardTitle>
                  <CardDescription>
                    Details published alongside this token definition.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-subtle">
                  <DetailRow label="Name" value={token.name ?? "—"} />
                  <DetailRow label="Ticker" value={token.currencyCode ?? token.ticker ?? "—"} />
                  <DetailRow
                    label="Type"
                    value={token.type ?? "—"}
                  />
                  <DetailRow
                    label="Head Block"
                    value={
                      token.headBlock ? truncateIdentifier(token.headBlock, 18, 14) : "—"
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Recent Transactions
                  </CardTitle>
                  <CardDescription>
                    Latest transactions and settlements involving this token.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExplorerOperationsTable
                    operations={operations}
                    emptyLabel="No recent token operations."
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
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

function TokenPageSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-4 w-48 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
          <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <CardHeader className="space-y-3">
              <Skeleton className="h-4 w-36 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
              <Skeleton className="h-9 w-64 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_14%,transparent)]" />
              <Skeleton className="h-4 w-40 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_10%,transparent)]" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-3 w-24 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_10%,transparent)]" />
                    <Skeleton className="h-7 w-20 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_14%,transparent)]" />
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

