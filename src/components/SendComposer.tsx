'use client';

import React, { useState, useRef } from 'react';
import { Link2, FileText, Upload, Send, Lock, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { TransferType } from '../lib/types';
import { validateAndNormalizeUrl, isDangerousExtension } from '../lib/validation';

interface SendComposerProps {
  onSend: (data: {
    type: TransferType;
    content: string;
    title?: string;
    file?: File;
  }) => Promise<void>;
  disabled?: boolean;
}

export const SendComposer: React.FC<SendComposerProps> = ({ onSend, disabled = false }) => {
  const [activeTab, setActiveTab] = useState<TransferType>('url');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL Domain preview
  const domainPreview = React.useMemo(() => {
    if (!urlInput.trim()) return null;
    const res = validateAndNormalizeUrl(urlInput);
    return res.isValid ? res.domain : null;
  }, [urlInput]);

  const handleTabChange = (tab: TransferType) => {
    setActiveTab(tab);
    setErrorMessage(null);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileSelected = (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 50MB transfer limit.');
      return;
    }
    if (isDangerousExtension(file.name)) {
      setErrorMessage(`Executable files (.${file.name.split('.').pop()}) cannot be transferred for security.`);
      return;
    }
    setErrorMessage(null);
    setSelectedFile(file);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || disabled) return;

    setErrorMessage(null);

    try {
      setIsSubmitting(true);

      if (activeTab === 'url') {
        const valRes = validateAndNormalizeUrl(urlInput);
        if (!valRes.isValid || !valRes.normalizedUrl) {
          throw new Error(valRes.error || 'Please enter a valid HTTP or HTTPS URL.');
        }
        await onSend({
          type: 'url',
          content: valRes.normalizedUrl,
          title: valRes.domain,
        });
        setUrlInput('');
        setSuccessToast('Link encrypted & sent to your devices!');
      } else if (activeTab === 'text') {
        if (!textInput.trim()) {
          throw new Error('Please enter some text or note to send.');
        }
        await onSend({
          type: 'text',
          content: textInput,
        });
        setTextInput('');
        setSuccessToast('Text encrypted & sent to your devices!');
      } else if (activeTab === 'file' || activeTab === 'image') {
        if (!selectedFile) {
          throw new Error('Please select or drag a file to transfer.');
        }
        const isImg = selectedFile.type.startsWith('image/');
        await onSend({
          type: isImg ? 'image' : 'file',
          content: selectedFile.name,
          title: selectedFile.name,
          file: selectedFile,
        });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSuccessToast('File encrypted & sent to your devices!');
      }

      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transfer failed to complete.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-8 transition-all">
      {/* Type Selector Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 px-3 pt-2 gap-1">
        <button
          type="button"
          onClick={() => handleTabChange('url')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'url'
              ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 bg-white dark:bg-zinc-900'
              : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>Share Link</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('text')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'text'
              ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 bg-white dark:bg-zinc-900'
              : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Note / Snippet</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('file')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'file'
              ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 bg-white dark:bg-zinc-900'
              : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Send File</span>
        </button>
      </div>

      {/* Composer Content Form */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-5">
        {/* Error notification */}
        {errorMessage && (
          <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success notification */}
        {successToast && (
          <div className="mb-4 flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successToast}</span>
          </div>
        )}

        {/* URL Tab */}
        {activeTab === 'url' && (
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste or type URL (e.g., https://github.com or nytimes.com)..."
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                autoFocus
              />
            </div>
            {domainPreview && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 px-1">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Destination:</span>
                <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">
                  {domainPreview}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Text Tab */}
        {activeTab === 'text' && (
          <div>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type or paste text, notes, addresses, prompt instructions, or code snippets..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 font-sans resize-y"
              autoFocus
            />
            <div className="flex justify-between items-center text-[11px] text-zinc-400 mt-1 px-1">
              <span>Markdown & code preserved</span>
              <span>{textInput.length} / 250,000 chars</span>
            </div>
          </div>
        )}

        {/* File Tab */}
        {activeTab === 'file' && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelected(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/30'
                }`}
              >
                <Upload className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Drop a PDF, image, document, or code file here
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  or click to select from your device (Max 50MB, client-side encrypted)
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type || 'Binary'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer with Security Badge & Submit */}
        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>256-bit AES-GCM Encrypted before transmission</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || disabled}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-sm shadow-indigo-600/30 active:scale-95"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Encrypting & Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send to My Devices</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
