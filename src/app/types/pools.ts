export interface PoolInfo {
  id: string;
  token_a: string;
  token_b: string;
  reserve_a: string;
  reserve_b: string;
  lp_token: string;
  total_lp_supply: string;
  fee_rate: string;
  pool_type: string;
  storage_account: string;
  is_paused: boolean;
  pending_settlement: boolean;
  last_swap_signature?: string | null;
  last_swap_confirmed_at?: string | null;
  last_swap_token_in?: string | null;
  last_swap_token_out?: string | null;
  last_swap_amount_in?: string | null;
  last_swap_amount_out?: string | null;
}

export interface QuoteResponse {
  amount_out: string;
  fee: string;
  price_impact: string;
  minimum_received: string;
  route: string;
}

export interface SwapParams {
  poolId: string;
  tokenIn: string;
  amountIn: string;
  minAmountOut?: string;
  expectedAmountOut?: string;
}

export type SwapStatus =
  | 'idle'
  | 'preparing'
  | 'awaiting-signature'
  | 'submitting'
  | 'confirming'
  | 'confirmed'
  | 'failed';

export interface SwapStatusUpdate {
  status: SwapStatus;
  details?: string;
  txSignature?: string;
}

export interface SwapExecutionOptions {
  onStatusChange?: (update: SwapStatusUpdate) => void;
}

export interface SwapExecutionResult {
  amountIn: string;
  amountOut: string;
  tokenIn: string;
  tokenOut: string;
  txSignature?: string;
}

export interface SwapTelemetryPayload {
  poolId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  minAmountOut?: string;
  walletAddress?: string;
  storageAccount?: string;
  txSignature?: string;
  confirmedAt?: string;
}

