// Token metadata service based on wallet extension patterns
export interface TokenInfo {
  ticker: string;
  decimals: number;
  fieldType: 'decimalPlaces' | 'decimals';
  name: string;
  metadata?: string;
}

export interface TokenInfoMap {
  [tokenAddress: string]: TokenInfo;
}

// Cache for token metadata
const tokenInfoCache = new Map<string, TokenInfo>();

// Default token info for fallback
export function createDefaultTokenInfo(tokenAddress?: string): TokenInfo {
  return {
    ticker: 'UNKNOWN',
    decimals: 8, // Default to 8 decimals like KTA
    fieldType: 'decimals',
    name: 'Unknown Token',
    metadata: undefined,
  };
}

// Parse base64 metadata like wallet extension does
export function parseTokenMetadata(metadataBase64?: string | null): Partial<TokenInfo> | null {
  if (!metadataBase64) {
    return null;
  }

  try {
    const decoded = atob(metadataBase64);
    const parsed = JSON.parse(decoded);
    
    return {
      ticker: parsed.ticker || parsed.symbol,
      decimals: parsed.decimals || parsed.decimalPlaces,
      fieldType: parsed.decimalPlaces ? 'decimalPlaces' : 'decimals',
      name: parsed.name || parsed.displayName,
      metadata: metadataBase64,
    };
  } catch (error) {
    console.warn('Failed to parse token metadata:', error);
    return null;
  }
}

// Process token metadata with caching
export async function processTokenMetadata(
  tokenAddress: string,
  operationMetadata?: string,
  baseTokenAddress?: string,
  getTokenMetadata?: (address: string) => Promise<any>
): Promise<TokenInfo> {
  // Check cache first
  if (tokenInfoCache.has(tokenAddress)) {
    return tokenInfoCache.get(tokenAddress)!;
  }

  let tokenInfo: TokenInfo = createDefaultTokenInfo(tokenAddress);

  try {
    // Try to parse from operation metadata first
    if (operationMetadata) {
      const parsed = parseTokenMetadata(operationMetadata);
      if (parsed) {
        tokenInfo = { ...tokenInfo, ...parsed };
      }
    }

    // If we have a token metadata service, use it
    if (getTokenMetadata && tokenAddress !== baseTokenAddress) {
      try {
        const metadata = await getTokenMetadata(tokenAddress);
        if (metadata) {
          const parsed = parseTokenMetadata(metadata);
          if (parsed) {
            tokenInfo = { ...tokenInfo, ...parsed };
          }
        }
      } catch (error) {
        console.warn('Failed to fetch token metadata:', error);
      }
    }

    // Cache the result
    tokenInfoCache.set(tokenAddress, tokenInfo);
    return tokenInfo;
  } catch (error) {
    console.warn('Error processing token metadata:', error);
    return tokenInfo;
  }
}

// Format balance with proper decimals and field type
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  fieldType: 'decimalPlaces' | 'decimals',
  ticker: string,
): string {
  const safeDecimals = Number.isFinite(decimals) ? Math.max(0, Math.trunc(decimals)) : 0;
  const divisor = BigInt(10) ** BigInt(safeDecimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;
  
  if (fractionalPart === BigInt(0)) {
    return `${wholePart.toString()} ${ticker}`;
  }
  
  const fractionalStr = fractionalPart.toString().padStart(safeDecimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  if (trimmedFractional === '') {
    return `${wholePart.toString()} ${ticker}`;
  }
  
  return `${wholePart.toString()}.${trimmedFractional} ${ticker}`;
}

// Get token display name
export function getTokenDisplayName(tokenInfo: TokenInfo): string {
  return tokenInfo.name || tokenInfo.ticker || 'Unknown Token';
}

// Get token ticker
export function getTokenTicker(tokenInfo: TokenInfo): string {
  return tokenInfo.ticker || 'UNKNOWN';
}
