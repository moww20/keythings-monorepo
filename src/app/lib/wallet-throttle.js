// Shared throttling mechanism for wallet balance queries
// This prevents multiple pages from making simultaneous balance requests

let lastBalanceCheck = 0;
const BALANCE_CHECK_THROTTLE = 2000; // 2 seconds to be safe

export const throttleBalanceCheck = (forceCheck = false) => {
  const now = Date.now();
  const timeSinceLastCheck = now - lastBalanceCheck;
  
  if (!forceCheck && timeSinceLastCheck < BALANCE_CHECK_THROTTLE) {
    const remainingTime = Math.ceil((BALANCE_CHECK_THROTTLE - timeSinceLastCheck) / 1000);
    console.log(`Balance queries are throttled. Please wait ${remainingTime} second(s) before retrying.`);
    return false; // Throttled
  }
  
  lastBalanceCheck = now;
  return true; // Can proceed
};

export const resetThrottle = () => {
  lastBalanceCheck = 0;
};
