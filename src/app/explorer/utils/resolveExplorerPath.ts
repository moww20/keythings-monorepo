const BLOCK_HASH_LENGTH = 64;
const ADDRESS_PREFIX = "keeta_";
const TOKEN_PREFIXES = ["am", "an", "ao", "ap"] as const;
const ADDRESS_LENGTHS = new Set([67, 69]);
const ADDRESS_BODY_REGEX = /^[a-z0-9]+$/;

function isLikelyTokenSuffix(suffix: string): boolean {
  const prefix = suffix.slice(0, 2).toLowerCase();
  return TOKEN_PREFIXES.some((tokenPrefix) => tokenPrefix === prefix);
}

export type ExplorerPathType = "block" | "token" | "account";

interface ResolveResult {
  type: ExplorerPathType;
  path: string;
}

export function resolveExplorerPath(input: string): string | null {
  const result = resolveExplorerTarget(input);
  return result?.path ?? null;
}

export function resolveExplorerTarget(input: string): ResolveResult | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  if (value.length === BLOCK_HASH_LENGTH && /^[0-9a-fA-F]+$/.test(value)) {
    return { type: "block", path: `/explorer/block/${value}` };
  }

  if (value.startsWith(ADDRESS_PREFIX) && ADDRESS_LENGTHS.has(value.length)) {
    const suffix = value.slice(ADDRESS_PREFIX.length);
    if (!suffix || !ADDRESS_BODY_REGEX.test(suffix)) {
      return null;
    }

    if (isLikelyTokenSuffix(suffix)) {
      return { type: "token", path: `/explorer/token/${value}` };
    }

    return { type: "account", path: `/explorer/account/${value}` };
  }

  return null;
}

export function truncateIdentifier(value: string, start = 6, end = 4): string {
  if (value.length <= start + end) {
    return value;
  }
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}
