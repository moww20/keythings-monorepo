export interface TokenCatalogEntry {
  symbol: string;
  address: string;
  name?: string;
  icon?: string;
  decimals?: number;
}

export interface WalletTokenBalance {
  address: string;
  balance: string;
  formattedAmount: string;
  formattedUsdValue?: string;
  rawBalance?: string;
}

export interface TokenChoice extends TokenCatalogEntry {
  isListed: boolean;
  balance?: string;
  formattedAmount?: string;
}
