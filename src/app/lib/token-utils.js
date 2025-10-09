/**
 * Token Utilities for Website
 * Simplified version based on extension wallet patterns
 */

/**
 * Parse base64 encoded metadata
 */
function parseMetadata(metadata) {
  if (!metadata) return null;
  try {
    const metadataJson = atob(metadata);
    const parsed = JSON.parse(metadataJson);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Extract decimals and field type from token metadata
 */
export function extractDecimalsAndFieldType(metadata) {
  const metadataObj = parseMetadata(metadata);
  if (!metadataObj) return { decimals: 0, fieldType: 'decimals' };

  // Check decimalPlaces first (higher priority)
  if ('decimalPlaces' in metadataObj && typeof metadataObj.decimalPlaces === 'number') {
    return { decimals: metadataObj.decimalPlaces, fieldType: 'decimalPlaces' };
  }

  // Fallback to decimals
  if ('decimals' in metadataObj && typeof metadataObj.decimals === 'number') {
    return { decimals: metadataObj.decimals, fieldType: 'decimals' };
  }

  return { decimals: 0, fieldType: 'decimals' };
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(rawAmount, decimals = 0, fieldType = 'decimals') {
  const amount = BigInt(rawAmount);

  if (decimals === 0) {
    return amount.toString();
  }

  if (fieldType === 'decimalPlaces') {
    // decimalPlaces: divide by 10^decimalPlaces
    const divisor = BigInt(10) ** BigInt(decimals);
    const quotient = amount / divisor;
    const remainder = amount % divisor;

    if (remainder === 0n) {
      return quotient.toString();
    }

    // Format with proper decimal places
    const remainderStr = remainder.toString().padStart(decimals, '0');
    const displayFractional = remainderStr.replace(/0+$/, '');

    if (displayFractional === '') {
      return quotient.toString();
    }

    return `${quotient}.${displayFractional}`;
  } else {
    // decimals: add decimal padding (no division)
    const amountStr = amount.toString();
    return `${amountStr}.${'0'.repeat(decimals)}`;
  }
}

/**
 * Format amount with commas for readability
 */
export function formatAmountWithCommas(amount) {
  const [integerPart, decimalPart] = amount.toString().split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  if (decimalPart) {
    // Remove trailing zeros from decimal part
    const trimmedDecimal = decimalPart.replace(/0+$/, '');
    return trimmedDecimal ? `${formattedInteger}.${trimmedDecimal}` : formattedInteger;
  }
  
  return formattedInteger;
}

/**
 * Get token display name from metadata
 */
export function getTokenDisplayName(metadata) {
  const metadataObj = parseMetadata(metadata);
  if (!metadataObj) return '';

  if (metadataObj.displayName) return metadataObj.displayName;
  if (metadataObj.name) return metadataObj.name;
  if (metadataObj.symbol) return metadataObj.symbol;
  
  return '';
}

/**
 * Get token ticker/symbol from metadata
 */
export function getTokenTicker(metadata) {
  const metadataObj = parseMetadata(metadata);
  if (!metadataObj) return '';

  if (metadataObj.symbol) return metadataObj.symbol;
  if (metadataObj.ticker) return metadataObj.ticker;
  if (metadataObj.name) return metadataObj.name;
  
  return '';
}

/**
 * Get token icon from metadata (Keeta Token Icon Standard - KIS)
 */
export function getTokenIconFromMetadata(metadata) {
  const metadataObj = parseMetadata(metadata);
  if (!metadataObj) return null;

  const kis = metadataObj.kis;
  if (!kis || typeof kis !== 'object') return null;

  const version = kis.version;
  const icon = kis.icon;

  if (version === '1.0' && icon && typeof icon === 'object') {
    const type = icon.type;
    if (type === 'badge' || type === 'badge-square' || type === 'image') {
      return icon;
    }
  }
  
  return null;
}

/**
 * Sanitize SVG markup to prevent XSS
 */
function sanitizeSvgMarkup(svg) {
  if (!svg) return null;
  
  // Check for dangerous patterns
  if (/<\s*script/i.test(svg)) return null;
  if (/\son[a-z0-9-]+\s*=/gi.test(svg)) return null;
  if (/\s(?:href|xlink:href)\s*=\s*['"]\s*javascript:/gi.test(svg)) return null;
  
  return svg;
}

/**
 * Generate a data URL for the token icon
 */
export function getTokenIconDataUrl(icon) {
  if (!icon) return '';

  // Handle image type
  if (icon.type === 'image' && icon.imageData) {
    if (icon.imageData.startsWith('data:')) {
      return icon.imageData;
    }
    
    if (icon.mimeType && !icon.imageData.includes(',')) {
      return `data:${icon.mimeType};base64,${icon.imageData}`;
    }
    
    return '';
  }

  // Handle SVG
  if (icon.svg) {
    const sanitized = sanitizeSvgMarkup(icon.svg);
    if (!sanitized) return '';
    
    try {
      const base64 = btoa(sanitized);
      return `data:image/svg+xml;base64,${base64}`;
    } catch {
      return '';
    }
  }

  return '';
}

/**
 * Create a fallback badge icon
 */
export function createFallbackTokenIcon(symbol) {
  const letter = symbol.charAt(0).toUpperCase();
  
  // Color palette for badges
  const colors = [
    { bg: '#ff6b35', text: '#ffffff' }, // Orange
    { bg: '#007acc', text: '#ffffff' }, // Blue
    { bg: '#28a745', text: '#ffffff' }, // Green
    { bg: '#dc3545', text: '#ffffff' }, // Red
    { bg: '#ffc107', text: '#000000' }, // Yellow
    { bg: '#6f42c1', text: '#ffffff' }, // Purple
  ];

  // Select color based on first character
  const charCode = letter.charCodeAt(0);
  const colorIndex = charCode % colors.length;
  const color = colors[colorIndex];

  return {
    type: 'badge',
    letter,
    bgColor: color.bg,
    textColor: color.text,
    shape: 'circle',
  };
}

/**
 * Process token metadata for display
 */
export async function processTokenForDisplay(tokenAddress, balance, metadata, baseTokenAddress) {
  // Check if this is the base token (KTA)
  const isBaseToken = tokenAddress === baseTokenAddress;

  let decimals = 9; // Default for KTA
  let fieldType = 'decimalPlaces';
  let name = 'Unknown Token';
  let ticker = '';

  if (isBaseToken) {
    name = 'Keeta Token';
    ticker = 'KTA';
  } else if (metadata) {
    // Extract metadata
    const decimalInfo = extractDecimalsAndFieldType(metadata);
    decimals = decimalInfo.decimals;
    fieldType = decimalInfo.fieldType;
    
    name = getTokenDisplayName(metadata) || `Token ${tokenAddress.slice(-8)}`;
    ticker = getTokenTicker(metadata) || tokenAddress.slice(-4).toUpperCase();
  } else {
    // Fallback for tokens without metadata
    name = `Token ${tokenAddress.slice(-8)}`;
    ticker = tokenAddress.slice(-4).toUpperCase();
  }

  // Format the amount
  const formattedAmount = formatTokenAmount(balance, decimals, fieldType);
  const displayAmount = formatAmountWithCommas(formattedAmount);

  // Get icon
  const icon = metadata ? getTokenIconFromMetadata(metadata) : null;
  const iconDataUrl = icon ? getTokenIconDataUrl(icon) : '';
  const fallbackIcon = icon ? null : createFallbackTokenIcon(ticker);

  return {
    address: tokenAddress,
    name,
    ticker,
    balance: balance.toString(),
    formattedAmount: displayAmount,
    decimals,
    fieldType,
    isBaseToken,
    icon: iconDataUrl,
    fallbackIcon,
    hasMetadata: !!metadata && !!ticker && !!name,
  };
}

