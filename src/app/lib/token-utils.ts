/**
 * Token Utilities for Website
 * Simplified version based on extension wallet patterns
 */

export type TokenFieldType = "decimalPlaces" | "decimals";

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
  decimals: number;
  fieldType: TokenFieldType;
  isBaseToken: boolean;
  icon: string;
  fallbackIcon: TokenIcon | null;
  hasMetadata: boolean;
}

/**
 * Parse base64 encoded metadata
 */
function parseMetadata(metadata?: string | null): TokenMetadata | null {
  if (!metadata) return null;
  try {
    const metadataJson = atob(metadata);
    const parsed = JSON.parse(metadataJson);
    return typeof parsed === "object" && parsed !== null ? (parsed as TokenMetadata) : null;
  } catch {
    return null;
  }
}

/**
 * Extract decimals and field type from token metadata
 */
export function extractDecimalsAndFieldType(metadata?: string | null): { decimals: number; fieldType: TokenFieldType } {
  const metadataObj = parseMetadata(metadata);
  if (!metadataObj) return { decimals: 0, fieldType: "decimals" };

  // Check decimalPlaces first (higher priority)
  if (typeof metadataObj.decimalPlaces === "number") {
    return { decimals: metadataObj.decimalPlaces, fieldType: "decimalPlaces" };
  }

  // Fallback to decimals
  if (typeof metadataObj.decimals === "number") {
    return { decimals: metadataObj.decimals, fieldType: "decimals" };
  }

  return { decimals: 0, fieldType: "decimals" };
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(rawAmount: string | number | bigint, decimals = 0, fieldType: TokenFieldType = "decimals"): string {
  const amount = BigInt(rawAmount);

  if (decimals === 0) {
    return amount.toString();
  }

  if (fieldType === "decimalPlaces") {
    // decimalPlaces: divide by 10^decimalPlaces
    const divisor = BigInt(10) ** BigInt(decimals);
    const quotient = amount / divisor;
    const remainder = amount % divisor;

    if (remainder === 0n) {
      return quotient.toString();
    }

    // Format with proper decimal places
    const remainderStr = remainder.toString().padStart(decimals, "0");
    const displayFractional = remainderStr.replace(/0+$/, "");

    if (displayFractional === "") {
      return quotient.toString();
    }

    return `${quotient}.${displayFractional}`;
  }

  // decimals: add decimal padding (no division)
  const amountStr = amount.toString();
  return `${amountStr}.${"0".repeat(decimals)}`;
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
  const letter = symbol.charAt(0).toUpperCase();

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
  const charCode = letter.charCodeAt(0);
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
): Promise<ProcessedToken> {
  // Check if this is the base token (KTA)
  const isBaseToken = Boolean(baseTokenAddress && tokenAddress === baseTokenAddress);

  let decimals = 9; // Default for KTA
  let fieldType: TokenFieldType = "decimalPlaces";
  let name = "Unknown Token";
  let ticker = "";

  if (isBaseToken) {
    name = "Keeta Token";
    ticker = "KTA";
  } else if (metadata) {
    // Extract metadata
    const decimalInfo = extractDecimalsAndFieldType(metadata);
    decimals = decimalInfo.decimals;
    fieldType = decimalInfo.fieldType;

    name = getTokenDisplayName(metadata) || `Token ${tokenAddress.slice(-8)}`;
    ticker = getTokenTicker(metadata) || tokenAddress.slice(-4).toUpperCase();
  } else {
    // Fallback for tokens without metadata
    name = `Token ${tokenAddress.slice(-8)}`;
    ticker = tokenAddress.slice(-4).toUpperCase();
  }

  // Format the amount
  const formattedAmount = formatTokenAmount(balance, decimals, fieldType);
  const displayAmount = formatAmountWithCommas(formattedAmount);

  // Get icon
  let iconDataUrl = "";
  let fallbackIcon: TokenIcon | null = null;

  if (isBaseToken) {
    // Use the Keeta logo for KTA base token
    iconDataUrl = "/icons/TLEOfKos_400x400.jpg";
  } else {
    const icon = metadata ? getTokenIconFromMetadata(metadata) : null;
    iconDataUrl = icon ? getTokenIconDataUrl(icon) : "";
    fallbackIcon = icon ? null : createFallbackTokenIcon(ticker);
  }

  return {
    address: tokenAddress,
    name,
    ticker,
    balance: balance.toString(),
    formattedAmount: displayAmount,
    decimals,
    fieldType,
    isBaseToken,
    icon: iconDataUrl,
    fallbackIcon,
    hasMetadata: Boolean(metadata && ticker && name),
  };
}

