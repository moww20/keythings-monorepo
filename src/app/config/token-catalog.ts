import type { TokenCatalogEntry } from '@/app/types/token';

export interface TokenCatalogConfig {
  tokens: TokenCatalogEntry[];
  rawValue: string | undefined;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceEntry(entry: unknown): TokenCatalogEntry | null {
  if (!isRecord(entry)) {
    return null;
  }

  const symbol = typeof entry.symbol === 'string' ? entry.symbol.trim() : '';
  const address = typeof entry.address === 'string' ? entry.address.trim() : '';
  if (!symbol || !address) {
    return null;
  }

  const name = typeof entry.name === 'string' ? entry.name : undefined;
  const icon = typeof entry.icon === 'string' ? entry.icon : undefined;
  const decimals = Number.isFinite(entry.decimals) ? Number(entry.decimals) : undefined;

  return {
    symbol,
    address,
    name,
    icon,
    decimals,
  } satisfies TokenCatalogEntry;
}

export function loadTokenCatalogFromEnv(): TokenCatalogConfig {
  const raw = process.env.NEXT_PUBLIC_RFQ_TOKEN_CATALOG;
  const errors: string[] = [];

  if (!raw || raw.trim().length === 0) {
    errors.push('[TokenCatalog] NEXT_PUBLIC_RFQ_TOKEN_CATALOG missing; UI will show wallet balances only.');
    return { tokens: [], rawValue: raw, errors };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      errors.push('[TokenCatalog] Expected an array in NEXT_PUBLIC_RFQ_TOKEN_CATALOG.');
      return { tokens: [], rawValue: raw, errors };
    }

    const tokens = parsed
      .map(coerceEntry)
      .filter((entry): entry is TokenCatalogEntry => Boolean(entry));

    if (tokens.length === 0) {
      errors.push('[TokenCatalog] Catalog parsed successfully but contained no valid token entries.');
    }

    return { tokens, rawValue: raw, errors };
  } catch (error) {
    errors.push('[TokenCatalog] Failed to parse NEXT_PUBLIC_RFQ_TOKEN_CATALOG JSON.');
    console.warn('[TokenCatalog] Parse failure', error);
    return { tokens: [], rawValue: raw, errors };
  }
}
