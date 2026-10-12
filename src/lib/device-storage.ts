import { DeviceType } from './types';
import { exportKeyToBase64, generateMasterKey, importKeyFromBase64 } from './crypto';

const KEY_STORAGE_NAME = 'bridge_master_key_v1';
const DEVICE_ID_STORAGE_NAME = 'bridge_device_id_v1';
const DEVICE_NAME_STORAGE_NAME = 'bridge_device_name_v1';
const DEVICE_TYPE_STORAGE_NAME = 'bridge_device_type_v1';

// Detect device type from user agent and screen
export function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'laptop';
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod/.test(ua)) {
    return 'phone';
  }
  if (/tablet|ipad/.test(ua)) {
    return 'tablet';
  }
  return 'laptop';
}

// Generate default device name based on platform
export function getDefaultDeviceName(): string {
  if (typeof window === 'undefined') return 'Desktop Client';
  const ua = navigator.userAgent;
  let os = 'Device';
  if (ua.includes('Win')) os = 'Windows PC';
  else if (ua.includes('Mac')) os = 'MacBook';
  else if (ua.includes('Android')) os = 'Android Phone';
  else if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('Linux')) os = 'Linux PC';

  return os;
}

const USER_ID_STORAGE_NAME = 'bridge_user_id_v1';

// Get or generate persistent user ID
export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return 'srv-placeholder-id';
  let userId = localStorage.getItem(USER_ID_STORAGE_NAME);
  if (!userId) {
    userId = getOrCreateDeviceId();
    localStorage.setItem(USER_ID_STORAGE_NAME, userId);
  }
  return userId;
}

// Store paired user ID
export function storeUserId(userId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_ID_STORAGE_NAME, userId);
  }
}

// Get or generate local device ID
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'srv-placeholder-id';
  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_NAME);
  if (!deviceId) {
    deviceId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_NAME, deviceId);
  }
  return deviceId;
}

// Get or initialize device info
export function getStoredDeviceInfo(): { deviceId: string; deviceName: string; deviceType: DeviceType } {
  const deviceId = getOrCreateDeviceId();
  let deviceName = typeof window !== 'undefined' ? localStorage.getItem(DEVICE_NAME_STORAGE_NAME) : null;
  if (!deviceName) {
    deviceName = getDefaultDeviceName();
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEVICE_NAME_STORAGE_NAME, deviceName);
    }
  }

  let deviceType = (typeof window !== 'undefined' ? localStorage.getItem(DEVICE_TYPE_STORAGE_NAME) : null) as DeviceType | null;
  if (!deviceType) {
    deviceType = detectDeviceType();
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEVICE_TYPE_STORAGE_NAME, deviceType);
    }
  }

  return { deviceId, deviceName, deviceType };
}

// Save device name
export function saveDeviceName(name: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DEVICE_NAME_STORAGE_NAME, name);
  }
}

// Retrieve or generate the AES-GCM Master Encryption Key
export async function getOrCreateMasterKey(): Promise<{ key: CryptoKey; keyBase64: string }> {
  if (typeof window === 'undefined') {
    const key = await generateMasterKey();
    const keyBase64 = await exportKeyToBase64(key);
    return { key, keyBase64 };
  }

  const storedKeyB64 = localStorage.getItem(KEY_STORAGE_NAME);
  if (storedKeyB64) {
    try {
      const key = await importKeyFromBase64(storedKeyB64);
      return { key, keyBase64: storedKeyB64 };
    } catch (e) {
      console.warn('Failed to import existing key from storage, regenerating:', e);
    }
  }

  // Generate a brand new master key
  const newKey = await generateMasterKey();
  const keyBase64 = await exportKeyToBase64(newKey);
  localStorage.setItem(KEY_STORAGE_NAME, keyBase64);
  return { key: newKey, keyBase64 };
}

// Explicitly store a shared master key (e.g. received via QR code pairing)
export async function storeMasterKey(keyBase64: string): Promise<CryptoKey> {
  const key = await importKeyFromBase64(keyBase64);
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY_STORAGE_NAME, keyBase64);
  }
  return key;
}

// Clear all local Bridge session and key data
export function clearLocalBridgeData(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEY_STORAGE_NAME);
    localStorage.removeItem(USER_ID_STORAGE_NAME);
    localStorage.removeItem(DEVICE_ID_STORAGE_NAME);
    localStorage.removeItem(DEVICE_NAME_STORAGE_NAME);
    localStorage.removeItem(DEVICE_TYPE_STORAGE_NAME);
  }
}
