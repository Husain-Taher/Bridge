import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMasterKey,
  exportKeyToBase64,
  importKeyFromBase64,
  encryptText,
  decryptText,
  encryptBuffer,
  decryptBuffer,
  generatePairingCode,
  deriveKeyFromPassphrase,
} from '../src/lib/crypto';

describe('Web Crypto Primitives & End-to-End Encryption', () => {
  it('should generate, export, and import 256-bit AES-GCM master key', async () => {
    const key = await generateMasterKey();
    assert.ok(key);
    assert.equal(key.algorithm.name, 'AES-GCM');

    const keyBase64 = await exportKeyToBase64(key);
    assert.equal(typeof keyBase64, 'string');
    assert.ok(keyBase64.length > 30);

    const importedKey = await importKeyFromBase64(keyBase64);
    assert.ok(importedKey);
    assert.equal(importedKey.algorithm.name, 'AES-GCM');
  });

  it('should encrypt and decrypt plaintext accurately (Round-Trip)', async () => {
    const key = await generateMasterKey();
    const originalText = 'https://news.ycombinator.com/item?id=42000000 - High priority task';

    const encrypted = await encryptText(originalText, key);
    assert.ok(encrypted.ciphertext);
    assert.ok(encrypted.iv);
    assert.ok(encrypted.checksum);
    assert.notEqual(encrypted.ciphertext, originalText);

    const decrypted = await decryptText(
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.checksum,
      key
    );

    assert.equal(decrypted.text, originalText);
    assert.equal(decrypted.verified, true);
  });

  it('should produce unique 12-byte IVs for repeated encryptions of the same plaintext', async () => {
    const key = await generateMasterKey();
    const text = 'Identical message';

    const enc1 = await encryptText(text, key);
    const enc2 = await encryptText(text, key);

    assert.notEqual(enc1.iv, enc2.iv);
    assert.notEqual(enc1.ciphertext, enc2.ciphertext);
  });

  it('should detect tampering and fail integrity verification when checksum is altered', async () => {
    const key = await generateMasterKey();
    const text = 'Sensitive financial statement';

    const encrypted = await encryptText(text, key);
    const corruptedChecksum = '0000000000000000000000000000000000000000000000000000000000000000';

    await assert.rejects(
      async () => {
        await decryptText(encrypted.ciphertext, encrypted.iv, corruptedChecksum, key);
      },
      /Integrity check failed/
    );
  });

  it('should encrypt and decrypt binary file buffers with SHA-256 integrity verification', async () => {
    const key = await generateMasterKey();
    const fileBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]);

    const encResult = await encryptBuffer(fileBytes.buffer, key);
    assert.ok(encResult.encryptedBuffer.byteLength > 0);
    assert.ok(encResult.iv);
    assert.ok(encResult.checksum);

    const decResult = await decryptBuffer(
      encResult.encryptedBuffer,
      encResult.iv,
      encResult.checksum,
      key
    );

    assert.equal(decResult.verified, true);
    const decryptedBytes = new Uint8Array(decResult.decryptedBuffer);
    assert.deepEqual(decryptedBytes, fileBytes);
  });

  it('should derive an AES-GCM key from a passphrase and salt using PBKDF2', async () => {
    const salt = new Uint8Array(16);
    globalThis.crypto.getRandomValues(salt);

    const key = await deriveKeyFromPassphrase('user-secure-passphrase-2026', salt);
    assert.ok(key);
    assert.equal(key.algorithm.name, 'AES-GCM');
  });

  it('should generate valid human-friendly pairing codes matching BR-XXXXXX', () => {
    const code = generatePairingCode();
    assert.match(code, /^BR-[2-9A-HJ-NP-Z]{6}$/);
  });
});
