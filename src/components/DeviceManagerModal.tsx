'use client';

import React, { useState, useEffect } from 'react';
import { X, Laptop, Smartphone, Tablet, Globe, HardDrive, Trash2, ShieldAlert } from 'lucide-react';
import { Device, DeviceType } from '../lib/types';
import { PairingService } from '../lib/api/pairing-service';
import { getStoredDeviceInfo } from '../lib/device-storage';

interface DeviceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const DeviceManagerModal: React.FC<DeviceManagerModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');

  const loadDevices = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await PairingService.listDevices(userId);
      setDevices(list);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      const info = getStoredDeviceInfo();
      setCurrentDeviceId(info.deviceId);
      void loadDevices();
    }
  }, [isOpen, loadDevices]);

  const handleRevoke = async (deviceId: string) => {
    if (window.confirm('Are you sure you want to revoke this device? It will immediately lose access to your Bridge inbox.')) {
      try {
        await PairingService.revokeDevice(deviceId, userId);
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      } catch (err) {
        console.error('Failed to revoke device:', err);
      }
    }
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'laptop':
        return <Laptop className="w-4 h-4" />;
      case 'phone':
        return <Smartphone className="w-4 h-4" />;
      case 'tablet':
        return <Tablet className="w-4 h-4" />;
      case 'browser_extension':
        return <Globe className="w-4 h-4" />;
      default:
        return <HardDrive className="w-4 h-4" />;
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
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Paired Devices</h3>
              <p className="text-xs text-zinc-500">Authorized devices in your personal workspace</p>
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
        <div className="p-5 max-h-96 overflow-y-auto space-y-3">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-zinc-400">Loading devices...</div>
          ) : devices.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No other paired devices registered yet. Scan the QR code from your phone to connect!
            </div>
          ) : (
            devices.map((device) => {
              const isThisDevice = device.id === currentDeviceId;
              return (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                      {getDeviceIcon(device.device_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {device.device_name}
                        </span>
                        {isThisDevice && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                            This Device
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Type: {device.device_type} • Active
                      </p>
                    </div>
                  </div>

                  {!isThisDevice && (
                    <button
                      onClick={() => handleRevoke(device.id)}
                      className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Revoke device access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Security Notice */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Revoking a device prevents it from querying or synchronizing any new transfers.</span>
        </div>
      </div>
    </div>
  );
};
