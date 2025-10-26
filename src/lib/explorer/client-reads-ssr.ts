/**
 * Explorer reads (SSR-safe reexports)
 *
 * Use these from server components and API routes to avoid importing any browser-only SDKs.
 * This module only re-exports wallet-only, SSR-safe functions and types.
 */

export {
  fetchNetworkStats,
  fetchVoteStaple,
  fetchTransactions,
  fetchAccount,
  fetchAccountCertificate,
  fetchStorage,
  fetchToken,
  fetchTokensBatch,
  parseExplorerOperation,
  parseExplorerOperations,
} from './client';

export type {
  ExplorerAccount,
  ExplorerOperation,
  ExplorerTransactionsResponse,
  ExplorerVoteStapleResponse,
  ExplorerToken,
  ExplorerCertificate,
} from './client';
