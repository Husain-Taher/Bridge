import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TransferService } from '../src/lib/api/transfer-service';
import { generateMasterKey } from '../src/lib/crypto';
import { clearLocalBridgeData } from '../src/lib/device-storage';

describe('TransferService Operations', () => {
  beforeEach(() => {
    clearLocalBridgeData();
  });

  it('should create and retrieve an encrypted text note transfer', async () => {
    const key = await generateMasterKey();
    const noteText = 'Meeting notes: Discuss deployment schedule for Bridge v1.';

    const created = await TransferService.createTransfer(
      {
        type: 'text',
        rawContent: noteText,
        title: 'Meeting Notes',
      },
      'test-user-1',
      key
    );

    assert.ok(created.id);
    assert.equal(created.type, 'text');
    assert.ok(created.content_ciphertext);
    assert.ok(created.iv);
    assert.ok(created.checksum);

    // Fetch and decrypt
    const items = await TransferService.fetchItems('test-user-1', key);
    assert.ok(items.length > 0);
    const fetched = items.find((i) => i.id === created.id);
    assert.ok(fetched);
    assert.equal(fetched.decrypted_content, noteText);
    assert.equal(fetched.verified_integrity, true);
  });

  it('should create and retrieve an encrypted URL transfer with domain normalization', async () => {
    const key = await generateMasterKey();
    const rawUrl = 'github.com/supabase/supabase';

    const created = await TransferService.createTransfer(
      {
        type: 'url',
        rawContent: rawUrl,
      },
      'test-user-1',
      key
    );

    assert.equal(created.type, 'url');
    const items = await TransferService.fetchItems('test-user-1', key);
    const fetched = items.find((i) => i.id === created.id);
    assert.ok(fetched);
    assert.equal(fetched.decrypted_content, 'https://github.com/supabase/supabase');
    assert.equal(fetched.decrypted_title, 'github.com');
  });

  it('should toggle pin state and soft delete transfer items', async () => {
    const key = await generateMasterKey();
    const item = await TransferService.createTransfer(
      {
        type: 'text',
        rawContent: 'Important pinned secret instruction',
      },
      'test-user-1',
      key
    );

    // Pin item
    const newPinned = await TransferService.togglePin(item.id, false, 'test-user-1');
    assert.equal(newPinned, true);

    // Delete item
    await TransferService.deleteItem(item.id, null, 'test-user-1');
    const itemsAfterDelete = await TransferService.fetchItems('test-user-1', key);
    assert.equal(itemsAfterDelete.some((i) => i.id === item.id), false);
  });
});
