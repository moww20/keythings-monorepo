"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";

import { useExplorerData } from "@/app/hooks/useExplorerData";
import ExplorerOperationsTable from "../../components/ExplorerOperationsTable";
import {
  formatRelativeTime,
  parseExplorerDate,
} from "../../utils/operation-format";
import {
  resolveExplorerPath,
  truncateIdentifier,
} from "../../utils/resolveExplorerPath";

function toDisplayString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.error("Failed to stringify metadata value", error);
      return null;
    }
  }
  return null;
}

// Remove the interface since we're using useParams now

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
    const fractionString = fraction.toString().padStart(Number(decimals), "0").replace(/0+$/, "");
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

export default function AccountPage(): React.JSX.Element {
  const params = useParams();
  const publicKey = params.publicKey as string;
  
  const { account, loading, error, fetchAccount } = useExplorerData();

  useEffect(() => {
    if (publicKey) {
      fetchAccount(publicKey);
    }
  }, [publicKey, fetchAccount]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="px-4 py-6 lg:px-6">
          <div className="flex flex-col gap-6">
            <div className="text-center py-8">
              <p className="text-muted">Loading account information...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="px-4 py-6 lg:px-6">
          <div className="flex flex-col gap-6">
            <div className="text-center py-8">
              <p className="text-red-400">Error: {error || 'Account not found'}</p>
              <p className="text-muted mt-2">Please ensure your wallet is connected and try again.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const representativeLink = account.representative
    ? resolveExplorerPath(account.representative)
    : null;
  const ownerLink = account.owner ? resolveExplorerPath(account.owner) : null;
  const accountDescription =
    toDisplayString(account.info?.["description"]) ?? "This account does not include a description.";

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.3em] text-muted">Explorer Account</p>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
              {truncateIdentifier(account.publicKey, 20, 12)}
            </h1>
            <p className="text-base text-subtle">
              {accountDescription}
            </p>
          </header>

          <section className="grid gap-4 rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)] md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Account Type</p>
              <p className="text-2xl font-semibold text-foreground">{account.type}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Tokens</p>
              <p className="text-2xl font-semibold text-foreground">{account.tokens.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Certificates</p>
              <p className="text-2xl font-semibold text-foreground">{account.certificates?.length ?? 0}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Head Block</p>
              {account.headBlock ? (
                <Link
                  href={`/explorer/block/${account.headBlock}`}
                  className="text-sm font-medium text-accent hover:text-foreground"
                >
                  {truncateIdentifier(account.headBlock, 8, 6)}
                </Link>
              ) : (
                <p className="text-sm text-subtle">—</p>
              )}
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
              <h2 className="text-lg font-semibold text-foreground">Ownership</h2>
              <div className="mt-4 space-y-3 text-sm text-subtle">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted">Representative</p>
                  {representativeLink ? (
                    <Link href={representativeLink} className="text-sm font-medium text-accent hover:text-foreground">
                      {truncateIdentifier(account.representative!, 10, 8)}
                    </Link>
                  ) : (
                    <p>—</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted">Owner</p>
                  {ownerLink ? (
                    <Link href={ownerLink} className="text-sm font-medium text-accent hover:text-foreground">
                      {truncateIdentifier(account.owner!, 10, 8)}
                    </Link>
                  ) : (
                    <p>—</p>
                  )}
                </div>
                {account.signers && account.signers.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted">Signers</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {account.signers.map((signer) => {
                        const link = resolveExplorerPath(signer);
                        return (
                          <Link
                            key={signer}
                            href={link ?? "#"}
                            className="rounded-full border border-soft px-3 py-1 text-xs font-medium text-accent transition hover:text-foreground"
                          >
                            {truncateIdentifier(signer, 8, 6)}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
              <h2 className="text-lg font-semibold text-foreground">Metadata</h2>
              <div className="mt-4 space-y-3 text-sm text-subtle">
                {Object.entries(account.info ?? {}).map(([key, value]) => {
                  const displayValue = toDisplayString(value) ?? "—";
                  return (
                    <div key={key}>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted">{key}</p>
                      <p>{displayValue}</p>
                    </div>
                  );
                })}
                {(!account.info || Object.keys(account.info).length === 0) && (
                  <p>No metadata available.</p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Token Balances</h2>
              <span className="text-xs text-muted">Balances are shown using token decimals when provided.</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
              <div className="hidden grid-cols-[2fr_1fr_1fr] gap-6 border-b border-hairline px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-muted md:grid">
                <span>Name</span>
                <span>Ticker</span>
                <span>Balance</span>
              </div>
              <div className="divide-y divide-hairline">
                {account.tokens.length === 0 ? (
                  <div className="px-6 py-4 text-sm text-muted">No tokens associated with this account.</div>
                ) : (
                  account.tokens.map((token) => (
                    <div key={token.publicKey} className="grid gap-4 px-6 py-4 text-sm text-foreground md:grid-cols-[2fr_1fr_1fr]">
                      <div className="flex flex-col">
                        <span className="font-medium">{token.name ?? "Unnamed Token"}</span>
                        <Link
                          href={resolveExplorerPath(token.publicKey) ?? "#"}
                          className="text-xs text-accent hover:text-foreground"
                        >
                          {truncateIdentifier(token.publicKey, 10, 8)}
                        </Link>
                      </div>
                      <div className="text-sm text-subtle">{token.ticker ?? "—"}</div>
                      <div className="text-sm text-foreground">
                        {formatTokenAmount(token.balance, token.decimals ?? null)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Certificates</h2>
            <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
              <div className="hidden grid-cols-[2fr_1fr_1fr] gap-6 border-b border-hairline px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-muted md:grid">
                <span>Issuer</span>
                <span>Issued</span>
                <span>Expires</span>
              </div>
              <div className="divide-y divide-hairline">
                {!account.certificates || account.certificates.length === 0 ? (
                  <div className="px-6 py-4 text-sm text-muted">No certificates recorded.</div>
                ) : (
                  account.certificates.map((certificate) => {
                    const certificateLink = `/explorer/account/${account.publicKey}/certificate/${certificate.hash}`;
                    return (
                      <div key={certificate.hash} className="grid gap-4 px-6 py-4 text-sm text-foreground md:grid-cols-[2fr_1fr_1fr]">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{certificate.issuer ?? "Unknown issuer"}</span>
                          <Link href={certificateLink} className="text-xs text-accent hover:text-foreground">
                            {truncateIdentifier(certificate.hash, 10, 8)}
                          </Link>
                        </div>
                        <span className="text-sm text-subtle">{formatDate(certificate.issuedAt)}</span>
                        <span className="text-sm text-subtle">{formatDate(certificate.expiresAt)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            </div>
            <div className="rounded-2xl border border-hairline bg-surface p-6">
              <p className="text-muted">Transaction history will be available when connected to the Keeta network.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
