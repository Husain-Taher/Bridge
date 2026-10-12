'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, RefreshCw, Smartphone, QrCode, AlertCircle, Shield } from 'lucide-react';
import { PairingService } from '../lib/api/pairing-service';
import { getStoredDeviceInfo } from '../lib/device-storage';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  masterKeyBase64: string;
  onPairingComplete: () => void;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  onClose,
  userId,
  masterKeyBase64,
  onPairingComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'show-qr' | 'enter-code'>('show-qr');
  const [invitationCode, setInvitationCode] = useState<string>('');
  const [qrPayload, setQrPayload] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate or refresh pairing invitation
  const generateNewInvitation = React.useCallback(async () => {
    try {
      setIsGenerating(true);
      const res = await PairingService.createInvitation(userId, masterKeyBase64);
      setInvitationCode(res.invitation.invitation_code);
      setQrPayload(res.qrPayload);
    } catch (err: unknown) {
      console.error('Failed to generate invitation:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [userId, masterKeyBase64]);

  useEffect(() => {
    if (isOpen && activeTab === 'show-qr' && masterKeyBase64) {
      void generateNewInvitation();
    }
  }, [isOpen, activeTab, masterKeyBase64, generateNewInvitation]);

  // Render QR Code onto canvas
  useEffect(() => {
    if (qrPayload && canvasRef.current && activeTab === 'show-qr') {
      QRCode.toCanvas(
        canvasRef.current,
        qrPayload,
        {
          width: 240,
          margin: 2,
          color: {
            dark: '#18181b',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('Error drawing QR code:', error);
        }
      );
    }
  }, [qrPayload, activeTab]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(invitationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleManualPair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    try {
      setIsClaiming(true);
      setClaimError(null);
      const info = getStoredDeviceInfo();

      await PairingService.completePairingFromQr(manualInput.trim(), info.deviceName, info.deviceType);
      onPairingComplete();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete pairing.';
      setClaimError(msg);
    } finally {
      setIsClaiming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Pair Devices</h3>
              <p className="text-xs text-zinc-500">Secure end-to-end device connection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 px-5 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('show-qr')}
            className={`pb-2.5 font-semibold border-b-2 transition ${
              activeTab === 'show-qr'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Show Pairing QR
          </button>
          <button
            onClick={() => setActiveTab('enter-code')}
            className={`pb-2.5 font-semibold border-b-2 transition ${
              activeTab === 'enter-code'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Link Second Device
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {activeTab === 'show-qr' ? (
            <div className="flex flex-col items-center text-center">
              {/* QR Canvas */}
              <div className="p-4 bg-white rounded-2xl shadow-inner border border-zinc-200 dark:border-zinc-700 mb-4">
                {isGenerating ? (
                  <div className="w-[240px] h-[240px] flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                  </div>
                ) : (
                  <canvas ref={canvasRef} className="block rounded-lg" />
                )}
              </div>

              {/* Instructions */}
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Scan with your phone camera or Bridge mobile app
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs">
                Transfers the private end-to-end encryption key directly to your paired device. Valid for 10 minutes.
              </p>

              {/* Human-readable Code */}
              <div className="mt-4 flex items-center gap-2 p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 w-full justify-between">
                <div className="text-left pl-2">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                    Pairing Code
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {invitationCode || 'Generating...'}
                  </span>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-600 border border-zinc-200 dark:border-zinc-600 transition flex items-center gap-1 active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <button
                onClick={generateNewInvitation}
                disabled={isGenerating}
                className="mt-3 flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh Code</span>
              </button>
            </div>
          ) : (
            /* Link Second Device Tab */
            <form onSubmit={handleManualPair} className="space-y-4">
              {claimError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{claimError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Pairing Payload / Link Data
                </label>
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Paste the scanned QR payload JSON from your other device..."
                  rows={4}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                <Shield className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <span>
                  Pairing securely installs the master encryption key onto this device, giving you instant access to your private cross-device inbox.
                </span>
              </div>

              <button
                type="submit"
                disabled={isClaiming || !manualInput.trim()}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition active:scale-95 flex items-center justify-center gap-2"
              >
                {isClaiming ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying & Linking Device...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Authorize & Link This Device</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
