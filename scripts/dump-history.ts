import * as KeetaNet from "@keetanetwork/keetanet-client";

async function dumpHistory(accountKey: string, depth: number = 100): Promise<void> {
  const account = KeetaNet.lib.Account.fromPublicKeyString(accountKey);
  const seed = KeetaNet.lib.Account.generateRandomSeed({ asString: true });
  const signer = KeetaNet.lib.Account.fromSeed(seed, 0);
  const client = KeetaNet.UserClient.fromNetwork("test", signer);

  const historyOptions: Record<string, unknown> = { depth, account };

  console.log("🔍 Running client.history", { account: accountKey, depth });
  const staplesRaw = await client.history(historyOptions as any);
  const normalizedStaples = Array.isArray(staplesRaw)
    ? staplesRaw.map((entry: any) => (entry && typeof entry === "object" && "voteStaple" in entry ? entry.voteStaple : entry))
    : [];
  console.log("Staple count:", normalizedStaples.length, { type: typeof staplesRaw, isArray: Array.isArray(staplesRaw) });

  if (client.filterStapleOperations) {
    const ctx = { account };
    const filtered = await client.filterStapleOperations(normalizedStaples as any, ctx);
    const filteredKeys = filtered && typeof filtered === "object" ? Object.keys(filtered as Record<string, unknown>) : [];
    console.log("Filtered groups:", filteredKeys.length, filteredKeys);
  } else {
    console.log("filterStapleOperations not available on client");
  }
}

(async () => {
  const [, , accountArg, depthArg] = process.argv;
  if (!accountArg) {
    console.error("Usage: bun scripts/dump-history.ts <accountPublicKey> [depth]");
    process.exit(1);
  }

  const depth = depthArg ? Number(depthArg) : 100;
  if (Number.isNaN(depth)) {
    console.error("Depth must be a number if provided");
    process.exit(1);
  }

  try {
    await dumpHistory(accountArg, depth);
  } catch (err) {
    console.error("Failed to dump history", err);
    process.exit(1);
  }
})();
