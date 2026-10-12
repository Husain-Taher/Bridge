import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndNormalizeUrl,
  isDangerousExtension,
  sanitizeFileName,
  textTransferSchema,
  urlTransferSchema,
  fileTransferSchema,
  pairingCodeSchema,
} from '../src/lib/validation';

describe('Validation, Normalization & Sanitization', () => {
  describe('URL Validation', () => {
    it('should validate and normalize standard HTTP and HTTPS URLs', () => {
      const res = validateAndNormalizeUrl('https://vercel.com/docs');
      assert.equal(res.isValid, true);
      assert.equal(res.normalizedUrl, 'https://vercel.com/docs');
      assert.equal(res.domain, 'vercel.com');
    });

    it('should prepend https:// when protocol is omitted', () => {
      const res = validateAndNormalizeUrl('github.com/trending');
      assert.equal(res.isValid, true);
      assert.equal(res.normalizedUrl, 'https://github.com/trending');
      assert.equal(res.domain, 'github.com');
    });

    it('should block dangerous schemes (javascript:, data:, file:)', () => {
      const res1 = validateAndNormalizeUrl('javascript:alert(1)');
      assert.equal(res1.isValid, false);
      assert.ok(res1.error?.includes('not permitted'));

      const res2 = validateAndNormalizeUrl('data:text/html,<script>alert(1)</script>');
      assert.equal(res2.isValid, false);

      const res3 = validateAndNormalizeUrl('file:///etc/passwd');
      assert.equal(res3.isValid, false);
    });

    it('should reject invalid or malformed URL strings', () => {
      const res = validateAndNormalizeUrl('   ');
      assert.equal(res.isValid, false);
    });
  });

  describe('File Security & Sanitization', () => {
    it('should identify dangerous executable file extensions', () => {
      assert.equal(isDangerousExtension('installer.exe'), true);
      assert.equal(isDangerousExtension('script.bat'), true);
      assert.equal(isDangerousExtension('payload.ps1'), true);
      assert.equal(isDangerousExtension('document.pdf'), false);
      assert.equal(isDangerousExtension('photo.png'), false);
      assert.equal(isDangerousExtension('notes.txt'), false);
    });

    it('should sanitize filenames against path traversal and null bytes', () => {
      assert.equal(sanitizeFileName('../../secret.txt'), 'secret.txt');
      assert.equal(sanitizeFileName('folder/sub/file.pdf'), 'folder_sub_file.pdf');
      assert.equal(sanitizeFileName('null\0byte.jpg'), 'nullbyte.jpg');
    });
  });

  describe('Zod Schemas', () => {
    it('should validate text transfers within bounds', () => {
      const valid = textTransferSchema.safeParse({ content: 'Quick note to self' });
      assert.equal(valid.success, true);

      const empty = textTransferSchema.safeParse({ content: '' });
      assert.equal(empty.success, false);

      const tooLong = textTransferSchema.safeParse({ content: 'a'.repeat(250001) });
      assert.equal(tooLong.success, false);
    });

    it('should validate URL transfer schema with http or https', () => {
      const valid = urlTransferSchema.safeParse({ url: 'https://news.ycombinator.com' });
      assert.equal(valid.success, true);

      const invalid = urlTransferSchema.safeParse({ url: 'not-a-valid-url' });
      assert.equal(invalid.success, false);
    });

    it('should validate file sizes up to 50MB', () => {
      const valid = fileTransferSchema.safeParse({
        fileName: 'report.pdf',
        fileSize: 1024 * 1024 * 10, // 10MB
      });
      assert.equal(valid.success, true);

      const tooLarge = fileTransferSchema.safeParse({
        fileName: 'huge.iso',
        fileSize: 1024 * 1024 * 51, // 51MB
      });
      assert.equal(tooLarge.success, false);
    });

    it('should validate human-friendly pairing code format', () => {
      assert.equal(pairingCodeSchema.safeParse('BR-94A2XK').success, true);
      assert.equal(pairingCodeSchema.safeParse('BR-invalid-long').success, false);
      assert.equal(pairingCodeSchema.safeParse('123456').success, false);
    });
  });
});
