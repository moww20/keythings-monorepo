const TOKEN_HEX_PREFIX = '0x02';
const STORAGE_HEX_PREFIX = '0x04';

type IdentifierKind = 'token' | 'storage';

const HEX_PREFIX_BY_KIND: Record<IdentifierKind, string> = {
  token: TOKEN_HEX_PREFIX,
  storage: STORAGE_HEX_PREFIX,
};

let cachedKeetaModule: typeof import('@keetanetwork/keetanet-client') | null = null;

async function loadKeetaModule() {
  if (!cachedKeetaModule) {
    cachedKeetaModule = await import('@keetanetwork/keetanet-client');
  }
  return cachedKeetaModule;
}

function isHexIdentifier(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value.trim());
}

function extractPublicKeyString(account: unknown): string | null {
  if (!account) return null;
  try {
    const pk = (account as any).publicKeyString;
    if (typeof pk === 'string') return pk;
    if (pk && typeof pk.toString === 'function') {
      const value = String(pk.toString()).trim();
      if (value && value !== '[object Object]') return value;
    }
    if (pk && typeof pk.get === 'function') {
      const value = String(pk.get()).trim();
      if (value && value !== '[object Object]') return value;
    }
  } catch (error) {
    console.error('[token-address] Failed to extract publicKeyString', error);
  }
  return null;
}

async function convertHexIdentifierToKeeta(value: string, kind: IdentifierKind): Promise<string | null> {
  if (!isHexIdentifier(value)) return null;
  try {
    const KeetaNet = await loadKeetaModule();
    const prefix = HEX_PREFIX_BY_KIND[kind];
    // The SDK's fromPublicKeyAndType expects format: "0x<type><key>" where type is 2 hex chars
    // After slicing "0x", it reads first byte as type, rest as key
    const combinedHex = `${prefix}${value}`;
    console.log('[token-address] Converting hex to keeta:', { 
      original: value, 
      prefix, 
      combined: combinedHex,
      kind 
    });
    
    const account = KeetaNet.lib.Account.fromPublicKeyAndType(combinedHex);
    console.log('[token-address] Account created:', { 
      accountType: typeof account,
      hasPublicKeyString: !!(account as any)?.publicKeyString 
    });
    
    const keetaAddress = extractPublicKeyString(account);
    console.log('[token-address] Extracted keeta address:', keetaAddress);
    
    if (keetaAddress && typeof keetaAddress === 'string' && keetaAddress.startsWith('keeta_')) {
      console.log('[token-address] ✅ Conversion successful:', value, '→', keetaAddress);
      return keetaAddress;
    } else {
      console.error('[token-address] ❌ Invalid keeta address extracted:', keetaAddress);
      return null;
    }
  } catch (error) {
    console.error('[token-address] Failed to convert hex identifier to keeta format', { value, kind, error });
    return null;
  }
}

export async function normalizeTokenAddress(address: string | null | undefined): Promise<string | null> {
  if (!address) return null;
  if (address.startsWith('keeta_')) return address;
  return convertHexIdentifierToKeeta(address, 'token');
}

export async function normalizeStorageAddress(address: string | null | undefined): Promise<string | null> {
  if (!address) return null;
  if (address.startsWith('keeta_')) return address;
  return convertHexIdentifierToKeeta(address, 'storage');
}

export function isHexTokenIdentifier(value: string | null | undefined): value is string {
  return typeof value === 'string' && isHexIdentifier(value);
}

