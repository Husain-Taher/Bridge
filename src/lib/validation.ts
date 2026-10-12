import { z } from 'zod';

// Disallowed or dangerous schemes
const BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'file:', 'vbscript:', 'blob:'];

// Dangerous file extensions that should never be opened automatically
export const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'ps1', 'sh', 'vbs', 'com', 'msi', 'scr', 'pif', 'application', 'gadget'
]);

// URL Validation and Normalization
export function validateAndNormalizeUrl(rawUrl: string): { isValid: boolean; normalizedUrl?: string; domain?: string; error?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { isValid: false, error: 'URL cannot be empty.' };
  }

  // Prevent dangerous schemes
  const lower = trimmed.toLowerCase();
  for (const protocol of BLOCKED_PROTOCOLS) {
    if (lower.startsWith(protocol)) {
      return { isValid: false, error: `Protocol ${protocol} is not permitted for security reasons.` };
    }
  }

  let parsed: URL;
  try {
    // If user forgot http/https protocol, test with https://
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      if (!trimmed.includes('.') && !trimmed.startsWith('localhost')) {
        return { isValid: false, error: 'Invalid URL format.' };
      }
      parsed = new URL(`https://${trimmed}`);
    } else {
      parsed = new URL(trimmed);
    }
  } catch {
    return { isValid: false, error: 'Invalid URL format.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Only HTTP and HTTPS URLs are supported.' };
  }

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
    domain: parsed.hostname,
  };
}

// Check if a file extension is potentially dangerous
export function isDangerousExtension(fileName: string): boolean {
  const parts = fileName.split('.');
  if (parts.length <= 1) return false;
  const ext = parts.pop()?.toLowerCase() || '';
  return DANGEROUS_EXTENSIONS.has(ext);
}

// Sanitize filename against directory traversal and null bytes
export function sanitizeFileName(name: string): string {
  let clean = name.replace(/\0/g, '');
  // Recursively strip ../ and ..\ traversal sequences
  while (clean.includes('../') || clean.includes('..\\')) {
    clean = clean.replace(/\.\.[\/\\]/g, '');
  }
  return clean
    .replace(/[/\\]/g, '_') // Replace remaining path separators
    .replace(/^\.+/, '') // Remove leading dots (hidden files/parent dir)
    .trim()
    .slice(0, 255); // Max 255 chars
}

// Schema: Text/Note Input
export const textTransferSchema = z.object({
  content: z
    .string()
    .min(1, 'Text content cannot be empty.')
    .max(250000, 'Content exceeds maximum limit of 250,000 characters.'),
  title: z.string().max(200, 'Title exceeds 200 characters.').optional(),
  retentionHours: z.number().int().min(1).max(720).default(72),
});

// Schema: URL Input
export const urlTransferSchema = z.object({
  url: z.string().min(1, 'URL cannot be empty.').refine((val) => validateAndNormalizeUrl(val).isValid, {
    message: 'Must be a valid HTTP or HTTPS URL.',
  }),
  title: z.string().max(200).optional(),
  retentionHours: z.number().int().min(1).max(720).default(72),
});

// Schema: File Input
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const fileTransferSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().min(1, 'File cannot be empty.').max(MAX_FILE_SIZE_BYTES, 'File size exceeds 50MB limit.'),
  fileMime: z.string().default('application/octet-stream'),
  retentionHours: z.number().int().min(1).max(720).default(72),
});

// Schema: Device Pairing Code
export const pairingCodeSchema = z
  .string()
  .trim()
  .regex(/^BR-[2-9A-HJ-NP-Z]{6}$/i, 'Pairing code must match format BR-XXXXXX.');

// Schema: Registered Device
export const deviceRegistrationSchema = z.object({
  deviceName: z.string().min(1).max(100),
  deviceType: z.enum(['laptop', 'phone', 'tablet', 'browser_extension', 'other']),
  publicKey: z.string().optional(),
});
