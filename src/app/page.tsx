'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { SendComposer } from '../components/SendComposer';
import { InboxList } from '../components/InboxList';
import { PairingModal } from '../components/PairingModal';
import { DeviceManagerModal } from '../components/DeviceManagerModal';
import { SettingsModal } from '../components/SettingsModal';
import { PwaInstallBanner } from '../components/PwaInstallBanner';
import { TransferItem, TransferType } from '../lib/types';
import { TransferService } from '../lib/api/transfer-service';
import { PairingService } from '../lib/api/pairing-service';
import { getOrCreateMasterKey, getOrCreateUserId, getStoredDeviceInfo } from '../lib/device-storage';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase/client';

export default function BridgeHome() {
  const [userId, setUserId] = useState<string>('local-user');
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [masterKeyBase64, setMasterKeyBase64] = useState<string>('');
  const [items, setItems] = useState<TransferItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals state
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isDevicesOpen, setIsDevicesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize Auth, Identity, and Encryption Key
  const initApp = useCallback(async () => {
    try {
      setIsLoading(true);

      // Check if opened via QR pairing link (?pair=...)
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const pairParam = urlParams.get('pair');
        if (pairParam) {
          try {
            const deviceInfo = getStoredDeviceInfo();
            await PairingService.completePairingFromQr(pairParam, deviceInfo.deviceName, deviceInfo.deviceType);
            // Clean the URL without reloading
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (pairErr) {
            console.error('Auto-pairing from link failed:', pairErr);
          }
        }
      }

      // 1. Get or create master 256-bit AES-GCM encryption key
      const keyResult = await getOrCreateMasterKey();
      setMasterKey(keyResult.key);
      setMasterKeyBase64(keyResult.keyBase64);

      // 2. Determine User ID (from Supabase Auth or persistent shared identity)
      let resolvedUserId = getOrCreateUserId();
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          resolvedUserId = session.user.id;
        } else {
          // Anonymous or persistent local/paired identity
          resolvedUserId = getOrCreateUserId();
        }
      }
      setUserId(resolvedUserId);

      // 3. Register current device
      const deviceInfo = getStoredDeviceInfo();
      await PairingService.registerDevice(resolvedUserId, deviceInfo.deviceName, deviceInfo.deviceType);

      // 4. Fetch and decrypt initial items
      const initialItems = await TransferService.fetchItems(resolvedUserId, keyResult.key);
      setItems(initialItems);
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initApp();
  }, [initApp]);

  // Refresh items callback
  const refreshItems = useCallback(async () => {
    if (!masterKey || !userId) return;
    try {
      setIsSyncing(true);
      const updated = await TransferService.fetchItems(userId, masterKey);
      setItems(updated);
    } catch (err) {
      console.error('Error refreshing items:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [userId, masterKey]);

  // Real-time synchronization subscription
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = TransferService.subscribeToUpdates(userId, () => {
      refreshItems();
    });
    return () => unsubscribe();
  }, [userId, refreshItems]);

  // Handle incoming Web Share Target parameters (e.g. from mobile share menu)
  useEffect(() => {
    if (typeof window === 'undefined' || !masterKey) return;
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get('url');
    const sharedText = params.get('text');
    const sharedTitle = params.get('title');

    if (sharedUrl || sharedText) {
      const type: TransferType = sharedUrl ? 'url' : 'text';
      const content = sharedUrl || sharedText || '';
      TransferService.createTransfer(
        {
          type,
          rawContent: content,
          title: sharedTitle || undefined,
        },
        userId,
        masterKey
      ).then(() => {
        refreshItems();
        // Clear query parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }
  }, [masterKey, userId, refreshItems]);

  // Handlers for item operations
  const handleSendTransfer = async (data: {
    type: TransferType;
    content: string;
    title?: string;
    file?: File;
  }) => {
    if (!masterKey) throw new Error('Encryption key not initialized.');
    const newItem = await TransferService.createTransfer(
      {
        type: data.type,
        rawContent: data.content,
        title: data.title,
        file: data.file,
      },
      userId,
      masterKey
    );
    setItems((prev) => [newItem, ...prev]);
  };

  const handleTogglePin = async (id: string, currentPinned: boolean) => {
    try {
      const newPinned = await TransferService.togglePin(id, currentPinned, userId);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, pinned: newPinned } : item))
      );
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const handleDeleteItem = async (id: string, filePath?: string | null) => {
    try {
      await TransferService.deleteItem(id, filePath, userId);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const handleDownloadFile = async (item: TransferItem) => {
    if (!masterKey) return;
    try {
      const { url } = await TransferService.downloadAndDecryptFile(item, masterKey);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.file_name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      alert(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Navigation */}
      <Navbar
        onOpenPairing={() => setIsPairingOpen(true)}
        onOpenDevices={() => setIsDevicesOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isSyncing={isSyncing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 sm:py-8">
        {/* PWA Install Banner */}
        <PwaInstallBanner />

        {/* Transfer Composer */}
        <SendComposer onSend={handleSendTransfer} disabled={isLoading || !masterKey} />

        {/* Transfers Inbox */}
        <InboxList
          items={items}
          onTogglePin={handleTogglePin}
          onDelete={handleDeleteItem}
          onDownloadFile={handleDownloadFile}
          isLoading={isLoading}
        />
      </main>

      {/* Modals */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        userId={userId}
        masterKeyBase64={masterKeyBase64}
        onPairingComplete={() => {
          initApp();
          setIsPairingOpen(false);
        }}
      />

      <DeviceManagerModal
        isOpen={isDevicesOpen}
        onClose={() => setIsDevicesOpen(false)}
        userId={userId}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        masterKeyBase64={masterKeyBase64}
        onKeyUpdated={() => initApp()}
      />

      {/* Footer */}
      <footer className="py-6 border-t border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
        <p>Bridge &bull; Private Cross-Device Personal Transfer &bull; Client-Side Encrypted</p>
      </footer>
    </div>
  );
}
