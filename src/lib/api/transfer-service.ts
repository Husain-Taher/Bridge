import { getSupabaseClient, isSupabaseConfigured } from '../supabase/client';
import { CreateTransferInput, TransferItem } from '../types';
import { decryptBuffer, decryptText, encryptBuffer, encryptText } from '../crypto';
import { getStoredDeviceInfo } from '../device-storage';
import { sanitizeFileName, validateAndNormalizeUrl } from '../validation';

const LOCAL_STORAGE_ITEMS_KEY = 'bridge_local_transfer_items_v1';

let memoryItems: TransferItem[] = [];

// In-memory / LocalStorage fallback helpers for testing and offline mode
function getLocalFallbackItems(): TransferItem[] {
  if (typeof window === 'undefined') {
    return memoryItems;
  }
  const raw = localStorage.getItem(LOCAL_STORAGE_ITEMS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalFallbackItems(items: TransferItem[]): void {
  memoryItems = items;
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_ITEMS_KEY, JSON.stringify(items));
    // Trigger custom event for same-window / tabs realtime sync
    window.dispatchEvent(new CustomEvent('bridge_storage_update', { detail: items }));
  }
}

export class TransferService {
  /**
   * Create and send a new transfer item (text, URL, or encrypted file)
   */
  static async createTransfer(
    input: CreateTransferInput,
    userId: string,
    masterKey: CryptoKey
  ): Promise<TransferItem> {
    const { deviceId, deviceName } = getStoredDeviceInfo();
    const retentionHours = input.retentionHours || 72;
    const expiresAt = new Date(Date.now() + retentionHours * 3600 * 1000).toISOString();
    const createdAt = new Date().toISOString();
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    let contentToEncrypt = input.rawContent;
    let titleToEncrypt = input.title || '';
    let filePath: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let fileMime: string | null = null;
    let fileIv: string | null = null;

    // Handle URL type
    if (input.type === 'url') {
      const urlResult = validateAndNormalizeUrl(input.rawContent);
      if (!urlResult.isValid || !urlResult.normalizedUrl) {
        throw new Error(urlResult.error || 'Invalid URL provided.');
      }
      contentToEncrypt = urlResult.normalizedUrl;
      if (!titleToEncrypt && urlResult.domain) {
        titleToEncrypt = urlResult.domain;
      }
    }

    // Handle File / Image type
    if (input.type === 'file' || input.type === 'image') {
      if (!input.file) {
        throw new Error('A file object is required for file transfers.');
      }
      const file = input.file;
      fileName = sanitizeFileName(file.name);
      fileSize = file.size;
      fileMime = file.type || 'application/octet-stream';
      titleToEncrypt = fileName;

      // 1. Read file as ArrayBuffer
      const rawBuffer = await file.arrayBuffer();

      // 2. Client-side encrypt file with AES-GCM
      const encryptedFile = await encryptBuffer(rawBuffer, masterKey);
      fileIv = encryptedFile.iv;
      filePath = `${userId}/${id}.enc`;

      // 3. Upload encrypted file to Supabase Storage if configured
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { error: uploadError } = await supabase.storage
          .from('transfers')
          .upload(filePath, encryptedFile.encryptedBuffer, {
            contentType: 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Failed to upload encrypted file to storage: ${uploadError.message}`);
        }
      } else {
        // Fallback for offline/local simulation: store data URL in IndexedDB/session if needed
        contentToEncrypt = `[Encrypted File: ${fileName} (${fileSize} bytes)]`;
      }
    }

    // Client-side encrypt textual content and title
    const encryptedContent = await encryptText(contentToEncrypt, masterKey);
    const encryptedTitle = titleToEncrypt ? await encryptText(titleToEncrypt, masterKey) : null;
    const titleCiphertext = encryptedTitle ? JSON.stringify(encryptedTitle) : null;

    const newItem: TransferItem = {
      id,
      user_id: userId,
      source_device_id: deviceId,
      source_device_name: deviceName,
      type: input.type,
      title_ciphertext: titleCiphertext,
      content_ciphertext: encryptedContent.ciphertext,
      iv: encryptedContent.iv,
      checksum: encryptedContent.checksum,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      file_mime: fileMime,
      file_iv: fileIv,
      pinned: false,
      retention_hours: retentionHours,
      expires_at: expiresAt,
      is_deleted: false,
      created_at: createdAt,
      // Populated for immediate local display
      decrypted_content: contentToEncrypt,
      decrypted_title: titleToEncrypt,
      verified_integrity: true,
    };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase.from('transfer_items').insert({
        id: newItem.id,
        user_id: newItem.user_id,
        source_device_id: newItem.source_device_id,
        source_device_name: newItem.source_device_name,
        type: newItem.type,
        title_ciphertext: newItem.title_ciphertext,
        content_ciphertext: newItem.content_ciphertext,
        iv: newItem.iv,
        checksum: newItem.checksum,
        file_path: newItem.file_path,
        file_name: newItem.file_name,
        file_size: newItem.file_size,
        file_mime: newItem.file_mime,
        file_iv: newItem.file_iv,
        pinned: newItem.pinned,
        retention_hours: newItem.retention_hours,
        expires_at: newItem.expires_at,
        is_deleted: false,
        created_at: newItem.created_at,
      });

      if (dbError) {
        throw new Error(`Database error saving transfer item: ${dbError.message}`);
      }
    } else {
      // Offline fallback
      const current = getLocalFallbackItems();
      saveLocalFallbackItems([newItem, ...current]);
    }

    return newItem;
  }

  /**
   * Fetch all active transfer items and decrypt them client-side
   */
  static async fetchItems(userId: string, masterKey: CryptoKey): Promise<TransferItem[]> {
    let rawItems: TransferItem[] = [];

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('transfer_items')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error fetching items: ${error.message}`);
      }
      rawItems = (data as TransferItem[]) || [];
    } else {
      rawItems = getLocalFallbackItems().filter(
        (i) => !i.is_deleted && new Date(i.expires_at) > new Date()
      );
    }

    // Client-side decryption for each item
    const decryptedItems: TransferItem[] = [];
    for (const item of rawItems) {
      try {
        const decrypted = await decryptText(
          item.content_ciphertext,
          item.iv,
          item.checksum,
          masterKey
        );

        let decryptedTitle = item.file_name || '';
        if (item.title_ciphertext) {
          try {
            const titlePayload = JSON.parse(item.title_ciphertext);
            const res = await decryptText(
              titlePayload.ciphertext,
              titlePayload.iv,
              titlePayload.checksum,
              masterKey
            );
            decryptedTitle = res.text;
          } catch {
            decryptedTitle = item.file_name || '';
          }
        }

        decryptedItems.push({
          ...item,
          decrypted_content: decrypted.text,
          decrypted_title: decryptedTitle,
          verified_integrity: decrypted.verified,
        });
      } catch (err) {
        console.warn(`Failed to decrypt item ${item.id}:`, err);
        decryptedItems.push({
          ...item,
          decrypted_content: '[Encrypted payload - Unable to decrypt with current key]',
          verified_integrity: false,
        });
      }
    }

    return decryptedItems;
  }

  /**
   * Download and decrypt file from Supabase Storage
   */
  static async downloadAndDecryptFile(
    item: TransferItem,
    masterKey: CryptoKey
  ): Promise<{ blob: Blob; url: string }> {
    if (!item.file_path || !item.file_iv) {
      throw new Error('Item does not have associated encrypted file storage information.');
    }

    if (!isSupabaseConfigured()) {
      // Local fallback blob
      const content = item.decrypted_content || 'Local file content';
      const blob = new Blob([content], { type: item.file_mime || 'text/plain' });
      return { blob, url: URL.createObjectURL(blob) };
    }

    const supabase = getSupabaseClient();
    const { data: fileData, error } = await supabase.storage
      .from('transfers')
      .download(item.file_path);

    if (error || !fileData) {
      throw new Error(`Failed to download encrypted file: ${error?.message || 'Empty response'}`);
    }

    const encryptedBuffer = await fileData.arrayBuffer();
    const { decryptedBuffer } = await decryptBuffer(
      encryptedBuffer,
      item.file_iv,
      item.checksum,
      masterKey
    );

    const decryptedBlob = new Blob([decryptedBuffer], {
      type: item.file_mime || 'application/octet-stream',
    });

    const url = URL.createObjectURL(decryptedBlob);
    return { blob: decryptedBlob, url };
  }

  /**
   * Toggle pinned state
   */
  static async togglePin(id: string, currentPinned: boolean, userId: string): Promise<boolean> {
    const newPinned = !currentPinned;
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('transfer_items')
        .update({ pinned: newPinned })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    } else {
      const items = getLocalFallbackItems();
      const updated = items.map((i) => (i.id === id ? { ...i, pinned: newPinned } : i));
      saveLocalFallbackItems(updated);
    }
    return newPinned;
  }

  /**
   * Delete transfer item
   */
  static async deleteItem(id: string, filePath: string | null | undefined, userId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('transfer_items')
        .update({ is_deleted: true })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw new Error(error.message);

      if (filePath) {
        // Asynchronously remove object from storage
        supabase.storage.from('transfers').remove([filePath]).catch(console.error);
      }
    } else {
      const items = getLocalFallbackItems();
      const updated = items.map((i) => (i.id === id ? { ...i, is_deleted: true } : i));
      saveLocalFallbackItems(updated);
    }
  }

  /**
   * Subscribe to real-time updates for transfer items
   */
  static subscribeToUpdates(
    userId: string,
    onChange: () => void
  ): () => void {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const channel = supabase
        .channel(`transfer_updates_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transfer_items',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            onChange();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      // Local fallback event listener
      const handler = () => onChange();
      if (typeof window !== 'undefined') {
        window.addEventListener('bridge_storage_update', handler);
        window.addEventListener('storage', handler);
      }
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('bridge_storage_update', handler);
          window.removeEventListener('storage', handler);
        }
      };
    }
  }
}
