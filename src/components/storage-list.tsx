"use client";

import React from "react";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, KeyRound, ArrowUpRight } from "lucide-react";
import { storageApi } from "@/lib/api/client";
import { listStorageAccountsByOwner, getAccountState } from "@/lib/explorer/sdk-read-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWallet } from "@/app/contexts/WalletContext";
import StorageAccountManager from "@/app/lib/storage-account-manager";
import { toast } from "sonner";

export const StorageAclEntrySchema = z
  .object({
    principal: z.string().min(1),
    entity: z.string().min(1),
    target: z.string().min(1).nullable().optional(),
    permissions: z.array(z.string()).optional(),
  })
  .passthrough();

export const StorageAclListSchema = z.array(StorageAclEntrySchema);

type StorageAclEntry = z.infer<typeof StorageAclEntrySchema>;

const STORAGE_CACHE_TTL_MS = 30_000;
const storageCache = new Map<string, { data: StorageAclEntry[]; fetchedAt: number }>();

const STORAGE_DETAIL_TTL_MS = 60_000;
const storageDetailCache = new Map<string, { data: { name?: string | null; description?: string | null }; fetchedAt: number }>();

function buildStorageExplorerHref(publicKey: string): string {
  return `/explorer/account/${encodeURIComponent(publicKey)}`;
}

function buildAccountExplorerHref(publicKey: string): string {
  return `/explorer/account/${encodeURIComponent(publicKey)}`;
}

const StorageTokenSchema = z.object({
  tokenId: z.string(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  balance: z.string(),
  decimals: z.number().optional(),
});

const StorageResponseSchema = z.object({
  tokens: z.array(StorageTokenSchema).optional(),
}).passthrough();

const StorageInfoSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().max(512, "Description is too long").optional(),
});

export function useStorageAccounts(owner: string | null | undefined, options?: { enabled?: boolean }) {
  const [storages, setStorages] = React.useState<StorageAclEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { userClient } = useWallet();
  const enabled = options?.enabled ?? true;

  const fetchStorages = React.useCallback(async (opts?: { force?: boolean }) => {
    if (!enabled) {
      return;
    }

    const normalizedOwner = owner?.trim();
    if (!normalizedOwner) {

      setStorages([]);
      setError(null);
      setLoading(false);
      return;
    }

    const cacheKey = normalizedOwner.toLowerCase();

    try {

      if (!opts?.force) {
        const cached = storageCache.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAt < STORAGE_CACHE_TTL_MS) {

          setStorages(cached.data);
          setError(null);
          return;
        }
      }

      setLoading(true);
      setError(null);

      // Prefer extension provider RPC (matches how the extension surfaces data to dApps)
      let entriesRaw: unknown = null;
      let trustedFiltered = false;
      try {
        const provider = typeof window !== 'undefined' ? (window as any).keeta : null;
        if (provider && typeof provider.listStorageAccountsByOwner === 'function') {
          entriesRaw = await provider.listStorageAccountsByOwner(normalizedOwner);
          trustedFiltered = true; // extension already filters to storage entities
        } else if (provider && typeof provider.request === 'function') {
          entriesRaw = await provider.request({ method: 'keeta_listStorageAccountsByOwner', params: [normalizedOwner] });
          trustedFiltered = true; // extension already filters to storage entities
        }
      } catch (e) {

      }

      // Next, try direct SDK call on the authenticated user client (like the extension internal UI)
      if (userClient && typeof (userClient as any).listACLsByPrincipal === 'function' && !entriesRaw) {
        try {
          const aclEntries = await (userClient as any).listACLsByPrincipal([normalizedOwner]);
          if (Array.isArray(aclEntries)) {
            entriesRaw = aclEntries;
          }
        } catch (e) {
          // ignore
        }
      }

      // If extension already filtered and serialized, try direct Zod parse first
      if (Array.isArray(entriesRaw) && trustedFiltered) {
        const directParsed = StorageAclListSchema.safeParse(entriesRaw);
        if (directParsed.success) {
          setStorages(directParsed.data);
          storageCache.set(cacheKey, { data: directParsed.data, fetchedAt: Date.now() });
          return;
        }
      }

      // Normalize to our schema: principal/entity/target as strings, permissions as string[]
      const normalized: Array<{ principal?: string; entity?: string; target?: string; permissions?: string[] }> = [];
      if (Array.isArray(entriesRaw) && entriesRaw.every((e) => typeof e === 'string')) {

        for (const addr of entriesRaw as string[]) {
          const entityS = typeof addr === 'string' ? addr : String(addr ?? '');
          if (entityS && entityS.trim().length > 0) {
            normalized.push({ principal: normalizedOwner, entity: entityS, target: undefined, permissions: [] });
          }
        }
      } else if (Array.isArray(entriesRaw)) {
        for (const acl of entriesRaw as any[]) {
          try {
            const toAccountString = (value: unknown): string | undefined => {
              if (typeof value === 'string') return value;
              try {
                if (value && typeof (value as { publicKeyString?: string }).publicKeyString === 'string') {
                  return (value as { publicKeyString: string }).publicKeyString;
                }
                const maybePK = (value as { publicKeyString?: { toString?: () => string } }).publicKeyString;
                if (maybePK && typeof maybePK.toString === 'function') {
                  const coerced = String(maybePK.toString());
                  if (coerced && coerced !== '[object Object]') return coerced;
                }
                if (value && typeof (value as { toString?: () => string }).toString === 'function') {
                  const coerced = String((value as { toString: () => string }).toString());
                  if (coerced && coerced !== '[object Object]') return coerced;
                }
              } catch {}
              return undefined;
            };

            const entity = (acl as any).entity ?? (acl as any).address ?? (acl as any).account ?? (acl as any).storage ?? (acl as any).entityAddress;
            const rawPerms = (acl as any).permissions ?? (acl as any).flags ?? (acl as any).permissionFlags;
            const permissions: string[] = Array.isArray(rawPerms)
              ? rawPerms.map((p: unknown) => (typeof p === 'string' ? p : String(p)))
              : Array.isArray(rawPerms?.base?.flags)
                ? (rawPerms.base.flags as unknown[]).map((p: unknown) => (typeof p === 'string' ? p : String(p)))
                : [];
            const isStorage = trustedFiltered
              || (typeof entity?.isStorage === 'function' ? Boolean(entity.isStorage()) : false)
              || permissions.some((p) => typeof p === 'string' && p.toUpperCase().startsWith('STORAGE_'))
              || typeof entity === 'string'; // heuristically accept string entity when provider pre-serializes
            if (!isStorage) continue;

            const principalRaw = (acl as any).principal ?? (acl as any).owner ?? normalizedOwner;
            const principalS = toAccountString(principalRaw) || normalizedOwner;
            const entityRaw = (acl as any).entity ?? (acl as any).address ?? (acl as any).account ?? (acl as any).storage ?? (acl as any).entityAddress;
            const entityS = toAccountString(entityRaw);
            const targetRawAny = (acl as any).target ?? (acl as any).token ?? (acl as any).targetAccount;
            const targetRaw = toAccountString(targetRawAny);
            const targetS = targetRaw && targetRaw.trim && targetRaw.trim().length > 0 ? targetRaw : undefined;
            if (!entityS || entityS.trim().length === 0) {
              continue;
            }
            normalized.push({
              principal: principalS,
              entity: entityS,
              target: targetS,
              permissions,
            });
          } catch {}
        }
      }

      const parsed = StorageAclListSchema.safeParse(normalized);
      if (!parsed.success) {

        setStorages([]);
        storageCache.delete(cacheKey);
      } else {
        setStorages(parsed.data);
        storageCache.set(cacheKey, { data: parsed.data, fetchedAt: Date.now() });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch storages");
      setStorages([]);
      storageCache.delete(cacheKey);
    } finally {
      setLoading(false);
    }
  }, [enabled, owner, userClient]);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    void fetchStorages();
  }, [enabled, fetchStorages]);

  const refresh = React.useCallback(
    (opts?: { force?: boolean }) => fetchStorages(opts),
    [fetchStorages],
  );

  return { storages, loading, error, refresh };
}
export function StorageList({
  owner,
  showActions = false,
  className,
  rowActionsEnabled = true,
  enabled = true,
  onLoaded,
}: {
  owner: string | null | undefined;
  showActions?: boolean;
  className?: string;
  rowActionsEnabled?: boolean;
  enabled?: boolean;
  onLoaded?: (count: number) => void;
}) {
  const { storages, error, refresh, loading } = useStorageAccounts(owner, { enabled });
  const { userClient, requestTransactionPermissions, isConnected, isUnlocked } = useWallet();

  const canTransact = isConnected && isUnlocked && !!userClient;

  React.useEffect(() => {
    if (!onLoaded) return;
    if (!enabled) return;
    if (loading) return;
    onLoaded(storages.length);
  }, [enabled, loading, onLoaded, storages.length]);

  const [details, setDetails] = React.useState<Record<string, { name?: string | null; description?: string | null }>>({});
  const [modal, setModal] = React.useState<{ type: 'view' | 'grant' | 'withdraw'; entry: StorageAclEntry | null } | null>(null);
  const [grantForm, setGrantForm] = React.useState({ operator: "", token: "" });
  const [withdrawForm, setWithdrawForm] = React.useState({ destination: "", token: "", amountBase: "" });
  const [viewForm, setViewForm] = React.useState({ name: "", description: "" });
  const [savingInfo, setSavingInfo] = React.useState(false);
  const [modalTokens, setModalTokens] = React.useState<Array<z.infer<typeof StorageTokenSchema>>>([]);
  const [tokensLoading, setTokensLoading] = React.useState(false);
  const [tokensError, setTokensError] = React.useState<string | null>(null);
  const originalInfoRef = React.useRef<{ name: string; description: string }>({ name: "", description: "" });

  const canQueryStorageApi = React.useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "";
    return base.trim().length > 0;
  }, []);

  React.useEffect(() => {
    if (modal?.type === "view" && modal.entry) {
      const info = details[modal.entry.entity] ?? {};
      setViewForm({
        name: typeof info.name === "string" ? info.name : "",
        description: typeof info.description === "string" ? info.description : "",
      });
      originalInfoRef.current = {
        name: typeof info.name === "string" ? info.name : "",
        description: typeof info.description === "string" ? info.description : "",
      };
    }
  }, [modal, details]);

  const truncateId = React.useCallback((value: string, head = 12, tail = 10) => {
    if (!value) return "";
    if (value.length <= head + tail + 3) return value;
    return `${value.slice(0, head)}...${value.slice(-tail)}`;
  }, []);

  React.useEffect(() => {
    if (modal?.type === 'withdraw' && modalTokens.length > 0 && !withdrawForm.token) {
      setWithdrawForm((f) => ({ ...f, token: modalTokens[0].tokenId }));
    }
  }, [modal?.type, modalTokens, withdrawForm.token]);

  const truncateText = React.useCallback((value: string | null | undefined, max = 60) => {
    if (!value) return null;
    const v = value.trim();
    if (!v) return null;
    if (v.length <= max) return v;
    return `${v.slice(0, max)}...`;
  }, []);

  const formatTokenAmount = React.useCallback((balance: string, decimals?: number) => {
    try {
      const amount = BigInt(balance);
      if (!decimals || decimals <= 0) return amount.toString();
      const denom = BigInt(10) ** BigInt(decimals);
      const whole = amount / denom;
      const fraction = amount % denom;
      if (fraction === BigInt(0)) return whole.toString();
      const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
      return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
    } catch {
      return balance;
    }
  }, []);

  const handleSaveInfo = React.useCallback(async () => {
    if (!modal?.entry) return;
    try {
      const parsed = StorageInfoSchema.safeParse({
        name: viewForm.name,
        description: viewForm.description || undefined,
      });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Invalid inputs");
        return;
      }

      if (!rowActionsEnabled) {
        toast.error("You do not have permission to update this storage");
        return;
      }

      if (!canTransact) {
        const granted = await requestTransactionPermissions();
        if (!granted) {
          return;
        }
      }

      if (!userClient) {
        toast.error("Wallet not ready");
        return;
      }

      setSavingInfo(true);
      const manager = new StorageAccountManager(userClient);
      await manager.updateStorageInfo(modal.entry.entity, {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      });

      setDetails((prev) => ({
        ...prev,
        [modal.entry!.entity]: {
          name: parsed.data.name,
          description: parsed.data.description ?? null,
        },
      }));

      toast.success("Storage details updated");
      setModal(null);
      await refresh({ force: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update storage");
    } finally {
      setSavingInfo(false);
    }
  }, [modal, viewForm, rowActionsEnabled, canTransact, requestTransactionPermissions, userClient, refresh]);

  const isInfoDirty = React.useMemo(() => {
    const original = originalInfoRef.current;
    return viewForm.name.trim() !== original.name.trim() || (viewForm.description ?? "").trim() !== (original.description ?? "").trim();
  }, [viewForm]);

  const fetchTokensForStorage = React.useCallback(async (storageAddr: string) => {
    if (!canQueryStorageApi) {
      setModalTokens([]);
      setTokensError(null);
      return;
    }
    setTokensLoading(true);
    setTokensError(null);
    try {
      const data: unknown = await storageApi.getStorage(storageAddr);
      const parsed = StorageResponseSchema.safeParse(data);
      if (!parsed.success) {
        setModalTokens([]);
      } else {
        setModalTokens(parsed.data.tokens ?? []);
      }
    } catch (e) {
      setTokensError(e instanceof Error ? e.message : "Failed to load tokens");
      setModalTokens([]);
    } finally {
      setTokensLoading(false);
    }
  }, [canQueryStorageApi]);

  // Pagination (fixed 5 rows per page)
  const pageSize = 5;
  const [pageIndex, setPageIndex] = React.useState(0);
  const pageCount = Math.max(1, Math.ceil(storages.length / pageSize));
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const displayedStorages = storages.slice(start, end);

  React.useEffect(() => {
    try {


    } catch {}
  }, [owner, storages, displayedStorages.length, pageIndex, pageCount]);

  React.useEffect(() => {
    // Clamp page index when data changes
    const maxIndex = Math.max(0, pageCount - 1);
    if (pageIndex > maxIndex) setPageIndex(maxIndex);
  }, [pageCount, pageIndex]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadDetails() {
      // Fetch storage info details via SDK state reads
      const pending: Array<Promise<void>> = [];
      const next: Record<string, { name?: string | null; description?: string | null }> = {};
      for (const entry of storages) {
        const addr = entry.entity;
        if (!addr || details[addr]) continue;
        const cached = storageDetailCache.get(addr);
        if (cached && Date.now() - cached.fetchedAt < STORAGE_DETAIL_TTL_MS) {
          next[addr] = cached.data;
          continue;
        }
        pending.push(
          (async () => {
            try {
              const state = await getAccountState(addr);
              const rec = state && typeof state === 'object' ? (state as any) : null;
              const infoObj = rec && typeof rec.info === 'object' ? (rec.info as Record<string, unknown>) : {};
              const name = typeof infoObj.name === 'string' && infoObj.name.trim().length > 0 ? infoObj.name : null;
              const description = typeof infoObj.description === 'string' && infoObj.description.trim().length > 0 ? infoObj.description : null;
              const payload = { name, description };
              next[addr] = payload;
              storageDetailCache.set(addr, { data: payload, fetchedAt: Date.now() });
            } catch {
              const payload = {};
              next[addr] = payload;
              storageDetailCache.set(addr, { data: payload, fetchedAt: Date.now() });
            }
          })()
        );
      }
      await Promise.allSettled(pending);
      if (!cancelled && Object.keys(next).length > 0) {
        setDetails((prev) => ({ ...prev, ...next }));
      }
    }
    loadDetails();
    return () => { cancelled = true };
  }, [storages, details]);

  const handleCreateStorage = async () => {
    try {
      if (!canTransact) {
        const granted = await requestTransactionPermissions();
        if (!granted) return;
      }
      if (!userClient) return;
      const manager = new StorageAccountManager(userClient);

      const operator = window.prompt("Operator address (optional)")?.trim() || null;
      const tokensInput = window.prompt("Allowed token addresses (comma-separated, optional)")?.trim() || "";
      const tokens = tokensInput.length > 0 ? tokensInput.split(",").map(s => s.trim()).filter(Boolean) : [];

      const addr = await manager.createStorageAccount(operator, tokens);
      toast.success(`Storage created: ${addr}`);
      await refresh({ force: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create storage");
    }
  };

  const submitGrant = async () => {
    try {
      if (!modal?.entry) return;
      if (!rowActionsEnabled) return;
      if (!canTransact) {
        const granted = await requestTransactionPermissions();
        if (!granted) return;
      }
      if (!userClient) return;
      const manager = new StorageAccountManager(userClient);
      const InputSchema = z.object({
        operator: z.string().min(1, "Operator is required"),
        token: z.string().min(1, "Token is required"),
      });
      const parsed = InputSchema.safeParse(grantForm);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Invalid inputs");
        return;
      }
      await manager.grantTokenPermission(modal.entry.entity, parsed.data.operator, parsed.data.token);
      toast.success("Permission granted");
      setModal(null);
      setGrantForm({ operator: "", token: "" });
      await refresh({ force: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to grant permission");
    }
  };

  const submitWithdraw = async () => {
    try {
      if (!modal?.entry) return;
      if (!rowActionsEnabled) return;
      if (!canTransact) {
        const granted = await requestTransactionPermissions();
        if (!granted) return;
      }
      if (!userClient) return;
      const manager = new StorageAccountManager(userClient);
      const InputSchema = z.object({
        destination: z.string().min(1, "Destination is required"),
        token: z.string().min(1, "Token is required"),
        amountBase: z.string().regex(/^\d+$/, "Amount must be an integer in base units"),
      });
      const parsed = InputSchema.safeParse(withdrawForm);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Invalid inputs");
        return;
      }
      const hash = await manager.selfWithdraw(modal.entry.entity, parsed.data.destination, parsed.data.token, BigInt(parsed.data.amountBase));
      toast.success(`Withdrawal published: ${hash}`);
      setModal(null);
      setWithdrawForm({ destination: "", token: "", amountBase: "" });
      await refresh({ force: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to withdraw");
    }
  };

  const handleGrantPermission = async () => {
    try {
      if (!canTransact) {
        const granted = await requestTransactionPermissions();
        if (!granted) return;
      }
      if (!userClient) return;
      const manager = new StorageAccountManager(userClient);

      const storage = window.prompt("Storage address")?.trim() ?? "";
      const operator = window.prompt("Operator address")?.trim() ?? "";
      const token = window.prompt("Token address")?.trim() ?? "";

      const InputSchema = z.object({
        storage: z.string().min(1, "Storage is required"),
        operator: z.string().min(1, "Operator is required"),
        token: z.string().min(1, "Token is required"),
      });
      const parsed = InputSchema.safeParse({ storage, operator, token });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Invalid inputs");
        return;
      }

      await manager.grantTokenPermission(parsed.data.storage, parsed.data.operator, parsed.data.token);
      toast.success("Permission granted");
      await refresh({ force: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to grant permission");
    }
  };

  const handleWithdraw = async () => {
    try {
      if (!canTransact) {
        const granted = await requestTransactionPermissions();
        if (!granted) return;
      }
      if (!userClient) return;
      const manager = new StorageAccountManager(userClient);

      const storage = window.prompt("Storage address")?.trim() ?? "";
      const destination = window.prompt("Destination address")?.trim() ?? "";
      const token = window.prompt("Token address")?.trim() ?? "";
      const amountBase = window.prompt("Amount (base units)")?.trim() ?? "";

      const InputSchema = z.object({
        storage: z.string().min(1, "Storage is required"),
        destination: z.string().min(1, "Destination is required"),
        token: z.string().min(1, "Token is required"),
        amountBase: z.string().regex(/^\d+$/, "Amount must be an integer in base units"),
      });
      const parsed = InputSchema.safeParse({ storage, destination, token, amountBase });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Invalid inputs");
        return;
      }

      const hash = await manager.selfWithdraw(parsed.data.storage, parsed.data.destination, parsed.data.token, BigInt(parsed.data.amountBase));
      toast.success(`Withdrawal published: ${hash}`);
      await refresh({ force: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to withdraw");
    }
  };

  return (
    <div className={className}>
      {showActions && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={handleCreateStorage} disabled={!isConnected}>Create Storage</Button>
          <Button size="sm" variant="outline" onClick={handleGrantPermission} disabled={!isConnected}>Grant Permission</Button>
          <Button size="sm" variant="outline" onClick={handleWithdraw} disabled={!isConnected}>Withdraw</Button>
        </div>
      )}
      {/* View Modal */}
      {modal?.type === 'view' && modal.entry && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setSavingInfo(false);
              setModal(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Storage Details</DialogTitle>
              <DialogDescription>Review and update storage account information</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-1">
                <Label>Name</Label>
                <Input
                  value={viewForm.name}
                  onChange={(e) => setViewForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Storage name"
                  maxLength={128}
                />
              </div>
              <div className="grid gap-1">
                <Label>Description</Label>
                <Textarea
                  value={viewForm.description}
                  onChange={(e) => setViewForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe this storage"
                  rows={3}
                />
              </div>
              <div className="grid gap-1">
                <Label>Storage Address</Label>
                <span className="truncate text-sm text-muted" title={modal.entry.entity}>
                  {truncateId(modal.entry.entity, 18, 12)}
                </span>
              </div>
              <div className="grid gap-1">
                <Label>Owner</Label>
                <span className="truncate text-sm text-muted" title={modal.entry.principal}>
                  {truncateId(modal.entry.principal, 18, 12)}
                </span>
              </div>
              <div className="grid gap-1">
                <Label>Permissions</Label>
                <span className="truncate text-sm text-muted">
                  {(modal.entry.permissions ?? []).join(', ') || '—'}
                </span>
              </div>
            </div>
            <DialogFooter className="flex items-center justify-between gap-3">
              <Link
                prefetch={false}
                href={buildStorageExplorerHref(modal.entry.entity)}
                className="text-accent hover:text-foreground text-sm"
              >
                Open in Explorer
              </Link>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setModal(null)} disabled={savingInfo}>Cancel</Button>
                <Button
                  onClick={handleSaveInfo}
                  disabled={savingInfo || !isInfoDirty}
                >
                  {savingInfo ? "Saving..." : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Grant Permission Modal */}
      {modal?.type === 'grant' && modal.entry && (
        <Dialog open onOpenChange={(open) => { if (!open) setModal(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grant Permission</DialogTitle>
              <DialogDescription>Grant SEND_ON_BEHALF to an operator for a token</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-1">
                <Label>Storage Address</Label>
                <Input readOnly value={modal.entry.entity} />
              </div>
              <div className="grid gap-1">
                <Label>Operator Address</Label>
                <Input value={grantForm.operator} onChange={(e) => setGrantForm((f) => ({ ...f, operator: e.target.value }))} placeholder="keeta_..." />
              </div>
              <div className="grid gap-1">
                <Label>Token Address</Label>
                <Input value={grantForm.token} onChange={(e) => setGrantForm((f) => ({ ...f, token: e.target.value }))} placeholder="token_..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={submitGrant} disabled={!rowActionsEnabled || !isConnected}>Grant</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Withdraw Modal */}
      {modal?.type === 'withdraw' && modal.entry && (
        <Dialog open onOpenChange={(open) => { if (!open) setModal(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw From Storage</DialogTitle>
              <DialogDescription>Send tokens from storage to a destination</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-1">
                <Label>Storage Address</Label>
                <Input readOnly value={modal.entry.entity} />
              </div>
              <div className="grid gap-1">
                <Label>Destination Address</Label>
                <Input value={withdrawForm.destination} onChange={(e) => setWithdrawForm((f) => ({ ...f, destination: e.target.value }))} placeholder="keeta_..." />
              </div>
              <div className="grid gap-1">
                <Label>Token</Label>
                {tokensLoading ? (
                  <Input readOnly value="Loading tokens..." />
                ) : modalTokens.length > 0 ? (
                  <Select value={withdrawForm.token} onValueChange={(val) => setWithdrawForm((f) => ({ ...f, token: val }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a token" />
                    </SelectTrigger>
                    <SelectContent>
                      {modalTokens.map((t) => (
                        <SelectItem key={t.tokenId} value={t.tokenId}>
                          {(t.symbol || '—') + ' · ' + (t.name || 'Unnamed')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={withdrawForm.token} onChange={(e) => setWithdrawForm((f) => ({ ...f, token: e.target.value.trim() }))} placeholder="token_..." />
                )}
                {(() => {
                  const sel = modalTokens.find((t) => t.tokenId === withdrawForm.token);
                  if (!sel) return null;
                  return (
                    <span className="text-xs text-muted">Available: {formatTokenAmount(sel.balance, sel.decimals)} {sel.symbol || ''}</span>
                  );
                })()}
                {tokensError ? <span className="text-xs text-red-500">{tokensError}</span> : null}
              </div>
              <div className="grid gap-1">
                <Label>Amount (base units)</Label>
                <div className="flex items-center gap-2">
                  <Input value={withdrawForm.amountBase} onChange={(e) => setWithdrawForm((f) => ({ ...f, amountBase: e.target.value }))} placeholder="e.g. 1000000" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const sel = modalTokens.find((t) => t.tokenId === withdrawForm.token);
                      if (sel) setWithdrawForm((f) => ({ ...f, amountBase: sel.balance }));
                    }}
                    disabled={!withdrawForm.token}
                  >
                    Max
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={submitWithdraw} disabled={!rowActionsEnabled || !isConnected}>Withdraw</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {error ? (
        <div className="rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-6 text-sm text-muted">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-hairline">
          <div className="hidden grid-cols-[2fr_1.5fr_1fr_auto] gap-6 border-b border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-muted md:grid">
            <span>Storage</span>
            <span>Owner</span>
            <span>Permissions</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-hairline">
            {displayedStorages.map((entry) => {
                const info = details[entry.entity] || {};
                const name = truncateText(info.name, 40);
                const description = truncateText(info.description, 60);
                return (
                  <div
                    key={`${entry.entity}-${entry.principal}`}
                    className="grid h-16 items-center gap-4 px-6 text-sm text-foreground md:grid-cols-[2fr_1.5fr_1fr_auto]"
                  >
                    <div className="flex min-w-0 flex-col">
                      <div className="min-w-0 truncate font-medium">
                        {name ?? truncateId(entry.entity, 10, 8)}
                      </div>
                      {description ? (
                        <div className="min-w-0 truncate text-xs text-subtle">({description})</div>
                      ) : null}
                      <Link
                        prefetch={false}
                        href={buildStorageExplorerHref(entry.entity)}
                        className="min-w-0 truncate text-xs text-accent hover:text-foreground"
                      >
                        {truncateId(entry.entity, 12, 10)}
                      </Link>
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <Link
                        prefetch={false}
                        href={buildAccountExplorerHref(entry.principal)}
                        className="min-w-0 truncate text-sm font-medium text-accent hover:text-foreground"
                      >
                        {truncateId(entry.principal, 12, 10)}
                      </Link>
                      <span className="text-xs text-muted">Owner</span>
                    </div>
                    <div className="min-w-0 text-xs text-subtle">
                      <span className="block min-w-0 truncate">{(entry.permissions ?? []).join(', ') || '—'}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="View"
                            title="View"
                            onClick={() => setModal({ type: 'view', entry })}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Grant Permission"
                            title="Grant Permission"
                            onClick={() => { setGrantForm({ operator: "", token: "" }); setModal({ type: 'grant', entry }); }}
                            disabled={!rowActionsEnabled || !isConnected}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Grant Permission</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Withdraw"
                            title="Withdraw"
                            onClick={() => { setWithdrawForm({ destination: "", token: "", amountBase: "" }); setModal({ type: 'withdraw', entry }); void fetchTokensForStorage(entry.entity); }}
                            disabled={!rowActionsEnabled || !isConnected}
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Withdraw</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            {Array.from({ length: Math.max(0, pageSize - displayedStorages.length) }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="grid h-16 items-center gap-4 px-6 text-sm text-foreground md:grid-cols-[2fr_1.5fr_1fr_auto]"
              >
                <div className="min-w-0 text-subtle">&nbsp;</div>
                <div className="min-w-0">&nbsp;</div>
                <div className="min-w-0">&nbsp;</div>
                <div className="flex items-center justify-end gap-1">&nbsp;</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Pagination controls */}
      {!error && (
        <div className="mt-3 flex items-center px-4">
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-[2.5rem] px-2"
              onClick={() => setPageIndex(0)}
              disabled={pageIndex === 0}
              aria-label="Go to first page"
            >
              {"<<"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-[2.5rem] px-2"
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
              aria-label="Go to previous page"
            >
              {"<"}
            </Button>
            <span className="px-1 text-sm font-medium">
              Page {pageIndex + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-[2.5rem] px-2"
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
              disabled={pageIndex >= pageCount - 1}
              aria-label="Go to next page"
            >
              {">"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-[2.5rem] px-2"
              onClick={() => setPageIndex(pageCount - 1)}
              disabled={pageIndex >= pageCount - 1}
              aria-label="Go to last page"
            >
              {">>"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
