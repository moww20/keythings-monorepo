"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from "next/link";
import { useRouter, useParams } from 'next/navigation';
import { useStorage } from "@/hooks/useApi";
import { ExplorerDetailCard } from "../../components/ExplorerDetailCard";
import { formatRelativeTime } from "../../utils/operation-format";
import { truncateIdentifier } from "../../utils/resolveExplorerPath";
import { formatTokenAmount as formatWithMeta } from "../../utils/token-metadata";
import { getTokenMetadata, type TokenMetadataEntry } from "@/lib/tokens/metadata-service";
import { processTokenForDisplay, type ProcessedToken } from "@/app/lib/token-utils";
import { getReadClient, getTokenMetadataRecord, getHistoryForAccount } from "@/lib/explorer/sdk-read-client";
import { parseExplorerOperation } from "@/lib/explorer/client";
import ExplorerOperationsTable from "../../components/ExplorerOperationsTable";
import { isHexTokenIdentifier, normalizeTokenAddress } from '@/lib/explorer/token-address';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useWallet } from "@/app/contexts/WalletContext";

// Define TypeScript interfaces for our data models
interface Token {
  tokenId: string;
  name?: string;
  symbol?: string;
  balance: string;
  decimals?: number;
}

interface StorageAccount {
  publicKey: string;
  type?: string;
  owner?: string;
  createdAt?: string;
  updatedAt?: string;
  tokens?: Token[];
}

interface StoragePageProps {
  params: {
    publicKey: string;
  };
}


function toDisplayString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return "[Object]";
    }
  }
  return String(value);
}

type MetaBrief = Pick<TokenMetadataEntry, "decimals" | "fieldType" | "name" | "ticker">;

interface PermissionEntry {
  principal: string;
  flags: string[];
  target?: string | null;
}

export default function StoragePage() {
  const router = useRouter();
  const params = useParams();
  const storagePublicKey = params.publicKey as string;
  const { data, loading, error } = useStorage(storagePublicKey);
  const storageAccount = data ?? null;
  const { userClient } = useWallet();
  const [metaByToken, setMetaByToken] = useState<Record<string, MetaBrief>>({});
  const [processed, setProcessed] = useState<ProcessedToken[] | null>(null);
  const [activeTab, setActiveTab] = useState<string>("tokens");
  const [activity, setActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const lastUpdated = useMemo(() => {
    if (!data?.updatedAt) return null;
    return formatRelativeTime(new Date(data.updatedAt));
  }, [data]);

  // Prefetch token metadata for balances to ensure decimals/fieldType/ticker are applied
  // This is a fallback for when processed tokens aren't available yet
  useEffect(() => {
    const tokens = storageAccount?.tokens ?? [];
    if (!tokens || tokens.length === 0) return;

    let cancelled = false;
    (async () => {
      const distinctIds = Array.from(new Set((tokens as Token[]).map(t => t.tokenId).filter(Boolean)));
      const results = await Promise.all(
        distinctIds.map(async (id) => {
          try {
            // Try getTokenMetadataRecord first (from SDK) - more reliable
            const rec = await getTokenMetadataRecord(id);
            if (rec) {
              return [id, {
                decimals: typeof rec.decimals === 'number' ? rec.decimals : 0,
                fieldType: (rec.fieldType === 'decimalPlaces' || rec.fieldType === 'decimals') ? rec.fieldType : 'decimals',
                name: rec.name ?? undefined,
                ticker: rec.ticker ?? undefined,
              }] as const;
            }
            // Fallback to metadata service
            const entry = await getTokenMetadata(id);
            if (!entry) return [id, undefined] as const;
            return [id, {
              decimals: entry.decimals ?? 0,
              fieldType: entry.fieldType ?? 'decimals',
              name: entry.name ?? undefined,
              ticker: entry.ticker ?? undefined,
            }] as const;
          } catch {
            return [id, undefined] as const;
          }
        })
      );
      if (cancelled) return;
      const map: Record<string, MetaBrief> = {};
      for (const [id, brief] of results) {
        if (brief) map[id] = brief;
      }
      setMetaByToken((prev) => ({ ...prev, ...map }));
    })();
    return () => { cancelled = true; };
  }, [storageAccount?.tokens]);

  // Match dashboard normalization: build ProcessedToken entries using token-utils
  useEffect(() => {
    const tokens = storageAccount?.tokens ?? [];
    if (!tokens || tokens.length === 0) {
      setProcessed([]);
      return;
    }

    let cancelled = false;
    (async () => {
      let baseTokenAddress: string | null = null;
      try {
        const client = await getReadClient();
        const bt = (client as any)?.baseToken;
        const pk = bt?.publicKeyString
          ? (typeof bt.publicKeyString === 'string'
              ? bt.publicKeyString
              : (typeof bt.publicKeyString.toString === 'function'
                  ? String(bt.publicKeyString.toString())
                  : ''))
          : '';
        baseTokenAddress = pk && pk !== '[object Object]' ? pk : null;
      } catch {}

      const list: ProcessedToken[] = await Promise.all(
        (tokens as Token[]).map(async (t) => {
          let tokenId = t.tokenId;

          if (isHexTokenIdentifier(tokenId)) {
            console.log('[StoragePage] Hex token identifier detected, attempting conversion');
            const converted = await normalizeTokenAddress(tokenId);
            if (converted) {
              tokenId = converted;
              console.log('[StoragePage] Converted token identifier to keeta format:', tokenId);
            } else {
              console.warn('[StoragePage] Unable to convert hex token identifier to keeta format; metadata lookup may fail');
            }
          }

          console.log('[StoragePage] Fetching metadata for tokenId:', tokenId);
          let tokenMetadata: any = null;
          try {
            const rec = await getTokenMetadataRecord(tokenId);
            console.log('[StoragePage] getTokenMetadataRecord result:', rec);
            if (rec) {
              tokenMetadata = rec.metadata ?? null;
              console.log('[StoragePage] Extracted metadata:', {
                name: rec.name,
                ticker: rec.ticker,
                decimals: rec.decimals,
                hasMetadata: !!tokenMetadata
              });
            } else {
              console.log('[StoragePage] ⚠️ getTokenMetadataRecord returned null/undefined');
            }
          } catch (e) {
            console.error('[StoragePage] ❌ getTokenMetadataRecord error:', e);
          }

          console.log('[StoragePage] Processing token for display:', {
            tokenId,
            balance: t.balance,
            hasMetadata: !!tokenMetadata,
            baseTokenAddress
          });
          
          const result = await processTokenForDisplay(
            tokenId, // Use exact tokenId from balance entry
            t.balance,
            tokenMetadata, // Pass metadata directly
            baseTokenAddress ?? undefined,
            undefined,
            {
              infoName: t.name ?? null,
              infoSymbol: t.symbol ?? null,
              fetchMetadata: async (addr) => {
                console.log('[StoragePage] fetchMetadata called with addr:', addr);
                let lookupAddress = addr;
                if (isHexTokenIdentifier(lookupAddress)) {
                  const converted = await normalizeTokenAddress(lookupAddress);
                  if (converted) {
                    lookupAddress = converted;
                  }
                }
                const rec = await getTokenMetadataRecord(lookupAddress);
                console.log('[StoragePage] fetchMetadata result:', rec);
                if (!rec) return null;
                // Return proper structure for TokenMetadataLookupResult
                const metadataResult = {
                  decimals: typeof rec.decimals === 'number' ? rec.decimals : 0,
                  fieldType: rec.fieldType === 'decimalPlaces' || rec.fieldType === 'decimals' ? rec.fieldType : 'decimals',
                  name: rec.name ?? null,
                  symbol: rec.ticker ?? null, // symbol and ticker are both set to ticker
                  ticker: rec.ticker ?? null,
                  metadata: rec.metadata ?? null,
                };
                console.log('[StoragePage] fetchMetadata returning:', metadataResult);
                return metadataResult;
              },
            },
          );
          console.log('[StoragePage] processTokenForDisplay result:', {
            address: result.address,
            name: result.name,
            ticker: result.ticker,
            formattedAmount: result.formattedAmount
          });
          return result;
        })
      );
      if (cancelled) return;
      setProcessed(list);
    })();
    return () => { cancelled = true; };
  }, [storageAccount?.tokens]);

  // Fetch activity data
  useEffect(() => {
    if (!storagePublicKey || activeTab !== 'activity') return;

    let cancelled = false;
    setActivityLoading(true);
    (async () => {
      try {
        const history = await getHistoryForAccount(storagePublicKey, {
          depth: 25,
          includeTokenMetadata: true,
        });
        if (cancelled) return;

        const ops: any[] = [];
        for (const r of history) {
          const type = String(r?.type ?? 'UNKNOWN').toUpperCase();
          const blockHash = r?.block ?? r?.id;
          const ts = typeof r?.timestamp === 'number' && Number.isFinite(r.timestamp)
            ? new Date(r.timestamp).toISOString()
            : new Date().toISOString();
          const base: any = {
            type,
            block: { $hash: blockHash ?? '', date: ts, account: r?.from ?? '' },
            operation: { type, from: r?.from, to: r?.to, amount: r?.amount, token: r?.token, tokenMetadata: r?.tokenMetadata },
            amount: r?.amount,
            rawAmount: r?.amount,
            token: r?.token,
            tokenAddress: r?.token,
            tokenTicker: r?.tokenTicker,
            tokenDecimals: typeof r?.tokenDecimals === 'number' ? r.tokenDecimals : undefined,
            tokenMetadata: r?.tokenMetadata ?? null,
            from: r?.from,
            to: r?.to,
            operationType: r?.type ?? type,
          };
          const parsed = parseExplorerOperation(base);
          if (parsed) ops.push(parsed);
        }
        if (cancelled) return;
        setActivity(ops);
      } catch (err) {
        if (!cancelled) {
          setActivity([]);
        }
      } finally {
        if (!cancelled) {
          setActivityLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [storagePublicKey, activeTab]);

  // Fetch permissions data
  useEffect(() => {
    if (!storagePublicKey || !userClient || activeTab !== 'permissions') return;

    let cancelled = false;
    setPermissionsLoading(true);
    (async () => {
      try {
        if (typeof userClient.listACLsByEntity === 'function') {
          const accountRef = { publicKeyString: storagePublicKey };
          const acls = await userClient.listACLsByEntity({ account: accountRef });
          if (cancelled) return;

          const normalized: PermissionEntry[] = (Array.isArray(acls) ? acls : []).map((acl: any) => {
            const principal = typeof acl?.principal === 'string'
              ? acl.principal
              : (acl?.principal?.publicKeyString ?? 'Unknown');
            const target = typeof acl?.target === 'string'
              ? acl.target
              : (acl?.target?.publicKeyString ?? null);
            const rawFlags = acl?.permissions?.base?.flags ?? acl?.permissions ?? [];
            const flags = Array.isArray(rawFlags)
              ? rawFlags.map((f: any) => typeof f === 'string' ? f : String(f)).filter(Boolean)
              : [];
            return { principal, target, flags };
          });

          if (cancelled) return;
          setPermissions(normalized);
        } else {
          setPermissions([]);
        }
      } catch (err) {
        if (!cancelled) {
          setPermissions([]);
        }
      } finally {
        if (!cancelled) {
          setPermissionsLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [storagePublicKey, userClient, activeTab]);

  // Handle loading and error states
  if (loading || !storageAccount) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium">Loading storage account...</div>
          <div className="text-sm text-muted">Please wait while we fetch the data</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-xl font-semibold">Error Loading Account</h2>
        <p className="mb-4 max-w-md text-muted">
          {error.message || 'An error occurred while loading the storage account'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Retry
          </button>
          <button
            onClick={() => router.back()}
            className="rounded-md border border-hairline bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-strong"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }


  const detailItems = [
    {
      label: "Account Type",
      value: storageAccount.type || "STORAGE",
    },
    {
      label: "Owner",
      value: storageAccount.owner ? (
        <Link
          href={`/explorer/account/${storageAccount.owner}`}
          className="text-accent hover:text-foreground"
        >
          {truncateIdentifier(storageAccount.owner, 12, 10)}
        </Link>
      ) : "—",
    },
    {
      label: "Created At",
      value: storageAccount.createdAt 
        ? formatRelativeTime(new Date(storageAccount.createdAt))
        : "—",
    },
    {
      label: "Last Updated",
      value: lastUpdated || "—",
    },
    {
      label: "Public Key",
      value: (
        <span className="font-mono text-sm">
          {truncateIdentifier(storageAccount.publicKey, 16, 12)}
        </span>
      ),
    },
    {
      label: "Status",
      value: (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          Active
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3">
            <p className="text-sm uppercase tracking-[0.3em] text-muted">Explorer Storage Account</p>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
                {truncateIdentifier(storageAccount.publicKey, 16, 12)}
              </h1>
              {lastUpdated ? (
                <p className="text-xs text-faint">Last activity {lastUpdated}</p>
              ) : null}
            </div>
          </header>

          <ExplorerDetailCard title="Account Details" items={detailItems} columns={2} />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-6">
            <TabsList className="bg-[color:color-mix(in_oklab,var(--foreground)_5%,transparent)]">
              <TabsTrigger value="tokens" className="px-4">
                Tokens
              </TabsTrigger>
              <TabsTrigger value="activity" className="px-4">
                Activity
              </TabsTrigger>
              <TabsTrigger value="permissions" className="px-4">
                Permissions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tokens">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Token Balances
                  </CardTitle>
                  <CardDescription>
                    Values reflect current explorer snapshot.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(!storageAccount.tokens || storageAccount.tokens.length === 0) ? (
                    <div className="rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-6 text-sm text-muted">
                      No tokens associated with this storage account.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-hairline">
                      <div className="hidden grid-cols-[2fr_1fr_1fr] gap-6 border-b border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-muted md:grid">
                        <span>Name</span>
                        <span>Ticker</span>
                        <span className="text-right">Balance</span>
                      </div>
                      <div className="divide-y divide-hairline">
                        {(processed && processed.length > 0 ? processed : storageAccount.tokens).map((token: any) => {
                          // ProcessedToken uses 'address', raw Token uses 'tokenId'
                          // Get token ID and ensure it's in keeta format for links and metadata lookup
                          let tokenId = (token.address ?? token.tokenId) as string;
                          
                          // Convert hex to keeta format if needed (for display and links)
                          // ProcessedToken.address should already be in keeta format, but raw tokenId might be hex
                          if (tokenId && tokenId.length === 64 && !tokenId.startsWith('keeta_')) {
                            // This is hex format - we need keeta format for the link
                            // But we'll use the hex for metadata lookup since SDK handles both
                            // The link should use keeta format though
                            // For now, keep hex since that's what's displayed - we'll fix the conversion in fetchStorageFromChain
                          }
                          
                          // For processed tokens, use their name/ticker directly (they're already processed with metadata)
                          // For raw tokens, try to get from metadata cache or use fallbacks
                          const isProcessed = processed && processed.length > 0 && 'address' in token;
                          
                          let tokenName: string;
                          let tokenTicker: string;
                          
                          if (isProcessed) {
                            // ProcessedToken already has correct name and ticker from processTokenForDisplay
                            tokenName = (token.name as string) || 'Unnamed Token';
                            tokenTicker = (token.ticker as string) || '—';
                          } else {
                            // Raw token - try metadata cache first, then fallback to token properties
                            // Use tokenId for lookup (might be hex, but cache should have it)
                            const meta = metaByToken[tokenId];
                            tokenName = meta?.name ?? (token.name as string) ?? 'Unnamed Token';
                            tokenTicker = meta?.ticker ?? (token.symbol as string) ?? '—';
                          }
                          
                          const tokenBalance = token.balance ?? '0';
                          const tokenDecimals = token.decimals ?? metaByToken[tokenId]?.decimals ?? 0;
                          const tokenFieldType = token.fieldType ?? metaByToken[tokenId]?.fieldType ?? 'decimals';
                          
                          // Format balance
                          let formattedBalance: string;
                          if (isProcessed && typeof token.formattedAmount === 'string' && token.formattedAmount.length > 0) {
                            formattedBalance = token.formattedAmount;
                          } else {
                            try {
                              formattedBalance = formatWithMeta(BigInt(tokenBalance), tokenDecimals, tokenFieldType, tokenTicker !== '—' ? tokenTicker : '');
                            } catch {
                              formattedBalance = tokenBalance;
                            }
                          }

                          return (
                            <div
                              key={tokenId}
                              className="grid gap-4 px-6 py-4 text-sm text-foreground md:grid-cols-[2fr_1fr_1fr]"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)] text-xs text-muted">
                                  {(tokenTicker !== '—' ? tokenTicker : 'TK').slice(0, 3)}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-medium">{tokenName}</span>
                                  <Link
                                    href={`/explorer/token/${tokenId}`}
                                    className="text-xs text-accent hover:text-foreground"
                                  >
                                    {truncateIdentifier(tokenId, 12, 10)}
                                  </Link>
                                </div>
                              </div>
                              <div className="text-sm text-subtle">{tokenTicker}</div>
                              <div className="text-right font-mono">{formattedBalance}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Recent Activity
                  </CardTitle>
                  <CardDescription>
                    Latest settlement operations touching this storage account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activityLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-sm text-muted">Loading activity...</div>
                    </div>
                  ) : (
                    <ExplorerOperationsTable operations={activity} emptyLabel="No recent activity recorded." />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="permissions">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Permissions
                  </CardTitle>
                  <CardDescription>
                    Access control list (ACL) entries for this storage account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {permissionsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-sm text-muted">Loading permissions...</div>
                    </div>
                  ) : !userClient ? (
                    <div className="rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-6 text-sm text-muted">
                      Connect your wallet to view storage account permissions.
                    </div>
                  ) : permissions.length === 0 ? (
                    <div className="rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-6 text-sm text-muted">
                      No permissions recorded for this storage account.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {permissions.map((entry, index) => (
                        <div
                          key={`${entry.principal}-${entry.target ?? '*'}-${index}`}
                          className="rounded-lg border border-hairline bg-surface-strong/50 p-4"
                        >
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-muted">Principal</p>
                              <p className="font-mono text-sm text-foreground break-all">{truncateIdentifier(entry.principal, 20, 12)}</p>
                            </div>
                            {entry.target && (
                              <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-muted">Target Token</p>
                                <Link
                                  href={`/explorer/token/${entry.target}`}
                                  className="font-mono text-sm text-accent hover:text-foreground break-all"
                                >
                                  {truncateIdentifier(entry.target, 20, 12)}
                                </Link>
                              </div>
                            )}
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-muted mb-2">Permissions</p>
                              <div className="flex flex-wrap gap-2">
                                {entry.flags.map((flag) => (
                                  <span
                                    key={flag}
                                    className="inline-flex items-center rounded-full bg-surface px-2 py-1 text-xs font-medium text-foreground"
                                  >
                                    {flag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
