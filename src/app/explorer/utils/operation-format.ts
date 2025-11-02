import { formatDistanceToNow } from "date-fns";

import type { ExplorerOperation } from "@/lib/explorer/client";

import { truncateIdentifier } from "./resolveExplorerPath";

export function coerceString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  return null;
}

export function parseExplorerDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "number") {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      const ms = n < 1_000_000_000_000 ? n * 1000 : n;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

export function formatRelativeTime(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  return formatDistanceToNow(value, { addSuffix: true });
}

export function describeOperation(operation: ExplorerOperation): string {
  switch (operation.type) {
    case "SEND": {
      const amount = coerceString(
        (operation as Record<string, unknown>)?.amount ??
          operation.operation?.amount ??
          operation.operationSend?.amount
      );
      const token = coerceString(
        (operation as Record<string, unknown>)?.token ??
          operation.operation?.token ??
          operation.operationSend?.token
      );
      const recipient = coerceString(
        (operation as Record<string, unknown>)?.to ??
          operation.operation?.to ??
          operation.operationSend?.to
      );
      if (amount && token && recipient) {
        return `Sent ${amount} of ${truncateIdentifier(token, 8, 6)} to ${truncateIdentifier(recipient)}`;
      }
      break;
    }
    case "RECEIVE": {
      const amount = coerceString(
        (operation as Record<string, unknown>)?.amount ??
          operation.operation?.amount ??
          operation.operationReceive?.amount
      );
      const sender = coerceString(
        (operation as Record<string, unknown>)?.from ??
          operation.operation?.from ??
          operation.operationReceive?.from
      );
      if (amount && sender) {
        return `Received ${amount} from ${truncateIdentifier(sender)}`;
      }
      break;
    }
    case "SWAP": {
      const sendToken = coerceString(operation.operationSend?.token);
      const receiveToken = coerceString(operation.operationReceive?.token);
      if (sendToken && receiveToken) {
        return `Swapped ${truncateIdentifier(sendToken, 8, 6)} ↔ ${truncateIdentifier(receiveToken, 8, 6)}`;
      }
      break;
    }
    default:
      break;
  }

  const account = operation.block.account ? truncateIdentifier(operation.block.account) : "Unknown";
  return `${operation.type} involving ${account}`;
}

export interface OperationParticipants {
  from?: string | null;
  to?: string | null;
}

export interface OperationSummary {
  description: string;
  participants: OperationParticipants;
  timestamp: Date | null;
}

export function summarizeOperation(operation: ExplorerOperation): OperationSummary {
  const description = describeOperation(operation);
  const participants: OperationParticipants = {};

  const blockAccount = coerceString(operation.block.account);
  // Check top-level fields first, then nested fields
  const resolvedSendFrom = coerceString(
    (operation as Record<string, unknown>)?.from ??
      operation.operation?.from ??
      operation.operationSend?.from
  );
  const resolvedSendTo = coerceString(
    (operation as Record<string, unknown>)?.to ??
      (operation as Record<string, unknown>)?.toAccount ??
      operation.operation?.to ??
      operation.operationSend?.to
  );
  const resolvedReceiveFrom = coerceString(
    (operation as Record<string, unknown>)?.from ??
      operation.operation?.from ??
      operation.operationReceive?.from
  );
  const resolvedReceiveTo = coerceString(
    (operation as Record<string, unknown>)?.to ??
      (operation as Record<string, unknown>)?.toAccount ??
      operation.operation?.to ??
      operation.operationReceive?.to
  );
  const resolvedToken = coerceString(
    (operation as Record<string, unknown>)?.token ??
      (operation as Record<string, unknown>)?.tokenAddress ??
      operation.operation?.token ??
      operation.operationSend?.token ??
      operation.operationReceive?.token
  );

  switch (operation.type) {
    case "SEND": {
      participants.from = resolvedSendFrom ?? blockAccount;
      participants.to = resolvedSendTo ?? resolvedToken ?? coerceString(operation.toAccount ?? undefined);
      break;
    }
    case "RECEIVE": {
      participants.from = resolvedReceiveFrom;
      participants.to = resolvedReceiveTo ?? coerceString(operation.toAccount ?? blockAccount ?? undefined);
      break;
    }
    case "SWAP": {
      participants.from = coerceString(operation.operationReceive?.from ?? blockAccount ?? undefined);
      participants.to = coerceString(operation.operationSend?.to ?? operation.operationReceive?.from ?? undefined);
      break;
    }
    case "SWAP_FORWARD": {
      participants.from = coerceString(operation.operationForward?.from ?? blockAccount ?? undefined);
      participants.to = coerceString(operation.operationForward?.forward ?? operation.operationSend?.to ?? undefined);
      break;
    }
    case "TOKEN_ADMIN_SUPPLY":
    case "TOKEN_ADMIN_MODIFY_BALANCE": {
      participants.from = blockAccount;
      participants.to = coerceString(operation.operation?.token ?? operation.operationSend?.token ?? undefined);
      break;
    }
    default: {
      participants.from = blockAccount;
      participants.to = coerceString(operation.operation?.to ?? operation.operationSend?.to ?? undefined);
    }
  }

  const pickParsedDate = (...values: unknown[]): Date | null => {
    for (const v of values) {
      const d = parseExplorerDate(v);
      if (d) return d;
    }
    return null;
  };
  const timestamp = pickParsedDate(
    (operation.block as any)?.date,
    (operation.block as any)?.createdAt,
    (operation as any)?.timestamp,
    (operation as any)?.date,
    (operation as any)?.createdAt,
    (operation as any)?.blockTimestamp,
    (operation.operation as any)?.date,
    (operation.operation as any)?.timestamp,
  );

  return {
    description,
    participants,
    timestamp,
  };
}
