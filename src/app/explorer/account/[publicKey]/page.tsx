"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { StorageList } from "@/components/storage-list";
import { parseExplorerOperation } from "@/lib/explorer/client";

import { Badge } from "@/components/ui/badge";
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

import { useExplorerData } from "@/app/hooks/useExplorerData";
import ExplorerOperationsTable from "../../components/ExplorerOperationsTable";
import { parseExplorerDate } from "../../utils/operation-format";
import {
  resolveExplorerPath,
  truncateIdentifier,
} from "../../utils/resolveExplorerPath";
import { useWallet } from "@/app/contexts/WalletContext";

function toDisplayString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(
        value,
        (_key, val) => (typeof val === "bigint" ? val.toString() : val),
      );
    } catch (error) {
      console.error("[ACCOUNT_PAGE] Failed to stringify metadata value", error);
      return null;
    }
  }
  return null;
}

function formatTokenAmount(balance: string, decimals?: number | null): string {
  try {
    const amount = BigInt(balance);
    if (!decimals || decimals <= 0) {
      return amount.toString();
    }
    const denominator = BigInt(10) ** BigInt(decimals);
    const whole = amount / denominator;
    const fraction = amount % denominator;
    if (fraction === BigInt(0)) {
      return whole.toString();
    }
    const fractionString = fraction
      .toString()
      .padStart(Number(decimals), "0")
      .replace(/0+$/, "");
    return `${whole.toString()}.${fractionString}`;
  } catch {
    return balance;
  }
}

function formatDate(value: unknown): string {
  const date = parseExplorerDate(value);
  if (!date) {
    return "—";
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function formatAccountType(type: string | null | undefined): string {
  if (!type) {
    return "Keyed Account";
  }
  const normalizedType = String(type).toUpperCase().trim();
  if (normalizedType === "STORAGE") {
    return "Storage";
  }
  return "Keyed Account";
}

function decodeBase64Metadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'string') {
    return null;
  }
  try {
    const decoded = typeof window !== 'undefined' && typeof window.atob === 'function'
      ? window.atob(metadata)
      : Buffer.from(metadata, 'base64').toString('utf-8');
    
    // Try to parse as JSON and pretty-print it
    try {
      const parsed = JSON.parse(decoded);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If not JSON, return as-is
      return decoded;
    }
  } catch {
    return null;
  }
}

function formatDefaultPermissions(defaultPermission: unknown): string {
  if (!defaultPermission || typeof defaultPermission !== 'object') {
    return "—";
  }
  
  const perm = defaultPermission as any;
  const flags = perm?.base?.flags ?? perm?.flags ?? [];
  
  if (!Array.isArray(flags) || flags.length === 0) {
    return "—";
  }
  
  return flags.map((flag: unknown) => String(flag)).join(", ");
}


export default function AccountPage(): React.JSX.Element {
  const params = useParams();
  const publicKey = params.publicKey as string;

  const { account, loading, error, fetchAccount } = useExplorerData();

  useEffect(() => {
    if (publicKey) {
      fetchAccount(publicKey);
    }
  }, [publicKey, fetchAccount]);

  const tokens = account?.tokens ?? [];
  const certificates = account?.certificates ?? [];
  const activity = useMemo(() => account?.activity ?? [], [account?.activity]);
  const activityOps = useMemo(() => {
    try {
      const ops: any[] = [];
      for (const r of activity) {
        const type = String(r?.type ?? r?.operationType ?? 'UNKNOWN').toUpperCase();
        const blockHash = typeof r?.block === 'string' ? r.block : r?.id;
        const ts = typeof r?.timestamp === 'number' && Number.isFinite(r.timestamp)
          ? new Date(r.timestamp).toISOString()
          : new Date().toISOString();
        const base: any = {
          type,
          block: { $hash: blockHash ?? '', date: ts, account: r?.from ?? '' },
          operation: { type, from: r?.from, to: r?.to, amount: r?.amount, token: r?.token, tokenMetadata: r?.tokenMetadata },
          amount: r?.amount,
          rawAmount: r?.rawAmount ?? r?.amount,
          formattedAmount: r?.formattedAmount,
          token: r?.token,
          tokenAddress: r?.token,
          tokenTicker: r?.tokenTicker,
          tokenDecimals: typeof r?.tokenDecimals === 'number' ? r.tokenDecimals : undefined,
          tokenMetadata: r?.tokenMetadata ?? null,
          from: r?.from,
          to: r?.to,
          operationType: r?.operationType ?? type,
        };
        const parsed = parseExplorerOperation(base);
        if (parsed) ops.push(parsed);
      }
      return ops;
    } catch {
      return [];
    }
  }, [activity]);
  const lastActivityTimestamp = useMemo(() => {
    if (!activity.length) {
      return null;
    }
    let mostRecent: number | null = null;
    for (const item of activity) {
      const value = item?.timestamp;
      if (typeof value === "number" && Number.isFinite(value)) {
        mostRecent = mostRecent === null ? value : Math.max(mostRecent, value);
        continue;
      }
      if (typeof value === "string") {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) {
          mostRecent = mostRecent === null ? parsed : Math.max(mostRecent, parsed);
        }
      }
    }
    return mostRecent;
  }, [activity]);
  

  const hasAccountData = Boolean(
    account?.representative ||
      account?.owner ||
      (account?.signers?.length ?? 0) > 0 ||
      account?.headBlock ||
      Object.keys(account?.info ?? {}).length > 0,
  );
  const hasTokens = tokens.length > 0;
  const hasCertificates = certificates.length > 0;
  

  const representativeLink = account?.representative
    ? resolveExplorerPath(account.representative)
    : null;
  const ownerLink = account?.owner ? resolveExplorerPath(account.owner) : null;

  // Determine if this is a storage account
  const accountType = account?.type?.toUpperCase()?.trim();
  const isStorageAccount = accountType === 'STORAGE';

  const accountDescription =
    toDisplayString(account?.info?.description ?? account?.info?.["description"]) ??
    (hasAccountData || hasTokens || hasCertificates
      ? "This account does not include a description."
      : "This is a basic account on the Keeta network with no additional metadata or activity recorded. Connect your wallet for deeper insights.");

  const [activeTab, setActiveTab] = useState<string>("tokens");
  const [storageCount, setStorageCount] = useState<number | null>(null);
  const [storageOwner, setStorageOwner] = useState<string | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const { userClient } = useWallet();

  useEffect(() => {
    setActiveTab("tokens");
    setStorageCount(null);
    setStorageOwner(null);
  }, [publicKey]);

  // If this is a storage account and user somehow gets to storage tab, redirect to tokens
  useEffect(() => {
    if (isStorageAccount && activeTab === "storage") {
      setActiveTab("tokens");
    }
  }, [isStorageAccount, activeTab]);

  // Fetch storage account owner via ACL when account is a storage account
  // Per Keeta docs: Storage accounts have an OWNER permission in ACL entries
  // Use listACLsByEntity to find the principal with OWNER permission
  useEffect(() => {
    if (!account || !publicKey) return;
    
    const accountType = account.type?.toUpperCase()?.trim();
    const isStorageAccount = accountType === 'STORAGE';
    
    if (!isStorageAccount || !userClient) {
      setStorageOwner(null);
      return;
    }

    let cancelled = false;
    setOwnerLoading(true);
    
    (async () => {
      try {
        // Use listACLsByEntity to get ACL entries for this storage account
        // The owner is the principal with OWNER permission
        if (typeof userClient.listACLsByEntity !== 'function') {
          if (!cancelled) {
            setStorageOwner(null);
            setOwnerLoading(false);
          }
          return;
        }

        // Use listACLsByEntity to get ACL entries for this storage account
        // The owner is the principal with OWNER permission
        // Convert Account object to the format expected by listACLsByEntity
        const accountRef = { publicKeyString: publicKey };
        const acls = await userClient.listACLsByEntity({ account: accountRef });
        
        if (cancelled) return;

        if (!Array.isArray(acls) || acls.length === 0) {
          setStorageOwner(null);
          setOwnerLoading(false);
          return;
        }

        // Find the ACL entry with OWNER permission
        // Extract flags from permissions.base.flags or permissions array
        const ownerEntry = acls.find((acl: any) => {
          const rawFlags = acl?.permissions?.base?.flags ?? acl?.permissions ?? [];
          const flags = Array.isArray(rawFlags)
            ? rawFlags.map((f: any) => String(f).toUpperCase())
            : [];
          return flags.includes('OWNER');
        });

        if (ownerEntry) {
          // Extract principal address
          const principal = typeof ownerEntry.principal === 'string'
            ? ownerEntry.principal
            : (ownerEntry.principal?.publicKeyString 
                ? (typeof ownerEntry.principal.publicKeyString === 'string'
                    ? ownerEntry.principal.publicKeyString
                    : String(ownerEntry.principal.publicKeyString.toString?.() ?? ''))
                : null);
          
          if (principal && principal.trim().length > 0) {
            setStorageOwner(principal.trim());
          } else {
            setStorageOwner(null);
          }
        } else {
          setStorageOwner(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[AccountPage] Failed to fetch storage owner:', err);
          setStorageOwner(null);
        }
      } finally {
        if (!cancelled) {
          setOwnerLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account, publicKey, userClient]);

  

  if (loading && !account) {
    return <AccountPageSkeleton />;
  }

  if (error || !account) {
    return <AccountErrorState message={error ?? "Account not found."} />;
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
                <BreadcrumbLink href="/explorer/account">Account</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {truncateIdentifier(account.publicKey, 12, 10)}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.3em] text-muted">
                  Explorer Account
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
                    {truncateIdentifier(account.publicKey, 20, 12)}
                  </h1>
                  <Badge variant="outline" className="text-xs uppercase tracking-[0.2em]">
                    {formatAccountType(account.type)}
                  </Badge>
                </div>
                <p className="max-w-3xl text-base text-subtle">
                  {accountDescription}
                </p>
                {/* Show Representative and Owner for storage accounts */}
                {isStorageAccount && (
                  <div className="mt-4 flex flex-wrap gap-6 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-[0.3em] text-muted">
                        Representative
                      </span>
                      <span className="text-foreground">
                        {representativeLink ? (
                          <Link
                            href={representativeLink}
                            className="font-medium text-accent hover:text-foreground"
                          >
                            {truncateIdentifier(account.representative!, 12, 10)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-[0.3em] text-muted">
                        Owner
                      </span>
                      <span className="text-foreground">
                        {ownerLoading ? (
                          <span className="text-muted">Loading...</span>
                        ) : storageOwner ? (
                          (() => {
                            const ownerLink = resolveExplorerPath(storageOwner);
                            return ownerLink ? (
                              <Link
                                href={ownerLink}
                                className="font-medium text-accent hover:text-foreground"
                              >
                                {truncateIdentifier(storageOwner, 12, 10)}
                              </Link>
                            ) : (
                              truncateIdentifier(storageOwner, 12, 10)
                            );
                          })()
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SummaryMetric label="Tokens" value={tokens.length} />
                <SummaryMetric label="Storage Accounts" value={storageCount ?? "—"} />
                <SummaryMetric label="Certificates" value={certificates.length} />
                <SummaryMetric
                  label="Head Block"
                  value={
                    account.headBlock ? (
                      <Link
                        href={`/explorer/block/${account.headBlock}`}
                        className="text-sm font-medium text-accent hover:text-foreground"
                      >
                        {truncateIdentifier(account.headBlock, 12, 10)}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <SummaryMetric
                  label="Last Activity"
                  value={
                    lastActivityTimestamp ? formatDate(lastActivityTimestamp) : "No recent activity"
                  }
                />
              </div>
            </CardContent>
          </Card>

          {!isStorageAccount && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Metadata
                  </CardTitle>
                  <CardDescription>
                    Structured metadata published for this account.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-subtle">
                  <DetailRow
                    label="Name"
                    value={
                      account.info?.name && typeof account.info.name === 'string'
                        ? account.info.name
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Description"
                    value={
                      account.info?.description && typeof account.info.description === 'string'
                        ? account.info.description
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Metadata"
                    value={
                      account.info?.metadata
                        ? (
                            <div className="max-h-48 overflow-y-auto rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] p-3 font-mono text-xs">
                              <pre className="whitespace-pre-wrap break-words text-foreground">
                                {decodeBase64Metadata(account.info.metadata) ?? "—"}
                              </pre>
                            </div>
                          )
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Default Permission"
                    value={formatDefaultPermissions(account.info?.defaultPermission)}
                  />
                  {(!account.info || 
                    (!account.info.name && 
                     !account.info.description && 
                     !account.info.metadata && 
                     !account.info.defaultPermission)) && (
                    <p className="text-sm text-muted">No metadata available.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs 
            value={activeTab} 
            onValueChange={(value) => {
              // Prevent switching to storage tab if this is a storage account
              if (value === "storage" && isStorageAccount) {
                return;
              }
              setActiveTab(value);
            }} 
            className="flex flex-col gap-6"
          >
            <TabsList className="bg-[color:color-mix(in_oklab,var(--foreground)_5%,transparent)]">
              <TabsTrigger value="tokens" className="px-4">
                Tokens
              </TabsTrigger>
              {isStorageAccount && (
                <TabsTrigger value="metadata" className="px-4">
                  Metadata
                </TabsTrigger>
              )}
              {!isStorageAccount && (
                <TabsTrigger 
                  value="storage" 
                  className="px-4"
                >
                  Storage
                </TabsTrigger>
              )}
              <TabsTrigger value="activity" className="px-4">
                Activity
              </TabsTrigger>
              {!isStorageAccount && (
                <TabsTrigger value="certificates" className="px-4">
                  Certificates
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="tokens">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Token Balances
                  </CardTitle>
                  <CardDescription>
                    Balances are adjusted for token decimals when metadata is provided.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tokens.length === 0 ? (
                    <div className="rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-6 text-sm text-muted">
                      No tokens associated with this account.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-hairline">
                      <div className="hidden grid-cols-[2fr_1fr_1fr] gap-6 border-b border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-muted md:grid">
                        <span>Name</span>
                        <span>Ticker</span>
                        <span>Balance</span>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        <div className="divide-y divide-hairline">
                          {tokens.map((token) => (
                            <div
                              key={token.publicKey}
                              className="grid gap-4 px-6 py-4 text-sm text-foreground md:grid-cols-[2fr_1fr_1fr]"
                            >
                              <div className="flex items-center gap-3">
                                {token.icon ? (
                                  <Image
                                    src={token.icon}
                                    alt={token.name ?? "token"}
                                    width={24}
                                    height={24}
                                    className="h-6 w-6 rounded-full"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)] text-xs text-muted">
                                    {token.ticker?.slice(0, 3) ?? "TK"}
                                  </div>
                                )}
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {token.name && token.name.trim().length > 0 ? token.name : " - "}
                                  </span>
                                  <Link
                                    href={resolveExplorerPath(token.publicKey) ?? "#"}
                                    className="text-xs text-accent hover:text-foreground"
                                  >
                                    {truncateIdentifier(token.publicKey, 12, 10)}
                                  </Link>
                                </div>
                              </div>
                              <div className="text-sm text-subtle">
                                {token.ticker && token.ticker.trim().length > 0 ? token.ticker : " - "}
                              </div>
                              <div className="text-sm text-foreground">
                                {token.formattedAmount ??
                                  formatTokenAmount(token.balance, token.decimals ?? null)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {!isStorageAccount && (
              <TabsContent value="storage">
                <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">
                      Storage Accounts
                    </CardTitle>
                    <CardDescription>
                      Storage accounts where this address has access.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StorageList
                      owner={publicKey}
                      rowActionsEnabled={false}
                      className="w-full"
                      enabled={activeTab === "storage"}
                      onLoaded={setStorageCount}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="activity">
              <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Recent Activity
                  </CardTitle>
                  <CardDescription>
                    Latest settlement operations touching this account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExplorerOperationsTable operations={activityOps} emptyLabel="No recent activity recorded." />
                </CardContent>
              </Card>
            </TabsContent>

            {!isStorageAccount && (
              <TabsContent value="certificates">
                <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">
                      Certificates
                    </CardTitle>
                    <CardDescription>
                      Proofs issued to or by this account across the Keeta network.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {certificates.length === 0 ? (
                      <div className="rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-6 text-sm text-muted">
                        No certificates recorded.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-hairline">
                        <div className="hidden grid-cols-[2fr_1fr_1fr] gap-6 border-b border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-muted md:grid">
                          <span>Issuer</span>
                          <span>Issued</span>
                          <span>Expires</span>
                        </div>
                        <div className="divide-y divide-hairline">
                          {certificates.map((certificate) => {
                            const certificateLink = `/explorer/account/${account.publicKey}/certificate/${certificate.hash}`;
                            return (
                              <div
                                key={certificate.hash}
                                className="grid gap-4 px-6 py-4 text-sm text-foreground md:grid-cols-[2fr_1fr_1fr]"
                              >
                                <div className="flex flex-col gap-1 min-w-[12rem]">
                                  <span className="font-medium">
                                    {certificate.issuer ?? "Unknown issuer"}
                                  </span>
                                  <Link
                                    href={certificateLink}
                                    className="text-xs text-accent hover:text-foreground"
                                  >
                                    {truncateIdentifier(certificate.hash, 12, 10)}
                                  </Link>
                                </div>
                                <span className="text-sm text-subtle">
                                  {formatDate(certificate.issuedAt)}
                                </span>
                                <span className="text-sm text-subtle">
                                  {formatDate(certificate.expiresAt)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {isStorageAccount && (
              <TabsContent value="metadata">
                <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">
                      Metadata
                    </CardTitle>
                    <CardDescription>
                      Structured metadata published for this account.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-subtle">
                    <DetailRow
                      label="Name"
                      value={
                        account.info?.name && typeof account.info.name === 'string'
                          ? account.info.name
                          : "—"
                      }
                    />
                    <DetailRow
                      label="Description"
                      value={
                        account.info?.description && typeof account.info.description === 'string'
                          ? account.info.description
                          : "—"
                      }
                    />
                    <DetailRow
                      label="Metadata"
                      value={
                        account.info?.metadata
                          ? (
                              <div className="max-h-48 overflow-y-auto rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] p-3 font-mono text-xs">
                                <pre className="whitespace-pre-wrap break-words text-foreground">
                                  {decodeBase64Metadata(account.info.metadata) ?? "—"}
                                </pre>
                              </div>
                            )
                          : "—"
                      }
                    />
                    <DetailRow
                      label="Default Permission"
                      value={formatDefaultPermissions(account.info?.defaultPermission)}
                    />
                    {(!account.info || 
                      (!account.info.name && 
                       !account.info.description && 
                       !account.info.metadata && 
                       !account.info.defaultPermission)) && (
                      <p className="text-sm text-muted">No metadata available.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
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

function AccountPageSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-4 w-40 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
          <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <CardHeader className="space-y-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                <Skeleton className="h-8 w-72 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                <Skeleton className="h-4 w-full max-w-xl rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
              </div>
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
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Card
                key={index}
                className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]"
              >
                <CardHeader className="space-y-2">
                  <Skeleton className="h-5 w-32 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                  <Skeleton className="h-4 w-56 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_10%,transparent)]" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {Array.from({ length: 3 }).map((__, idx) => (
                    <Skeleton
                      key={idx}
                      className="h-4 w-full rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_8%,transparent)]"
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountErrorState({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Unable to load account
            </CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted">
            <p>Ensure your Keeta wallet is connected and granted read permissions.</p>
            <p>Please try searching for another identifier.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
