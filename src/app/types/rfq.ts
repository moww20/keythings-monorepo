export type OrderSide = 'buy' | 'sell';

export type RFQOrderStatus = 'open' | 'pending_fill' | 'filled' | 'expired';

export interface RFQMakerMeta {
  id: string;
  displayName: string;
  verified: boolean;
  reputationScore: number;
  fillsCompleted: number;
  failureRate: number;
  allowlistLabel?: string;
}

export interface RFQOrder {
  id: string;
  pair: string;
  side: OrderSide;
  price: number;
  size: number;
  minFill?: number;
  expiry: string;
  maker: RFQMakerMeta;
  unsignedBlock?: string | null;
  makerSignature?: string | null;
  storageAccount?: string;
  allowlisted: boolean;
  status: RFQOrderStatus;
  takerFillAmount?: number;
  takerAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RFQOrderBookBuckets {
  open: RFQOrder[];
  pending_fill: RFQOrder[];
  filled: RFQOrder[];
  expired: RFQOrder[];
}

export interface RFQQuoteDraft {
  side: OrderSide;
  price: string;
  size: string;
  minFill?: string;
  expiryPreset: '5m' | '15m' | '1h' | '4h' | '24h';
  allowlistLabel?: string;
  autoSignProfileId?: string;
}

export interface RFQFillRequestResult {
  order: RFQOrder;
  status: 'initiated' | 'settled' | 'rejected';
  latencyMs: number;
}


export interface RFQQuoteSubmission extends RFQQuoteDraft {
  maker: RFQMakerMeta;
  pair: string;
}

// RFQ Declaration Types
export type DeclarationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface RFQDeclaration {
  id: string;
  orderId: string;
  takerAddress: string;
  fillAmount: number;
  declaredAt: string;
  status: DeclarationStatus;
  unsignedAtomicSwapBlock?: string;
  makerBlockHash?: string | null;
}

export interface RFQDeclarationRequest {
  takerAddress: string;
  fillAmount: number;
  unsignedAtomicSwapBlock?: string;
}

export interface RFQDeclarationResponse {
  declaration: RFQDeclaration;
  status: 'declared' | 'approved' | 'rejected';
}

export interface RFQApprovalRequest {
  declarationId: string;
  approved: boolean;
  makerBlockHash?: string | null;
  makerSignedBlock?: string | null;
}

