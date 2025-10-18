/**
 * Lightweight encoding helpers that work in both browser and server environments.
 * Avoids relying on Node's Buffer in client bundles while providing fallbacks
 * during SSR or tests where Buffer is still available.
 */

function hasBrowserEncoder(): boolean {
  return typeof window !== 'undefined' && typeof window.btoa === 'function';
}

function hasBrowserDecoder(): boolean {
  return typeof window !== 'undefined' && typeof window.atob === 'function';
}

function getNodeBuffer() {
  if (typeof globalThis === 'undefined') {
    return null;
  }

  const maybeBuffer = (globalThis as Record<string, unknown>).Buffer as
    | { from: (input: string, encoding?: string) => { toString: (encoding?: string) => string } }
    | undefined;

  return typeof maybeBuffer === 'object' && typeof maybeBuffer?.from === 'function' ? maybeBuffer : null;
}

function encodeUtf8ToBase64Browser(value: string): string {
  // Encode to UTF-8 before base64 to preserve Unicode characters
  const utf8 = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
  return window.btoa(utf8);
}

function decodeBase64ToUtf8Browser(value: string): string {
  const binary = window.atob(value);
  const encoded = binary
    .split('')
    .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
    .join('');
  return decodeURIComponent(encoded);
}

export function encodeToBase64(value: string): string {
  if (hasBrowserEncoder()) {
    return encodeUtf8ToBase64Browser(value);
  }

  const nodeBuffer = getNodeBuffer();
  if (nodeBuffer) {
    return nodeBuffer.from(value, 'utf-8').toString('base64');
  }

  throw new Error('Base64 encoding is not supported in this environment.');
}

export function decodeFromBase64(value: string): string {
  if (!value) {
    return '';
  }

  if (hasBrowserDecoder()) {
    return decodeBase64ToUtf8Browser(value);
  }

  const nodeBuffer = getNodeBuffer();
  if (nodeBuffer) {
    return nodeBuffer.from(value, 'base64').toString('utf-8');
  }

  throw new Error('Base64 decoding is not supported in this environment.');
}

export function normalizeHexString(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }

  return trimmed.startsWith('0x') ? trimmed.slice(2).toLowerCase() : trimmed.toLowerCase();
}

export function hexByteLength(value: string): number {
  const normalized = normalizeHexString(value);
  return normalized.length % 2 === 0 ? normalized.length / 2 : (normalized.length - 1) / 2;
}
