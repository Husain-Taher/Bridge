import { EncryptedFileResult, EncryptedPayload } from './types';

// Cross-environment Web Crypto API accessor
export const getSubtleCrypto = (): SubtleCrypto => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (SubtleCrypto) is not available in this environment.');
};

// Convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

// Convert Base64 to Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  let binaryString: string;
  if (typeof atob !== 'undefined') {
    binaryString = atob(base64);
  } else {
    binaryString = Buffer.from(base64, 'base64').toString('binary');
  }
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Convert ArrayBuffer or Uint8Array to Hex string
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Compute SHA-256 Hex Digest for integrity verification
export async function calculateSha256(data: Uint8Array | ArrayBuffer | string): Promise<string> {
  const subtle = getSubtleCrypto();
  let buffer: ArrayBuffer;
  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data).buffer;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer as ArrayBuffer;
  } else {
    buffer = data;
  }
  const hashBuffer = await subtle.digest('SHA-256', buffer);
  return bufferToHex(hashBuffer);
}

// Generate a cryptographic 256-bit AES-GCM master key
export async function generateMasterKey(): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  return await subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // Extractable so it can be securely backed up or synced to paired devices
    ['encrypt', 'decrypt']
  );
}

// Export a CryptoKey to a Base64 string for secure local storage / QR pairing
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const subtle = getSubtleCrypto();
  const raw = await subtle.exportKey('raw', key);
  return bufferToBase64(raw);
}

// Import a CryptoKey from a Base64 string
export async function importKeyFromBase64(base64: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const raw = base64ToUint8Array(base64);
  return await subtle.importKey(
    'raw',
    raw.buffer as ArrayBuffer,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Derive AES-GCM key from user passphrase via PBKDF2
export async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt plaintext string using AES-GCM-256 with 96-bit random IV
export async function encryptText(text: string, key: CryptoKey): Promise<EncryptedPayload> {
  const subtle = getSubtleCrypto();
  const encodedText = new TextEncoder().encode(text);

  // 1. Calculate plaintext SHA-256 checksum for end-to-end integrity
  const checksum = await calculateSha256(encodedText);

  // 2. Generate cryptographically random 12-byte (96-bit) IV
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  // 3. Encrypt payload
  const ciphertextBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedText
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    checksum,
  };
}

// Decrypt ciphertext using AES-GCM-256 and verify SHA-256 integrity
export async function decryptText(
  ciphertextB64: string,
  ivB64: string,
  expectedChecksum: string,
  key: CryptoKey
): Promise<{ text: string; verified: boolean }> {
  const subtle = getSubtleCrypto();
  const ciphertext = base64ToUint8Array(ciphertextB64);
  const iv = base64ToUint8Array(ivB64);

  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
    },
    key,
    ciphertext.buffer as ArrayBuffer
  );

  const text = new TextDecoder().decode(decryptedBuffer);

  // Verify integrity
  const calculatedChecksum = await calculateSha256(text);
  if (calculatedChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
    throw new Error('Integrity check failed: Checksum mismatch for decrypted content.');
  }

  return { text, verified: true };
}

// Encrypt binary buffer (for files and images)
export async function encryptBuffer(buffer: ArrayBuffer, key: CryptoKey): Promise<EncryptedFileResult> {
  const subtle = getSubtleCrypto();
  const checksum = await calculateSha256(buffer);

  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    buffer
  );

  return {
    encryptedBuffer,
    iv: bufferToBase64(iv),
    checksum,
  };
}

// Decrypt binary buffer (for files and images) and verify integrity
export async function decryptBuffer(
  encryptedBuffer: ArrayBuffer,
  ivB64: string,
  expectedChecksum: string,
  key: CryptoKey
): Promise<{ decryptedBuffer: ArrayBuffer; verified: boolean }> {
  const subtle = getSubtleCrypto();
  const iv = base64ToUint8Array(ivB64);

  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
    },
    key,
    encryptedBuffer
  );

  const calculatedChecksum = await calculateSha256(decryptedBuffer);
  if (calculatedChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
    throw new Error('Integrity check failed: File checksum mismatch.');
  }

  return { decryptedBuffer, verified: true };
}

// Generate human-friendly 8-character pairing code (e.g., BRDG-49X8)
export function generatePairingCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars (0, 1, I, O)
  const randomBytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(randomBytes);
  let code = 'BR-';
  for (let i = 0; i < 6; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}
