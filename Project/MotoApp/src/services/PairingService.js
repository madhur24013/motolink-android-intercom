import { Storage } from '../storage/Storage';
import { TRANSPORT_STATES } from '../constants/states';
import { BluetoothService } from './BluetoothService';
import { LogsService } from './LogsService';
import { TransportStateManager } from './TransportStateManager';

export const PairingService = {
  pair: async (device, onStep) => {
    TransportStateManager.setState(TRANSPORT_STATES.PAIRING);
    LogsService.add('pairing', 'Pairing Started', `${device.name} (${device.id})`, 'PAIRING');

    onStep && onStep(0, 'Initiating link handshake');
    let connected = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        connected = await Promise.race([
          BluetoothService.connectForPairing(device),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Handshake timeout. Try scan again.')), 30000)),
        ]);
        break;
      } catch (error) {
        lastError = error;
        LogsService.add('pairing', 'Handshake Attempt Failed', `attempt=${attempt} ${error.message}`, 'RETRY');
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
    if (!connected) {
      throw lastError || new Error('Handshake timeout. Try scan again.');
    }

    onStep && onStep(1, 'Negotiating secure session');
    const sessionToken = PairingService._generateToken(device.id);

    const pairedDevice = {
      ...device,
      sessionToken,
      pairedAt: Date.now(),
      lastSeen: Date.now(),
      preferredTransport: connected?.transport || device.type || 'BLE',
    };

    onStep && onStep(2, 'Saving paired device');
    Storage.savePairedDevice(pairedDevice);

    onStep && onStep(3, 'Subscribing signaling channel');
    TransportStateManager.setState(TRANSPORT_STATES.PAIRED);
    LogsService.add('pairing', 'Pairing Completed', pairedDevice.name, 'PAIRED');

    return { pairedDevice, channel: connected };
  },

  forgetDevice: () => {
    const device = Storage.getPairedDevice();
    Storage.clearPairedDevice();
    TransportStateManager.setState(TRANSPORT_STATES.IDLE);
    LogsService.add('pairing', 'Device Forgotten', device?.name || 'Unknown', 'FORGOT');
  },

  getSavedDevice: () => Storage.getPairedDevice(),

  updateLastSeen: (deviceId) => {
    const existing = Storage.getPairedDevice();
    if (existing && existing.id === deviceId) {
      Storage.savePairedDevice({ ...existing, lastSeen: Date.now() });
    }
  },

  _generateToken: (deviceId) => `ML-${deviceId}-${Date.now()}`,
};
