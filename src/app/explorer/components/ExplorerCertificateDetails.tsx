import React from "react";

import { ExplorerCertificate } from "@/lib/explorer/client";

import { ExplorerDetailCard } from "./ExplorerDetailCard";

function formatDate(value: unknown): string {
  if (!value) {
    return "—";
  }
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function formatSerial(serial: unknown): string {
  if (typeof serial === "string" || typeof serial === "number") {
    return String(serial);
  }
  if (serial && typeof serial === "object" && "toString" in serial) {
    try {
      return String((serial as { toString: () => string }).toString());
    } catch (error) {

    }
  }
  return "—";
}

interface ExplorerCertificateDetailsProps {
  certificate: ExplorerCertificate;
  accountPublicKey: string;
}

export function ExplorerCertificateDetails(
  { certificate, accountPublicKey }: ExplorerCertificateDetailsProps,
): React.ReactElement {
  const generalItems = [
    { label: "Certificate Hash", value: certificate.hash },
    { label: "Account", value: accountPublicKey },
    { label: "Issuer", value: certificate.issuerName ?? "—" },
    { label: "Issued On", value: formatDate(certificate.issuedAt) },
    { label: certificate.valid ? "Valid Until" : "Expired On", value: formatDate(certificate.expiresAt) },
    { label: "Trusted", value: certificate.trusted ? "Yes" : "No" },
    { label: "Serial", value: formatSerial(certificate.serial) },
  ];

  const subjectItems = (certificate.subjectDN ?? []).map((item) => ({
    label: item.name,
    value: item.value ?? "—",
  }));

  const issuerItems = (certificate.issuerDN ?? []).map((item) => ({
    label: item.name,
    value: item.value ?? "—",
  }));

  const attributeItems = (certificate.attributes ?? []).map((item) => ({
    label: item.name,
    value: item.sensitive ? "********" : (item.value ?? "—"),
  }));

  return (
    <div className="flex flex-col gap-6">
      <ExplorerDetailCard title="Certificate" items={generalItems} columns={3} />

      {subjectItems.length > 0 && (
        <ExplorerDetailCard title="Subject" items={subjectItems} />
      )}

      {issuerItems.length > 0 && (
        <ExplorerDetailCard title="Issuer" items={issuerItems} />
      )}

      {attributeItems.length > 0 && (
        <ExplorerDetailCard title="Attributes" items={attributeItems} />
      )}

      {(certificate.chain ?? []).length > 0 && (
        <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
          <h2 className="text-lg font-semibold text-foreground">Chain of Trust</h2>
          <div className="mt-4 space-y-3">
            {certificate.chain?.map((chainCertificate) => (
              <div
                key={chainCertificate.hash}
                className="rounded-xl border border-soft bg-[color:color-mix(in_oklab,var(--foreground)_3%,transparent)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-foreground/90">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{chainCertificate.subjectName ?? "Certificate"}</span>
                    <span className="text-xs text-muted">{chainCertificate.hash}</span>
                  </div>
                  <span className="text-xs text-muted">
                    {chainCertificate.trusted ? "Trusted" : "Untrusted"}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 text-sm text-subtle sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted">Issuer</p>
                    <p>{chainCertificate.issuerName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted">Issued On</p>
                    <p>{formatDate(chainCertificate.issuedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted">Valid Until</p>
                    <p>{formatDate(chainCertificate.expiresAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted">Serial</p>
                    <p>{formatSerial(chainCertificate.serial)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {certificate.pem && (
        <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
          <h2 className="text-lg font-semibold text-foreground">Certificate PEM</h2>
          <pre className="mt-3 max-h-80 overflow-auto rounded-xl border border-soft bg-[color:color-mix(in_oklab,var(--foreground)_3%,transparent)] p-4 text-xs text-muted">
            {certificate.pem}
          </pre>
        </section>
      )}
    </div>
  );
}
