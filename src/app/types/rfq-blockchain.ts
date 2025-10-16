import type { OrderSide } from '@/app/types/trading';
import type { RFQOrder } from '@/app/types/rfq';

export interface RFQStorageAccountDetails {
  pair: string;
  side: OrderSide;
  price: number;
  size: number;
  minFill?: number;
  expiry: string;
  tokenAddress: string;
  tokenDecimals: number;
  makerAddress: string;
  allowlistLabel?: string;
  metadata?: Record<string, unknown>;
}

export interface RFQStorageCreationResult {
  address: string;
  blockHash: string | null;
  metadataBase64: string;
}

export interface RFQFillDetails {
  order: RFQOrder;
  fillAmount: number;
  takerAddress?: string;
}

export interface RFQFillResult {
  blockHash: string | null;
}

export interface RFQCancelDetails {
  order: RFQOrder;
  tokenAddress: string;
  tokenDecimals: number;
  amount: number;
}

export interface RFQCancelResult {
  blockHash: string | null;
}

export interface StorageAccountPermission {
  principal: string;
  flags: string[];
  target?: string | null;
}

export interface StorageAccountBalanceEntry {
  token: string;
  amount: bigint;
  normalizedAmount: number;
  decimals: number;
}

export interface StorageAccountState {
  address: string;
  metadata?: Record<string, unknown>;
  balances: StorageAccountBalanceEntry[];
  permissions: StorageAccountPermission[];
  raw?: unknown;
}
