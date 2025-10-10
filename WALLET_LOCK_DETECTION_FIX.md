# Wallet Lock Detection Fix

## Problem
The website was not properly detecting when the Keeta Wallet extension was locked. When users had a locked wallet, they would see the "Connect Wallet" screen instead of the "Wallet Locked" screen.

## Root Cause
In `src/app/hooks/useWalletData.js`, the `fetchWalletState()` function was incorrectly handling the case when no accounts were returned:

```javascript
// BEFORE (Lines 92-100)
if (!accounts.length) {
  return {
    connected: false,      // ❌ Wrong: should be true if locked
    accounts: [],
    balance: null,
    network: null,
    isLocked: false,       // ❌ Wrong: should preserve actual lock state
    isInitializing: false,
  };
}
```

### Why This Was Wrong
1. When the wallet is **locked**, `getAccounts()` returns an empty array
2. The code treated "no accounts" as "not connected" 
3. It also hardcoded `isLocked: false` instead of preserving the actual lock state
4. The homepage checks for `wallet.connected && wallet.isLocked` to show the locked screen
5. Since `connected` was false, the condition never matched, showing "Connect Wallet" instead

## Solution
Preserve the actual `isLocked` state and set `connected: true` when the wallet is locked:

```javascript
// AFTER (Lines 92-103)
if (!accounts.length) {
  // If wallet is locked, it's technically "connected" but just locked
  // This allows the UI to show the locked screen instead of connect screen
  return {
    connected: isLocked,   // ✅ True if locked, false if not connected
    accounts: [],
    balance: null,
    network: null,
    isLocked,             // ✅ Preserve actual lock state
    isInitializing: false,
  };
}
```

## Wallet States

### Before Fix
| Actual State | Returned State | UI Shown |
|-------------|----------------|----------|
| Not Connected | `connected: false, isLocked: false` | ✅ Connect Wallet |
| Connected & Unlocked | `connected: true, isLocked: false` | ✅ Dashboard |
| Connected & Locked | `connected: false, isLocked: false` | ❌ Connect Wallet (Wrong!) |

### After Fix
| Actual State | Returned State | UI Shown |
|-------------|----------------|----------|
| Not Connected | `connected: false, isLocked: false` | ✅ Connect Wallet |
| Connected & Unlocked | `connected: true, isLocked: false` | ✅ Dashboard |
| Connected & Locked | `connected: true, isLocked: true` | ✅ Wallet Locked |

## How Lock Detection Works

### Extension Side
1. Extension stores session state in `chrome.storage.local` with `isLocked` boolean
2. When locked, the session has `isLocked: true`
3. The `keeta_isLocked` RPC method reads this from storage

### Website Side
1. Calls `provider.isLocked()` to check lock state
2. Calls `provider.getAccounts()` to get accounts
3. If wallet is locked, `getAccounts()` returns `[]`
4. Now correctly identifies this as "locked" vs "not connected"

## User Experience

### Locked Wallet Screen
When locked, users now see:
- 🔒 Lock icon
- "Wallet Locked" heading
- Instructions to unlock the extension
- "Check Again" button to refresh state

### Not Connected Screen  
When not connected, users see:
- "Connect Your Keeta Wallet" heading
- Instructions to connect
- "Connect Wallet" button

## Testing

### Manual Test Steps
1. **Install** the Keeta Wallet extension
2. **Create/Import** a wallet and set a password
3. **Lock** the wallet (click lock icon in extension)
4. **Visit** the website
5. **Verify** "Wallet Locked" screen appears (not "Connect Wallet")
6. **Unlock** wallet in extension
7. **Click** "Check Again" button
8. **Verify** Dashboard loads with balance

### Edge Cases Handled
- ✅ Wallet not installed → Shows "Connect Wallet"
- ✅ Wallet installed but never connected → Shows "Connect Wallet"  
- ✅ Wallet connected but locked → Shows "Wallet Locked"
- ✅ Wallet connected and unlocked → Shows Dashboard
- ✅ User locks wallet while viewing dashboard → Shows notification toast

## Files Changed
- `src/app/hooks/useWalletData.js` - Fixed lock state detection logic

## Build Status
- ✅ `npm run lint` - No warnings or errors
- ✅ `npm run build` - Build successful

## Related Components
- `src/app/home/page.js` - Home page that shows different screens based on wallet state
- `src/app/components/WalletAutoConnect.js` - Handles auto-connect on page load
- Extension: `src/inpage/inpage-provider.ts` - Implements `isLocked()` method
- Extension: `src/background/wallet-provider-handler.ts` - Handles `keeta_isLocked` RPC call

## Future Improvements
Consider adding:
- Real-time lock state change detection via events
- Automatic refresh when wallet is unlocked (instead of manual "Check Again")
- Toast notification when wallet gets locked during active session

