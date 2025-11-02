import { processTokenForDisplay, formatTokenAmount, formatAmountWithCommas, extractDecimalsAndFieldType } from '@/app/lib/token-utils';

export function coerceString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return undefined;
}

export function coerceAmount(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value).toString();
  if (typeof value === 'bigint') return value.toString();
  return coerceString(value);
}

export function resolveDate(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
      return candidate.toISOString();
    }
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      const ms = candidate < 1_000_000_000_000 ? candidate * 1000 : candidate;
      const normalized = new Date(ms);
      if (!Number.isNaN(normalized.getTime())) return normalized.toISOString();
    }
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (/^\d+$/.test(trimmed)) {
        const n = Number(trimmed);
        const ms = n < 1_000_000_000_000 ? n * 1000 : n;
        const d = new Date(ms);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
      }
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  return '';
}

export type TokenDisplayEntry = {
  publicKey: string;
  name: string | null;
  ticker: string | null;
  decimals: number | null;
  fieldType?: 'decimalPlaces' | 'decimals';
  formattedAmount?: string;
  icon?: string | null;
  totalSupply: string | null;
  balance: string;
};

export async function processBalancesEntries(
  entries: any[],
  baseTokenAddress: string | null,
): Promise<TokenDisplayEntry[]> {
  const tasks = entries.map(async (entry: any) => {
    const tokenAddress = String(entry?.token ?? entry?.publicKey ?? '');
    const rawBalance = entry?.balance ?? '0';
    const metadata = typeof entry?.metadata === 'string' ? entry.metadata : undefined;
    if (entry && typeof entry === 'object' && 'formattedAmount' in entry) {
      return {
        publicKey: tokenAddress,
        name: typeof entry.name === 'string' && entry.name.trim().length > 0 ? entry.name : null,
        ticker: typeof entry.ticker === 'string' && entry.ticker.trim().length > 0 ? entry.ticker : null,
        decimals: entry.decimals ?? null,
        fieldType: (entry as any).fieldType,
        formattedAmount: (entry as any).formattedAmount,
        icon: (entry as any).icon ?? null,
        totalSupply: null,
        balance: String(rawBalance),
      } as TokenDisplayEntry;
    }
    try {
      const p = await processTokenForDisplay(
        tokenAddress,
        rawBalance,
        metadata,
        baseTokenAddress ?? undefined,
        undefined,
      );
      // Base token override: trust centralized parser for KTA and do NOT override ticker from entry
      const isBaseToken = Boolean(baseTokenAddress && tokenAddress === baseTokenAddress);
      const resolvedName = isBaseToken
        ? p.name
        : ((typeof entry.name === 'string' && entry.name.trim().length > 0) ? entry.name : p.name);
      const resolvedTicker = isBaseToken
        ? 'KTA'
        : ((typeof entry.ticker === 'string' && entry.ticker.trim().length > 0) ? entry.ticker : p.ticker);
      const resolvedDecimals = isBaseToken
        ? (p.decimals ?? 9)
        : ((typeof entry.decimals === 'number' && Number.isFinite(entry.decimals)) ? entry.decimals : p.decimals);
      const resolvedFieldType: 'decimalPlaces' | 'decimals' = isBaseToken
        ? 'decimalPlaces'
        : ((entry.fieldType === 'decimalPlaces' || entry.fieldType === 'decimals') ? entry.fieldType : p.fieldType);
      const displayHints = extractDecimalsAndFieldType(metadata);
      const recomputed = formatAmountWithCommas(
        formatTokenAmount(
          String(rawBalance),
          resolvedDecimals ?? 0,
          resolvedFieldType ?? 'decimals',
          displayHints.displayDecimals
        )
      );

      try {
        console.debug('[TOKENS_TAB] mappers.processBalancesEntries', {
          tokenAddress,
          isBaseToken,
          entryName: entry?.name,
          entryTicker: entry?.ticker,
          entryDecimals: entry?.decimals,
          pName: p.name,
          pTicker: p.ticker,
          pDecimals: p.decimals,
          resolvedName,
          resolvedTicker,
          resolvedDecimals,
          resolvedFieldType,
          formattedAmount: recomputed ?? p.formattedAmount,
        });
      } catch {}

      return {
        publicKey: tokenAddress,
        name: resolvedName?.trim().length ? resolvedName : null,
        ticker: resolvedTicker?.trim().length ? resolvedTicker : null,
        decimals: resolvedDecimals ?? null,
        fieldType: resolvedFieldType,
        formattedAmount: recomputed ?? p.formattedAmount,
        icon: p.icon || null,
        totalSupply: null,
        balance: String(rawBalance),
      } as TokenDisplayEntry;
    } catch {
      return {
        publicKey: tokenAddress,
        name: null,
        ticker: null,
        decimals: null,
        totalSupply: null,
        balance: String(rawBalance),
      } as TokenDisplayEntry;
    }
  });
  return await Promise.all(tasks);
}

export type ActivityRecord = {
  id: string;
  block: string;
  timestamp: number;
  type: string;
  amount: string;
  from: string;
  to: string;
  token: string;
  operationType: string;
  formattedAmount?: string;
  rawAmount?: string;
  tokenTicker?: string | null;
  tokenDecimals?: number | null;
  tokenMetadata?: {
    name?: string | null;
    ticker?: string | null;
    decimals?: number | null;
  } | null;
};

export function mapHistoryRecords(records: any[]): ActivityRecord[] {
  return (records ?? []).map((record: any, index: number) => ({
    id: record.id || record.block || `activity-${index}`,
    block: record.block || record.id || '',
    timestamp: record.timestamp || Date.now(),
    type: record.type || record.operationType || 'UNKNOWN',
    amount: record.amount || '0',
    from: record.from || '',
    to: record.to || '',
    token: record.token || record.tokenAddress || '',
    operationType: record.type || record.operationType || 'UNKNOWN',
    formattedAmount: record.amount || '0',
    rawAmount: record.amount || '0',
    tokenTicker: record.tokenTicker || undefined,
    tokenDecimals: record.tokenDecimals || null,
    tokenMetadata: record.tokenMetadata || null,
  }));
}
