import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'motolink-storage' });

const defaultSettings = {
  autoConnect: true,
  pttMode: false,
  hqAudio: false,
  keepScreenOn: true,
  speakerDefault: true,
  wifiDirect: true,
};

const safeParse = (raw, fallback) => {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const Storage = {
  savePairedDevice: (device) => {
    storage.set(
      'paired_device',
      JSON.stringify({
        id: device.id,
        name: device.name,
        address: device.address,
        role: device.role,
        type: device.type,
        version: device.version,
        sessionToken: device.sessionToken,
        pairedAt: device.pairedAt || Date.now(),
        lastSeen: device.lastSeen || Date.now(),
        preferredTransport: device.preferredTransport || 'BLE',
      }),
    );
  },

  getPairedDevice: () => {
    const raw = storage.getString('paired_device');
    return safeParse(raw, null);
  },

  clearPairedDevice: () => {
    storage.delete('paired_device');
  },

  saveRole: (role) => storage.set('user_role', role),
  getRole: () => storage.getString('user_role') || null,

  saveSettings: (settings) => storage.set('settings', JSON.stringify(settings)),
  getSettings: () => {
    const raw = storage.getString('settings');
    return { ...defaultSettings, ...safeParse(raw, {}) };
  },

  saveLogs: (logs) => storage.set('logs', JSON.stringify(logs)),
  getLogs: () => {
    const raw = storage.getString('logs');
    return safeParse(raw, []);
  },

  clearLogs: () => storage.delete('logs'),
};
