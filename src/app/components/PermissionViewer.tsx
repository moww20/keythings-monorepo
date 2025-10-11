"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, Shield } from "lucide-react";

import { useWallet } from "@/app/contexts/WalletContext";
import type { KeetaACLRecord } from "@/types/keeta";

interface PermissionEntry {
  principal: string;
  flags: string[];
  target?: string | null;
  isOwner: boolean;
}

function normalizePublicKey(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = (value as { publicKeyString?: unknown }).publicKeyString;
  if (typeof candidate === "string") {
    return candidate;
  }

  if (candidate && typeof (candidate as { toString?: () => string }).toString === "function") {
    return (candidate as { toString: () => string }).toString();
  }

  if (typeof (value as { toString?: () => string }).toString === "function") {
    return (value as { toString: () => string }).toString();
  }

  return null;
}

function extractFlags(record: KeetaACLRecord | null | undefined): string[] {
  const raw = record?.permissions?.base?.flags;
  if (!Array.isArray(raw)) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .map((flag) => (typeof flag === "string" ? flag.trim() : ""))
        .filter((flag) => flag.length > 0),
    ),
  );
}

function isStorageACL(record: KeetaACLRecord | null | undefined): boolean {
  if (!record) return false;
  const entity = record.entity;

  const explicitFlag = (entity as { isStorage?: () => boolean }).isStorage;
  if (typeof explicitFlag === "function") {
    try {
      if (explicitFlag.call(entity)) {
        return true;
      }
    } catch {
      // Ignore errors from custom implementations
    }
  }

  const typeCandidate = (entity as { type?: unknown }).type;
  if (typeof typeCandidate === "string" && typeCandidate.toLowerCase().includes("storage")) {
    return true;
  }

  const kindCandidate = (entity as { kind?: unknown }).kind;
  if (typeof kindCandidate === "string" && kindCandidate.toLowerCase().includes("storage")) {
    return true;
  }

  const accountType = (entity as { accountType?: unknown }).accountType;
  if (typeof accountType === "string" && accountType.toLowerCase().includes("storage")) {
    return true;
  }

  const resolved = normalizePublicKey(entity);
  return Boolean(resolved && resolved.startsWith("S_"));
}

function buildAccountContext(record: KeetaACLRecord, fallbackAddress: string) {
  const entity = record.entity;
  if (entity && typeof entity === "object" && "publicKeyString" in entity) {
    return entity;
  }
  return { publicKeyString: fallbackAddress };
}

export function PermissionViewer(): React.JSX.Element {
  const { userClient, isConnected, isDisconnected, isLocked } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageAccount, setStorageAccount] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadPermissions = async () => {
      if (!userClient || typeof userClient.listACLsByPrincipal !== "function") {
        setStorageAccount(null);
        setPermissions([]);
        setError("Smart account permissions are unavailable for this wallet session.");
        return;
      }

      if (!isConnected) {
        setStorageAccount(null);
        setPermissions([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const principalAcls = await userClient.listACLsByPrincipal();
        if (cancelled) return;

        if (!Array.isArray(principalAcls) || principalAcls.length === 0) {
          setStorageAccount(null);
          setPermissions([]);
          return;
        }

        const storageAcls = principalAcls.filter((acl) => isStorageACL(acl));
        const primaryRecord = storageAcls[0] ?? principalAcls[0];
        const storageAddress = normalizePublicKey(primaryRecord?.entity);

        if (!storageAddress) {
          throw new Error("Unable to resolve storage account address from ACL response");
        }

        setStorageAccount(storageAddress);

        const entityContext = buildAccountContext(primaryRecord, storageAddress);
        const entityAcls =
          typeof userClient.listACLsByEntity === "function"
            ? await userClient.listACLsByEntity({ account: entityContext })
            : storageAcls;
        if (cancelled) return;

        const source = Array.isArray(entityAcls) && entityAcls.length > 0 ? entityAcls : storageAcls;

        const normalized: PermissionEntry[] = source.map((acl) => {
          const principal = normalizePublicKey(acl?.principal) ?? "Unknown";
          const target = normalizePublicKey(acl?.target);
          const flags = extractFlags(acl);
          return {
            principal,
            target: target ?? null,
            flags,
            isOwner: flags.includes("OWNER"),
          };
        });

        normalized.sort((a, b) => {
          if (a.isOwner !== b.isOwner) {
            return a.isOwner ? -1 : 1;
          }
          return a.principal.localeCompare(b.principal);
        });

        setPermissions(normalized);
      } catch (aclError) {
        if (!cancelled) {
          console.error("PermissionViewer: failed to load ACL information", aclError);
          setStorageAccount(null);
          setPermissions([]);
          setError("Unable to fetch smart account permissions. Try again after refreshing the wallet.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [userClient, isConnected]);

  const stateMessage = useMemo(() => {
    if (isDisconnected) {
      return "Connect your Keeta wallet to inspect smart account permissions.";
    }
    if (isLocked) {
      return "Unlock your wallet to review storage account permissions.";
    }
    if (!userClient) {
      return "This wallet session does not expose ACL inspection APIs.";
    }
    return null;
  }, [isDisconnected, isLocked, userClient]);

  if (stateMessage) {
    return (
      <div className="rounded-lg border border-hairline bg-surface p-4 text-sm text-muted">
        <div className="flex items-center gap-2 text-foreground">
          <Shield className="h-4 w-4 text-accent" />
          <span className="font-medium">Smart Account Permissions</span>
        </div>
        <p className="mt-3 text-muted">{stateMessage}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-4 py-3 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        <span>Loading storage account permissions…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-hairline bg-surface-strong/60 p-4 text-sm text-muted">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-accent" />
        <div>
          <div className="font-medium text-foreground">Permissions unavailable</div>
          <p className="mt-1 text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!storageAccount) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-hairline/60 bg-surface px-4 py-4 text-sm text-muted">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-accent" />
        <div>
          <div className="font-medium text-foreground">No storage account detected</div>
          <p className="mt-1 text-muted">Connect a wallet with an initialized storage account to review delegated permissions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-accent" />
        <h3 className="text-lg font-semibold text-foreground">Storage Account Permissions</h3>
      </div>

      <div className="glass rounded-lg border border-hairline p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">Storage Account</div>
        <div className="mt-1 font-mono text-xs text-foreground break-all">{storageAccount}</div>
      </div>

      <div className="space-y-3">
        {permissions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-hairline/60 bg-surface px-4 py-4 text-sm text-muted">
            No delegated permissions are currently active for this storage account.
          </div>
        ) : (
          permissions.map((entry) => (
            <div key={`${entry.principal}-${entry.target ?? "*"}`} className="glass rounded-lg border border-hairline p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {entry.isOwner ? "Owner (You)" : "Delegated Principal"}
                  </div>
                  <div className="font-mono text-xs text-muted break-all mt-1">{entry.principal}</div>
                </div>
                {entry.isOwner && <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />}
              </div>

              <div className="mt-3 space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">Permissions</div>
                <div className="flex flex-wrap gap-2">
                  {entry.flags.map((flag) => (
                    <span
                      key={`${entry.principal}-${flag}`}
                      className="inline-flex items-center rounded-full bg-surface px-2 py-1 text-xs font-medium text-foreground"
                    >
                      {flag}
                    </span>
                  ))}
                </div>

                {entry.target && (
                  <div className="pt-2 text-xs text-muted">
                    <div className="font-medium text-foreground">Scoped Token</div>
                    <div className="font-mono text-[11px] text-muted break-all mt-1">{entry.target}</div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default PermissionViewer;
