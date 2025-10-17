import type { OperationDetail } from "../types/dapp-requests";

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

type TokenMetadataInput = TokenMetadata | string | null | undefined;

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

export interface OperationTokenDisplay {
  formattedAmount: string | null;
  symbol: string | null;
  name: string | null;
  iconUrl: string | null;
  fallbackIcon: TokenIcon | null;
  decimals: number;
  fieldType: TokenFieldType;
  displayDecimals: number | null;
}

export interface OperationTokenDisplayContext {
  requestMetadata?: Record<string, unknown> | null | undefined;
  additionalSources?: unknown[];
}

function safeAtob(value: string): string {
  if (typeof value !== "string") {
    return "";
  }

  if (typeof globalThis.atob === "function") {
    try {
      return globalThis.atob(value);
    } catch {
      return "";
    }
  }

  try {
    return Buffer.from(value, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function safeBtoa(value: string): string {
  if (typeof value !== "string") {
    return "";
  }

  if (typeof globalThis.btoa === "function") {
    try {
      return globalThis.btoa(value);
    } catch {
      return "";
    }
  }

  try {
    return Buffer.from(value, "utf-8").toString("base64");
  } catch {
    return "";
  }
}

function parseMetadata(metadata?: TokenMetadataInput): TokenMetadata | null {
  if (!metadata) {
    return null;
  }

  if (typeof metadata === "object") {
    if (Array.isArray(metadata)) {
      return null;
    }
    return metadata as TokenMetadata;
  }

  if (typeof metadata !== "string") {
    return null;
  }

  const trimmed = metadata.trim();
  if (!trimmed) {
    return null;
  }

  const decoded = safeAtob(trimmed);
  const attempts = decoded ? [decoded, trimmed] : [trimmed];

  for (const candidate of attempts) {
    if (!candidate) {
      continue;
    }

    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as TokenMetadata;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function extractDecimalsAndFieldType(metadata?: TokenMetadataInput): {
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

export function formatAmountWithCommas(amount: string | number | bigint): string {
  const [integerPart, decimalPart] = amount.toString().split(".");
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decimalPart) {
    const trimmed = decimalPart.replace(/0+$/, "");
    return trimmed.length > 0 ? `${formattedInteger}.${trimmed}` : formattedInteger;
  }

  return formattedInteger;
}

export function getTokenDisplayName(metadata?: TokenMetadataInput): string {
  const metadataObj = parseMetadata(metadata);
  if (!metadataObj) {
    return "";
  }

  if (typeof metadataObj.displayName === "string") {
    return metadataObj.displayName;
  }

  if (typeof metadataObj.name === "string") {
    return metadataObj.name;
  }

  if (typeof metadataObj.symbol === "string") {
    return metadataObj.symbol;
  }

  return "";
}

export function getTokenTicker(metadata?: TokenMetadataInput): string {
  const metadataObj = parseMetadata(metadata);
  if (!metadataObj) {
    return "";
  }

  if (typeof metadataObj.symbol === "string") {
    return metadataObj.symbol;
  }

  if (typeof metadataObj.ticker === "string") {
    return metadataObj.ticker;
  }

  if (typeof metadataObj.name === "string") {
    return metadataObj.name;
  }

  return "";
}

function sanitizeSvgMarkup(svg?: string): string | null {
  if (!svg || typeof svg !== "string") {
    return null;
  }

  if (/<\s*script/i.test(svg)) {
    return null;
  }

  if (/\son[a-z0-9-]+\s*=/gi.test(svg)) {
    return null;
  }

  if (/\s(?:href|xlink:href)\s*=\s*['"]\s*javascript:/gi.test(svg)) {
    return null;
  }

  return svg;
}

export function getTokenIconFromMetadata(metadata?: TokenMetadataInput): TokenIcon | null {
  const metadataObj = parseMetadata(metadata);
  if (!metadataObj) {
    return null;
  }

  const kis = metadataObj.kis;
  if (!kis || typeof kis !== "object") {
    return null;
  }

  const { version, icon } = kis as { version?: string; icon?: TokenIcon };
  if (version === "1.0" && icon && typeof icon === "object") {
    const type = icon.type;
    if (type === "badge" || type === "badge-square" || type === "image") {
      return icon;
    }
  }

  return null;
}

export function getTokenIconDataUrl(icon: TokenIcon | null | undefined): string {
  if (!icon) {
    return "";
  }

  if (icon.type === "image" && typeof icon.imageData === "string") {
    if (icon.imageData.startsWith("data:")) {
      return icon.imageData;
    }

    if (icon.mimeType && !icon.imageData.includes(",")) {
      return `data:${icon.mimeType};base64,${icon.imageData}`;
    }

    return "";
  }

  const remoteUrl =
    typeof icon.url === "string"
      ? icon.url
      : typeof icon.href === "string"
        ? icon.href
        : undefined;

  if (remoteUrl) {
    const trimmed = remoteUrl.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (typeof icon.svg === "string") {
    const sanitized = sanitizeSvgMarkup(icon.svg);
    if (!sanitized) {
      return "";
    }

    const encoded = safeBtoa(sanitized);
    return encoded ? `data:image/svg+xml;base64,${encoded}` : "";
  }

  return "";
}

export function createFallbackTokenIcon(symbol: string): TokenIcon {
  const letter = symbol.charAt(0).toUpperCase() || "?";
  const colors = [
    { bg: "#ff6b35", text: "#ffffff" },
    { bg: "#007acc", text: "#ffffff" },
    { bg: "#28a745", text: "#ffffff" },
    { bg: "#dc3545", text: "#ffffff" },
    { bg: "#ffc107", text: "#000000" },
    { bg: "#6f42c1", text: "#ffffff" },
  ] as const;

  const index = letter.charCodeAt(0) % colors.length;
  const color = colors[index];

  return {
    type: "badge",
    letter,
    bgColor: color.bg,
    textColor: color.text,
    shape: "circle",
  } satisfies TokenIcon;
}

interface RawAmountResult {
  raw: bigint | null;
  decimalString: string | null;
}

function extractRawAmount(value: unknown, depth = 0): RawAmountResult | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "bigint") {
    return { raw: value, decimalString: null };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return { raw: BigInt(Math.trunc(value)), decimalString: null };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^-?\d+$/.test(trimmed)) {
      try {
        return { raw: BigInt(trimmed), decimalString: null };
      } catch {
        return null;
      }
    }

    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      return { raw: null, decimalString: trimmed };
    }

    return null;
  }

  if (typeof value !== "object" || depth > 3) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = extractRawAmount(item, depth + 1);
      if (result) {
        return result;
      }
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const nestedKeys = ["raw", "value", "amount", "amountRaw", "quantity", "baseUnits"];

  for (const key of nestedKeys) {
    if (!Object.hasOwn(record, key)) {
      continue;
    }

    const nested = record[key];
    const result = extractRawAmount(nested, depth + 1);
    if (result) {
      return result;
    }
  }

  return null;
}

const RAW_AMOUNT_KEYS = [
  "rawAmount",
  "amountRaw",
  "tokenAmount",
  "tokenAmountRaw",
  "quantityRaw",
  "baseUnits",
  "valueRaw",
  "amount",
  "value",
];

const DECIMAL_PLACES_KEYS = [
  "decimalPlaces",
  "tokenDecimalPlaces",
  "precision",
  "scale",
];

const DECIMALS_KEYS = [
  "decimals",
  "tokenDecimals",
  "fractionalDigits",
];

const METADATA_KEYS = [
  "tokenMetadata",
  "metadata",
  "kisMetadata",
  "encodedMetadata",
  "metadataBase64",
];

const SYMBOL_KEYS = [
  "tokenSymbol",
  "symbol",
  "ticker",
  "assetSymbol",
];

const NAME_KEYS = [
  "tokenName",
  "name",
  "displayName",
];

const BASE_TOKEN_KEYS = [
  "isBaseToken",
  "isNative",
  "isBase",
];

function gatherCandidates(
  operation: OperationDetail,
  additionalSources: unknown[] = [],
): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const queue: Record<string, unknown>[] = [];
  const visited = new Set<unknown>();

  const enqueue = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }

    if (visited.has(value)) {
      return;
    }

    visited.add(value);
    queue.push(value as Record<string, unknown>);
  };

  enqueue(operation as Record<string, unknown>);
  enqueue(operation.metadata);

  for (const source of additionalSources) {
    enqueue(source);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    results.push(current);

    for (const key of Object.keys(current)) {
      const child = current[key];
      if (!child || typeof child !== "object") {
        continue;
      }

      if (Array.isArray(child)) {
        for (const item of child) {
          enqueue(item);
        }
      } else {
        enqueue(child);
      }
    }
  }

  return results;
}

function findFirstString(candidates: Record<string, unknown>[], keys: readonly string[]): string | undefined {
  for (const candidate of candidates) {
    for (const key of keys) {
      if (!Object.hasOwn(candidate, key)) {
        continue;
      }

      const value = candidate[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return undefined;
}

function collectMetadataCandidates(
  candidates: Record<string, unknown>[],
  keys: readonly string[],
): TokenMetadataInput[] {
  const results: TokenMetadataInput[] = [];

  for (const candidate of candidates) {
    for (const key of keys) {
      if (!Object.hasOwn(candidate, key)) {
        continue;
      }

      const value = candidate[key];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          results.push(trimmed);
        }
      }

      if (value && typeof value === "object") {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === "object" && !Array.isArray(item)) {
              results.push(item as TokenMetadata);
            }
          }
        } else {
          results.push(value as TokenMetadata);
        }
      }
    }
  }

  return results;
}

function collectStringsByKeys(
  candidates: Record<string, unknown>[],
  keys: readonly string[],
): string[] {
  const results = new Set<string>();

  for (const candidate of candidates) {
    for (const key of keys) {
      if (!Object.hasOwn(candidate, key)) {
        continue;
      }

      const value = candidate[key];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          results.add(trimmed);
        }
      }
    }
  }

  return Array.from(results);
}

function findFirstNumber(candidates: Record<string, unknown>[], keys: readonly string[]): number | undefined {
  for (const candidate of candidates) {
    for (const key of keys) {
      if (!Object.hasOwn(candidate, key)) {
        continue;
      }

      const value = candidate[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number.parseInt(value.trim(), 10);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
  }

  return undefined;
}

function findFirstBoolean(candidates: Record<string, unknown>[], keys: readonly string[]): boolean | undefined {
  for (const candidate of candidates) {
    for (const key of keys) {
      if (!Object.hasOwn(candidate, key)) {
        continue;
      }

      const value = candidate[key];
      if (typeof value === "boolean") {
        return value;
      }

      if (typeof value === "string") {
        if (/^(true|yes|1)$/i.test(value.trim())) {
          return true;
        }
        if (/^(false|no|0)$/i.test(value.trim())) {
          return false;
        }
      }
    }
  }

  return undefined;
}

function findFormattedAmountCandidate(candidates: Record<string, unknown>[]): string | undefined {
  const keys = ["formattedAmount", "displayAmount", "display", "prettyAmount"];
  for (const candidate of candidates) {
    for (const key of keys) {
      if (!Object.hasOwn(candidate, key)) {
        continue;
      }

      const value = candidate[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return undefined;
}

export function deriveOperationTokenDisplay(
  operation: OperationDetail,
  context?: OperationTokenDisplayContext,
): OperationTokenDisplay {
  const additionalSources: unknown[] = [];

  if (context?.requestMetadata) {
    additionalSources.push(context.requestMetadata);
  }

  if (Array.isArray(context?.additionalSources)) {
    for (const source of context.additionalSources) {
      additionalSources.push(source);
    }
  }

  const operationCandidates = gatherCandidates(operation);
  const candidates = gatherCandidates(operation, additionalSources);
  const metadataCandidates = collectMetadataCandidates(candidates, METADATA_KEYS);
  const operationSymbols = new Set(
    collectStringsByKeys(operationCandidates, SYMBOL_KEYS).map((value) => value.toUpperCase()),
  );

  if (typeof operation.tokenSymbol === "string" && operation.tokenSymbol.trim().length > 0) {
    operationSymbols.add(operation.tokenSymbol.trim().toUpperCase());
  }

  let metadataCandidate: TokenMetadataInput | undefined = metadataCandidates[0];

  if (metadataCandidates.length > 1 && operationSymbols.size > 0) {
    const matched = metadataCandidates.find((metadata) => {
      const ticker = getTokenTicker(metadata);
      return ticker ? operationSymbols.has(ticker.trim().toUpperCase()) : false;
    });

    if (matched) {
      metadataCandidate = matched;
    }
  }

  const {
    decimals: metadataDecimals,
    fieldType: metadataFieldType,
    displayDecimals: metadataDisplayDecimals,
  } = extractDecimalsAndFieldType(metadataCandidate);

  const decimalPlacesOverride = findFirstNumber(candidates, DECIMAL_PLACES_KEYS);
  const decimalsOverride = findFirstNumber(candidates, DECIMALS_KEYS);

  let decimals = metadataDecimals;
  let fieldType: TokenFieldType = metadataFieldType;
  let displayDecimals: number | null = metadataDisplayDecimals;

  const hasDecimalsOverride = typeof decimalsOverride === "number" && Number.isFinite(decimalsOverride);
  if (hasDecimalsOverride) {
    decimals = Math.max(0, Math.trunc(decimalsOverride));
    fieldType = "decimals";
    if (displayDecimals === null) {
      displayDecimals = decimals;
    }
  }

  if (typeof decimalPlacesOverride === "number" && Number.isFinite(decimalPlacesOverride)) {
    const normalized = Math.max(0, Math.trunc(decimalPlacesOverride));
    displayDecimals = normalized;
    if (!hasDecimalsOverride && fieldType === "decimalPlaces") {
      decimals = normalized;
      fieldType = "decimalPlaces";
    }
  }

  if (displayDecimals === null && decimals > 0) {
    displayDecimals = decimals;
  }


  const rawAmountResult = (() => {
    for (const candidate of candidates) {
      for (const key of RAW_AMOUNT_KEYS) {
        if (!Object.hasOwn(candidate, key)) {
          continue;
        }

        const value = candidate[key];
        const extracted = extractRawAmount(value);
        if (extracted) {
          return extracted;
        }
      }
    }
    return { raw: null, decimalString: null } satisfies RawAmountResult;
  })();

  let formattedAmount: string | null = null;

  if (rawAmountResult.raw !== null) {
    try {
      const normalized = formatTokenAmount(rawAmountResult.raw, decimals, fieldType, displayDecimals);
      formattedAmount = formatAmountWithCommas(normalized);
      
      // Debug logging for BASE token result
      if (operation.tokenSymbol === 'BASE') {
        console.log('[token-display] BASE token result:', {
          normalized,
          formattedAmount
        });
      }
    } catch (error) {
      console.warn("[token-display] Failed to format raw amount", error);
    }
  } else if (rawAmountResult.decimalString) {
    formattedAmount = formatAmountWithCommas(rawAmountResult.decimalString);
  } else {
    const formattedCandidate = findFormattedAmountCandidate(candidates);
    if (formattedCandidate) {
      formattedAmount = formattedCandidate;
    } else if (typeof operation.amount === "string" && operation.amount.trim().length > 0) {
      const trimmed = operation.amount.trim();
      if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
        formattedAmount = formatAmountWithCommas(trimmed);
      } else {
        formattedAmount = trimmed;
      }
    }
  }

  const symbolCandidate =
    findFirstString(operationCandidates, SYMBOL_KEYS) ?? findFirstString(candidates, SYMBOL_KEYS);
  const metadataTicker = metadataCandidate ? getTokenTicker(metadataCandidate) : "";
  const symbol = symbolCandidate || (metadataTicker ? metadataTicker : operation.tokenSymbol) || null;

  // Special handling for BASE token - ensure it has 1 decimal place
  if (operation.tokenSymbol === 'BASE' || symbol === 'BASE') {
    if (decimals === 0) {
      decimals = 1;
      fieldType = "decimalPlaces";
      console.log('[token-display] Applied BASE token decimal fix:', { decimals, fieldType });
    }
  }

  const nameCandidate = findFirstString(candidates, NAME_KEYS);
  const metadataName = metadataCandidate ? getTokenDisplayName(metadataCandidate) : "";
  const name = nameCandidate || metadataName || symbol || null;

  let iconUrl = "";
  let fallbackIcon: TokenIcon | null = null;

  const icon = metadataCandidate ? getTokenIconFromMetadata(metadataCandidate) : null;
  if (icon) {
    iconUrl = getTokenIconDataUrl(icon);
    fallbackIcon = iconUrl ? null : icon;
  }

  if (!iconUrl) {
    const isBaseToken = findFirstBoolean(candidates, BASE_TOKEN_KEYS);
    if (isBaseToken) {
      iconUrl = "/icons/TLEOfKos_400x400.jpg";
    }
  }

  if (!iconUrl && !fallbackIcon) {
    const fallbackSymbol = symbol || name || "?";
    fallbackIcon = createFallbackTokenIcon(fallbackSymbol);
  }

  return {
    formattedAmount,
    symbol,
    name,
    iconUrl: iconUrl || null,
    fallbackIcon,
    decimals,
    fieldType,
    displayDecimals,
  } satisfies OperationTokenDisplay;
}
