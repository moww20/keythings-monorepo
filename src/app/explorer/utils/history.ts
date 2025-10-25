import { z } from "zod";
import { processTokenMetadata, formatTokenAmount, parseTokenMetadata, type TokenInfo } from './token-metadata';

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

  function classifyAndBuild(op: any, block: any, ctx?: string): RecentActivityItem | null {
    const blockHash = getPK(block?.hash) || toStringSafe(block?.$hash, "");
    const ts = getDateMsMaybe(block);
    const blockAccount = getPK(block?.account);
    const opTo = getPK(op?.to);
    const opFrom = getPK(op?.from);
    const token = getPK(op?.token);
    const amount = getAmount(op?.amount);

    // Choose classification rules inspired by explorer-main server mapping
    // SEND as seen from the chain owner: if op.to != ctx and block.account == ctx => SEND
    // RECEIVE: if op.to == ctx or op.from exists and block.account == ctx => RECEIVE
    // If ctx provided, filter to related ops
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
        from = blockAccount || ctx || "";
        to = opTo;
      }
    } else if (opFrom) {
      type = "RECEIVE";
      from = opFrom;
      to = blockAccount || ctx || "";
    }

    // Fall back to generic mapping if neither to/from present
    if (!from && !to) {
      from = blockAccount || ctx || "";
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
  contextAccount?: string
): RecentActivityItem[] {
  globalThis.console.warn('🔍 [PARSING] processKeetaHistoryWithFiltering called with:', {
    historyData,
    contextAccount,
    isArray: Array.isArray(historyData),
    length: Array.isArray(historyData) ? historyData.length : 'not array',
    dataType: typeof historyData,
    dataKeys: historyData && typeof historyData === 'object' ? Object.keys(historyData) : 'not object'
  });
  
  // Handle different data structures from RPC vs SDK
  let items: any[] = [];
  
  if (Array.isArray(historyData)) {
    items = historyData;
    globalThis.console.warn('🔍 [PARSING] Data is array, processing directly');
  } else if (historyData && typeof historyData === 'object') {
    // Check if it's an object with a specific structure
    const dataObj = historyData as any;
    
    // Check for common RPC response structures
    if (dataObj.history && Array.isArray(dataObj.history)) {
      items = dataObj.history;
      globalThis.console.warn('🔍 [PARSING] Found history array in object');
    } else if (dataObj.data && Array.isArray(dataObj.data)) {
      items = dataObj.data;
      globalThis.console.warn('🔍 [PARSING] Found data array in object');
    } else if (dataObj.result && Array.isArray(dataObj.result)) {
      items = dataObj.result;
      globalThis.console.warn('🔍 [PARSING] Found result array in object');
    } else if (dataObj.records && Array.isArray(dataObj.records)) {
      items = dataObj.records;
      globalThis.console.warn('🔍 [PARSING] Found records array in object');
    } else if (dataObj.voteStaples && Array.isArray(dataObj.voteStaples)) {
      items = dataObj.voteStaples;
      globalThis.console.warn('🔍 [PARSING] Found voteStaples array in object');
    } else if (dataObj.voteStaples && typeof dataObj.voteStaples === 'object') {
      // Handle case where voteStaples is an object with nested structure
      globalThis.console.warn('🔍 [PARSING] voteStaples is object, checking for nested arrays');
      if (Array.isArray(dataObj.voteStaples.blocks)) {
        items = dataObj.voteStaples.blocks;
        globalThis.console.warn('🔍 [PARSING] Found blocks array in voteStaples object');
      } else {
        // Try to find any array in the voteStaples object
        for (const [key, value] of Object.entries(dataObj.voteStaples)) {
          if (Array.isArray(value)) {
            items = value as any[];
            globalThis.console.warn(`🔍 [PARSING] Found array in voteStaples.${key}`);
            break;
          }
        }
      }
    } else {
      globalThis.console.warn('🔍 [PARSING] Unknown object structure, trying to extract arrays');
      // Try to find any array in the object
      for (const [key, value] of Object.entries(dataObj)) {
        if (Array.isArray(value)) {
          items = value as any[];
          globalThis.console.warn(`🔍 [PARSING] Found array in key: ${key}`);
          break;
        }
      }
      
      // If no array found, check if the object itself is a transaction record
      if (items.length === 0 && dataObj.id && dataObj.block && dataObj.timestamp) {
        globalThis.console.warn('🔍 [PARSING] Object appears to be a single transaction record, wrapping in array');
        items = [dataObj];
      }
    }
  }
  
  globalThis.console.warn('🔍 [PARSING] Processing items:', items.length);
  const results: RecentActivityItem[] = [];

  for (const item of items) {
    globalThis.console.warn('🔍 [PARSING] Processing item:', item);
    globalThis.console.warn('🔍 [PARSING] Item type:', typeof item);
    globalThis.console.warn('🔍 [PARSING] Item keys:', item && typeof item === 'object' ? Object.keys(item) : 'not object');
    
    // Check if this is already a flattened transaction record (RPC format)
    globalThis.console.warn('🔍 [PARSING] Checking if item is flattened record:', {
      isObject: item && typeof item === 'object',
      hasId: item && typeof item === 'object' && 'id' in item,
      hasBlock: item && typeof item === 'object' && 'block' in item,
      hasTimestamp: item && typeof item === 'object' && 'timestamp' in item,
      itemKeys: item && typeof item === 'object' ? Object.keys(item) : 'not object'
    });
    
    if (item && typeof item === 'object' && 'id' in item && 'block' in item && 'timestamp' in item) {
      globalThis.console.warn('🔍 [PARSING] Found flattened transaction record, processing directly');
      
      // Extract operation type
      let operationType = 'UNKNOWN';
      const typeCandidates: unknown[] = [
        (item as any)?.type,
        (item as any)?.operationType,
      ];

      let numericType: number | null = null;
      for (const candidate of typeCandidates) {
        const parsed = parseNumericOperationType(candidate);
        if (parsed !== null) {
          numericType = parsed;
          break;
        }
      }

      if (numericType !== null && !Number.isNaN(numericType)) {
        operationType = getOperationTypeFromNumeric(numericType);
      }

      // Extract addresses
      const from = toAddressString((item as any)?.from);
      const to = toAddressString((item as any)?.to);
      const token = toAddressString((item as any)?.token);
      
      // Debug the extracted values
      globalThis.console.warn('🔍 [PARSING] Extracted addresses:', {
        from,
        to,
        token,
        rawFrom: (item as any)?.from,
        rawTo: (item as any)?.to,
        rawToken: (item as any)?.token,
        itemKeys: item && typeof item === 'object' ? Object.keys(item) : 'not object'
      });
      
      // Extract amount
      const amountValue = toBigIntSafe((item as any)?.amount);
      
      // Get token metadata for proper formatting
      const tokenMetadata = extractTokenMetadataFromOperation(item);
      let formattedAmount = amountValue.toString();
      
      if (tokenMetadata && tokenMetadata.decimals !== undefined) {
        try {
          formattedAmount = formatTokenAmount(
            amountValue,
            tokenMetadata.decimals,
            tokenMetadata.fieldType || 'decimals',
            tokenMetadata.ticker || 'UNKNOWN'
          );
        } catch (error) {
          console.warn('Failed to format token amount:', error);
          formattedAmount = amountValue.toString();
        }
      }
      
      const blockHash = toStringSafe((item as any)?.block);
      const timestamp = toTimestampMs((item as any)?.timestamp, Date.now());
      
      // Determine transaction type based on context account
      let type = 'Transaction';
      if (contextAccount) {
        if (to === contextAccount) {
          type = 'RECEIVE';
        } else if (from === contextAccount) {
          type = 'SEND';
        }
      }
      
      // Only include if it's relevant to the context account
      // For RPC data with empty from/to, include if we have a valid amount and block
      const hasValidData = amountValue > BigInt(0) && blockHash;
      const isRelevantToAccount = !contextAccount || from === contextAccount || to === contextAccount;
      
      globalThis.console.warn('🔍 [PARSING] Filtering check:', {
        hasValidData,
        isRelevantToAccount,
        from,
        to,
        contextAccount,
        amountValue: amountValue.toString(),
        blockHash,
        willInclude: isRelevantToAccount || (hasValidData && !from && !to)
      });
      
      if (isRelevantToAccount || (hasValidData && !from && !to)) {
        const uniqueId = `${blockHash || 'unknown'}-${operationType}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
        
        const result = {
          id: uniqueId,
          block: blockHash,
          timestamp,
          type,
          amount: formattedAmount,
          from,
          to,
          token,
          operationType: operationType.toString(),
          tokenMetadata,
        };

        globalThis.console.warn('🔍 [PARSING] Adding flattened record result:', result);
        results.push(result);
      }
      continue;
    }
    
    const parsed = KeetaSDKHistoryItemSchema.safeParse(item);
    if (!parsed.success) {
      globalThis.console.warn('🔍 [PARSING] Schema validation failed for item:', parsed.error);
      globalThis.console.warn('🔍 [PARSING] Item structure:', JSON.stringify(item, null, 2));
      
      // Try alternative parsing for different RPC response formats
      if (item && typeof item === 'object') {
        globalThis.console.warn('🔍 [PARSING] Trying alternative parsing for RPC response');
        
        // Check if this is a direct block with operations
        if (Array.isArray(item.operations)) {
          globalThis.console.warn('🔍 [PARSING] Found direct block with operations');
          const block = item;
          const operations = block.operations ?? [];
          
          for (const operation of operations) {
            globalThis.console.warn('🔍 [PARSING] Processing direct operation:', operation);
            
            // Extract operation type
            let operationType = 'UNKNOWN';
            const typeCandidates: unknown[] = [
              (operation as any)?.type,
              (operation as any)?.operationType,
            ];

            let numericType: number | null = null;
            for (const candidate of typeCandidates) {
              const parsed = parseNumericOperationType(candidate);
              if (parsed !== null) {
                numericType = parsed;
                break;
              }
            }

            if (numericType !== null && !Number.isNaN(numericType)) {
              operationType = getOperationTypeFromNumeric(numericType);
            }

            // Extract addresses
            const from = toAddressString((operation as any)?.from);
            const to = toAddressString((operation as any)?.to);
            const token = extractTokenAddress({ voteStaple: null, effects: null, operation });
            
            // Extract amount
            const amountValue = toBigIntSafe((operation as any)?.amount);
            
            // Get token metadata for proper formatting
            const tokenMetadata = extractTokenMetadataFromOperation(operation);
            let formattedAmount = amountValue.toString();
            
            if (tokenMetadata && tokenMetadata.decimals !== undefined) {
              try {
                formattedAmount = formatTokenAmount(
                  amountValue,
                  tokenMetadata.decimals,
                  tokenMetadata.fieldType || 'decimals',
                  tokenMetadata.ticker || 'UNKNOWN'
                );
              } catch (error) {
                console.warn('Failed to format token amount:', error);
                formattedAmount = amountValue.toString();
              }
            }
            
            const blockHash = getAccountString(block?.hash);
            const timestamp = getTimestamp(block);
            
            // Determine transaction type based on context account
            let type = 'Transaction';
            if (contextAccount) {
              if (to === contextAccount) {
                type = 'RECEIVE';
              } else if (from === contextAccount) {
                type = 'SEND';
              }
            }
            
            // Only include if it's relevant to the context account
            if (!contextAccount || from === contextAccount || to === contextAccount) {
              const uniqueId = `${blockHash || 'unknown'}-${operationType}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
              
              const result = {
                id: uniqueId,
                block: blockHash,
                timestamp,
                type,
                amount: formattedAmount,
                from,
                to,
                token,
                operationType: operationType.toString(),
                tokenMetadata,
              };

              globalThis.console.warn('🔍 [PARSING] Adding direct operation result:', result);
              results.push(result);
            }
          }
          continue;
        }
      }
      
      continue;
    }

    const { voteStaple, effects } = parsed.data;
    globalThis.console.warn('🔍 [PARSING] Parsed voteStaple:', voteStaple);
    
    // Extract operations from voteStaple blocks
    const blocks = voteStaple?.blocks ?? [];
    globalThis.console.warn('🔍 [PARSING] Found blocks:', blocks.length);
    
    for (const block of blocks) {
      const operations = block?.operations ?? [];
      globalThis.console.warn('🔍 [PARSING] Block operations:', operations.length, operations);
      
      for (const operation of operations) {
        globalThis.console.warn('🔍 [PARSING] Processing operation:', operation);
        
        // Extract operation type using wallet extension pattern
        let operationType = 'UNKNOWN';
        const typeCandidates: unknown[] = [
          (operation as any)?.type,
          (operation as any)?.operationType,
        ];

        let numericType: number | null = null;
        for (const candidate of typeCandidates) {
          const parsed = parseNumericOperationType(candidate);
          if (parsed !== null) {
            numericType = parsed;
            break;
          }
        }

        if (numericType !== null && !Number.isNaN(numericType)) {
          operationType = getOperationTypeFromNumeric(numericType);
        }

        // Extract addresses using wallet extension pattern
        const from = toAddressString(
          (operation as any)?.from ?? (effects as any)?.from
        );
        const to = toAddressString(
          (operation as any)?.to ?? (effects as any)?.to
        );
        const token = extractTokenAddress({ voteStaple, effects, operation });
        
        // Extract amount using wallet extension pattern
        const amountValue = toBigIntSafe(
          (operation as any)?.amount ?? (effects as any)?.amount
        );
        
        // Get token metadata for proper formatting
        const tokenMetadata = extractTokenMetadataFromOperation(operation);
        let formattedAmount = amountValue.toString();
        
        if (tokenMetadata && tokenMetadata.decimals !== undefined) {
          try {
            formattedAmount = formatTokenAmount(
              amountValue,
              tokenMetadata.decimals,
              tokenMetadata.fieldType || 'decimals',
              tokenMetadata.ticker || 'UNKNOWN'
            );
          } catch (error) {
            console.warn('Failed to format token amount:', error);
            formattedAmount = amountValue.toString();
          }
        }
        
        const blockHash = getAccountString(block?.hash);
        const timestamp = getTimestamp(block);
        
        // Determine transaction type based on context account
        let type = 'Transaction';
        if (contextAccount) {
          if (to === contextAccount) {
            type = 'RECEIVE';
          } else if (from === contextAccount) {
            type = 'SEND';
          }
        }
        
        // Only include if it's relevant to the context account
        if (!contextAccount || from === contextAccount || to === contextAccount) {
            // Create unique ID to avoid duplicates
            const uniqueId = `${blockHash || 'unknown'}-${operationType}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
            
            const result = {
              id: uniqueId,
              block: blockHash,
              timestamp,
              type,
              amount: formattedAmount,
              from,
              to,
              token,
              operationType: operationType.toString(),
              tokenMetadata,
            };

            globalThis.console.warn('🔍 [PARSING] Adding result:', result);
            globalThis.console.warn('🔍 [PARSING] Unique ID created:', uniqueId);
            globalThis.console.warn('🔍 [PARSING] Block hash:', blockHash);
            globalThis.console.warn('🔍 [PARSING] Operation type:', operationType);
            globalThis.console.warn('🔍 [PARSING] Numeric type:', numericType);
            globalThis.console.warn('🔍 [PARSING] From/To:', { from, to });
            globalThis.console.warn('🔍 [PARSING] Token:', token);
            globalThis.console.warn('🔍 [PARSING] Amount (raw):', amountValue.toString());
            globalThis.console.warn('🔍 [PARSING] Amount (formatted):', formattedAmount);
            globalThis.console.warn('🔍 [PARSING] Token metadata:', tokenMetadata);
            results.push(result);
        }
      }
    }
  }

  globalThis.console.warn('🔍 [PARSING] Final results:', results);
  return results;
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
  console.log('🧪 Testing Keeta History Parsing...');
  
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
  
  console.log('📊 Sample Flattened Data:', sampleFlattenedData);
  console.log('📊 Sample Keeta SDK Data:', sampleKeetaSDKData);
  
  // Test the new parsing function
  const result = processKeetaHistoryWithFiltering(sampleKeetaSDKData, 'keeta_account_123');
  console.log('✅ Parsing Result:', result);
  
  // Verify the result has the expected fields
  if (result.length > 0) {
    const firstResult = result[0];
    console.log('🔍 First Result Analysis:');
    console.log('- Has amount:', !!firstResult.amount);
    console.log('- Has from/to:', !!firstResult.from && !!firstResult.to);
    console.log('- Has token:', !!firstResult.token);
    console.log('- Has metadata:', !!firstResult.tokenMetadata);
    console.log('- Operation type:', firstResult.operationType);
    console.log('- Transaction type:', firstResult.type);
  }
  
  return result;
}
