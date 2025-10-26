"use client";

/**
 * Explorer reads for client components (SDK-first)
 *
 * This module is safe for client components and uses the SDK via dynamic
 * import helpers in sdk-read-client. Avoid using this in server components
 * or API routes. For SSR, import from '@/lib/explorer/client-reads-ssr'.
 */

import { getHistory as sdkGetHistory, getAccountState as sdkGetAccountState, getBlock as sdkGetBlock } from '@/lib/explorer/sdk-read-client';
import { parseExplorerOperation, parseExplorerOperations } from './client';
import type { ExplorerTransactionsResponse, ExplorerOperation, ExplorerAccount, ExplorerVoteStapleResponse } from './client';

export async function fetchTransactionsBrowser(query?: { startBlock?: string; depth?: number; publicKey?: string }): Promise<ExplorerTransactionsResponse> {
  const depth = query?.depth ?? 20;
  try {
    const historyResult: any = await sdkGetHistory({ depth, cursor: query?.startBlock ?? null });
    const records = Array.isArray(historyResult) ? historyResult : (historyResult?.records ?? []);
    const stapleOperations = records.map((record: any) => ({
      type: record.operationType || record.type || 'Transaction',
      voteStapleHash: record.block || '',
      toAccount: record.to || '',
      from: record.from,
      to: record.to,
      amount: record.amount,
      token: record.token,
      tokenMetadata: record.tokenMetadata,
      block: {
        $hash: record.block || record.id || '',
        date: new Date(record.timestamp || Date.now()).toISOString(),
        account: query?.publicKey || '',
      },
      operation: {
        type: record.operationType || record.type,
        from: record.from,
        to: record.to,
        amount: record.amount,
        token: record.token,
      },
    }));
    return { nextCursor: historyResult?.cursor ?? null, stapleOperations };
  } catch {
    // Fallback no data
    return { nextCursor: null, stapleOperations: [] };
  }
}

export async function fetchAccountBrowser(publicKey: string): Promise<ExplorerAccount | null> {
  try {
    const accountInfo: any = await sdkGetAccountState(publicKey);
    if (!accountInfo || typeof accountInfo !== 'object') return null;
    const tokensArr: any[] = Array.isArray((accountInfo as any)?.tokens)
      ? (accountInfo as any).tokens
      : Array.isArray((accountInfo as any)?.balances)
      ? (accountInfo as any).balances
      : [];
    return {
      publicKey,
      type: 'ACCOUNT',
      representative: null,
      owner: null,
      signers: [],
      headBlock: undefined,
      info: (accountInfo as Record<string, unknown>) || {},
      tokens: tokensArr.map((b: any) => ({
        publicKey: String(b?.token ?? b?.publicKey ?? ''),
        name: null,
        ticker: null,
        decimals: null,
        totalSupply: null,
        balance: String(b?.balance ?? '0'),
      })),
      certificates: [],
      activity: [],
    };
  } catch {
    return null;
  }
}

export async function fetchVoteStapleBrowser(blockhash: string): Promise<ExplorerVoteStapleResponse> {
  try {
    const block: any = await sdkGetBlock(blockhash);
    if (!block) {
      return { voteStaple: { blocks: [{ hash: blockhash, createdAt: new Date().toISOString(), account: '', transactions: [] }] }, previousBlockHash: null, nextBlockHash: null };
    }
    const normAddr = (v: any) => (typeof v === 'string' ? v : (v?.publicKeyString?.toString?.() ?? (v?.toString?.() ?? '')));
    const ts = (block?.date instanceof Date) ? block.date.toISOString() : (block?.createdAt ?? new Date().toISOString());
    const ops: any[] = Array.isArray((block as any)?.operations) ? (block as any).operations : [];
    const transactions = ops.map((op: any) => ({
      type: (op?.type?.toString?.() ?? String(op?.type ?? 'UNKNOWN')).toUpperCase(),
      block: { $hash: blockhash, date: ts, account: normAddr(block?.account) },
      operation: {
        type: (op?.type?.toString?.() ?? String(op?.type ?? 'UNKNOWN')).toUpperCase(),
        amount: typeof op?.amount === 'bigint' ? op.amount.toString() : String(op?.amount ?? '0'),
        from: normAddr(op?.from),
        to: normAddr(op?.to),
        token: normAddr(op?.token ?? op?.tokenAddress ?? op?.account ?? op?.target),
      },
    }));
    return { voteStaple: { blocks: [{ hash: blockhash, createdAt: ts, account: normAddr(block?.account), transactions }] }, previousBlockHash: null, nextBlockHash: null };
  } catch {
    return { voteStaple: { blocks: [{ hash: blockhash, createdAt: new Date().toISOString(), account: '', transactions: [] }] }, previousBlockHash: null, nextBlockHash: null };
  }
}

export { parseExplorerOperation, parseExplorerOperations };
