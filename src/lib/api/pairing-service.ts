import { getSupabaseClient, isSupabaseConfigured } from '../supabase/client';
import { Device, DeviceType, PairingInvitation } from '../types';
import { generatePairingCode } from '../crypto';
import { getStoredDeviceInfo, storeMasterKey, storeUserId } from '../device-storage';

const LOCAL_STORAGE_DEVICES_KEY = 'bridge_local_devices_v1';
const LOCAL_STORAGE_INVITATIONS_KEY = 'bridge_local_invitations_v1';

let memoryDevices: Device[] = [];
let memoryInvitations: PairingInvitation[] = [];

export interface QrPairingPayload {
  version: 1;
  code: string;
  appUrl: string;
  userId: string;
  masterKeyBase64: string;
  expiresAt: string;
}

export class PairingService {
  /**
   * Create a new pairing invitation with QR payload
   */
  static async createInvitation(
    userId: string,
    masterKeyBase64: string
  ): Promise<{ invitation: PairingInvitation; qrPayload: string }> {
    const { deviceName } = getStoredDeviceInfo();
    const code = generatePairingCode();
    const ephemeralKey = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes expiry
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `inv-${Date.now()}`;
    const rawAppUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const appUrl = rawAppUrl.replace(/\/$/, '');

    const qrData: QrPairingPayload = {
      version: 1,
      code,
      appUrl,
      userId,
      masterKeyBase64,
      expiresAt,
    };
    
    // Encode pairing payload so native phone camera opens directly to Bridge with pairing query
    const encodedPayload = typeof btoa === 'function' ? btoa(JSON.stringify(qrData)) : Buffer.from(JSON.stringify(qrData)).toString('base64');
    const qrPayload = `${appUrl}/?pair=${encodeURIComponent(encodedPayload)}`;

    const invitation: PairingInvitation = {
      id,
      user_id: userId,
      invitation_code: code,
      ephemeral_key: ephemeralKey,
      device_name: deviceName,
      status: 'pending',
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('pairing_invitations').insert({
        id: invitation.id,
        user_id: invitation.user_id,
        invitation_code: invitation.invitation_code,
        ephemeral_key: invitation.ephemeral_key,
        device_name: invitation.device_name,
        status: invitation.status,
        expires_at: invitation.expires_at,
        created_at: invitation.created_at,
      });

      if (error) {
        throw new Error(`Failed to create pairing invitation: ${error.message}`);
      }
    } else {
      // Local fallback
      memoryInvitations = [invitation, ...memoryInvitations];
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(LOCAL_STORAGE_INVITATIONS_KEY);
        const list: PairingInvitation[] = stored ? JSON.parse(stored) : [];
        localStorage.setItem(LOCAL_STORAGE_INVITATIONS_KEY, JSON.stringify([invitation, ...list]));
      }
    }

    return { invitation, qrPayload };
  }

  /**
   * Complete pairing on a second device using the scanned QR payload
   */
  static async completePairingFromQr(
    rawInput: string,
    newDeviceName: string,
    newDeviceType: DeviceType
  ): Promise<{ success: boolean; masterKey: CryptoKey }> {
    let payloadJson = rawInput.trim();

    // Check if input is a URL containing ?pair=...
    if (payloadJson.includes('pair=')) {
      try {
        const url = new URL(payloadJson);
        const pairParam = url.searchParams.get('pair');
        if (pairParam) {
          payloadJson = typeof atob === 'function' ? atob(decodeURIComponent(pairParam)) : Buffer.from(decodeURIComponent(pairParam), 'base64').toString('utf8');
        }
      } catch {
        const match = payloadJson.match(/pair=([^&]+)/);
        if (match) {
          const pairParam = match[1];
          payloadJson = typeof atob === 'function' ? atob(decodeURIComponent(pairParam)) : Buffer.from(decodeURIComponent(pairParam), 'base64').toString('utf8');
        }
      }
    } else if (!payloadJson.startsWith('{')) {
      // Might be direct base64 string
      try {
        payloadJson = typeof atob === 'function' ? atob(payloadJson) : Buffer.from(payloadJson, 'base64').toString('utf8');
      } catch {
        // Keep as is and let JSON.parse attempt
      }
    }

    let payload: QrPairingPayload;
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      throw new Error('Invalid QR code format or pairing link.');
    }

    if (new Date(payload.expiresAt) < new Date()) {
      throw new Error('This pairing invitation has expired. Please generate a new one on your laptop.');
    }

    if (!payload.masterKeyBase64) {
      throw new Error('Missing encryption key in pairing payload.');
    }

    // 1. Store and verify master encryption key on the new device
    const masterKey = await storeMasterKey(payload.masterKeyBase64);

    // 2. Persist the paired user ID so all transfers sync under the same identity
    storeUserId(payload.userId);

    // 3. Register the new device in the system
    await this.registerDevice(payload.userId, newDeviceName, newDeviceType);

    return { success: true, masterKey };
  }

  /**
   * Register or update a device
   */
  static async registerDevice(
    userId: string,
    deviceName: string,
    deviceType: DeviceType
  ): Promise<Device> {
    const { deviceId } = getStoredDeviceInfo();
    const now = new Date().toISOString();

    const device: Device = {
      id: deviceId,
      user_id: userId,
      device_name: deviceName,
      device_type: deviceType,
      last_seen_at: now,
      is_revoked: false,
      created_at: now,
    };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      await supabase.from('devices').upsert({
        id: device.id,
        user_id: device.user_id,
        device_name: device.device_name,
        device_type: device.device_type,
        last_seen_at: device.last_seen_at,
        is_revoked: false,
      });
    } else {
      memoryDevices = [device, ...memoryDevices.filter((d) => d.id !== deviceId)];
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(LOCAL_STORAGE_DEVICES_KEY);
        const list: Device[] = stored ? JSON.parse(stored) : [];
        const filtered = list.filter((d) => d.id !== deviceId);
        localStorage.setItem(LOCAL_STORAGE_DEVICES_KEY, JSON.stringify([device, ...filtered]));
      }
    }

    return device;
  }

  /**
   * List all registered devices
   */
  static async listDevices(userId: string): Promise<Device[]> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', userId)
        .eq('is_revoked', false)
        .order('last_seen_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }
      return (data as Device[]) || [];
    } else {
      if (typeof window === 'undefined') {
        return memoryDevices.filter((d) => !d.is_revoked);
      }
      const stored = localStorage.getItem(LOCAL_STORAGE_DEVICES_KEY);
      const list: Device[] = stored ? JSON.parse(stored) : [];
      return list.filter((d) => !d.is_revoked);
    }
  }

  /**
   * Revoke a paired device
   */
  static async revokeDevice(deviceId: string, userId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('devices')
        .update({ is_revoked: true })
        .eq('id', deviceId)
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    } else {
      memoryDevices = memoryDevices.map((d) => (d.id === deviceId ? { ...d, is_revoked: true } : d));
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(LOCAL_STORAGE_DEVICES_KEY);
        const list: Device[] = stored ? JSON.parse(stored) : [];
        const updated = list.map((d) => (d.id === deviceId ? { ...d, is_revoked: true } : d));
        localStorage.setItem(LOCAL_STORAGE_DEVICES_KEY, JSON.stringify(updated));
      }
    }
  }
}
