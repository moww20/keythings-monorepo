#!/usr/bin/env bun

import { setTimeout as sleep } from 'node:timers/promises';
import { Buffer } from 'node:buffer';

import { z } from 'zod';

import * as KeetaNet from '@keetanetwork/keetanet-client';

type NetworkAlias = Parameters<typeof KeetaNet.UserClient.fromNetwork>[0];

const API_BASE = (process.env.AUTOSIGNER_API_URL ?? 'https://testnet.api.keythings.xyz').replace(/\/$/, '');
const PROFILE_ID = process.env.AUTOSIGNER_PROFILE_ID;
const ACCOUNT_SEED = process.env.AUTOSIGNER_ACCOUNT_SEED;
const ACCOUNT_INDEX = Number.parseInt(process.env.AUTOSIGNER_ACCOUNT_INDEX ?? '0', 10);
const NETWORK_ALIAS = (process.env.AUTOSIGNER_NETWORK ?? 'test') as NetworkAlias;
const POLL_INTERVAL_MS = Number.parseInt(process.env.AUTOSIGNER_POLL_INTERVAL_MS ?? '2000', 10);
const REQUEST_LIMIT = Number.parseInt(process.env.AUTOSIGNER_BATCH_SIZE ?? '10', 10);

if (!PROFILE_ID) {
  console.error('[autosigner] Missing AUTOSIGNER_PROFILE_ID environment variable.');
  process.exit(1);
}

if (!ACCOUNT_SEED) {
  console.error('[autosigner] Missing AUTOSIGNER_ACCOUNT_SEED environment variable.');
  process.exit(1);
}

const fillRequestSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  unsigned_block: z.string(),
  taker_signature: z.string().optional().nullable(),
  taker_address: z.string().optional().nullable(),
  requested_at: z.string().optional().nullable(),
  amount: z.union([z.string(), z.number()]).optional().nullable(),
});

type FillRequest = z.infer<typeof fillRequestSchema>;

type BuilderCtor = ReturnType<typeof createBuilderClass>;

type PendingJson = {
  renderedBlocks: string[];
  nonRendered: unknown[];
};

function parsePendingPayload(encoded: string): PendingJson[] {
  try {
    const raw = Buffer.from(encoded, 'base64').toString('utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      return parsed as PendingJson[];
    }

    if (parsed && typeof parsed === 'object' && 'pending' in parsed) {
      const pending = (parsed as { pending: PendingJson[] }).pending;
      return Array.isArray(pending) ? pending : [];
    }

    return parsed ? [parsed as PendingJson] : [];
  } catch (error) {
    console.error('[autosigner] failed to parse unsigned block payload', error);
    return [];
  }
}

async function fetchFillRequests(): Promise<FillRequest[]> {
  try {
    const url = new URL(`/api/rfq/makers/${encodeURIComponent(PROFILE_ID!)}/fill-requests`, API_BASE);
    if (Number.isFinite(REQUEST_LIMIT) && REQUEST_LIMIT > 0) {
      url.searchParams.set('limit', REQUEST_LIMIT.toString());
    }

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      console.warn('[autosigner] fill-request poll failed', response.status, text);
      return [];
    }

    const payload = (await response.json()) as unknown;
    const result = z.array(fillRequestSchema).safeParse(payload);
    if (!result.success) {
      console.warn('[autosigner] unable to parse fill request payload', result.error.flatten());
      return [];
    }

    return result.data;
  } catch (error) {
    console.error('[autosigner] failed to poll fill requests', error);
    return [];
  }
}

async function acknowledgeFill(
  request: FillRequest,
  status: 'confirmed' | 'failed',
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/rfq/orders/${encodeURIComponent(request.order_id)}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: request.id,
        status,
        ...payload,
      }),
    });
  } catch (error) {
    console.error('[autosigner] failed to acknowledge fill result', error);
  }
}

function createBuilderClass(client: KeetaNet.UserClient) {
  const builder = client.initBuilder();
  return builder.constructor as typeof builder;
}

async function handleFillRequest(
  request: FillRequest,
  client: KeetaNet.UserClient,
  account: ReturnType<typeof KeetaNet.lib.Account.fromSeed>,
  builderClass: BuilderCtor,
): Promise<void> {
  const pending = parsePendingPayload(request.unsigned_block);
  if (pending.length === 0) {
    console.warn('[autosigner] request', request.id, 'missing pending blocks');
    await acknowledgeFill(request, 'failed', { reason: 'missing_pending_blocks' });
    return;
  }

  const builder = await builderClass.FromPendingJSON(
    { signer: account, userClient: client },
    async () => account,
    pending as unknown as Parameters<typeof builderClass.FromPendingJSON>[2],
  );

  try {
    const publishResult = await builder.publish({ userClient: client });
    const publishedHashes =
      publishResult?.blocks?.map((block) => {
        const hash = block?.hash as unknown;
        if (!hash) {
          return null;
        }
        if (typeof hash === 'string') {
          return hash;
        }
        if (typeof (hash as { toString?: () => string }).toString === 'function') {
          return (hash as { toString(): string }).toString();
        }
        return null;
      }) ?? [];

    console.log('[autosigner] co-signed RFQ order', request.order_id, 'blocks', publishedHashes);

    await acknowledgeFill(request, 'confirmed', {
      block_hashes: publishedHashes.filter(Boolean),
      taker_address: request.taker_address ?? null,
    });
  } catch (error) {
    console.error('[autosigner] failed to publish builder for request', request.id, error);
    await acknowledgeFill(request, 'failed', {
      reason: error instanceof Error ? error.message : 'publish_failed',
    });
  }
}

async function main() {
  console.log('[autosigner] starting maker autosigner for profile', PROFILE_ID);

  const signerAccount = KeetaNet.lib.Account.fromSeed(ACCOUNT_SEED!, ACCOUNT_INDEX);
  const userClient = KeetaNet.UserClient.fromNetwork(NETWORK_ALIAS, signerAccount);
  const builderClass = createBuilderClass(userClient);

  while (true) {
    const requests = await fetchFillRequests();

    for (const request of requests) {
      await handleFillRequest(request, userClient, signerAccount, builderClass);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch((error) => {
  console.error('[autosigner] fatal error', error);
  process.exit(1);
});
