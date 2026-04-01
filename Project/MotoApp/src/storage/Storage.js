import {MMKV} from 'react-native-mmkv';

const storage = new MMKV({id: 'motolink-storage'});

const defaultSettings = {
  settingsVersion: 2,
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

const normalizeRole = role =>
  role === 'rider' || role === 'pillion' ? role : null;

const normalizeTransport = transport =>
  transport === 'CLASSIC' || transport === 'BLE' ? transport : null;

const sanitizePairedDevice = device => {
  if (!device || typeof device !== 'object') {
    return null;
  }

  const id = typeof device.id === 'string' ? device.id.trim() : '';
  if (!id) {
    return null;
  }

  const normalizedPreferredTransport = normalizeTransport(
    device.preferredTransport,
  );
  const normalizedType = normalizeTransport(device.type);
  const preferredTransport =
    normalizedPreferredTransport || normalizedType || 'CLASSIC';

  return {
    id,
    name:
      typeof device.name === 'string' && device.name.trim()
        ? device.name.trim()
        : 'MotoLink Device',
    address:
      typeof device.address === 'string' && device.address.trim()
        ? device.address.trim()
        : id,
    role: normalizeRole(device.role) || 'unknown',
    type: normalizedType || preferredTransport,
    version:
      typeof device.version === 'string' && device.version.trim()
        ? device.version.trim()
        : null,
    sessionToken:
      typeof device.sessionToken === 'string' && device.sessionToken.trim()
        ? device.sessionToken.trim()
        : null,
    pairedAt:
      typeof device.pairedAt === 'number' ? device.pairedAt : Date.now(),
    lastSeen:
      typeof device.lastSeen === 'number' ? device.lastSeen : Date.now(),
    preferredTransport,
    validationState:
      typeof device.validationState === 'string' &&
      device.validationState.trim()
        ? device.validationState.trim()
        : null,
    validatedAt:
      typeof device.validatedAt === 'number' ? device.validatedAt : null,
    peerVersion:
      typeof device.peerVersion === 'string' && device.peerVersion.trim()
        ? device.peerVersion.trim()
        : null,
    localVersion:
      typeof device.localVersion === 'string' && device.localVersion.trim()
        ? device.localVersion.trim()
        : null,
    peerIdentityId:
      typeof device.peerIdentityId === 'string' && device.peerIdentityId.trim()
        ? device.peerIdentityId.trim()
        : null,
    localIdentityId:
      typeof device.localIdentityId === 'string' &&
      device.localIdentityId.trim()
        ? device.localIdentityId.trim()
        : null,
  };
};

const createLocalIdentity = () => ({
  id: `ml-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`,
  createdAt: Date.now(),
});

const sanitizeRePairNotice = notice => {
  if (!notice || typeof notice !== 'object') {
    return null;
  }

  const pairedDeviceId =
    typeof notice.pairedDeviceId === 'string'
      ? notice.pairedDeviceId.trim()
      : '';
  if (!pairedDeviceId) {
    return null;
  }

  return {
    pairedDeviceId,
    pairedDeviceName:
      typeof notice.pairedDeviceName === 'string' &&
      notice.pairedDeviceName.trim()
        ? notice.pairedDeviceName.trim()
        : 'MotoLink Partner',
    senderIdentityId:
      typeof notice.senderIdentityId === 'string' &&
      notice.senderIdentityId.trim()
        ? notice.senderIdentityId.trim()
        : null,
    expectedPeerIdentityId:
      typeof notice.expectedPeerIdentityId === 'string' &&
      notice.expectedPeerIdentityId.trim()
        ? notice.expectedPeerIdentityId.trim()
        : null,
    reason:
      typeof notice.reason === 'string' && notice.reason.trim()
        ? notice.reason.trim()
        : 'identity_mismatch',
    ts: typeof notice.ts === 'number' ? notice.ts : Date.now(),
  };
};

export const Storage = {
  savePairedDevice: device => {
    const safeDevice = sanitizePairedDevice(device);
    if (!safeDevice) {
      return;
    }

    storage.delete('re_pair_required');
    storage.set('paired_device', JSON.stringify(safeDevice));
  },

  getPairedDevice: () => {
    const raw = storage.getString('paired_device');
    return sanitizePairedDevice(safeParse(raw, null));
  },

  clearPairedDevice: () => {
    storage.delete('paired_device');
    storage.delete('re_pair_required');
  },

  saveRole: role => storage.set('user_role', role),
  getRole: () => normalizeRole(storage.getString('user_role')),

  saveSettings: settings => storage.set('settings', JSON.stringify(settings)),
  getSettings: () => {
    const raw = storage.getString('settings');
    const parsed = safeParse(raw, {});
    const merged = {...defaultSettings, ...parsed};
    if ((parsed.settingsVersion || 0) < defaultSettings.settingsVersion) {
      const repaired = {
        ...merged,
        settingsVersion: defaultSettings.settingsVersion,
        pttMode: defaultSettings.pttMode,
        speakerDefault: defaultSettings.speakerDefault,
      };
      storage.set('settings', JSON.stringify(repaired));
      return repaired;
    }

    return merged;
  },

  saveLogs: logs => storage.set('logs', JSON.stringify(logs)),
  getLogs: () => {
    const raw = storage.getString('logs');
    return safeParse(raw, []);
  },

  clearLogs: () => storage.delete('logs'),

  getOrCreateLocalIdentity: () => {
    const raw = storage.getString('device_identity');
    const parsed = safeParse(raw, null);
    if (
      parsed &&
      typeof parsed.id === 'string' &&
      parsed.id.trim() &&
      typeof parsed.createdAt === 'number'
    ) {
      return parsed;
    }

    const identity = createLocalIdentity();
    storage.set('device_identity', JSON.stringify(identity));
    return identity;
  },

  saveRePairRequired: notice => {
    const safeNotice = sanitizeRePairNotice(notice);
    if (!safeNotice) {
      return;
    }
    storage.set('re_pair_required', JSON.stringify(safeNotice));
  },

  getRePairRequired: () => {
    const raw = storage.getString('re_pair_required');
    return sanitizeRePairNotice(safeParse(raw, null));
  },

  clearRePairRequired: () => storage.delete('re_pair_required'),
};
