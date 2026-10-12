export type TransferType = 'text' | 'url' | 'file' | 'image';

export type DeviceType = 'laptop' | 'phone' | 'tablet' | 'browser_extension' | 'other';

export interface TransferItem {
  id: string;
  user_id: string;
  source_device_id?: string | null;
  source_device_name?: string | null;
  type: TransferType;
  title_ciphertext?: string | null;
  content_ciphertext: string;
  iv: string;
  checksum: string;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_mime?: string | null;
  file_iv?: string | null;
  pinned: boolean;
  retention_hours: number;
  expires_at: string;
  is_deleted: boolean;
  created_at: string;

  // Decrypted client-side representation
  decrypted_content?: string;
  decrypted_title?: string;
  verified_integrity?: boolean;
}

export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  device_type: DeviceType;
  public_key?: string | null;
  last_seen_at: string;
  is_revoked: boolean;
  created_at: string;
}

export type PairingStatus = 'pending' | 'approved' | 'claimed' | 'expired' | 'revoked';

export interface PairingInvitation {
  id: string;
  user_id: string;
  invitation_code: string;
  ephemeral_key: string;
  device_name: string;
  status: PairingStatus;
  claimed_by_device_id?: string | null;
  expires_at: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EncryptedPayload {
  ciphertext: string; // Base64
  iv: string;         // Base64 (12 bytes)
  checksum: string;   // SHA-256 hex digest
}

export interface EncryptedFileResult {
  encryptedBuffer: ArrayBuffer;
  iv: string;
  checksum: string;
}

export type FilterType = 'all' | 'url' | 'text' | 'file' | 'pinned';

export interface CreateTransferInput {
  type: TransferType;
  rawContent: string;
  title?: string;
  file?: File;
  retentionHours?: number;
}
