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
}

export interface QuoteResponse {
  amount_out: string;
  fee: string;
  price_impact: string;
  minimum_received: string;
  route: string;
}


