import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PairingService } from '../src/lib/api/pairing-service';
import { generateMasterKey, exportKeyToBase64 } from '../src/lib/crypto';
import { clearLocalBridgeData } from '../src/lib/device-storage';

describe('Pairing & Device Management Lifecycle', () => {
  beforeEach(() => {
    clearLocalBridgeData();
  });

  it('should generate pairing invitation with short code, QR payload, and 10m expiry', async () => {
    const key = await generateMasterKey();
    const keyB64 = await exportKeyToBase64(key);

    const { invitation, qrPayload } = await PairingService.createInvitation('user-123', keyB64);

    assert.match(invitation.invitation_code, /^BR-[2-9A-HJ-NP-Z]{6}$/);
    assert.equal(invitation.status, 'pending');
    assert.ok(new Date(invitation.expires_at).getTime() > Date.now());

    // QR Payload should contain JSON with code, userId, masterKeyBase64
    const parsed = JSON.parse(qrPayload);
    assert.equal(parsed.code, invitation.invitation_code);
    assert.equal(parsed.userId, 'user-123');
    assert.equal(parsed.masterKeyBase64, keyB64);
  });

  it('should reject expired pairing invitations', async () => {
    const key = await generateMasterKey();
    const keyB64 = await exportKeyToBase64(key);

    const expiredPayload = JSON.stringify({
      version: 1,
      code: 'BR-EXPD12',
      appUrl: 'http://localhost:3000',
      userId: 'user-123',
      masterKeyBase64: keyB64,
      expiresAt: new Date(Date.now() - 60000).toISOString(), // Expired 1 min ago
    });

    await assert.rejects(
      async () => {
        await PairingService.completePairingFromQr(expiredPayload, 'My Phone', 'phone');
      },
      /expired/
    );
  });

  it('should reject invalid or malformed pairing payload JSON', async () => {
    await assert.rejects(
      async () => {
        await PairingService.completePairingFromQr('not-valid-json', 'My Phone', 'phone');
      },
      /Invalid QR code format/
    );
  });

  it('should complete valid pairing and register the new device', async () => {
    const key = await generateMasterKey();
    const keyB64 = await exportKeyToBase64(key);

    const validPayload = JSON.stringify({
      version: 1,
      code: 'BR-VALID1',
      appUrl: 'http://localhost:3000',
      userId: 'user-123',
      masterKeyBase64: keyB64,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });

    const result = await PairingService.completePairingFromQr(validPayload, 'iPhone 15', 'phone');
    assert.equal(result.success, true);
    assert.ok(result.masterKey);

    const devices = await PairingService.listDevices('user-123');
    assert.ok(devices.some((d) => d.device_name === 'iPhone 15'));
  });

  it('should revoke paired device access', async () => {
    const dev = await PairingService.registerDevice('user-123', 'Old Laptop', 'laptop');
    let devices = await PairingService.listDevices('user-123');
    assert.ok(devices.some((d) => d.id === dev.id));

    await PairingService.revokeDevice(dev.id, 'user-123');
    devices = await PairingService.listDevices('user-123');
    assert.ok(!devices.some((d) => d.id === dev.id));
  });
});
