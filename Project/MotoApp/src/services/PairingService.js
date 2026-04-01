import {MOTOLINK_VERSION} from '../constants/config';
import {TRANSPORT_STATES} from '../constants/states';
import {Storage} from '../storage/Storage';
import {BluetoothService} from './BluetoothService';
import {LogsService} from './LogsService';
import {TransportStateManager} from './TransportStateManager';

let pendingValidation = null;
let activePairingRun = null;
const SIGNAL_MAX_CLOCK_SKEW_MS = 120000;
const SIGNAL_REPLAY_CACHE_LIMIT = 120;
const signalReplayCache = new Map();

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const buildRePairRequiredError = message => {
  const error = new Error(message);
  error.rePairRequired = true;
  error.code = 'REPAIR_REQUIRED';
  return error;
};

const buildPairingCancelledError = () => {
  const error = new Error('Pairing cancelled');
  error.cancelled = true;
  error.code = 'PAIRING_CANCELLED';
  return error;
};

const getConnectionId = connection =>
  connection?.transport === 'CLASSIC'
    ? connection?.device?.address || connection?.device?.id || null
    : connection?.id || null;

const isPairingRunCancelled = run =>
  !run || run.cancelled || activePairingRun !== run;

const purgeReplayCache = identityId => {
  const cache = signalReplayCache.get(identityId);
  if (!cache) {
    return;
  }

  const threshold = Date.now() - SIGNAL_MAX_CLOCK_SKEW_MS * 2;
  for (const [nonce, ts] of cache.entries()) {
    if (ts < threshold) {
      cache.delete(nonce);
    }
  }

  while (cache.size > SIGNAL_REPLAY_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    cache.delete(oldestKey);
  }
};

const isSignalReplay = (identityId, nonce) => {
  const cache = signalReplayCache.get(identityId);
  if (!cache) {
    return false;
  }
  purgeReplayCache(identityId);
  return cache.has(nonce);
};

const rememberSignalNonce = (identityId, nonce, ts) => {
  const cache = signalReplayCache.get(identityId) || new Map();
  cache.set(nonce, ts || Date.now());
  signalReplayCache.set(identityId, cache);
  purgeReplayCache(identityId);
};

const cancelPairingConnection = async connected => {
  const connectionId = getConnectionId(connected);
  if (connectionId) {
    await BluetoothService.disconnect(connectionId).catch(() => null);
  }
};

export const PairingService = {
  pair: async (device, onStep) => {
    const run = {
      id: `${device?.id || 'device'}-${Date.now()}`,
      cancelled: false,
    };
    activePairingRun = run;
    TransportStateManager.setState(TRANSPORT_STATES.PAIRING);
    LogsService.add(
      'pairing',
      'Pairing Started',
      `${device.name} (${device.id})`,
      'PAIRING',
    );

    onStep && onStep(0, 'Initiating link handshake');
    let connected = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        connected = await Promise.race([
          BluetoothService.connectForPairing(device),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Handshake timeout. Try scan again.')),
              30000,
            ),
          ),
        ]);
        if (isPairingRunCancelled(run)) {
          await cancelPairingConnection(connected);
          throw buildPairingCancelledError();
        }
        break;
      } catch (error) {
        if (error?.cancelled || isPairingRunCancelled(run)) {
          throw buildPairingCancelledError();
        }
        lastError = error;
        LogsService.add(
          'pairing',
          'Handshake Attempt Failed',
          `attempt=${attempt} ${error.message}`,
          'RETRY',
        );
        if (attempt < 2) {
          await wait(1000);
        }
      }
    }
    if (!connected) {
      throw lastError || new Error('Handshake timeout. Try scan again.');
    }

    try {
      onStep && onStep(1, 'Validating MotoLink link');
      const sessionToken = PairingService._generateToken(device.id);
      const validation = await PairingService._validateConnectedPeer(
        connected,
        device,
        sessionToken,
      );
      if (isPairingRunCancelled(run)) {
        await cancelPairingConnection(connected);
        throw buildPairingCancelledError();
      }

      const pairedDevice = {
        ...device,
        sessionToken,
        pairedAt: Date.now(),
        lastSeen: Date.now(),
        preferredTransport: connected?.transport || device.type || 'BLE',
        validationState: 'validated',
        validatedAt: Date.now(),
        peerVersion: validation.peerVersion || 'unknown',
        localVersion: MOTOLINK_VERSION,
        peerIdentityId: validation.peerIdentityId || null,
        localIdentityId: validation.localIdentityId || null,
      };

      onStep && onStep(2, 'Saving paired device');
      if (isPairingRunCancelled(run)) {
        await cancelPairingConnection(connected);
        throw buildPairingCancelledError();
      }
      Storage.savePairedDevice(pairedDevice);

      onStep && onStep(3, 'Subscribing signaling channel');
      if (isPairingRunCancelled(run)) {
        await cancelPairingConnection(connected);
        throw buildPairingCancelledError();
      }
      TransportStateManager.setState(TRANSPORT_STATES.PAIRED);
      LogsService.add(
        'pairing',
        'Pairing Completed',
        `${pairedDevice.name} (${pairedDevice.peerVersion})`,
        'PAIRED',
      );

      return {pairedDevice, channel: connected};
    } catch (error) {
      if (error?.cancelled) {
        TransportStateManager.setState(TRANSPORT_STATES.IDLE);
        LogsService.add(
          'pairing',
          'Pairing Cancelled',
          `${device.name} (${device.id})`,
          'CANCEL',
        );
      } else {
        const connectionId = getConnectionId(connected);
        if (connectionId) {
          await BluetoothService.disconnect(connectionId).catch(() => null);
        }
        TransportStateManager.setState(TRANSPORT_STATES.FAILED);
      }
      throw error;
    } finally {
      if (activePairingRun === run) {
        activePairingRun = null;
      }
    }
  },

  cancelPairing: async reason => {
    if (!activePairingRun) {
      return false;
    }

    activePairingRun.cancelled = true;
    LogsService.add(
      'pairing',
      'Pairing Cancel Requested',
      reason || 'Pairing stopped',
      'CANCEL',
    );

    const active = BluetoothService.getActiveConnection();
    const connectionId = getConnectionId(active);
    if (connectionId) {
      await BluetoothService.disconnect(connectionId).catch(() => null);
    }
    return true;
  },

  forgetDevice: () => {
    const device = Storage.getPairedDevice();
    signalReplayCache.clear();
    Storage.clearPairedDevice();
    TransportStateManager.setState(TRANSPORT_STATES.IDLE);
    LogsService.add(
      'pairing',
      'Device Forgotten',
      device?.name || 'Unknown',
      'FORGOT',
    );
  },

  getSavedDevice: () => Storage.getPairedDevice(),

  updateLastSeen: deviceId => {
    const existing = Storage.getPairedDevice();
    if (existing && existing.id === deviceId) {
      Storage.savePairedDevice({...existing, lastSeen: Date.now()});
    }
  },

  markRePairRequired: (
    pairedDevice = Storage.getPairedDevice(),
    {senderIdentityId = null, reason = 'identity_mismatch'} = {},
  ) => {
    if (!pairedDevice?.id) {
      return;
    }

    Storage.saveRePairRequired({
      pairedDeviceId: pairedDevice.id,
      pairedDeviceName: pairedDevice.name,
      senderIdentityId,
      expectedPeerIdentityId: pairedDevice.peerIdentityId || null,
      reason,
      ts: Date.now(),
    });
  },

  validateSavedDeviceLink: async (
    connected,
    savedDevice = Storage.getPairedDevice(),
  ) => {
    if (!connected) {
      throw new Error('MotoLink could not validate the reconnecting device.');
    }
    if (!savedDevice?.id) {
      return {
        validated: false,
        trust: 'missing_pair',
      };
    }

    const sessionToken = PairingService._generateToken(savedDevice.id);
    const validation = await PairingService._validateConnectedPeer(
      connected,
      savedDevice,
      sessionToken,
    );

    if (
      savedDevice.peerIdentityId &&
      validation.peerIdentityId &&
      validation.peerIdentityId !== savedDevice.peerIdentityId
    ) {
      PairingService.markRePairRequired(savedDevice, {
        senderIdentityId: validation.peerIdentityId,
        reason: 'identity_mismatch',
      });
      throw buildRePairRequiredError(
        'This device needs to be paired again before MotoLink can reconnect.',
      );
    }

    if (!validation.peerIdentityId) {
      PairingService.markRePairRequired(savedDevice, {
        reason: 'identity_unverified',
      });
      throw buildRePairRequiredError(
        'This device needs to be paired again before MotoLink can reconnect.',
      );
    }

    const refreshed = {
      ...savedDevice,
      lastSeen: Date.now(),
      validationState: 'validated',
      validatedAt: Date.now(),
      peerVersion: validation.peerVersion || savedDevice.peerVersion || null,
      peerIdentityId: validation.peerIdentityId,
      localIdentityId:
        validation.localIdentityId || savedDevice.localIdentityId || null,
    };
    Storage.savePairedDevice(refreshed);
    return {
      ...validation,
      validated: true,
      pairedDevice: refreshed,
    };
  },

  getSignalTrustStatus: (signal, pairedDevice = Storage.getPairedDevice()) => {
    if (
      !signal?.type ||
      signal.type === 'pair_hello' ||
      signal.type === 'pair_ack'
    ) {
      return {trusted: true, reason: null};
    }

    if (!pairedDevice?.peerIdentityId) {
      return {
        trusted: false,
        reason: 'peer_identity_missing',
        pairedDeviceId: pairedDevice?.id || null,
        pairedDeviceName: pairedDevice?.name || null,
      };
    }

    if (signal.senderIdentityId === pairedDevice.peerIdentityId) {
      const signalTs = Number(signal.ts);
      if (!Number.isFinite(signalTs) || !signal.signalNonce) {
        return {
          trusted: false,
          reason: 'missing_auth_fields',
          pairedDeviceId: pairedDevice.id,
          pairedDeviceName: pairedDevice.name,
          expectedPeerIdentityId: pairedDevice.peerIdentityId,
          senderIdentityId: signal.senderIdentityId || null,
        };
      }

      if (Math.abs(Date.now() - signalTs) > SIGNAL_MAX_CLOCK_SKEW_MS) {
        return {
          trusted: false,
          reason: 'stale_signal',
          pairedDeviceId: pairedDevice.id,
          pairedDeviceName: pairedDevice.name,
          expectedPeerIdentityId: pairedDevice.peerIdentityId,
          senderIdentityId: signal.senderIdentityId || null,
        };
      }

      if (isSignalReplay(signal.senderIdentityId, signal.signalNonce)) {
        return {
          trusted: false,
          reason: 'replay_detected',
          pairedDeviceId: pairedDevice.id,
          pairedDeviceName: pairedDevice.name,
          expectedPeerIdentityId: pairedDevice.peerIdentityId,
          senderIdentityId: signal.senderIdentityId || null,
        };
      }

      rememberSignalNonce(
        signal.senderIdentityId,
        signal.signalNonce,
        signalTs,
      );
      return {trusted: true, reason: null};
    }

    return {
      trusted: false,
      reason: 'identity_mismatch',
      pairedDeviceId: pairedDevice.id,
      pairedDeviceName: pairedDevice.name,
      expectedPeerIdentityId: pairedDevice.peerIdentityId,
      senderIdentityId: signal.senderIdentityId || null,
    };
  },

  isTrustedSignal: (signal, pairedDevice = Storage.getPairedDevice()) =>
    PairingService.getSignalTrustStatus(signal, pairedDevice).trusted,

  handleHandshakeSignal: async signal => {
    if (!signal?.type) {
      return {handled: false};
    }

    if (signal.type === 'pair_hello') {
      const active = BluetoothService.getActiveConnection();
      if (!active) {
        LogsService.add(
          'pairing',
          'Pair Validation Ignored',
          'No active link available for validation response',
          'WARN',
        );
        return {handled: true};
      }

      const localIdentity = Storage.getOrCreateLocalIdentity();
      await BluetoothService.sendInvitePacket(active, {
        type: 'pair_ack',
        sessionToken: signal.sessionToken,
        challenge: signal.challenge,
        acknowledgedIdentityId: signal.senderIdentityId || null,
        peerIdentityId: localIdentity.id,
        peerVersion: MOTOLINK_VERSION,
        ts: Date.now(),
      });
      LogsService.add(
        'pairing',
        'Pair Validation Ack Sent',
        `Session ${signal.sessionToken || 'unknown'}`,
        'ACK',
      );
      return {handled: true};
    }

    if (signal.type === 'pair_ack') {
      if (!pendingValidation) {
        LogsService.add(
          'pairing',
          'Unexpected Pair Ack',
          `Session ${signal.sessionToken || 'unknown'}`,
          'WARN',
        );
        return {handled: true};
      }

      if (
        pendingValidation.sessionToken !== signal.sessionToken ||
        pendingValidation.challenge !== signal.challenge
      ) {
        LogsService.add(
          'pairing',
          'Mismatched Pair Ack',
          `Expected ${pendingValidation.sessionToken}, received ${
            signal.sessionToken || 'unknown'
          }`,
          'WARN',
        );
        return {handled: true};
      }

      if (
        pendingValidation.localIdentityId &&
        signal.acknowledgedIdentityId !== pendingValidation.localIdentityId
      ) {
        LogsService.add(
          'pairing',
          'Pair Ack Identity Rejected',
          `Expected local ${pendingValidation.localIdentityId}, received ${
            signal.acknowledgedIdentityId || 'unknown'
          }`,
          'WARN',
        );
        return {handled: true};
      }

      pendingValidation.resolve({
        peerVersion: signal.peerVersion || 'unknown',
        peerIdentityId: signal.peerIdentityId || null,
        localIdentityId: pendingValidation.localIdentityId,
      });
      LogsService.add(
        'pairing',
        'Pair Validation Confirmed',
        `Peer ${signal.peerVersion || 'unknown'} ${
          signal.peerIdentityId || 'unknown'
        }`,
        'VALID',
      );
      pendingValidation = null;
      return {handled: true};
    }

    return {handled: false};
  },

  _generateToken: deviceId => {
    const compactId = String(deviceId || 'device')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-8);
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `ML-${compactId}-${Date.now().toString(36)}-${randomPart}`;
  },

  _generateChallenge: deviceId =>
    `${String(deviceId || 'peer')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-6)}-${Math.random().toString(36).slice(2, 12)}`,

  _validateConnectedPeer: async (connected, device, sessionToken) => {
    const challenge = PairingService._generateChallenge(device.id);
    const localIdentity = Storage.getOrCreateLocalIdentity();
    const validationPromise = new Promise(resolve => {
      pendingValidation = {
        sessionToken,
        challenge,
        localIdentityId: localIdentity.id,
        resolve,
      };
    });

    try {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        LogsService.add(
          'pairing',
          'Pair Validation Attempt',
          `attempt=${attempt} ${device.name || device.id}`,
          'VALIDATE',
        );

        await BluetoothService.sendInvitePacket(connected, {
          type: 'pair_hello',
          sessionToken,
          challenge,
          appVersion: MOTOLINK_VERSION,
          senderIdentityId: localIdentity.id,
          role: device.role || 'unknown',
          ts: Date.now(),
        });

        try {
          return await Promise.race([
            validationPromise,
            wait(4500).then(() => {
              throw new Error('Pair validation timed out');
            }),
          ]);
        } catch (error) {
          if (attempt === 3) {
            throw new Error(
              'MotoLink could not validate the paired device. Make sure MotoLink is open and updated on both phones, then try again.',
            );
          }
          await wait(700);
        }
      }

      throw new Error(
        'MotoLink could not validate the paired device. Try pairing again.',
      );
    } finally {
      pendingValidation = null;
    }
  },
};
