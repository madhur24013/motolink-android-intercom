import { RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_ATTEMPTS, SCAN_TIMEOUT_MS } from '../constants/config';
import { TRANSPORT_STATES } from '../constants/states';
import { BluetoothService } from './BluetoothService';
import { LogsService } from './LogsService';
import { PairingService } from './PairingService';
import { TransportStateManager } from './TransportStateManager';

let isRunning = false;
let shouldStop = false;
let currentAttempt = 0;

export const ReconnectService = {
  start: async (
    savedDevice,
    {
      mode = 'reconnect',
      onAttempt,
      onPhase,
      onSuccess,
      onFailed,
    } = {},
  ) => {
    if (!savedDevice || isRunning) {
      return;
    }

    isRunning = true;
    shouldStop = false;
    currentAttempt = 0;
    TransportStateManager.setState(mode === 'auto' ? TRANSPORT_STATES.AUTO_CONNECTING : TRANSPORT_STATES.RECONNECTING);
    LogsService.add('reconnect', mode === 'auto' ? 'Auto Connect Started' : 'Reconnect Started', savedDevice.name || savedDevice.id, 'START');

    for (let attempt = 1; attempt <= RECONNECT_MAX_ATTEMPTS; attempt += 1) {
      if (shouldStop) {
        break;
      }

      BluetoothService.stopScan();
      currentAttempt = attempt;
      onAttempt && onAttempt(attempt);
      onPhase && onPhase('searching', { attempt });
      LogsService.add('reconnect', 'Reconnect Attempt', `Attempt ${attempt}`, 'TRY');

      try {
        const found = await ReconnectService._findForReconnect(savedDevice);
        onPhase && onPhase('found', { attempt, device: found });
        LogsService.add('reconnect', 'Reconnect Device Found', found.name || found.id, 'FOUND');
        onPhase && onPhase('connecting', { attempt, device: found });

        const channel = await BluetoothService.connectSavedDevice(found);
        PairingService.updateLastSeen(found.id);

        isRunning = false;
        TransportStateManager.setState(TRANSPORT_STATES.CONNECTED);
        onPhase && onPhase('connected', { attempt, device: found });
        LogsService.add('reconnect', 'Reconnect Succeeded', `Attempt ${attempt}`, 'CONNECTED');
        onSuccess && onSuccess({ device: found, channel });
        return;
      } catch (error) {
        LogsService.add('reconnect', 'Reconnect Attempt Failed', error.message, 'FAIL');
      }

      if (attempt < RECONNECT_MAX_ATTEMPTS && !shouldStop) {
        const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1), 30000);
        onPhase && onPhase('waiting', { attempt, delay });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    isRunning = false;
    TransportStateManager.setState(TRANSPORT_STATES.FAILED);
    LogsService.add('reconnect', 'Reconnect Failed', 'Max attempts reached', 'FAILED');
    onFailed && onFailed({ mode, attempts: currentAttempt });
  },

  stop: () => {
    shouldStop = true;
    isRunning = false;
    BluetoothService.stopScan();
    LogsService.add('reconnect', 'Reconnect Stopped', 'Cancelled by user', 'STOP');
  },

  getCurrentAttempt: () => currentAttempt,

  _findForReconnect: async (savedDevice) => {
    if (savedDevice.type === 'CLASSIC' || savedDevice.preferredTransport === 'CLASSIC') {
      LogsService.add('reconnect', 'Classic Reconnect Path', savedDevice.address || savedDevice.id, 'PATH');
      return savedDevice;
    }
    return ReconnectService._tryBLEFind(savedDevice);
  },

  _tryBLEFind: (savedDevice) => {
    return new Promise((resolve, reject) => {
      let foundDevice = null;
      let settled = false;
      const finishResolve = (device) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(device);
      };
      const finishReject = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      const timeout = setTimeout(() => {
        BluetoothService.stopScan();
        if (!foundDevice) {
          finishReject(new Error('Device not found'));
        }
      }, SCAN_TIMEOUT_MS);

      BluetoothService.startScan(
        (device) => {
          if (device.id === savedDevice.id || device.address === savedDevice.address) {
            foundDevice = device;
            clearTimeout(timeout);
            BluetoothService.stopScan();
            finishResolve(device);
          }
        },
        () => {
          clearTimeout(timeout);
          if (!foundDevice) {
            finishReject(new Error('Scan completed without device'));
          }
        },
      );
    });
  },
};
