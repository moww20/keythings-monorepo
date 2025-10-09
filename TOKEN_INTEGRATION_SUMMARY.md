# Token Integration Summary

## Extension Wallet Token Handling Analysis

### 1. **Token Data Parsing Pattern**

**Location:** `keythings-extension-wallet/src/popup/Dashboard.tsx` (lines 200-300)

**Flow:**
```javascript
// 1. Fetch all balances from Keeta client
const balances = await allBalances();

// 2. Filter non-zero balances
const nonZeroBalances = balances.filter((entry) => entry.balance > 0n);

// 3. Process each balance entry
const tokenMetadataPromises = nonZeroBalances.map(async (balanceEntry) => {
  const tokenAddress = balanceEntry.token;
  const balance = balanceEntry.balance;
  
  // Process metadata
  const processedData = await processTokenMetadata(
    tokenAddress,
    balanceEntry.metadata,  // metadata from balance entry
    undefined,               // will be fetched if needed
    baseTokenAddress,
    getTokenMetadata
  );
  
  return {
    token: tokenAddress,
    amount: balance,
    name: processedData.name,
    ticker: processedData.ticker,
    decimals: processedData.decimals,
    fieldType: processedData.fieldType,
    metadata: processedData.metadata,
    isMalformed: processedData.isMalformed,
  };
});
```

### 2. **Metadata Processing Pattern**

**Location:** `keythings-extension-wallet/src/lib/token-service.ts` (lines 61-135)

**Key Logic:**
```javascript
export async function processTokenMetadata(
  tokenAddress,
  balanceEntryMetadata,    // Metadata from balance entry
  fetchedMetadata,          // Optional pre-fetched metadata
  baseTokenAddress,
  getTokenMetadata          // Function to fetch additional metadata
) {
  let tokenData = {
    decimals: 0,
    fieldType: 'decimals',
    name: '',
    ticker: '',
  };

  // 1. Try balance entry metadata first
  if (balanceEntryMetadata) {
    const metadataFromBalance = extractDecimalsAndFieldTypeFromMetadata(balanceEntryMetadata);
    tokenData = {
      decimals: metadataFromBalance.decimals,
      fieldType: metadataFromBalance.fieldType,
      name: getTokenDisplayName(balanceEntryMetadata) || '',
      ticker: getTokenTicker(balanceEntryMetadata) || '',
    };
  }

  // 2. Fetch additional metadata if available
  if (getTokenMetadata && !fetchedMetadata) {
    fetchedMetadata = await getTokenMetadata(tokenAddress);
  }

  // 3. Merge fetched metadata
  if (fetchedMetadata) {
    tokenData = {
      decimals: fetchedMetadata.decimals || tokenData.decimals,
      fieldType: fetchedMetadata.fieldType || tokenData.fieldType,
      name: fetchedMetadata.name || tokenData.name,
      ticker: fetchedMetadata.ticker || tokenData.ticker,
    };
  }

  // 4. Handle base token (KTA) special case
  const isBaseToken = tokenAddress === baseTokenAddress;
  if (isBaseToken) {
    tokenData.name = 'Keeta Token';
    tokenData.ticker = 'KTA';
    tokenData.decimals = 9;
    tokenData.fieldType = 'decimalPlaces';
  }

  // 5. Provide fallbacks for tokens without metadata
  const hasProperMetadata = Boolean(tokenData.name && tokenData.ticker);
  const fallbackName = isBaseToken ? 'Keeta Token' : `Token ${tokenAddress.slice(-8)}`;
  const fallbackTicker = isBaseToken ? 'KTA' : tokenAddress.slice(-4).toUpperCase();

  return {
    ticker: tokenData.ticker || fallbackTicker,
    decimals: tokenData.decimals,
    fieldType: tokenData.fieldType,
    name: tokenData.name || fallbackName,
    metadata: fullMetadata,
    isBaseToken,
    isMalformed: !hasProperMetadata && !isBaseToken,
  };
}
```

### 3. **Display Pattern**

**Location:** `keythings-extension-wallet/src/popup/Dashboard.tsx` (lines 700-743)

**Token Card Structure:**
```jsx
<div className="token-card token-card--clickable">
  {/* Icon Section */}
  <div className="token-card-icon">
    {iconSrc ? (
      <img src={iconSrc} alt={`${ticker} icon`} />
    ) : (
      <div className="token-card-fallback">
        <span>{fallbackLabel}</span>
      </div>
    )}
  </div>
  
  {/* Metadata Section */}
  <div className="token-card-meta">
    <span className="token-card-name">{displayName}</span>
    {ticker && <span className="token-card-symbol">{ticker}</span>}
  </div>
  
  {/* Amount Section */}
  <div className="token-card-amount">
    <span className="token-card-amount-value">{formattedAmount}</span>
    {ticker && <span className="token-card-amount-ticker">{ticker}</span>}
  </div>
</div>
```

### 4. **Icon Extraction Pattern**

**Location:** `keythings-extension-wallet/src/lib/keeta-amount-utils.ts` (lines 359-488)

**Keeta Token Icon Standard (KIS) v1.0:**
```json
{
  "kis": {
    "version": "1.0",
    "icon": {
      "type": "badge" | "badge-square" | "image",
      "letter": "K",           // For badge types
      "bgColor": "#007acc",    // For badge types
      "textColor": "#ffffff",  // For badge types
      "shape": "circle" | "square",
      "svg": "<svg>...</svg>", // For SVG icons
      "imageData": "data:image/png;base64,...", // For images
      "mimeType": "image/png",
      "format": "png"
    }
  }
}
```

**Icon Processing:**
1. Extract `kis` object from metadata
2. Check version === "1.0"
3. Get icon object and validate type
4. Generate data URL based on type:
   - **image**: Use `imageData` directly or construct from base64
   - **svg**: Sanitize and convert to data URL
   - **badge**: Fallback to letter badge with colors

### 5. **Amount Formatting Pattern**

**Location:** `keythings-extension-wallet/src/lib/keeta-amount-utils.ts` (lines 90-128)

**Two Field Types:**

**decimalPlaces** (division-based):
```javascript
// Example: 14896999999 with decimalPlaces=9 → 14.896999999
const divisor = BigInt(10) ** BigInt(decimals);
const quotient = amount / divisor;
const remainder = amount % divisor;
// Format: `${quotient}.${remainder}`
```

**decimals** (padding-based):
```javascript
// Example: 14896999999 with decimals=9 → 14896999999.000000000
const amountStr = amount.toString();
return `${amountStr}.${'0'.repeat(decimals)}`;
```

## Website Integration Plan

### Required Changes

#### 1. Create Token Utilities (`src/app/lib/token-utils.js`)
- ✅ **Created** - Simplified version of extension utilities
- Functions: `parseMetadata`, `extractDecimalsAndFieldType`, `formatTokenAmount`, `getTokenDisplayName`, `getTokenTicker`, `getTokenIconFromMetadata`, `getTokenIconDataUrl`, `createFallbackTokenIcon`, `processTokenForDisplay`

#### 2. Update Home Page (`src/app/home/page.js`)
- Add token state management
- Fetch tokens when wallet connects
- Replace hardcoded token data with dynamic data
- Implement token display with icons and metadata

#### 3. Token Display Components
- Token icon rendering (image or fallback badge)
- Token metadata display (name, ticker, amount)
- Loading states for token fetching
- Empty state when no tokens

### Implementation Steps

1. **Add token fetching to wallet connection flow**
2. **Process token metadata for each balance**
3. **Render tokens dynamically in Holdings tab**
4. **Handle loading and error states**
5. **Test with real wallet connection**

## Next Steps

1. Update `/home` page to fetch and display real tokens
2. Test token display with connected wallet
3. Add error handling for failed metadata fetching
4. Implement token filtering (show only tokens with balance > 0)
5. Add token clicking interaction (navigate to send flow in future)

