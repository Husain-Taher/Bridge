'use client';

import React, { useState } from 'react';
import { X, Key, Clock, Trash2, Copy, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { clearLocalBridgeData, storeMasterKey } from '../lib/device-storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterKeyBase64: string;
  onKeyUpdated: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  masterKeyBase64,
  onKeyUpdated,
}) => {
  const [retentionHours, setRetentionHours] = useState('72');
  const [copiedKey, setCopiedKey] = useState(false);
  const [importKeyInput, setImportKeyInput] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(masterKeyBase64);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleImportKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importKeyInput.trim()) return;
    try {
      await storeMasterKey(importKeyInput.trim());
      setImportStatus('Encryption key successfully updated!');
      setImportKeyInput('');
      onKeyUpdated();
      setTimeout(() => setImportStatus(null), 3000);
    } catch {
      setImportStatus('Invalid key format. Expected 256-bit base64 key.');
    }
  };

  const handleClearData = () => {
    if (window.confirm('Clear all local encryption keys and device registration from this browser?')) {
      clearLocalBridgeData();
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Bridge Settings</h3>
              <p className="text-xs text-zinc-500">Security, retention, and encryption keys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Retention Setting */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>Default Transfer Retention</span>
            </label>
            <select
              value={retentionHours}
              onChange={(e) => setRetentionHours(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="24">24 hours (1 day)</option>
              <option value="72">72 hours (3 days - Recommended)</option>
              <option value="168">7 days (1 week)</option>
              <option value="720">30 days (1 month)</option>
            </select>
            <p className="text-[11px] text-zinc-400 mt-1">
              Transfers older than this retention period will automatically expire and be deleted.
            </p>
          </div>

          {/* Master Key Backup */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Master AES-GCM Encryption Key</span>
            </label>
            <p className="text-[11px] text-zinc-500 mb-2">
              All transfers are encrypted end-to-end with this 256-bit key. You can back it up or copy it to another device.
            </p>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
              <span className="truncate flex-1">
                {masterKeyBase64 ? `${masterKeyBase64.slice(0, 16)}••••••••••••••••${masterKeyBase64.slice(-8)}` : 'Generating...'}
              </span>
              <button
                onClick={handleCopyKey}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium hover:bg-zinc-50 border border-zinc-200 dark:border-zinc-600 transition flex items-center gap-1 shrink-0"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Import Key */}
          <form onSubmit={handleImportKey} className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Import Key from Another Device
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={importKeyInput}
                onChange={(e) => setImportKeyInput(e.target.value)}
                placeholder="Paste Base64 master key..."
                className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-zinc-900 dark:text-zinc-100"
              />
              <button
                type="submit"
                disabled={!importKeyInput.trim()}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold hover:opacity-90 disabled:opacity-40"
              >
                Import
              </button>
            </div>
            {importStatus && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {importStatus}
              </p>
            )}
          </form>

          {/* Reset / Clear Local Data */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={handleClearData}
              className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Local Device Keys and Cache</span>
            </button>
          </div>
        </div>

        {/* Warning Footer */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Never share your master encryption key publicly or with unverified devices.</span>
        </div>
      </div>
    </div>
  );
};
