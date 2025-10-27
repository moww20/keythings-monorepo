/**
 * Token Utilities for Website
 * Simplified version based on extension wallet patterns
 */

import type { RFQOrder } from '@/app/types/rfq';
import type { OrderSide } from '@/app/types/rfq';

export type TokenFieldType = "decimalPlaces" | "decimals";

const TOKEN_FALLBACK_DECIMALS = 6;

function normalizeSymbol(symbol: string | undefined | null): string {
  if (!symbol) {
    return '';
  }
  return symbol.trim().toUpperCase();
}

function getEnvString(key: string | undefined, fallback: string): string {
  if (!key) {
    return fallback;
  }
  const value = process.env[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function getEnvNumber(key: string | undefined, fallback: number): number {
  if (!key) {
    return fallback;
  }
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitPair(pair: string): { base: string; quote: string } {
  const [rawBase, rawQuote] = pair.split('/');
  const base = normalizeSymbol(rawBase) || normalizeSymbol(pair);
  const quote = normalizeSymbol(rawQuote) || base;
  return { base, quote };
}

// Global token address cache from wallet balances
let tokenAddressCache: Map<string, string> = new Map();
let tokenDecimalsCache: Map<string, number> = new Map();
interface CachedTokenMetadata {
  metadata: string | null;
  decimals: number;
  fieldType: TokenFieldType;
  name?: string;
  symbol?: string;
  ticker?: string;
}
let tokenMetadataCache: Map<string, CachedTokenMetadata> = new Map();

export function setTokenAddressCache(addresses: Map<string, string>) {
  addresses.forEach((value, key) => {
    tokenAddressCache.set(key, value);
  });
}

export function setTokenDecimalsCache(decimals: Map<string, number>) {
  decimals.forEach((value, key) => {
    tokenDecimalsCache.set(key, value);
  });
}

export function setTokenMetadataCache(metadata: Map<string, CachedTokenMetadata>) {
  metadata.forEach((value, key) => {
    tokenMetadataCache.set(key, value);
  });
}

export function getTokenMetadataFromCache(address: string): CachedTokenMetadata | null {
  return tokenMetadataCache.get(address) ?? null;
}

export function getTokenAddressForSymbol(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return '';
  }
  
  // First try to get from wallet cache
  const cachedAddress = tokenAddressCache.get(normalized);
  if (cachedAddress) {
    return cachedAddress;
  }
  
  // Fallback to environment variables
  const directKey = `NEXT_PUBLIC_${normalized}_TOKEN_ADDRESS`;
  const pubkeyKey = `NEXT_PUBLIC_${normalized}_TOKEN_PUBKEY`;
  const envAddress = getEnvString(directKey, getEnvString(pubkeyKey, ''));
  
  // If we have a valid address from environment, return it
  if (envAddress && !envAddress.startsWith('PLACEHOLDER_') && envAddress.length > 10) {
    return envAddress;
  }
  
  // For KTA/BASE tokens, try to get from wallet context
  if (normalized === 'KTA' || normalized === 'BASE') {
    // Return empty string to let the calling code handle it with wallet context
    return '';
  }
  
  // For other tokens, return empty string instead of placeholder
  return '';
}

export function getTokenDecimalsForSymbol(symbol: string): number {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return TOKEN_FALLBACK_DECIMALS;
  }
  
  // First try to get from wallet cache (REAL DECIMALS!)
  const cachedDecimals = tokenDecimalsCache.get(normalized);
  if (cachedDecimals !== undefined) {
    return cachedDecimals;
  }
  
  // Fallback to environment variables
  const decimalsKey = `NEXT_PUBLIC_${normalized}_DECIMALS`;
  const envDecimals = getEnvNumber(decimalsKey, TOKEN_FALLBACK_DECIMALS);
  
  // If we have a valid decimals from environment, return it
  if (envDecimals !== TOKEN_FALLBACK_DECIMALS) {
    return envDecimals;
  }
  
  // If we reach this point, throw an error
  throw new Error(`No decimals found for token: ${normalized}`);
}

export function getMakerTokenSymbol(pair: string, side: OrderSide): string {
  const [base, quote] = pair.split('/');
  if (!base || !quote) {
    throw new Error(`Invalid pair format: ${pair}`);
  }
  return side === 'sell' ? base : quote;
}

export function getTakerTokenSymbol(pair: string, side: OrderSide): string {
  const [base, quote] = pair.split('/');
  if (!base || !quote) {
    throw new Error(`Invalid pair format: ${pair}`);
  }
  return side === 'sell' ? quote : base;
}

export function getMakerTokenAddress(pair: string, side: OrderSide): string {
  return getTokenAddressForSymbol(getMakerTokenSymbol(pair, side));
}

export function getTakerTokenAddress(pair: string, side: OrderSide): string {
  return getTokenAddressForSymbol(getTakerTokenSymbol(pair, side));
}

export function getMakerTokenAddressFromOrder(order: RFQOrder): string {
  return getMakerTokenAddress(order.pair, order.side);
}

export function getTakerTokenAddressFromOrder(order: RFQOrder): string {
  return getTakerTokenAddress(order.pair, order.side);
}

/**
 * @deprecated Use getTokenMetadata() from wallet context instead of cache-based decimals
 * These functions may return stale or incorrect decimal values
 */
export function getMakerTokenDecimals(pair: string, side: OrderSide): number {
  console.warn('[DEPRECATED] getMakerTokenDecimals() - Use getTokenMetadata() from wallet context instead');
  return getTokenDecimalsForSymbol(getMakerTokenSymbol(pair, side));
}

/**
 * @deprecated Use getTokenMetadata() from wallet context instead of cache-based decimals
 * These functions may return stale or incorrect decimal values
 */
export function getTakerTokenDecimals(pair: string, side: OrderSide): number {
  console.warn('[DEPRECATED] getTakerTokenDecimals() - Use getTokenMetadata() from wallet context instead');
  return getTokenDecimalsForSymbol(getTakerTokenSymbol(pair, side));
}

/**
 * @deprecated Use getTokenMetadata() from wallet context instead of cache-based decimals
 * These functions may return stale or incorrect decimal values
 */
export function getMakerTokenDecimalsFromOrder(order: RFQOrder): number {
  console.warn('[DEPRECATED] getMakerTokenDecimalsFromOrder() - Use getTokenMetadata() from wallet context instead');
  return getMakerTokenDecimals(order.pair, order.side);
}

/**
 * @deprecated Use getTokenMetadata() from wallet context instead of cache-based decimals
 * These functions may return stale or incorrect decimal values
 */
export function getTakerTokenDecimalsFromOrder(order: RFQOrder): number {
  console.warn('[DEPRECATED] getTakerTokenDecimalsFromOrder() - Use getTokenMetadata() from wallet context instead');
  return getTakerTokenDecimals(order.pair, order.side);
}

function ensureNonNegativeInteger(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Decimals must be a non-negative integer');
  }
}

function normaliseAmountInput(
  amount: number | string,
  decimals: number,
): { isNegative: boolean; digits: string; fraction: string } {
  const raw = typeof amount === 'number' ? amount.toString() : amount;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error('Amount must be provided as a number or numeric string');
  }

  let trimmed = raw.trim();

  if (/e/i.test(trimmed)) {
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      throw new Error(`Invalid numeric amount: ${amount}`);
    }

    const precision = Math.min(Math.max(decimals + 4, 8), 24);
    trimmed = numeric.toFixed(precision).replace(/\.?0+$/, '');
  }

  const match = trimmed.match(/^(-?)(\d*)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid numeric amount: ${amount}`);
  }

  const [, sign, whole = '', fraction = ''] = match;
  return {
    isNegative: sign === '-',
    digits: whole.replace(/^0+(?=\d)/, '') || '0',
    fraction,
  };
}

export function toBaseUnits(amount: number | string, decimals: number): bigint {
  ensureNonNegativeInteger(decimals);
  const { isNegative, digits, fraction } = normaliseAmountInput(amount, decimals);

  if (isNegative) {
    throw new Error('Amounts must be positive for token transfers');
  }

  if (decimals === 0) {
    return BigInt(digits);
  }

  const paddedFraction = (fraction + '0'.repeat(decimals)).slice(0, decimals);
  const combined = `${digits}${paddedFraction}`;
  return BigInt(combined);
}

export function fromBaseUnits(amount: bigint, decimals: number): number {
  ensureNonNegativeInteger(decimals);

  if (decimals === 0) {
    return Number(amount);
  }

  const base = BigInt(10) ** BigInt(decimals);
  const whole = amount / base;
  const remainder = amount % base;
  const fraction = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
  const asString = fraction.length > 0 ? `${whole.toString()}.${fraction}` : whole.toString();
  return Number.parseFloat(asString);
}

/**
 * Validate that token metadata decimals match expected values
 * Used to ensure consistency between taker and maker transactions
 */
export async function validateTokenMetadataConsistency(
  tokenAddress: string,
  expectedDecimals: number,
  getTokenMetadata: (addr: string) => Promise<{ decimals: number; fieldType: 'decimalPlaces' | 'decimals' } | null>
): Promise<boolean> {
  try {
    const metadata = await getTokenMetadata(tokenAddress);
    if (!metadata) {
      console.warn('[validateTokenMetadataConsistency] No metadata found for token:', tokenAddress);
      return false;
    }
    
    const isConsistent = metadata.decimals === expectedDecimals;
    if (!isConsistent) {
      console.error('[validateTokenMetadataConsistency] Decimal mismatch:', {
        tokenAddress,
        expected: expectedDecimals,
        actual: metadata.decimals,
        fieldType: metadata.fieldType
      });
    }
    
    return isConsistent;
  } catch (error) {
    console.error('[validateTokenMetadataConsistency] Validation failed:', error);
    return false;
  }
}

interface TokenMetadata {
  decimalPlaces?: number;
  decimals?: number;
  displayName?: string;
  name?: string;
  symbol?: string;
  ticker?: string;
  kis?: {
    version?: string;
    icon?: TokenIcon;
  } | null;
  [key: string]: unknown;
}

export interface TokenIcon {
  type?: "badge" | "badge-square" | "image" | string;
  imageData?: string;
  mimeType?: string;
  svg?: string;
  letter?: string;
  bgColor?: string;
  textColor?: string;
  shape?: string;
  [key: string]: unknown;
}

export interface ProcessedToken {
  address: string;
  name: string;
  ticker: string;
  balance: string;
  formattedAmount: string;
  formattedUsdValue?: string;
  decimals: number;
  fieldType: TokenFieldType;
  isBaseToken: boolean;
  icon: string;
  fallbackIcon: TokenIcon | null;
  hasMetadata: boolean;
}

export interface TokenChipPresentation {
  iconUrl: string | null;
  fallback?: TokenIcon | null;
  ticker: string;
  name?: string;
}

export function getTokenChipPresentation(token: ProcessedToken): TokenChipPresentation {
  if (token.icon) {
    return {
      iconUrl: token.icon,
      fallback: token.fallbackIcon,
      ticker: token.ticker,
      name: token.name,
    };
  }

  if (token.fallbackIcon) {
    return {
      iconUrl: null,
      fallback: token.fallbackIcon,
      ticker: token.ticker,
      name: token.name,
    };
  }

  return {
    iconUrl: null,
    ticker: token.ticker,
    name: token.name,
  };
}

/**
 * Parse base64 encoded metadata
 */
function parseMetadata(metadata?: string | null): TokenMetadata | null {
  if (!metadata) return null;
  // Try base64 -> JSON first
  try {
    const decoded = atob(metadata);
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? (parsed as TokenMetadata) : null;
  } catch {}
  // Fallback: try plain JSON directly
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' ? (parsed as TokenMetadata) : null;
  } catch {}
  return null;
}

/**
 * Extract decimals and field type from token metadata
 */
export function extractDecimalsAndFieldType(metadata?: string | null): {
  decimals: number;
  fieldType: TokenFieldType;
  displayDecimals: number | null;
} {
  const metadataObj = parseMetadata(metadata);
  if (!metadataObj) {
    return { decimals: 0, fieldType: "decimals", displayDecimals: null };
  }

  const decimalsValue =
    typeof metadataObj.decimals === "number" && Number.isFinite(metadataObj.decimals)
      ? Math.max(0, Math.trunc(metadataObj.decimals))
      : null;
  const decimalPlacesValue =
    typeof metadataObj.decimalPlaces === "number" && Number.isFinite(metadataObj.decimalPlaces)
      ? Math.max(0, Math.trunc(metadataObj.decimalPlaces))
      : null;

  const decimals = decimalsValue ?? decimalPlacesValue ?? 0;
  const fieldType: TokenFieldType = decimalsValue !== null ? "decimals" : "decimalPlaces";
  const displayDecimals =
    decimalPlacesValue !== null
      ? decimalPlacesValue
      : decimalsValue !== null
        ? decimalsValue
        : null;

  return { decimals, fieldType, displayDecimals };
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(
  rawAmount: string | number | bigint,
  decimals = 0,
  fieldType: TokenFieldType = "decimals",
  displayDecimals?: number | null,
): string {
  const amount = BigInt(rawAmount);

  const normalizedDecimals = Math.max(decimals, 0);
  const normalizedDisplayDecimals =
    typeof displayDecimals === "number" && Number.isFinite(displayDecimals)
      ? Math.max(0, Math.trunc(displayDecimals))
      : normalizedDecimals;

  if (normalizedDecimals <= 0) {
    return amount.toString();
  }

  const divisor = BigInt(10) ** BigInt(normalizedDecimals);
  const isNegative = amount < BigInt(0);
  const absoluteAmount = isNegative ? -amount : amount;
  const quotient = absoluteAmount / divisor;
  const remainder = absoluteAmount % divisor;
  const signPrefix = isNegative ? "-" : "";

  if (remainder === BigInt(0)) {
    if (fieldType === "decimals") {
      if (normalizedDisplayDecimals <= 0) {
        return `${signPrefix}${quotient.toString()}`;
      }
      return `${signPrefix}${quotient.toString()}.${"0".repeat(normalizedDisplayDecimals)}`;
    }

    return `${signPrefix}${quotient.toString()}`;
  }

  let remainderStr = remainder.toString().padStart(normalizedDecimals, "0");

  if (normalizedDisplayDecimals < normalizedDecimals) {
    remainderStr = remainderStr.slice(0, normalizedDisplayDecimals);
  } else if (normalizedDisplayDecimals > normalizedDecimals) {
    remainderStr = remainderStr.padEnd(normalizedDisplayDecimals, "0");
  }

  if (fieldType === "decimals") {
    if (normalizedDisplayDecimals <= 0) {
      return `${signPrefix}${quotient.toString()}`;
    }
    return `${signPrefix}${quotient.toString()}.${remainderStr}`;
  }

  const trimmed = remainderStr.replace(/0+$/, "");
  if (trimmed.length === 0) {
    return `${signPrefix}${quotient.toString()}`;
  }

  return `${signPrefix}${quotient.toString()}.${trimmed}`;
}

/**
 * Format amount with commas for readability
 */
export function formatAmountWithCommas(amount: string | number | bigint): string {
  const [integerPart, decimalPart] = amount.toString().split(".");
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decimalPart) {
    // Remove trailing zeros from decimal part
    const trimmedDecimal = decimalPart.replace(/0+$/, "");
    return trimmedDecimal ? `${formattedInteger}.${trimmedDecimal}` : formattedInteger;
  }

  return formattedInteger;
}

/**
 * Get token display name from metadata
 */
export function getTokenDisplayName(metadata?: string | null): string {
  const metadataObj = parseMetadata(metadata);
  if (!metadataObj) return "";

  if (typeof metadataObj.displayName === "string") return metadataObj.displayName;
  if (typeof metadataObj.name === "string") return metadataObj.name;
  if (typeof metadataObj.symbol === "string") return metadataObj.symbol;

  return "";
}

/**
 * Get token ticker/symbol from metadata
 */
export function getTokenTicker(metadata?: string | null): string {
  const metadataObj = parseMetadata(metadata);
  if (!metadataObj) return "";

  if (typeof metadataObj.symbol === "string") return metadataObj.symbol;
  if (typeof metadataObj.ticker === "string") return metadataObj.ticker;
  if (typeof metadataObj.name === "string") return metadataObj.name;

  return "";
}

/**
 * Get token icon from metadata (Keeta Token Icon Standard - KIS)
 */
export function getTokenIconFromMetadata(metadata?: string | null): TokenIcon | null {
  const metadataObj = parseMetadata(metadata);
  if (!metadataObj) return null;

  const kis = metadataObj.kis;
  if (!kis || typeof kis !== "object") return null;

  const version = kis.version;
  const icon = kis.icon;

  if (version === "1.0" && icon && typeof icon === "object") {
    const type = icon.type;
    if (type === "badge" || type === "badge-square" || type === "image") {
      return icon;
    }
  }

  return null;
}

/**
 * Sanitize SVG markup to prevent XSS
 */
function sanitizeSvgMarkup(svg?: string): string | null {
  if (!svg) return null;

  // Check for dangerous patterns
  if (/<\s*script/i.test(svg)) return null;
  if (/\son[a-z0-9-]+\s*=/gi.test(svg)) return null;
  if (/\s(?:href|xlink:href)\s*=\s*['"]\s*javascript:/gi.test(svg)) return null;

  return svg;
}

/**
 * Generate a data URL for the token icon
 */
export function getTokenIconDataUrl(icon: TokenIcon | null | undefined): string {
  if (!icon) return "";

  // Handle image type
  if (icon.type === "image" && typeof icon.imageData === "string") {
    if (icon.imageData.startsWith("data:")) {
      return icon.imageData;
    }

    if (icon.mimeType && !icon.imageData.includes(",")) {
      return `data:${icon.mimeType};base64,${icon.imageData}`;
    }

    return "";
  }

  // Handle SVG
  if (typeof icon.svg === "string") {
    const sanitized = sanitizeSvgMarkup(icon.svg);
    if (!sanitized) return "";

    try {
      const base64 = btoa(sanitized);
      return `data:image/svg+xml;base64,${base64}`;
    } catch {
      return "";
    }
  }

  return "";
}

/**
 * Create a fallback badge icon
 */
export function createFallbackTokenIcon(symbol: string): TokenIcon {
  const letter = (symbol && symbol.length > 0 ? symbol.charAt(0) : '?').toUpperCase();

  // Color palette for badges
  const colors = [
    { bg: "#ff6b35", text: "#ffffff" }, // Orange
    { bg: "#007acc", text: "#ffffff" }, // Blue
    { bg: "#28a745", text: "#ffffff" }, // Green
    { bg: "#dc3545", text: "#ffffff" }, // Red
    { bg: "#ffc107", text: "#000000" }, // Yellow
    { bg: "#6f42c1", text: "#ffffff" }, // Purple
  ] as const;

  // Select color based on first character
  const charCode = letter.charCodeAt(0) || 0;
  const colorIndex = charCode % colors.length;
  const color = colors[colorIndex];

  return {
    type: "badge",
    letter,
    bgColor: color.bg,
    textColor: color.text,
    shape: "circle",
  } satisfies TokenIcon;
}

/**
 * Process token metadata for display
 */
export async function processTokenForDisplay(
  tokenAddress: string,
  balance: string | number | bigint,
  metadata: string | null | undefined,
  baseTokenAddress: string | null | undefined,
  price?: number,
): Promise<ProcessedToken> {
  const isBaseToken = Boolean(baseTokenAddress && tokenAddress === baseTokenAddress);

  const metadataName = metadata ? getTokenDisplayName(metadata) : "";
  const metadataTicker = metadata ? getTokenTicker(metadata) : "";
  const decimalInfo = extractDecimalsAndFieldType(metadata);

  let decimals = decimalInfo.decimals;
  let fieldType: TokenFieldType = decimalInfo.fieldType;
  let displayDecimals = decimalInfo.displayDecimals;

  if (decimals <= 0) {
    if (isBaseToken) {
      decimals = 9;
      fieldType = "decimalPlaces";
      displayDecimals = 9;
    } else {
      decimals = 0;
      fieldType = "decimals";
      displayDecimals = null;
    }
  }

  let name = metadataName || (isBaseToken ? "Keeta Token" : "");
  let ticker = metadataTicker ? metadataTicker.trim().toUpperCase() : (isBaseToken ? "KTA" : "");

  try {
    console.debug('[TOKENS] processTokenForDisplay:input', {
      tokenAddress,
      hasMetadata: Boolean(metadata),
      metadataName,
      metadataTicker,
      decimalsFromMetadata: decimalInfo.decimals,
      fieldTypeFromMetadata: decimalInfo.fieldType,
      displayDecimalsFromMetadata: decimalInfo.displayDecimals,
      isBaseToken,
      rawBalance: typeof balance === 'bigint' ? balance.toString() : String(balance),
    });
  } catch {}

  const formattedAmount = formatTokenAmount(balance, decimals, fieldType, displayDecimals);
  const displayAmount = formatAmountWithCommas(formattedAmount);
  let formattedUsdValue: string | undefined;
  if (price) {
    const numericAmount = Number(formattedAmount.replace(/,/g, ""));
    if (Number.isFinite(numericAmount)) {
      const usdAmount = numericAmount * price;
      formattedUsdValue = formatAmountWithCommas(usdAmount.toFixed(2));
    }
  }

  const iconFromMetadata = metadata ? getTokenIconFromMetadata(metadata) : null;
  let iconDataUrl = iconFromMetadata ? getTokenIconDataUrl(iconFromMetadata) : "";
  let fallbackIcon: TokenIcon | null = null;

  if (!iconDataUrl && iconFromMetadata) {
    fallbackIcon = iconFromMetadata;
  }

  if (!iconDataUrl && !fallbackIcon) {
    if (isBaseToken) {
      iconDataUrl = "/icons/TLEOfKos_400x400.jpg";
    } else if (ticker) {
      fallbackIcon = createFallbackTokenIcon(ticker);
    }
  }

  try {
    console.debug('[TOKENS] processTokenForDisplay:output', {
      tokenAddress,
      name,
      ticker,
      decimals,
      fieldType,
      displayDecimals,
      formattedAmount: displayAmount,
      hasIcon: Boolean(iconDataUrl),
      hasFallbackIcon: Boolean(fallbackIcon),
    });
  } catch {}

  return {
    address: tokenAddress,
    name,
    ticker,
    balance: balance.toString(),
    formattedAmount: displayAmount,
    formattedUsdValue,
    decimals,
    fieldType,
    isBaseToken,
    icon: iconDataUrl,
    fallbackIcon,
    hasMetadata: Boolean(metadata && (metadataName || metadataTicker || iconFromMetadata)),
  };
}
