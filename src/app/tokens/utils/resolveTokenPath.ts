const ADDRESS_PREFIX = "keeta_";
const TOKEN_PREFIXES = ["am", "an", "ao", "ap"] as const;
const ADDRESS_LENGTHS = new Set([67, 69]);
const ADDRESS_BODY_REGEX = /^[a-z0-9]+$/;

function isLikelyTokenSuffix(suffix: string): boolean {
  const prefix = suffix.slice(0, 2).toLowerCase();
  return TOKEN_PREFIXES.some((tokenPrefix) => tokenPrefix === prefix);
}

export type TokenPathType = "token";

interface ResolveResult {
  type: TokenPathType;
  path: string;
}

export function resolveTokenPath(input: string): string | null {
  const result = resolveTokenTarget(input);
  return result?.path ?? null;
}

export function resolveTokenTarget(input: string): ResolveResult | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  // Check if it's a Keeta address
  if (value.startsWith(ADDRESS_PREFIX) && ADDRESS_LENGTHS.has(value.length)) {
    const suffix = value.slice(ADDRESS_PREFIX.length);
    if (!suffix || !ADDRESS_BODY_REGEX.test(suffix)) {
      return null;
    }

    // For tokens page, we primarily focus on token addresses
    if (isLikelyTokenSuffix(suffix)) {
      return { type: "token", path: `/tokens/token/${value}` };
    }

    // Also allow other addresses to be treated as potential tokens
    // (some tokens might not follow the typical prefix pattern)
    return { type: "token", path: `/tokens/token/${value}` };
  }

  // Check if it looks like a token symbol or short identifier
  if (value.length >= 2 && value.length <= 10 && /^[A-Za-z0-9]+$/.test(value)) {
    return { type: "token", path: `/tokens/symbol/${value}` };
  }

  return null;
}

export function truncateIdentifier(value: string, start = 6, end = 4): string {
  if (value.length <= start + end) {
    return value;
  }
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

