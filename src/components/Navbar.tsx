'use client';

import React from 'react';
import { Smartphone, QrCode, HardDrive, ShieldCheck, RefreshCw, Sliders } from 'lucide-react';
import { getStoredDeviceInfo } from '../lib/device-storage';
import { isSupabaseConfigured } from '../lib/supabase/client';

interface NavbarProps {
  onOpenPairing: () => void;
  onOpenDevices: () => void;
  onOpenSettings: () => void;
  isSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenPairing,
  onOpenDevices,
  onOpenSettings,
  isSyncing = false,
}) => {
  const [deviceInfo, setDeviceInfo] = React.useState({
    deviceName: 'My Device',
    deviceType: 'laptop',
  });
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const info = getStoredDeviceInfo();
    setDeviceInfo({ deviceName: info.deviceName, deviceType: info.deviceType });
  }, []);

  const isConfigured = isSupabaseConfigured();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
            <span className="font-bold text-lg tracking-wider">B</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Bridge</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                v1.0
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
              Cross-Device Personal Transfer
            </p>
          </div>
        </div>

        {/* Current Device & Sync Status */}
        <div className="hidden md:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300">
            <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-medium">{mounted ? deviceInfo.deviceName : 'My Device'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400">
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>{isConfigured ? 'E2EE Live' : 'E2EE Local'}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPairing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-sm shadow-indigo-600/20 active:scale-95"
            title="Pair Phone or Laptop via QR code"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Pair Device</span>
          </button>

          <button
            onClick={onOpenDevices}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Manage Paired Devices"
            aria-label="Devices"
          >
            <Smartphone className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Settings & Key Backup"
            aria-label="Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
