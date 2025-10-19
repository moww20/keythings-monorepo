export interface StorageTableAccount {
  entity: string;
  principal: string;
  target: string | null;
  permissions: string[];
  name?: string;
  description?: string;
  metadata?: string;
  ktaBalance?: string;
  otherTokenBalance?: string;
  otherTokenSymbol?: string;
  created?: number;
}

export interface StorageAccountTokenOption {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  available: number;
}
