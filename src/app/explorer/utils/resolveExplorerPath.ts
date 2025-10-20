const BLOCK_HASH_LENGTH = 64;
const ADDRESS_PREFIX = "keeta_";
const TOKEN_PREFIXES = ["am", "an", "ao", "ap"] as const;

function isLikelyTokenSuffix(suffix: string): boolean {
  return TOKEN_PREFIXES.some((prefix) => suffix.startsWith(prefix));
}

export function resolveExplorerPath(input: string): string | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  if (value.length === BLOCK_HASH_LENGTH && /^[0-9a-fA-F]+$/.test(value)) {
    return `/explorer/block/${value}`;
  }

  if (value.startsWith(ADDRESS_PREFIX)) {
    const suffix = value.slice(ADDRESS_PREFIX.length);
    if (!suffix) {
      return null;
    }

    if (isLikelyTokenSuffix(suffix)) {
      return `/explorer/token/${value}`;
    }

    return `/explorer/account/${value}`;
  }

  return null;
}

export function truncateIdentifier(value: string, start = 6, end = 4): string {
  if (value.length <= start + end) {
    return value;
  }
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}
