"use client";

import { useParams, useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";
import { z } from "zod";

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
  parseExplorerOperation,
} from "@/lib/explorer/client";
import type { ExplorerOperation } from "@/lib/explorer/client";
import { tokenApi } from "@/lib/api/client";
import { useTokenMetadata } from "@/app/hooks/useTokenMetadata";

import ExplorerOperationsTable from "../../components/ExplorerOperationsTable";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [tokenOperations, setTokenOperations] = useState<ExplorerOperation[]>([]);
  const [registryToken, setRegistryToken] = useState<{
    name?: string | null;
    symbol?: string | null;
    ticker?: string | null;
    decimals?: number | null;
    decimalPlaces?: number | null;
    supply?: string | number | null;
    totalSupply?: string | number | null;
    accessMode?: string | null;
    defaultPermissions?: string[] | null;
    metadata?: string | null;
    headBlock?: string | null;
    currencyCode?: string | null;
  } | null>(null);
  const [sdkTokenInfo, setSdkTokenInfo] = useState<{
    supply?: string | number | null;
    accessMode?: string | null;
    defaultPermissions?: string[] | null;
    headBlock?: string | null;
    type?: string | null;
  } | null>(null);

  const { metadata: tokenMeta } = useTokenMetadata(tokenPublicKey);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const tokenResponse = await fetchToken(tokenPublicKey);

        if (cancelled) {
          return;
        }

        if (!tokenResponse) {
          setError("Token not found on the Keeta network.");
          setToken(null);
          return;
        }

        setToken(tokenResponse);
      } catch (err) {
        console.error("[TOKEN_PAGE] Failed to fetch token information", err);
        if (!cancelled) {
          setError("Unable to load token data. Connect your wallet and try again.");
          setToken(null);
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
  const lastUpdated: string | null = null;

  useEffect(() => {
    let cancelled = false;
    async function loadFromSdk() {
      try {
        const provider: any = typeof window !== 'undefined' ? (window as any).keeta : null;
        if (!provider) { setSdkTokenInfo(null); return; }
        let raw: unknown = null;
        if (typeof provider.getAccountState === 'function') {
          raw = await provider.getAccountState(tokenPublicKey);
        } else if (typeof provider.request === 'function') {
          raw = await provider.request({ method: 'keeta_getAccountState', params: [tokenPublicKey] });
        }
        const InfoSchema = z.object({
          info: z.object({
            supply: z.union([z.string(), z.number(), z.bigint()]).optional().nullable(),
            accessMode: z.string().optional().nullable(),
            defaultPermission: z.object({ base: z.object({ flags: z.array(z.string()).default([]) }).optional() }).optional().nullable(),
          }).optional().nullable(),
          headBlock: z.string().optional().nullable(),
        }).passthrough();
        const parsed = InfoSchema.safeParse(raw);
        if (!parsed.success) { setSdkTokenInfo(null); return; }
        const info = parsed.data.info ?? null;
        const flags = info?.defaultPermission?.base?.flags ?? [];
        if (!cancelled) {
          setSdkTokenInfo({
            supply: (info?.supply as any) ?? null,
            accessMode: (info?.accessMode as any) ?? null,
            defaultPermissions: Array.isArray(flags) ? (flags as string[]) : null,
            headBlock: (parsed.data.headBlock as any) ?? null,
            type: 'TOKEN',
          });
        }
      } catch {
        if (!cancelled) setSdkTokenInfo(null);
      }
    }
    void loadFromSdk();
    return () => { cancelled = true };
  }, [tokenPublicKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadRegistry() {
      try {
        const raw = await tokenApi.getToken(tokenPublicKey);
        if (cancelled) return;
        const RegistryTokenSchema = z
          .union([
            z.object({
              token: z.object({
                name: z.string().optional().nullable(),
                symbol: z.string().optional().nullable(),
                ticker: z.string().optional().nullable(),
                decimals: z.number().optional().nullable(),
                decimalPlaces: z.number().optional().nullable(),
                supply: z.union([z.string(), z.number()]).optional().nullable(),
                totalSupply: z.union([z.string(), z.number()]).optional().nullable(),
                accessMode: z.string().optional().nullable(),
                defaultPermissions: z.array(z.string()).optional().nullable(),
                metadata: z.string().optional().nullable(),
                headBlock: z.string().optional().nullable(),
                currencyCode: z.string().optional().nullable(),
              }).passthrough(),
            }),
            z.object({
              name: z.string().optional().nullable(),
              symbol: z.string().optional().nullable(),
              ticker: z.string().optional().nullable(),
              decimals: z.number().optional().nullable(),
              decimalPlaces: z.number().optional().nullable(),
              supply: z.union([z.string(), z.number()]).optional().nullable(),
              totalSupply: z.union([z.string(), z.number()]).optional().nullable(),
              accessMode: z.string().optional().nullable(),
              defaultPermissions: z.array(z.string()).optional().nullable(),
              metadata: z.string().optional().nullable(),
              headBlock: z.string().optional().nullable(),
              currencyCode: z.string().optional().nullable(),
            }).passthrough(),
          ]);
        const parsed = RegistryTokenSchema.safeParse(raw);
        if (!parsed.success) {
          setRegistryToken(null);
          return;
        }
        const rt = "token" in parsed.data ? (parsed.data as any).token : parsed.data;
        setRegistryToken(rt as typeof registryToken);
      } catch {
        setRegistryToken(null);
      }
    }
    void loadRegistry();
    return () => { cancelled = true };
  }, [tokenPublicKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadTokenActivity() {
      try {
        setOpsLoading(true);
        setTokenOperations([]);
        if (typeof window === 'undefined' || !window.keeta?.history) return;
        try {
          if (typeof window.keeta.requestCapabilities === 'function') {
            await window.keeta.requestCapabilities(['read']);
          }
        } catch {}
        const result: any = await window.keeta.history({ depth: 50, cursor: null, includeOperations: true, includeTokenMetadata: true } as any);
        if (cancelled) return;
        const records: any[] = Array.isArray(result?.records) ? result.records : Array.isArray(result) ? result : [];
        const ops: ExplorerOperation[] = [];
        for (const r of records) {
          const tokenId = (r?.token ?? r?.tokenAddress ?? r?.operation?.token) as string | undefined;
          if (!tokenId || tokenId !== tokenPublicKey) continue;
          const base: any = {
            type: String(r?.type ?? r?.operationType ?? 'UNKNOWN').toUpperCase(),
            block: { $hash: r?.block ?? r?.id ?? '', date: r?.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(), account: r?.from ?? '' },
            operation: r?.operation ?? { type: r?.type, from: r?.from, to: r?.to, amount: r?.amount, token: tokenId },
            amount: r?.amount,
            rawAmount: r?.amount,
            formattedAmount: r?.formattedAmount,
            token: tokenId,
            tokenAddress: tokenId,
            tokenTicker: r?.tokenTicker,
            tokenDecimals: typeof r?.tokenDecimals === 'number' ? r.tokenDecimals : undefined,
            tokenMetadata: r?.tokenMetadata,
            from: r?.from,
            to: r?.to,
          };
          const parsed = parseExplorerOperation(base);
          if (parsed) ops.push(parsed);
        }
        if (!cancelled) setTokenOperations(ops);
      } catch (e) {
        if (!cancelled) setTokenOperations([]);
      } finally {
        if (!cancelled) setOpsLoading(false);
      }
    }
    void loadTokenActivity();
    return () => { cancelled = true };
  }, [tokenPublicKey]);

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

  const displayName = registryToken?.name ?? registryToken?.symbol ?? tokenMeta?.name ?? tokenMeta?.ticker ?? token.name ?? token.currencyCode ?? truncateIdentifier(token.publicKey);
  const displayTicker = tokenMeta?.ticker ?? tokenMeta?.symbol ?? registryToken?.ticker ?? registryToken?.symbol ?? token.currencyCode ?? token.ticker ?? "TOKEN";
  const displaySymbol = tokenMeta?.symbol ?? registryToken?.symbol ?? displayTicker;
  const displayDecimals = tokenMeta?.decimals ?? registryToken?.decimalPlaces ?? registryToken?.decimals ?? token.decimalPlaces ?? token.decimals ?? "—";
  const displayAccessMode = sdkTokenInfo?.accessMode ?? registryToken?.accessMode ?? token.accessMode ?? "—";
  const displayPermissions = (sdkTokenInfo?.defaultPermissions ?? registryToken?.defaultPermissions ?? token.defaultPermissions) ?? [];
  const resolvedSupply = (sdkTokenInfo?.supply ?? registryToken?.supply ?? registryToken?.totalSupply ?? token.supply ?? token.totalSupply) as unknown;
  const displayType = sdkTokenInfo?.type ?? token.type ?? 'TOKEN';

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
                  {displayName}
                </h1>
                <Badge variant="outline" className="text-xs uppercase tracking-[0.2em]">
                  {displayTicker}
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
                  label="Supply"
                  value={formatSupply(resolvedSupply, typeof displayDecimals === 'number' ? displayDecimals : undefined)}
                />
                <SummaryMetric
                  label="Decimal Places"
                  value={displayDecimals}
                />
                <SummaryMetric label="Access Mode" value={displayAccessMode} />
                <SummaryMetric
                  label="Default Permissions"
                  value={formatPermissions(displayPermissions ?? [])}
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
                  <DetailRow label="Name" value={displayName ?? "—"} />
                  <DetailRow label="Symbol" value={displaySymbol ?? "—"} />
                  <DetailRow
                    label="Type"
                    value={displayType ?? "—"}
                  />
                  <DetailRow
                    label="Head Block"
                    value={
                      (token.headBlock ?? registryToken?.headBlock ?? sdkTokenInfo?.headBlock) ? truncateIdentifier((token.headBlock ?? registryToken?.headBlock ?? (sdkTokenInfo?.headBlock as any)) as string, 18, 14) : "—"
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
                  <ExplorerOperationsTable operations={tokenOperations} loading={opsLoading} emptyLabel="No token activity." />
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

