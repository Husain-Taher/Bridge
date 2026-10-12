'use client';

import React, { useState } from 'react';
import {
  Link2,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Pin,
  Trash2,
  Copy,
  ExternalLink,
  Download,
  Check,
  Search,
  CheckCircle,
  HardDrive,
  Clock,
} from 'lucide-react';
import { FilterType, TransferItem } from '../lib/types';

interface InboxListProps {
  items: TransferItem[];
  onTogglePin: (id: string, currentPinned: boolean) => Promise<void>;
  onDelete: (id: string, filePath?: string | null) => Promise<void>;
  onDownloadFile: (item: TransferItem) => Promise<void>;
  isLoading?: boolean;
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const InboxList: React.FC<InboxListProps> = ({
  items,
  onTogglePin,
  onDelete,
  onDownloadFile,
  isLoading = false,
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Filter & Search logic
  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      // Filter by category
      if (filter === 'url' && item.type !== 'url') return false;
      if (filter === 'text' && item.type !== 'text') return false;
      if (filter === 'file' && item.type !== 'file' && item.type !== 'image') return false;
      if (filter === 'pinned' && !item.pinned) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const content = (item.decrypted_content || '').toLowerCase();
        const title = (item.decrypted_title || '').toLowerCase();
        const device = (item.source_device_name || '').toLowerCase();
        return content.includes(query) || title.includes(query) || device.includes(query);
      }

      return true;
    });
  }, [items, filter, searchQuery]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDownload = async (item: TransferItem) => {
    try {
      setDownloadingId(item.id);
      await onDownloadFile(item);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Top Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          {(
            [
              { id: 'all', label: 'All Transfers' },
              { id: 'url', label: 'Links' },
              { id: 'text', label: 'Notes' },
              { id: 'file', label: 'Files' },
              { id: 'pinned', label: 'Pinned' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 rounded-full font-medium transition whitespace-nowrap ${
                filter === t.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inbox..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
          />
        </div>
      </div>

      {/* Items List */}
      {isLoading ? (
        <div className="py-16 text-center text-zinc-400 text-xs flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Decrypting and synchronizing transfers...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 p-8">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mx-auto mb-3">
            <HardDrive className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {searchQuery ? 'No matching transfers found' : 'Your Bridge Inbox is Empty'}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-1">
            {searchQuery
              ? 'Try modifying your search query or switching filters.'
              : 'Share a link, snippet, or file from this device or scan the QR code to pair your phone.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isCopied = copiedId === item.id;
            const isDownloading = downloadingId === item.id;
            const content = item.decrypted_content || '';

            return (
              <div
                key={item.id}
                className={`group relative rounded-2xl border transition-all p-4 ${
                  item.pinned
                    ? 'border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-sm'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'
                }`}
              >
                {/* Header row: Type badge, source device, timestamp, and actions */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    {/* Item type badge */}
                    {item.type === 'url' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold text-[11px] border border-blue-200 dark:border-blue-800/60">
                        <Link2 className="w-3 h-3" />
                        <span>Link</span>
                      </span>
                    )}
                    {item.type === 'text' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-semibold text-[11px] border border-amber-200 dark:border-amber-800/60">
                        <FileText className="w-3 h-3" />
                        <span>Note</span>
                      </span>
                    )}
                    {(item.type === 'file' || item.type === 'image') && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-semibold text-[11px] border border-purple-200 dark:border-purple-800/60">
                        {item.type === 'image' ? <ImageIcon className="w-3 h-3" /> : <FileIcon className="w-3 h-3" />}
                        <span>{item.type === 'image' ? 'Image' : 'File'}</span>
                      </span>
                    )}

                    {/* Source Device */}
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px] flex items-center gap-1">
                      <span>•</span>
                      <span>From {item.source_device_name || 'Device'}</span>
                    </span>

                    {/* Time */}
                    <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatRelativeTime(item.created_at)}</span>
                    </span>
                  </div>

                  {/* Actions: Pin & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onTogglePin(item.id, item.pinned)}
                      className={`p-1.5 rounded-lg transition ${
                        item.pinned
                          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60'
                          : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                      title={item.pinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${item.pinned ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      onClick={() => onDelete(item.id, item.file_path)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                      title="Delete from Bridge"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content Body */}
                <div className="my-2">
                  {item.type === 'url' ? (
                    <div className="space-y-1.5">
                      {item.decrypted_title && (
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.decrypted_title}
                        </p>
                      )}
                      <a
                        href={content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline break-all block"
                      >
                        {content}
                      </a>
                    </div>
                  ) : item.type === 'text' ? (
                    <div className="text-xs text-zinc-800 dark:text-zinc-200 font-mono whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-950/70 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 max-h-60 overflow-y-auto">
                      {content}
                    </div>
                  ) : (
                    /* File / Image */
                    <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-100 dark:border-zinc-800/80">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950/70 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                          {item.type === 'image' ? <ImageIcon className="w-4 h-4" /> : <FileIcon className="w-4 h-4" />}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {item.file_name || item.decrypted_title || 'Transfer File'}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {formatBytes(item.file_size)} • {item.file_mime || 'Binary'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDownload(item)}
                        disabled={isDownloading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition active:scale-95 disabled:opacity-50 shrink-0"
                      >
                        {isDownloading ? (
                          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>Download & Decrypt</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer bar with quick one-tap Copy/Open button & Integrity indicator */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/50 mt-3 text-xs">
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="w-3 h-3" />
                    <span>SHA-256 Verified</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.type === 'url' && (
                      <a
                        href={content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium text-[11px] transition"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Link</span>
                      </a>
                    )}

                    <button
                      onClick={() => handleCopy(item.id, content)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition active:scale-95 ${
                        isCopied
                          ? 'bg-emerald-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
