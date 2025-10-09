// Shared throttling mechanism for wallet balance queries
// This prevents multiple pages from making simultaneous balance requests

// Keeta error codes (matching the extension)
export const KETA_ERROR_CODES = {
  USER_REJECTED_REQUEST: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  RATE_LIMITED: 4290,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
  UNKNOWN_ERROR: 5000,
};

let lastBalanceCheck = 0;
const BALANCE_CHECK_THROTTLE = 2000; // 2 seconds to be safe
let pendingBalanceCheck = false; // Track if a balance check is in progress

export const throttleBalanceCheck = (forceCheck = false, source = 'unknown') => {
  const now = Date.now();
  const timeSinceLastCheck = now - lastBalanceCheck;
  
  // If there's already a balance check in progress, wait
  if (pendingBalanceCheck && !forceCheck) {
    return false;
  }
  
  if (!forceCheck && timeSinceLastCheck < BALANCE_CHECK_THROTTLE) {
    return false; // Throttled
  }
  
  lastBalanceCheck = now;
  pendingBalanceCheck = true;
  
  // Reset pending flag after a delay to prevent it from getting stuck
  setTimeout(() => {
    pendingBalanceCheck = false;
  }, 1000);
  
  return true; // Can proceed
};

export const resetThrottle = () => {
  lastBalanceCheck = 0;
  pendingBalanceCheck = false;
};

export const markBalanceCheckComplete = () => {
  pendingBalanceCheck = false;
};

/**
 * Check if an error is a rate-limited error from the wallet
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is a rate-limited error
 */
export const isRateLimitedError = (error) => {
  if (!error) return false;
  
  // Check by error code (most reliable)
  if (error.code === KETA_ERROR_CODES.RATE_LIMITED) {
    return true;
  }
  
  // Fallback: check by message content
  if (error.message) {
    const message = error.message.toLowerCase();
    return message.includes('throttled') || message.includes('rate limit');
  }
  
  return false;
};
