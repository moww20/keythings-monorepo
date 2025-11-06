import { z } from "zod";
import { processTokenMetadata, formatTokenAmount, parseTokenMetadata, type TokenInfo } from './token-metadata';
import { normalizeHistoryRecords, groupOperationsByBlock, type CachedTokenMeta } from "@/lib/history/provider-history";
import type { ExplorerOperation } from "@/lib/explorer/client";

// Define the operation types used in Keeta network
export type ExplorerOperationType = 
  | "SEND" 
  | "RECEIVE" 
  | "SWAP" 
  | "SWAP_FORWARD" 
  | "TOKEN_ADMIN_SUPPLY" 
  | "TOKEN_ADMIN_MODIFY_BALANCE"
  | "UNKNOWN";

// Define the operation type labels mapping
const OPERATION_TYPE_LABELS: Record<string, string> = {
  "SEND": "Send",
  "RECEIVE": "Receive", 
  "SWAP": "Swap",
  "SWAP_FORWARD": "Swap Forward",
  "TOKEN_ADMIN_SUPPLY": "Token Admin Supply",
  "TOKEN_ADMIN_MODIFY_BALANCE": "Token Admin Modify Balance",
  "UNKNOWN": "Unknown"
};

// Unified Recent Activity item used by the Account page
export interface RecentActivityItem {
  id: string;
  block: string;
  timestamp: number;
  type: string;
  amount: string;
  formattedAmount?: string;
  rawAmount?: string;
  from: string;
  to: string;
  token: string;
  tokenTicker?: string | null;
  tokenDecimals?: number | null;
  operationType: string;
  tokenMetadata?: {
    name?: string;
    ticker?: string;
    decimals?: number;
  } | null;
}

type NormalizedTokenMeta = {
  ticker?: string;
  name?: string;
  decimals?: number | null;
  fieldType?: "decimalPlaces" | "decimals";
  metadata?: string;
};

function decodeMetadataBase64(value: string): unknown {
  try {
    if (typeof globalThis.atob === "function") {
      const decoded = globalThis.atob(value);
      return JSON.parse(decoded);
    }
  } catch {}
  try {
    if (typeof globalThis.Buffer !== "undefined") {
      const decoded = globalThis.Buffer.from(value, "base64").toString("utf8");
      return JSON.parse(decoded);
    }
  } catch {}
  return null;
}

function normalizeTokenMetadataValue(candidate: unknown): NormalizedTokenMeta | null {
  if (!candidate) return null;
  if (typeof candidate === "string") {
    const parsed = parseTokenMetadata(candidate);
    if (parsed) {
      return {
        ticker: parsed.ticker ?? undefined,
        name: parsed.name ?? undefined,
        decimals: typeof parsed.decimals === "number" ? parsed.decimals : undefined,
        fieldType: parsed.fieldType ?? undefined,
        metadata: parsed.metadata ?? candidate,
      };
    }
    const decoded = decodeMetadataBase64(candidate);
    if (decoded && typeof decoded === "object") {
      const normalized = normalizeTokenMetadataValue(decoded);
      return normalized ? { ...normalized, metadata: candidate } : { metadata: candidate };
    }
    return { metadata: candidate };
  }
  if (typeof candidate === "object") {
    const obj = candidate as Record<string, unknown>;
    const nestedMeta = typeof obj.metadata === "string" ? normalizeTokenMetadataValue(obj.metadata) : null;
    const decimals =
      typeof obj.decimals === "number" && Number.isFinite(obj.decimals)
        ? obj.decimals
        : typeof obj.decimalPlaces === "number" && Number.isFinite(obj.decimalPlaces)
          ? obj.decimalPlaces
          : nestedMeta?.decimals;
    const fieldType =
      typeof obj.fieldType === "string" && (obj.fieldType === "decimalPlaces" || obj.fieldType === "decimals")
        ? obj.fieldType
        : typeof obj.decimalPlaces === "number"
          ? "decimalPlaces"
          : nestedMeta?.fieldType;
    const ticker =
      typeof obj.ticker === "string"
        ? obj.ticker
        : typeof obj.symbol === "string"
          ? obj.symbol
          : typeof obj.currencyCode === "string"
            ? obj.currencyCode
            : nestedMeta?.ticker;
    const name =
      typeof obj.name === "string"
        ? obj.name
        : typeof obj.displayName === "string"
          ? obj.displayName
          : nestedMeta?.name;

    return {
      ticker: ticker ?? undefined,
      name: name ?? undefined,
      decimals: typeof decimals === "number" ? decimals : nestedMeta?.decimals ?? undefined,
      fieldType: (fieldType ?? nestedMeta?.fieldType) as "decimalPlaces" | "decimals" | undefined,
      metadata: nestedMeta?.metadata ?? (typeof obj.metadata === "string" ? obj.metadata : undefined),
    };
  }
  return null;
}

function deriveTokenDetails(amountRaw: string, tokenAddress: string, metadataCandidates: unknown[]): {
  formattedAmount: string;
  ticker: string | null;
  decimals: number | null;
  metadata: NormalizedTokenMeta | null;
} {
  const meta = metadataCandidates.reduce<NormalizedTokenMeta | null>((acc, candidate) => {
    return acc ?? normalizeTokenMetadataValue(candidate);
  }, null);

  const decimals =
    meta && typeof meta.decimals === "number" && Number.isFinite(meta.decimals) && meta.decimals >= 0
      ? meta.decimals
      : null;

  const fieldType: "decimalPlaces" | "decimals" = meta?.fieldType === "decimalPlaces" ? "decimalPlaces" : "decimals";
  const fallbackTicker = tokenAddress ? tokenAddress.slice(0, 6).toUpperCase() : "UNKNOWN";
  const ticker = meta?.ticker ?? meta?.name ?? fallbackTicker;

  let formattedAmount: string | undefined;
  if (decimals !== null) {
    try {
      const amountBigInt = toBigIntSafe(amountRaw);
      formattedAmount = formatTokenAmount(amountBigInt, decimals, fieldType, ticker ?? "UNKNOWN");
    } catch {
      formattedAmount = undefined;
    }
  }

  if (!formattedAmount) {
    formattedAmount = ticker ? `${amountRaw} ${ticker}` : amountRaw;
  }

  return {
    formattedAmount,
    ticker: ticker ?? null,
    decimals,
    metadata: meta,
  };
}

// Raw record as returned by wallet history APIs
// Be permissive and normalize to RecentActivityItem
const KeetaHistoryRecordSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    block: z.string().optional(),
    hash: z.string().optional(),
    timestamp: z.union([z.number(), z.string()]).optional(),
    type: z.union([z.string(), z.number()]).optional(),
    amount: z.union([z.string(), z.number(), z.bigint()]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    token: z.union([z.string(), z.object({ publicKeyString: z.any().optional() }).passthrough()]).optional(),
    operationType: z.union([z.string(), z.number()]).optional(),
    // Alternate/nested fields observed in other Keeta clients
    toAccount: z.string().optional(),
    recipient: z.string().optional(),
    source: z.string().optional(),
    dest: z.string().optional(),
    destination: z.string().optional(),
    tokenAddress: z.string().optional(),
    asset: z.string().optional(),
    currency: z.string().optional(),
    operation: z.record(z.string(), z.unknown()).optional(),
    operationSend: z.record(z.string(), z.unknown()).optional(),
    operationReceive: z.record(z.string(), z.unknown()).optional(),
    operationForward: z.record(z.string(), z.unknown()).optional(),
    tokenMetadata: z
      .object({
        name: z.string().optional(),
        ticker: z.string().optional(),
        decimals: z.number().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

const KeetaHistoryResponseSchema = z
  .object({
    records: z.array(KeetaHistoryRecordSchema),
    cursor: z.string().nullable().optional(),
    hasMore: z.boolean().optional(),
  })
  .passthrough();

function toStringSafe(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return fallback;
}

function toTimestampMs(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    // Try number first
    const n = Number(value);
    if (Number.isFinite(n)) return n;
    // Try Date parsing
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return fallback;
}

function normalizeAddress(value: unknown, depth = 0): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (depth > 4) {
    return "";
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = normalizeAddress(entry, depth + 1);
      if (resolved) {
        return resolved;
      }
    }
    return "";
  }

  if (typeof value !== "object") {
    return "";
  }

  try {
    const obj = value as Record<string, unknown> & {
      publicKeyString?: unknown;
      get?: () => unknown;
      toString?: () => string;
    };

    const candidateKeys = [
      "publicKeyString",
      "publicKey",
      "address",
      "account",
      "token",
      "tokenAccount",
      "tokenAddress",
      "tokenPublicKey",
      "tokenId",
      "value",
      "id",
      "$hash",
      "hash",
    ];

    for (const key of candidateKeys) {
      if (!(key in obj)) {
        continue;
      }
      const resolved = normalizeAddress(obj[key], depth + 1);
      if (resolved) {
        return resolved;
      }
    }

    if (typeof obj.publicKeyString === "object" && obj.publicKeyString !== null) {
      const resolved = normalizeAddress(obj.publicKeyString, depth + 1);
      if (resolved) {
        return resolved;
      }
    }

    if (typeof obj.get === "function") {
      const candidate = obj.get();
      const resolved = typeof candidate === "string"
        ? candidate
        : normalizeAddress(candidate, depth + 1);
      if (resolved && resolved !== "[object Object]") {
        return resolved;
      }
    }

    if (typeof obj.toString === "function") {
      const result = String(obj.toString()).trim();
      if (result.length > 0 && result !== "[object Object]") {
        return result;
      }
    }
  } catch {}

  return "";
}

function mapOpCodeToLabel(op: string): string | null {
  // Provisional mapping; adjust if docs specify codes differently
  switch (op) {
    case "0":
      return "SEND";
    case "1":
      return "RECEIVE";
    case "2":
      return "SWAP";
    case "3":
      return "SWAP_FORWARD";
    case "4":
      return "TOKEN_ADMIN_SUPPLY";
    case "5":
      return "TOKEN_ADMIN_MODIFY_BALANCE";
    default:
      return null;
  }
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    const s = toStringSafe(v).trim();
    if (s) return s;
  }
  return "";
}

function deriveTypeLabel(typeValue: unknown, opTypeValue: unknown, account?: string, from?: string, to?: string, hasSwapHints?: boolean): string {
  const typeStr = toStringSafe(typeValue).trim();
  // If typeStr looks like a numeric code, try mapping it first
  if (/^\d+$/.test(typeStr)) {
    const m = mapOpCodeToLabel(typeStr);
    if (m) return m;
  }
  if (typeStr) return typeStr.toUpperCase();
  const opStr = toStringSafe(opTypeValue).trim();
  const mapped = mapOpCodeToLabel(opStr);
  if (mapped) return mapped;
  if (hasSwapHints) return "SWAP";
  if (account) {
    if (from && from === account && (!to || to !== account)) return "SEND";
    if (to && to === account && (!from || from !== account)) return "RECEIVE";
  }
  return opStr || "Transaction";
}

export function normalizeHistoryRecord(input: unknown, contextAccount?: string): RecentActivityItem | null {
  const parsed = KeetaHistoryRecordSchema.safeParse(input);
  if (!parsed.success) return null;
  const r = parsed.data;

  const block = toStringSafe(r.block) || toStringSafe(r.hash);
  const timestamp = toTimestampMs(r.timestamp, Date.now());
  const id = toStringSafe(r.id) || block || `${timestamp}`;

  // Extract participants and token from multiple possible locations
  const from = normalizeAddress(
    r.from ?? r.operation?.from ?? r.operationSend?.from ?? r.operationReceive?.from ?? r.operationForward?.from ?? r.source ?? (r as any).src,
  );
  const to = normalizeAddress(
    r.to ?? r.operation?.to ?? r.operationSend?.to ?? r.operationReceive?.to ?? r.operationForward?.forward ?? r.toAccount ?? r.recipient ?? r.dest ?? r.destination,
  );
  const token = normalizeAddress(
    r.token ?? r.operation?.token ?? r.operationSend?.token ?? r.operationReceive?.token ?? r.tokenAddress ?? r.asset ?? r.currency,
  );

  const amountRaw = toStringSafe(r.amount, "0");
  const metadataCandidates: unknown[] = [
    (r as any).tokenMetadata,
    (r as any).metadata,
    r.operation?.tokenMetadata,
    (r.operation as any)?.metadata,
    (r.operation as any)?.token?.metadata,
    r.operationSend?.tokenMetadata,
    r.operationReceive?.tokenMetadata,
    r.operationForward?.tokenMetadata,
  ];
  const tokenDetails = deriveTokenDetails(amountRaw, token, metadataCandidates);
  const normalizedTokenMetadata = tokenDetails.metadata
    ? {
        name: tokenDetails.metadata.name,
        ticker: tokenDetails.metadata.ticker,
        decimals: typeof tokenDetails.metadata.decimals === "number" ? tokenDetails.metadata.decimals : undefined,
      }
    : ((r as any).tokenMetadata && typeof (r as any).tokenMetadata === "object")
        ? {
            name: (r as any).tokenMetadata?.name,
            ticker: (r as any).tokenMetadata?.ticker,
            decimals: (r as any).tokenMetadata?.decimals,
          }
        : null;

  const hasSwapHints = Boolean(r.operationSend && r.operationReceive);
  const typeLabel = deriveTypeLabel(r.type, r.operationType, contextAccount, from, to, hasSwapHints);

  return {
    id,
    block,
    timestamp,
    type: typeLabel,
    amount: amountRaw,
    formattedAmount: tokenDetails.formattedAmount,
    rawAmount: amountRaw,
    from,
    to,
    token,
    tokenTicker: tokenDetails.ticker,
    tokenDecimals: tokenDetails.decimals,
    operationType: toStringSafe(r.operationType) || toStringSafe(r.type) || "UNKNOWN",
    tokenMetadata: normalizedTokenMetadata,
  };
}

export function normalizeHistoryResponse(data: unknown, contextAccount?: string): RecentActivityItem[] {
  const resp = KeetaHistoryResponseSchema.safeParse(data);
  if (!resp.success) return [];
  const { records } = resp.data;
  return records
    .map((r) => normalizeHistoryRecord(r, contextAccount))
    .filter((x): x is RecentActivityItem => x !== null);
}

// SDK UserClient.history() -> [{ effects, voteStaple }]
// voteStaple.blocks[].operations[] contain operations for blocks in the staple
const KeetaSDKHistoryItemSchema = z
  .object({
    effects: z.unknown().optional(),
    voteStaple: z
      .object({
        blocks: z
          .array(
            z
              .object({
                hash: z.string().optional(),
                createdAt: z.union([z.string(), z.date(), z.number()]).optional(),
                timestamp: z.union([z.string(), z.date(), z.number()]).optional(),
                account: z.string().optional(),
                operations: z.array(z.unknown()).optional(),
                transactions: z.array(z.unknown()).optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export function extractActivityFromSDKHistory(data: unknown, contextAccount?: string): RecentActivityItem[] {
  const items = Array.isArray(data) ? data : [];
  const results: RecentActivityItem[] = [];

  function getPK(input: any): string {
    if (!input) return "";
    if (typeof input === "string") return input;
    try {
      if (typeof input?.publicKeyString?.toString === "function") return String(input.publicKeyString.toString());
      if (typeof input?.toString === "function") return String(input.toString());
      if (typeof input?.get === "function") return String(input.get());
    } catch {}
    return "";
  }

  function getAmount(input: any): string {
    if (input === null || input === undefined) return "0";
    if (typeof input === "string" || typeof input === "number" || typeof input === "bigint") return String(input);
    try {
      if (typeof input?.toString === "function") return String(input.toString());
    } catch {}
    return "0";
  }

  function getDateMsMaybe(block: any): number {
    const v = (block?.timestamp ?? block?.createdAt ?? block?.date) as unknown;
    return toTimestampMs(v, Date.now());
  }

  function classifyAndBuild(op: any, block: any, contextAccount?: string): RecentActivityItem | null {
    const blockHash = toStringSafe((block?.hash as unknown), "");
    const ts = getDateMsMaybe(block);
    const blockAccount = getPK(block?.account);
    const opFrom = getPK((op as any)?.from ?? (op as any)?.sender);
    const opTo = getPK((op as any)?.to ?? (op as any)?.receiver);
    const token = getPK((op as any)?.token ?? (op as any)?.tokenAddress ?? (op as any)?.account ?? (op as any)?.target ?? (op as any)?.asset ?? (op as any)?.currency);
    const amount = getAmount((op as any)?.amount);
    const ctx = contextAccount;

    if (ctx) {
      const involved = blockAccount === ctx || opTo === ctx || opFrom === ctx;
      if (!involved) return null;
    }

    // Heuristics
    let type = "Transaction";
    let from = "";
    let to = "";
    if (opTo) {
      if (ctx && opTo === ctx) {
        type = "RECEIVE";
        from = blockAccount || opFrom;
        to = opTo;
      } else {
        type = "SEND";
        from = blockAccount || (ctx ?? "");
        to = opTo;
      }
    } else if (opFrom) {
      type = "RECEIVE";
      from = opFrom;
      to = blockAccount || (ctx ?? "");
    }

    // Fall back to generic mapping if neither to/from present
    if (!from && !to) {
      from = blockAccount || (ctx ?? "");
    }

    return {
      id: blockHash || `${ts}-${from}-${to}`,
      block: blockHash,
      timestamp: ts,
      type,
      amount,
      from,
      to,
      token,
      operationType: type,
    };
  }

  for (const item of items) {
    const parsed = KeetaSDKHistoryItemSchema.safeParse(item);
    if (!parsed.success) continue;
    const voteStaple = parsed.data.voteStaple as any;
    const blocks = Array.isArray(voteStaple?.blocks) ? voteStaple.blocks : [];
    for (const block of blocks as any[]) {
      const ops = Array.isArray(block?.operations) ? block.operations : [];
      const txs = Array.isArray(block?.transactions) ? block.transactions : [];
      const list = ops.length ? ops : txs;
      for (const op of list) {
        const normalized = classifyAndBuild(op, block, contextAccount);
        if (normalized) results.push(normalized);
      }
    }
  }
  return results;
}

function extractFromBlockObject(blockObj: any, contextAccount?: string): RecentActivityItem[] {
  const blockHash = toStringSafe(blockObj?.hash, "");
  const ts = toTimestampMs(blockObj?.timestamp ?? blockObj?.createdAt, Date.now());
  const ops = Array.isArray(blockObj?.operations) ? blockObj.operations : [];
  const maybeTxs = Array.isArray(blockObj?.transactions) ? blockObj.transactions : [];
  const src = ops.length > 0 ? ops : maybeTxs;
  const results: RecentActivityItem[] = [];
  for (const op of src) {
    const merged = {
      ...(typeof op === 'object' && op !== null ? (op as Record<string, unknown>) : {}),
      block: blockHash,
      timestamp: ts,
    };
    const n = normalizeHistoryRecord(merged, contextAccount);
    if (n) results.push(n);
  }
  return results;
}

export function enrichActivityWithBlocks(
  items: RecentActivityItem[],
  blocksByHash: Record<string, unknown>,
  contextAccount?: string,
): RecentActivityItem[] {
  const out: RecentActivityItem[] = [];
  for (const item of items) {
    if (item.from && item.to && item.token) {
      out.push(item);
      continue;
    }
    const blockObj = blocksByHash[item.block];
    if (!blockObj) {
      out.push(item);
      continue;
    }
    const derived = extractFromBlockObject(blockObj, contextAccount);
    if (derived.length === 0) {
      out.push(item);
      continue;
    }
    // Try to find the best matching op for this item
    const matchByAccount = derived.find(
      (d) => (contextAccount && (d.from === contextAccount || d.to === contextAccount)) || d.amount === item.amount,
    );
    out.push(matchByAccount ?? derived[0]);
  }
  return out;
}

// Helper functions based on wallet extension patterns
const toBigIntSafe = (value: unknown): bigint => {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      try {
        return BigInt(trimmed);
      } catch {
        // Fall through to the generic parsing logic below.
      }
    }
  }

  if (typeof value === 'object' && value !== null) {
    const candidateValueOf = (value as { valueOf?: () => unknown }).valueOf;
    if (typeof candidateValueOf === 'function') {
      try {
        const primitive = candidateValueOf.call(value);
        if (primitive !== value) {
          const normalized = toBigIntSafe(primitive);
          if (normalized !== BigInt(0)) {
            return normalized;
          }
        }
      } catch {
        // Ignore and fallback to toString logic.
      }
    }

    const candidateToString = (value as { toString?: () => string }).toString;
    if (typeof candidateToString === 'function') {
      try {
        const stringValue = candidateToString.call(value);
        if (typeof stringValue === 'string') {
          const trimmed = stringValue.trim();
          if (trimmed.length > 0 && trimmed !== '[object Object]') {
            return toBigIntSafe(trimmed);
          }
        }
      } catch {
        // Ignore failures from custom toString implementations.
      }
    }
  }

  return BigInt(0);
};

const resolveTokenAddress = (candidate: unknown): string | undefined => {
  if (!candidate) {
    return undefined;
  }

  if (typeof candidate === 'string') {
    return candidate;
  }

  if (typeof candidate === 'object') {
    const candidateWithPk = candidate as { publicKeyString?: unknown; toString?: () => string };
    const { publicKeyString } = candidateWithPk;

    if (typeof publicKeyString === 'string') {
      return publicKeyString;
    }

    if (publicKeyString && typeof (publicKeyString as { toString?: () => string }).toString === 'function') {
      const value = (publicKeyString as { toString: () => string }).toString();
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    if (typeof candidateWithPk.toString === 'function') {
      const value = candidateWithPk.toString();
      if (typeof value === 'string' && value !== '[object Object]') {
        return value;
      }
    }
  }

  return undefined;
};

const toAddressString = (candidate: unknown): string =>
  typeof candidate === 'string' ? candidate : resolveTokenAddress(candidate) ?? '';

const parseNumericOperationType = (candidate: unknown): number | null => {
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
};

// Operation type mapping from wallet extension
const getOperationTypeFromNumeric = (numericType: number): string => {
  switch (numericType) {
    case 0:
      return 'SEND';
    case 1:
      return 'RECEIVE';
    case 2:
      return 'CREATE_IDENTIFIER';
    case 3:
      return 'SET_REP';
    case 4:
      return 'TOKEN_ADMIN_MODIFY_BALANCE';
    case 6:
      return 'TOKEN_ADMIN_SUPPLY';
    case 8:
      return 'SET_INFO';
    case 9:
      return 'UPDATE_PERMISSIONS';
    default:
      return 'UNKNOWN';
  }
};

const extractTokenAddress = (entry: any): string => {
  const primaryBlock = entry.voteStaple?.blocks?.[0];
  const primaryOperation = primaryBlock?.operations?.[0];

  const candidates: unknown[] = [
    primaryOperation?.token,
    primaryOperation?.account,
    primaryOperation?.target,
    primaryOperation?.identifier,
    entry.effects?.token,
    entry.effects?.account,
    entry.effects?.target,
    entry.effects?.identifier,
    entry.token,
    (entry as { tokenAddress?: unknown }).tokenAddress,
    (entry as { target?: unknown }).target,
    (entry as { account?: unknown }).account,
    (entry as { from?: unknown }).from,
    (entry as { to?: unknown }).to,
  ];

  for (const candidate of candidates) {
    const resolved = resolveTokenAddress(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return '';
};

/**
 * Process Keeta SDK history data using the proper filterStapleOperations approach
 * This follows the Keeta documentation recommendation to use filterStapleOperations
 * 
 * The issue with your current data is that it's already flattened, but Keeta SDK
 * returns voteStaple -> blocks -> operations structure
 */
function resolveOperationType(value: unknown): ExplorerOperationType {
	if (typeof value === "string" && value.trim().length > 0) {
		const upper = value.toUpperCase();
		if (upper in OPERATION_TYPE_LABELS) {
			return upper as ExplorerOperationType;
		}
	}

	if (typeof value === "number") {
		// Map numeric operation codes to operation types
		const numericMapping: Record<number, ExplorerOperationType> = {
			0: "SEND",
			1: "RECEIVE", 
			2: "SWAP",
			3: "SWAP_FORWARD",
			4: "TOKEN_ADMIN_SUPPLY",
			5: "TOKEN_ADMIN_MODIFY_BALANCE"
		};
		
		if (Number.isInteger(value) && value in numericMapping) {
			return numericMapping[value];
		}
	}

	return "UNKNOWN";
}

export function processKeetaHistoryWithFiltering(
  historyData: unknown,
  contextAccount?: string,
): RecentActivityItem[] {
  // Legacy helper kept for compatibility (token explorer fallback).
  // Simply reuse the SDK extraction logic, ensuring we always return an array.

  const extracted = extractActivityFromSDKHistory(historyData, contextAccount);
  if (extracted.length) {
    return extracted;
  }

  // As a final fallback, attempt to normalize any array-like structures.
  if (Array.isArray(historyData)) {
    return historyData
      .map((item) => normalizeHistoryRecord(item, contextAccount))
      .filter((item): item is RecentActivityItem => Boolean(item));
  }

  try {

  } catch {}
  return [];
}

// Helper functions for extracting data from Keeta SDK objects
function getAccountString(input: any): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  try {
    if (typeof input?.publicKeyString?.toString === "function") {
      return String(input.publicKeyString.toString());
    }
    if (typeof input?.toString === "function") {
      return String(input.toString());
    }
    if (typeof input?.get === "function") {
      return String(input.get());
    }
  } catch {}
  return "";
}

function getAmountString(input: any): string {
  if (input === null || input === undefined) return "0";
  if (typeof input === "string" || typeof input === "number" || typeof input === "bigint") {
    return String(input);
  }
  try {
    if (typeof input?.toString === "function") {
      return String(input.toString());
    }
  } catch {}
  return "0";
}

function getTimestamp(block: any): number {
  const timestamp = block?.timestamp ?? block?.createdAt ?? block?.date;
  return toTimestampMs(timestamp, Date.now());
}

/**
 * Extract token metadata from a Keeta operation
 * This handles various metadata sources and formats
 */
function extractTokenMetadataFromOperation(operation: any): any {
  if (!operation) return null;
  
  // Direct tokenMetadata field
  if (operation.tokenMetadata) {
    return operation.tokenMetadata;
  }
  
  // Check for nested operation metadata (operationSend, operationReceive, etc.)
  const nestedOps = [
    operation.operationSend,
    operation.operationReceive,
    operation.operationForward,
    operation.operation,
  ].filter(Boolean);
  
  for (const nestedOp of nestedOps) {
    if (nestedOp?.tokenMetadata) {
      return nestedOp.tokenMetadata;
    }
  }
  
  // Check for token info in the operation
  const tokenInfo = {
    name: operation.tokenName || operation.name,
    ticker: operation.tokenTicker || operation.ticker || operation.symbol,
    decimals: operation.tokenDecimals || operation.decimals,
    fieldType: operation.tokenFieldType || operation.fieldType,
    icon: operation.tokenIcon || operation.icon,
    metadata: operation.tokenMetadata || operation.metadata,
  };
  
  // Only return if we have at least some token info
  const hasTokenInfo = Object.values(tokenInfo).some(value => value !== undefined && value !== null);
  return hasTokenInfo ? tokenInfo : null;
}

/**
 * Test function to verify the new parsing works with sample data
 * This can be called from the browser console for debugging
 */
export function testKeetaHistoryParsing() {

  // Sample data structure that matches your current flattened format
  const sampleFlattenedData = {
    amount: '20300',
    block: 'BE53D93150FC93E3D76230708CFC6FBA484350F9B8962680844D4074C81091C6',
    from: '',
    to: '',
    token: '',
    operationType: '0',
    type: 'SEND'
  };
  
  // Sample data structure that matches Keeta SDK voteStaple format
  const sampleKeetaSDKData = [
    {
      voteStaple: {
        blocks: [
          {
            hash: 'BE53D93150FC93E3D76230708CFC6FBA484350F9B8962680844D4074C81091C6',
            timestamp: Date.now(),
            account: 'keeta_account_123',
            operations: [
              {
                type: 'SEND',
                from: 'keeta_account_123',
                to: 'keeta_account_456',
                amount: '20300',
                token: 'keeta_token_789',
                tokenMetadata: {
                  name: 'Test Token',
                  ticker: 'TEST',
                  decimals: 6,
                  fieldType: 'decimalPlaces'
                }
              }
            ]
          }
        ]
      },
      effects: {}
    }
  ];


  // Test the new parsing function
  const result = processKeetaHistoryWithFiltering(sampleKeetaSDKData, 'keeta_account_123');

  // Verify the result has the expected fields
  if (result.length > 0) {
    const firstResult = result[0];







  }
  
  return result;
}

// New: reuse provider normalization to get ExplorerOperation[] directly
export function extractOperationsFromSDKHistory(
  historyData: unknown,
  contextAccount?: string,
): ExplorerOperation[] {
  const records = Array.isArray(historyData) ? (historyData as unknown[]) : [];
  if (records.length === 0) return [];
  const normalized = normalizeHistoryRecords(records as any[], contextAccount ?? "", {} as Record<string, CachedTokenMeta>);
  return groupOperationsByBlock(normalized.operations);
}

// New: convert raw provider history records to ExplorerOperation[]
export function normalizeRecordsToOperations(
  records: unknown[],
  contextAccount?: string,
): ExplorerOperation[] {
  const normalized = normalizeHistoryRecords(records as any[], contextAccount ?? "", {} as Record<string, CachedTokenMeta>);
  return groupOperationsByBlock(normalized.operations);
}
