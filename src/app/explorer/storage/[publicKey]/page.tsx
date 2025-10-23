"use client";

import { useMemo } from 'react';
import Link from "next/link";
import { useRouter, useParams } from 'next/navigation';
import { useStorage } from "@/hooks/useApi";
import { ExplorerDetailCard } from "../../components/ExplorerDetailCard";
import { formatRelativeTime } from "../../utils/operation-format";
import { truncateIdentifier } from "../../utils/resolveExplorerPath";

// Define TypeScript interfaces for our data models
interface Token {
  tokenId: string;
  name?: string;
  symbol?: string;
  balance: string;
  decimals?: number;
}

interface Certificate {
  id: string;
  name?: string;
  issuer: string;
  issuedAt: string;
  status?: string;
}

interface StorageAccount {
  publicKey: string;
  type?: string;
  owner?: string;
  createdAt?: string;
  updatedAt?: string;
  tokens?: Token[];
  certificates?: Certificate[];
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
      console.warn("Failed to stringify value", error);
      return "[Object]";
    }
  }
  return String(value);
}

function formatTokenAmount(balance: string, decimals: number = 0): string {
  try {
    const amount = BigInt(balance);
    if (decimals <= 0) return amount.toString();
    
    const denominator = BigInt(10) ** BigInt(decimals);
    const whole = amount / denominator;
    const fraction = amount % denominator;
    
    if (fraction === BigInt(0)) return whole.toString();
    
    const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
    return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
  } catch (error) {
    console.warn("Failed to format token amount", error);
    return balance;
  }
}

export default function StoragePage() {
  const router = useRouter();
  const params = useParams();
  const storagePublicKey = params.publicKey as string;
  const { data, loading, error } = useStorage(storagePublicKey);
  const storageAccount = data ?? null;
  const lastUpdated = useMemo(() => {
    if (!data?.updatedAt) return null;
    return formatRelativeTime(new Date(data.updatedAt));
  }, [data]);

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

          <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Token Balances</h2>
              <span className="text-xs text-muted">Values reflect current explorer snapshot.</span>
            </div>
            
            {(!storageAccount.tokens || storageAccount.tokens.length === 0) ? (
              <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 rounded-full bg-surface p-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-8 w-8 text-muted"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <h3 className="mb-1 text-lg font-medium">No Tokens Found</h3>
                <p className="max-w-xs text-sm text-muted">
                  This storage account does not have any token balances yet.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm text-subtle">
                  <thead>
                    <tr className="border-b border-hairline text-xs uppercase tracking-[0.3em] text-muted">
                      <th className="py-3 pr-4">Token</th>
                      <th className="py-3 pr-4">Ticker</th>
                      <th className="py-3 pr-4 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {storageAccount.tokens.map((token: any) => (
                      <tr key={token.tokenId} className="group hover:bg-surface-strong/50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center">
                            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface-strong">
                              <span className="text-xs font-medium text-muted">
                                {token.symbol?.charAt(0) || 'T'}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-foreground">
                                {token.name || 'Unnamed Token'}
                              </div>
                              <div className="text-xs text-muted">
                                {truncateIdentifier(token.tokenId, 8, 6)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-medium text-foreground">
                          {token.symbol || '—'}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono text-foreground">
                          {formatTokenAmount(token.balance, token.decimals)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Certificates</h2>
              <span className="text-xs text-muted">Associated certificates</span>
            </div>
            
            {(!storageAccount.certificates || storageAccount.certificates.length === 0) ? (
              <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 rounded-full bg-surface p-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-8 w-8 text-muted"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 8 9 8 13"></polyline>
                  </svg>
                </div>
                <h3 className="mb-1 text-lg font-medium">No Certificates</h3>
                <p className="max-w-xs text-sm text-muted">
                  This storage account does not have any associated certificates.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {storageAccount.certificates.map((certificate: any) => (
                  <div
                    key={certificate.id}
                    className="group rounded-xl border border-soft bg-surface-strong/50 p-4 transition-colors hover:bg-surface-strong"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="truncate font-medium text-foreground">
                          {certificate.name || 'Unnamed Certificate'}
                        </h4>
                        <div className="mt-1 flex items-center space-x-2 text-xs text-muted">
                          <span>Issued by {truncateIdentifier(certificate.issuer, 8, 6)}</span>
                          <span className="text-hairline">•</span>
                          <span>{formatRelativeTime(new Date(certificate.issuedAt))}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                          {certificate.status || 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <div className="mt-4 flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 rounded-full bg-surface p-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-muted"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <h3 className="mb-1 text-lg font-medium">No Recent Activity</h3>
              <p className="max-w-xs text-sm text-muted">
                This storage account does not have any recent activity to display.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
