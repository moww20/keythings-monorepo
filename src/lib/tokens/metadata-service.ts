import { z } from "zod";
import { parseTokenMetadata } from "@/app/explorer/utils/token-metadata";

export type TokenMeta = {
  name?: string | null;
  ticker?: string | null;
  decimals?: number | null;
  metadataBase64?: string | null;
};

const cache = new Map<string, TokenMeta>();

const AccountInfoSchema = z
  .object({
    info: z.record(z.string(), z.unknown()).optional(),
    metadata: z.string().optional(),
    name: z.string().optional(),
    ticker: z.string().optional(),
    symbol: z.string().optional(),
    decimals: z.number().optional(),
    decimalPlaces: z.number().optional(),
  })
  .passthrough();

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function coerceString(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }
  return null;
}

export async function getTokenMeta(tokenId: string): Promise<TokenMeta | null> {
  if (!tokenId) return null;
  if (cache.has(tokenId)) return cache.get(tokenId)!;
  if (typeof window === "undefined" || !window.keeta) return null;
  try {
    // Prefer SDK via user client when available
    let raw: unknown = null;
    try {
      const uc = await window.keeta.getUserClient?.();
      if (uc && typeof (uc as any).getAccountInfo === 'function') {
        raw = await (uc as any).getAccountInfo(tokenId);
      } else if (uc && typeof (uc as any).account === 'function') {
        raw = await (uc as any).account(tokenId);
      } else if (uc && typeof (uc as any).getAccount === 'function') {
        raw = await (uc as any).getAccount(tokenId);
      }
    } catch {}
    // Fallback to wallet RPC
    if (!raw && typeof window.keeta.getAccountInfo === 'function') {
      raw = await window.keeta.getAccountInfo(tokenId);
    }
    if (!raw) return null;
    const parsed = AccountInfoSchema.safeParse(raw);
    const obj = parsed.success ? parsed.data : {};
    const info = (obj as any).info as Record<string, unknown> | undefined;
    const metadataBase64 = coerceString(info?.metadata ?? (obj as any).metadata);
    let name = coerceString(info?.name ?? (obj as any).name);
    let ticker = coerceString(info?.ticker ?? info?.symbol ?? (obj as any).ticker ?? (obj as any).symbol);
    let decimals = coerceNumber(info?.decimals ?? info?.decimalPlaces ?? (obj as any).decimals ?? (obj as any).decimalPlaces);

    if (metadataBase64) {
      const meta = parseTokenMetadata(metadataBase64);
      if (meta) {
        name = name ?? coerceString(meta.name) ?? null;
        ticker = ticker ?? coerceString(meta.ticker) ?? null;
        if (typeof meta.decimals === "number") decimals = meta.decimals;
      }
    }

    const result: TokenMeta = { name: name ?? null, ticker: ticker ?? null, decimals: decimals ?? null, metadataBase64: metadataBase64 ?? null };
    cache.set(tokenId, result);
    return result;
  } catch {
    return null;
  }
}

export async function prefetchTokenMeta(tokenIds: string[]): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  for (const id of tokenIds) {
    if (!id || cache.has(id)) continue;
    tasks.push(getTokenMeta(id));
  }
  if (tasks.length) await Promise.allSettled(tasks);
}
