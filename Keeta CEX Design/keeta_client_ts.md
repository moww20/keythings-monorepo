# Keeta CEX – Client SDK (TypeScript)

This is a minimal, production-leaning client SDK for a **CEX with internal orderbook** on Keeta.  
It assumes:
- Users custody funds in **user-owned storage accounts (`S_user`)**.
- Exchange has delegated `SEND_ON_BEHALF` for withdrawals.
- Orders are off-chain; the chain is for custody/settlement.

> Structure
```
keeta-client/
├─ package.json
├─ tsconfig.json
└─ src/
   ├─ types.ts
   ├─ auth.ts
   ├─ http.ts
   ├─ keeta.ts          # Keeta ledger shim (signing, self-withdraw)
   ├─ client.ts        # High-level methods (place order, cancel, withdraw, get balances)
   └─ demo.ts
```

---

## package.json
```json
{
  "name": "keeta-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p .",
    "start": "ts-node src/demo.ts",
    "lint": "eslint ."
  },
  "dependencies": {
    "cross-fetch": "^4.0.0",
    "tweetnacl": "^1.0.3",
    "bs58": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2"
  }
}
```

## tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## src/types.ts
```ts
export type PublicKeyBase58 = string;
export type SignatureBase58 = string;

export interface AuthSession {
  userId: string;
  jwt: string;
}

export type Side = "buy" | "sell";

export interface LimitOrder {
  id?: string;
  market: string;         // e.g., "USDX/USDT"
  side: Side;
  price: string;          // decimal as string
  quantity: string;       // decimal as string
  tif?: "gtc" | "ioc" | "postonly";
}

export interface PlacedOrder extends LimitOrder {
  id: string;
  status: "resting" | "filled" | "canceled" | "rejected" | "partially_filled";
  filledQuantity: string;
}

export interface Balance {
  token: string;
  available: string;
  total: string;
}

export interface WithdrawRequest {
  token: string;
  amount: string;
  to: PublicKeyBase58;     // destination account
}

export interface ApiError {
  code: string;
  message: string;
  data?: unknown;
}
```

---

## src/http.ts
```ts
import fetch from "cross-fetch";

export class Http {
  constructor(private baseUrl: string, private getToken?: () => string | undefined) {}

  async get<T>(path: string): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      headers: this.headers()
    });
    if (!res.ok) throw await this.error(res);
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await this.error(res);
    return res.json() as Promise<T>;
  }

  private headers() {
    const h: Record<string, string> = {
      "content-type": "application/json"
    };
    const t = this.getToken?.();
    if (t) h["authorization"] = `Bearer ${t}`;
    return h;
  }

  private async error(res: Response) {
    let payload: any;
    try { payload = await res.json(); } catch {}
    return new Error((payload && payload.message) || res.statusText);
  }
}
```

---

## src/auth.ts
```ts
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Http } from "./http.js";
import type { AuthSession, PublicKeyBase58 } from "./types.js";

export class AuthClient {
  private session?: AuthSession;
  constructor(private http: Http) {}

  get token() { return this.session?.jwt; }

  /**
   * Challenge/response using the user's Keeta keypair
   */
  async login(signFn: (msg: Uint8Array) => Uint8Array, pubkey: Uint8Array): Promise<AuthSession> {
    const pk58 = bs58.encode(pubkey);
    const { nonce }: { nonce: string } = await this.http.post("/auth/challenge", { pubkey: pk58 });
    const msg = new TextEncoder().encode(`keeta-login:${nonce}`);
    const sig = signFn(msg);
    const sig58 = bs58.encode(sig);
    this.session = await this.http.post<AuthSession>("/auth/verify", { pubkey: pk58, signature: sig58 });
    return this.session;
  }
}
```

---

## src/keeta.ts (Ledger shim for self-withdraw + address helpers)
```ts
import bs58 from "bs58";

export interface SendOp {
  to: string;         // dest account (base58)
  amount: string;     // decimal-as-string
  token: string;      // token id
  external?: string;  // memo
}

export interface SignedBlock {
  operations: SendOp[];
  signature: string;    // signature over serialized block
  signer: string;       // base58 pubkey
}

/**
 * In a real integration this module would:
 * - Build ASN.1 Keeta blocks
 * - Sign with user's private key (for OWNER direct withdraw)
 * - Submit to a Keeta RPC
 * For now we leave placeholders for wire integration.
 */
export class KeetaLedger {
  constructor(private rpcUrl: string) {}

  async buildAndSignSend(ownerSecretKey: Uint8Array, fromStorageAccount: string, op: SendOp): Promise<SignedBlock> {
    // PSEUDO: serialize as bytes using the Keeta ASN.1 schema, then sign
    // Here we'll just create a dummy structure
    const signer = "BASE58_PUBKEY_PLACEHOLDER";
    const signature = "BASE58_SIG_PLACEHOLDER";
    return {
      operations: [op],
      signature,
      signer
    };
  }

  async submit(block: SignedBlock): Promise<{ txid: string }> {
    // PSEUDO: POST to RPC with block
    return { txid: "DUMMY_TX_" + Math.random().toString(36).slice(2) };
  }

  async getStorageAddressForUser(pubkeyBase58: string): Promise<string> {
    // Deterministic derived storage account address; depends on network params.
    return `STOR_${pubkeyBase58.slice(0, 8)}_DERIVED`;
  }
}
```

---

## src/client.ts
```ts
import { Http } from "./http.js";
import { AuthClient } from "./auth.js";
import { KeetaLedger, type SendOp } from "./keeta.js";
import type { AuthSession, Balance, LimitOrder, PlacedOrder, WithdrawRequest } from "./types.js";

export class CexClient {
  private http: Http;
  private auth: AuthClient;
  private keeta: KeetaLedger;

  constructor(baseUrl: string, keetaRpcUrl: string, private getToken?: () => string | undefined) {
    this.http = new Http(baseUrl, () => this.auth.token ?? this.getToken?.());
    this.auth = new AuthClient(this.http);
    this.keeta = new KeetaLedger(keetaRpcUrl);
  }

  // --- auth
  async login(signFn: (msg: Uint8Array) => Uint8Array, pubkey: Uint8Array): Promise<AuthSession> {
    return this.auth.login(signFn, pubkey);
  }

  // --- orders
  async placeOrder(order: LimitOrder): Promise<PlacedOrder> {
    return this.http.post("/orders/place", order);
  }

  async cancelOrder(id: string): Promise<{ id: string; status: "canceled" } > {
    return this.http.post("/orders/cancel", { id });
  }

  async getBalances(): Promise<Balance[]> {
    return this.http.get("/balances");
  }

  async getDepositAddress(): Promise<{ storageAccount: string }> {
    return this.http.get("/deposits/address");
  }

  // --- withdrawals
  async requestWithdraw(req: WithdrawRequest): Promise<{ requestId: string }> {
    // Exchange will use SEND_ON_BEHALF on S_user to settle
    return this.http.post("/withdrawals/request", req);
  }

  // --- self-withdraw (owner path) fallback
  async selfWithdraw(ownerSecretKey: Uint8Array, storageAccount: string, op: SendOp) {
    const block = await this.keeta.buildAndSignSend(ownerSecretKey, storageAccount, op);
    return this.keeta.submit(block);
  }
}
```

---

## src/demo.ts
```ts
import nacl from "tweetnacl";
import bs58 from "bs58";
import { CexClient } from "./client.js";

async function main() {
  const key = nacl.sign.keyPair();
  const client = new CexClient("http://localhost:8080", "http://localhost:9090");

  // login
  await client.login((msg) => nacl.sign.detached(msg, key.secretKey), key.publicKey);

  // balances
  console.log("balances:", await client.getBalances());

  // place order
  const placed = await client.placeOrder({ market: "USDX/USDT", side: "buy", price: "1.0001", quantity: "100" });
  console.log("placed:", placed);

  // withdraw via exchange
  const w = await client.requestWithdraw({ token: "USDX", amount: "10", to: bs58.encode(key.publicKey) });
  console.log("withdrawal requested:", w);

  // self-withdraw (owner fallback) example
  const storage = (await client.getDepositAddress()).storageAccount;
  const res = await client.selfWithdraw(key.secretKey, storage, { to: "DEST_BASE58", token: "USDX", amount: "5" });
  console.log("owner-withdraw res:", res);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```
