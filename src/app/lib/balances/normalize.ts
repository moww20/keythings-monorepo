import { z } from 'zod';
import type { KeetaBalanceEntry } from '@/types/keeta';

// Tolerant schema for a variety of balance entry shapes
const RawBalanceEntrySchema = z
  .object({
    token: z.string().optional(),
    publicKey: z.string().optional(),
    balance: z.union([z.string(), z.number(), z.bigint()]).optional(),
    metadata: z.string().optional().nullable(),
  })
  .passthrough();

function coerceToken(v: unknown, fallback?: unknown): string | null {
  if (typeof v === 'string' && v.trim().length > 0) return v;
  if (typeof fallback === 'string' && fallback.trim().length > 0) return fallback;
  return null;
}

function coerceBalance(v: unknown): string | number | bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim().length > 0) return v;
  return '0';
}

export function normalizeBalances(raw: unknown): KeetaBalanceEntry[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: KeetaBalanceEntry[] = [];
  for (const item of arr) {
    const parsed = RawBalanceEntrySchema.safeParse(item);
    if (!parsed.success) continue;
    const obj = parsed.data as Record<string, unknown>;
    const token = coerceToken(obj.token, obj.publicKey);
    if (!token) continue;
    const balance = coerceBalance(obj.balance);
    const metadata = typeof obj.metadata === 'string' ? obj.metadata : undefined;
    out.push({ token, balance, metadata });
  }
  return out;
}
