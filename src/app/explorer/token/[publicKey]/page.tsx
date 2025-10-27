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

import { parseExplorerOperation } from "@/lib/explorer/client";
import type { ExplorerOperation } from "@/lib/explorer/client";
import { useTokenMetadata } from "@/app/hooks/useTokenMetadata";
import { getReadClient, getHistory as sdkGetHistory } from "@/lib/explorer/sdk-read-client";
import { formatAmountWithCommas, formatTokenAmount } from "@/app/lib/token-utils";

import ExplorerOperationsTable from "../../components/ExplorerOperationsTable";
import { truncateIdentifier } from "../../utils/resolveExplorerPath";
import { normalizeHistoryRecord, extractActivityFromSDKHistory, processKeetaHistoryWithFiltering } from "../../utils/history";

// Single source of truth: wallet provider (getAccountState) + useTokenMetadata

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

function formatSupplyWithMeta(value?: bigint, decimals?: number | null, fieldType?: 'decimalPlaces' | 'decimals'): string {
  if (typeof value !== 'bigint') return '—';
  try {
    const formatted = formatTokenAmount(value, typeof decimals === 'number' ? decimals : 0, fieldType ?? 'decimals');
    return formatAmountWithCommas(formatted);
  } catch {
    return value.toString();
  }
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

  const [infoLoading, setInfoLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [tokenOperations, setTokenOperations] = useState<ExplorerOperation[]>([]);
  const [sdkTokenInfo, setSdkTokenInfo] = useState<{
    supply?: string | number | null;
    accessMode?: string | null;
    defaultPermissions?: string[] | null;
    headBlock?: string | null;
    type?: string | null;
  } | null>(null);
  const [supplyState, setSupplyState] = useState<{ total?: bigint; distributed?: bigint; unallocated?: bigint } | null>(null);
  const [aclState, setAclState] = useState<{ admins: string[]; allowed: string[]; blocked: string[]; defaultFlags: string[]; mode: "public" | "private" } | null>(null);

  const { metadata: tokenMeta, loading: tokenMetaLoading } = useTokenMetadata(tokenPublicKey);

  const lastUpdated: string | null = null;

  useEffect(() => {
    let cancelled = false;
    async function loadFromSdk() {
      try {
        setInfoLoading(true);
        const provider: any = typeof window !== 'undefined' ? (window as any).keeta : null;
        if (!provider) { setSdkTokenInfo(null); setInfoLoading(false); return; }
        let raw: unknown = null;
        if (typeof provider.getAccountState === 'function') {
          raw = await provider.getAccountState(tokenPublicKey);
        } else if (typeof provider.request === 'function') {
          raw = await provider.request({ method: 'keeta_getAccountState', params: [tokenPublicKey] });
        }
        try { console.debug('[TOKEN_PAGE] provider.getAccountState:raw', raw); } catch {}
        const InfoSchema = z.object({
          info: z.object({
            name: z.string().optional().nullable(),
            symbol: z.string().optional().nullable(),
            ticker: z.string().optional().nullable(),
            metadata: z.string().optional().nullable(),
            supply: z.union([z.string(), z.number(), z.bigint()]).optional().nullable(),
            accessMode: z.string().optional().nullable(),
            defaultPermission: z.object({ base: z.object({ flags: z.array(z.string()).default([]) }).optional() }).optional().nullable(),
          }).optional().nullable(),
          headBlock: z.string().optional().nullable(),
        }).passthrough();
        const parsed = InfoSchema.safeParse(raw);
        if (!parsed.success) { setSdkTokenInfo(null); setInfoLoading(false); return; }
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
          try { console.debug('[TOKEN_PAGE] provider.getAccountState:resolved', { supply: info?.supply ?? null, accessMode: info?.accessMode ?? null, flags, headBlock: parsed.data.headBlock ?? null }); } catch {}
        }
      } catch {
        if (!cancelled) setSdkTokenInfo(null);
      } finally {
        if (!cancelled) setInfoLoading(false);
      }
    }
    void loadFromSdk();
    return () => { cancelled = true };
  }, [tokenPublicKey]);

  // Compute supply breakdown and ACLs
  useEffect(() => {
    let cancelled = false;
    async function loadSupplyAndACL() {
      try {
        const provider: any = typeof window !== 'undefined' ? (window as any).keeta : null;
        let providerClient: any = null;
        let stateClient: any = null;
        let aclClient: any = null;
        let KeetaNet: any = null;
        try { KeetaNet = await import('@keetanetwork/keetanet-client'); } catch {}
        try { providerClient = await provider?.getUserClient?.(); } catch {}
        // Prefer a client that supports state(); fall back to read client when necessary
        if (providerClient && typeof providerClient.state === 'function') {
          stateClient = providerClient;
        } else {
          try { stateClient = await getReadClient(); } catch {}
          try { console.debug('[TOKEN_PAGE] using read client for state; providerClient.state missing?', { hasProviderClient: Boolean(providerClient), hasState: typeof providerClient?.state === 'function' }); } catch {}
        }
        // Choose a client for ACLs if supported
        if (providerClient && typeof providerClient.listACLsByEntity === 'function') {
          aclClient = providerClient;
        } else if (stateClient && typeof stateClient.listACLsByEntity === 'function') {
          aclClient = stateClient;
        } else {
          aclClient = null;
        }
        if (!stateClient || !KeetaNet?.lib?.Account) { return; }

        const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(tokenPublicKey);
        const state = await stateClient.state({ account: tokenAccount });

        const toBig = (v: any): bigint => {
          try {
            if (typeof v === 'bigint') return v;
            if (typeof v === 'number') return BigInt(Math.trunc(v));
            if (typeof v === 'string') return BigInt(v);
            if (v && typeof v.toString === 'function') return BigInt(String(v.toString()));
          } catch {}
          return BigInt(0);
        };

        const total = toBig(state?.info?.supply);
        const balances: any[] = Array.isArray(state?.balances) ? state.balances : [];
        let unallocated = BigInt(0);
        try {
          const self = balances.find((b: any) => {
            try {
              const t = b?.token?.publicKeyString?.get?.() ?? b?.token?.publicKeyString ?? b?.token?.toString?.() ?? b?.token ?? b?.publicKey;
              return typeof t === 'string' && t === tokenPublicKey;
            } catch { return false; }
          });
          unallocated = toBig(self?.balance);
        } catch {}
        const distributed = total - unallocated;
        if (!cancelled) setSupplyState({ total, distributed, unallocated });

        // ACLs
        let acls: any[] = [];
        if (aclClient && typeof aclClient.listACLsByEntity === 'function') {
          try { acls = await aclClient.listACLsByEntity({ account: tokenAccount }); } catch {}
        }
        const flagsOf = (acl: any): string[] => Array.isArray(acl?.permissions?.base?.flags) ? (acl.permissions.base.flags as string[]) : [];
        const accountOf = (acl: any): string => {
          try { return acl?.principal?.publicKeyString?.get?.() ?? acl?.principal?.publicKeyString ?? acl?.principal?.toString?.() ?? ''; } catch { return ''; }
        };
        const defaultFlags: string[] = Array.isArray(state?.info?.defaultPermission?.base?.flags) ? (state.info.defaultPermission.base.flags as string[]) : [];
        const mode: 'public' | 'private' = defaultFlags.includes('ACCESS') ? 'public' : 'private';
        const ADMIN_FLAGS = new Set(['OWNER','ADMIN','TOKEN_ADMIN_SUPPLY','TOKEN_ADMIN_MODIFY_BALANCE','UPDATE_INFO','PERMISSION_DELEGATE_ADD','PERMISSION_DELEGATE_REMOVE']);
        const admins: string[] = [];
        const allowed: string[] = [];
        const blocked: string[] = [];
        for (const acl of acls) {
          const acc = accountOf(acl); if (!acc) continue;
          const fs = flagsOf(acl);
          if (fs.some((f) => ADMIN_FLAGS.has(f))) admins.push(acc);
          if (fs.includes('ACCESS')) allowed.push(acc); else blocked.push(acc);
        }
        if (!cancelled) setAclState({ admins, allowed, blocked, defaultFlags, mode });
        try { console.debug('[TOKEN_PAGE] supply&acl', { total: total.toString(), distributed: distributed.toString(), unallocated: unallocated.toString(), mode, defaultFlags, admins: admins.length, allowed: allowed.length, blocked: blocked.length }); } catch {}
      } catch (e) {
        try { console.debug('[TOKEN_PAGE] loadSupplyAndACL failed', e); } catch {}
      }
    }
    void loadSupplyAndACL();
    return () => { cancelled = true; };
  }, [tokenPublicKey]);

  // Registry/Backend removed for single source of truth

  useEffect(() => {
    let cancelled = false;
    async function loadTokenActivity() {
      try {
        setOpsLoading(true);
        setTokenOperations([]);
        let ops: ExplorerOperation[] = [];

        // 1) Wallet history normalized by token match
        if (ops.length === 0 && typeof window !== 'undefined' && window.keeta?.history) {
          try {
            if (typeof window.keeta.requestCapabilities === 'function') {
              await window.keeta.requestCapabilities(['read']);
            }
          } catch {}
          const result: any = await window.keeta.history({ depth: 50, cursor: null, includeOperations: true, includeTokenMetadata: true } as any);
          if (cancelled) return;
          const records: any[] = Array.isArray(result?.records) ? result.records : Array.isArray(result) ? result : [];
          const resolveMaybeAddress = (candidate: any): string | null => {
            if (!candidate) return null;
            if (typeof candidate === 'string') return candidate;
            try {
              const pk = candidate?.publicKeyString ?? candidate?.publicKey ?? candidate?.address;
              if (typeof pk === 'string' && pk) return pk;
              if (pk && typeof pk.toString === 'function') {
                const s = String(pk.toString());
                if (s && s !== '[object Object]') return s;
              }
              if (typeof candidate.toString === 'function') {
                const s = String(candidate.toString());
                if (s && s !== '[object Object]') return s;
              }
            } catch {}
            return null;
          };
          for (const r of records) {
            const norm = normalizeHistoryRecord(r);
            const tokenCandidates = [
              norm?.token,
              r?.token,
              r?.tokenAddress,
              r?.operation?.token,
              r?.operationSend?.token,
              r?.operationReceive?.token,
              r?.operationForward?.token,
              r?.operation?.account,
              r?.operation?.target,
            ];
            const matches = tokenCandidates.some((c) => resolveMaybeAddress(c) === tokenPublicKey);
            if (!matches) continue;
            const base: any = {
              type: String(norm?.type ?? r?.type ?? r?.operationType ?? 'UNKNOWN').toUpperCase(),
              block: { $hash: norm?.block ?? (r?.block ?? r?.id ?? ''), date: norm?.timestamp ? new Date(norm.timestamp).toISOString() : (r?.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString()), account: norm?.from ?? (r?.from ?? '') },
              operation: { type: norm?.type ?? r?.type, from: norm?.from ?? r?.from, to: norm?.to ?? r?.to, amount: norm?.amount ?? r?.amount, token: tokenPublicKey },
              amount: norm?.amount ?? r?.amount,
              rawAmount: norm?.amount ?? r?.amount,
              formattedAmount: norm?.formattedAmount ?? r?.formattedAmount,
              token: tokenPublicKey,
              tokenAddress: tokenPublicKey,
              tokenTicker: norm?.tokenTicker ?? r?.tokenTicker ?? undefined,
              tokenDecimals: typeof norm?.tokenDecimals === 'number' ? norm!.tokenDecimals : (typeof r?.tokenDecimals === 'number' ? r.tokenDecimals : undefined),
              tokenMetadata: norm?.tokenMetadata ?? r?.tokenMetadata ?? undefined,
              from: norm?.from ?? r?.from,
              to: norm?.to ?? r?.to,
            };
            const parsed = parseExplorerOperation(base);
            if (parsed) ops.push(parsed);
          }
        }

        // 2) Fallback: raw SDK history extraction
        if (ops.length === 0) {
          try {
            const sdkHistory: any = await sdkGetHistory({ depth: 50, cursor: null });
            const items = extractActivityFromSDKHistory(sdkHistory);
            for (const it of items) {
              if (it.token !== tokenPublicKey) continue;
              const base: any = {
                type: String(it.type ?? 'UNKNOWN').toUpperCase(),
                block: { $hash: it.block ?? '', date: it.timestamp ? new Date(it.timestamp).toISOString() : new Date().toISOString(), account: it.from ?? '' },
                operation: { type: it.type, from: it.from, to: it.to, amount: it.amount, token: it.token ?? tokenPublicKey },
                amount: it.amount,
                rawAmount: it.amount,
                token: it.token ?? tokenPublicKey,
                tokenAddress: it.token ?? tokenPublicKey,
                tokenTicker: it.tokenTicker ?? undefined,
                tokenDecimals: typeof it.tokenDecimals === 'number' ? it.tokenDecimals : undefined,
                tokenMetadata: it.tokenMetadata ?? undefined,
                from: it.from,
                to: it.to,
              };
              const parsed = parseExplorerOperation(base);
              if (parsed) ops.push(parsed);
            }
          } catch {}
        }

        // 3) Fallback: alternate parsing using processKeetaHistoryWithFiltering
        if (ops.length === 0) {
          try {
            const sdkHistory: any = await sdkGetHistory({ depth: 50, cursor: null });
            const items = processKeetaHistoryWithFiltering(sdkHistory);
            for (const it of items) {
              if (it.token !== tokenPublicKey) continue;
              const base: any = {
                type: String(it.type ?? 'UNKNOWN').toUpperCase(),
                block: { $hash: it.block ?? '', date: it.timestamp ? new Date(it.timestamp).toISOString() : new Date().toISOString(), account: it.from ?? '' },
                operation: { type: it.type, from: it.from, to: it.to, amount: it.amount, token: it.token ?? tokenPublicKey },
                amount: it.amount,
                rawAmount: it.amount,
                token: it.token ?? tokenPublicKey,
                tokenAddress: it.token ?? tokenPublicKey,
                tokenTicker: it.tokenTicker ?? undefined,
                tokenDecimals: typeof it.tokenDecimals === 'number' ? it.tokenDecimals : undefined,
                tokenMetadata: it.tokenMetadata ?? undefined,
                from: it.from,
                to: it.to,
              };
              const parsed = parseExplorerOperation(base);
              if (parsed) ops.push(parsed);
            }
          } catch {}
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

  try { console.debug('[TOKEN_PAGE] tokenMeta', tokenMeta); } catch {}
  const pageLoading = infoLoading || tokenMetaLoading; // gate until both info + metadata attempts resolve
  if (pageLoading) { return <TokenPageSkeleton />; }

  const displayName = (tokenMeta?.displayName && tokenMeta.displayName.trim().length)
    ? tokenMeta.displayName
    : (tokenMeta?.name && tokenMeta.name.trim().length) ? tokenMeta.name : " - ";
  const displayTicker = (tokenMeta?.ticker && tokenMeta.ticker.trim().length)
    ? tokenMeta.ticker
    : (tokenMeta?.symbol && tokenMeta.symbol.trim().length ? tokenMeta.symbol : " - ");
  const displaySymbol = (tokenMeta?.symbol && tokenMeta.symbol.trim().length) ? tokenMeta.symbol : displayTicker;
  const displayDecimals = (typeof tokenMeta?.decimals === 'number' && tokenMeta?.metadata)
    ? tokenMeta.decimals
    : "—";
  const displayAccessMode = aclState?.mode ?? sdkTokenInfo?.accessMode ?? "—";
  const displayPermissions = (aclState?.defaultFlags ?? sdkTokenInfo?.defaultPermissions) ?? [];
  const resolvedSupply = (sdkTokenInfo?.supply) as unknown;
  const displayType = sdkTokenInfo?.type ?? 'TOKEN';
  try { console.debug('[TOKEN_PAGE] resolvedDisplay', { displayName, displayTicker, displayDecimals, displayAccessMode, permissions: displayPermissions, supply: resolvedSupply, type: displayType, headBlock: sdkTokenInfo?.headBlock ?? null }); } catch {}

  
  
  
  

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
                  {displaySymbol}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-subtle">
                <span>{truncateIdentifier(tokenPublicKey, 18, 14)}</span>
                {lastUpdated ? <span>· Last activity {lastUpdated}</span> : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SummaryMetric
                  label="Supply"
                  value={supplyState && typeof tokenMeta?.decimals === 'number' ? formatSupplyWithMeta(supplyState.total, tokenMeta.decimals, tokenMeta.fieldType) : formatSupply(resolvedSupply, typeof displayDecimals === 'number' ? displayDecimals : undefined)}
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

          <Tabs defaultValue="activity" className="flex flex-col gap-6">
            <TabsList className="bg-[color:color-mix(in_oklab,var(--foreground)_5%,transparent)]">
              <TabsTrigger value="activity" className="px-4">
                Activity
              </TabsTrigger>
              <TabsTrigger value="supply" className="px-4">
                Supply
              </TabsTrigger>
              <TabsTrigger value="access" className="px-4">
                Access Control
              </TabsTrigger>
            </TabsList>

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

            <TabsContent value="supply">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Supply
                  </CardTitle>
                  <CardDescription>
                    Supply breakdown for this token.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-subtle">
                  <DetailRow label="Total Supply" value={supplyState && typeof tokenMeta?.decimals === 'number' ? formatSupplyWithMeta(supplyState.total, tokenMeta.decimals, tokenMeta.fieldType) : '—'} />
                  <DetailRow label="Distributed" value={supplyState && typeof tokenMeta?.decimals === 'number' ? formatSupplyWithMeta(supplyState.distributed, tokenMeta.decimals, tokenMeta.fieldType) : '—'} />
                  <DetailRow label="Unallocated" value={supplyState && typeof tokenMeta?.decimals === 'number' ? formatSupplyWithMeta(supplyState.unallocated, tokenMeta.decimals, tokenMeta.fieldType) : '—'} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="access">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Access Control
                  </CardTitle>
                  <CardDescription>
                    Token permissions and visibility.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-subtle">
                  <DetailRow label="Mode" value={displayAccessMode} />
                  <DetailRow label="Default Permissions" value={formatPermissions(displayPermissions ?? [])} />
                  <DetailRow label="Admins" value={aclState ? `${aclState.admins.length}` : '—'} />
                  <DetailRow label="Allowed Accounts" value={aclState ? `${aclState.allowed.length}` : '—'} />
                  <DetailRow label="Blocked Accounts" value={aclState ? `${aclState.blocked.length}` : '—'} />
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

