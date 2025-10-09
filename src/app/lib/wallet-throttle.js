// Shared throttling mechanism for wallet balance queries
// This prevents multiple pages from making simultaneous balance requests

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
