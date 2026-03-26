import { BleManager } from 'react-native-ble-plx';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';
import { BLE_SERVICE_UUID, BLE_CHAR_INVITE_UUID, MOTOLINK_VERSION, SCAN_TIMEOUT_MS } from '../constants/config';
import { TRANSPORT_STATES } from '../constants/states';
import { TransportStateManager } from './TransportStateManager';
import { LogsService } from './LogsService';

const manager = new BleManager();
let scanTimer = null;
let activeConnection = null;
let monitorSubscription = null;
let disconnectSubscription = null;
let adapterWatchSubscription = null;
let classicDiscoverySubscription = null;
let discovered = [];
let classicAcceptorEnabled = false;
let classicAcceptLoopActive = false;
let classicAcceptDesired = false;
let classicAcceptRole = 'none';
let bleChunkBuffers = new Map();
let classicLineBuffer = '';
const CONNECT_TIMEOUT_MS = 20000;
const PAIR_TIMEOUT_MS = 10000;
const BLE_SIGNAL_CHUNK_SIZE = 80;
const CLASSIC_SIGNAL_CHUNK_SIZE = 384;
const BLE_CHUNK_TTL_MS = 20000;
const CLASSIC_ACCEPT_OPTIONS = {
  delimiter: '\n',
  secureSocket: false,
  serviceName: 'MotoLink',
  connectionType: 'delimited',
  readSize: 4096,
  readTimeout: 0,
  charset: 'utf-8',
};
const CLASSIC_CONNECT_OPTIONS = {
  delimiter: '\n',
  secureSocket: false,
  serviceName: 'MotoLink',
  connectionType: 'delimited',
  readSize: 4096,
  readTimeout: 0,
  charset: 'utf-8',
};

const withTimeout = (promise, timeoutMs, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);

const decodeB64 = (value) => {
  try {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
  } catch {
    return null;
  }
};

const encodeB64 = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const buildSignalChunks = (payload, chunkSize) => {
  const raw = JSON.stringify(payload);
  if (raw.length <= chunkSize) {
    return [{ raw }];
  }

  const chunkId = `${payload.sessionId || 'sig'}-${payload.type}-${Date.now()}`;
  const parts = [];
  for (let offset = 0; offset < raw.length; offset += chunkSize) {
    parts.push(raw.slice(offset, offset + chunkSize));
  }

  return parts.map((part, index) => ({
    packet: {
      __mlChunk: true,
      id: chunkId,
      index,
      total: parts.length,
      data: part,
    },
  }));
};

const getClassicAddress = (device) => device?.address || device?.id || null;

const ensureClassicDisconnected = async (address) => {
  if (!address) {
    return;
  }
  try {
    const connected = await RNBluetoothClassic.isDeviceConnected(address);
    if (connected) {
      await RNBluetoothClassic.disconnectFromDevice(address).catch(() => null);
      LogsService.add('classic', 'Classic Socket Reset', address, 'RESET');
    }
  } catch {
    // ignore disconnect checks
  }
};

const connectClassicDevice = async (device, reasonLabel) => {
  const address = getClassicAddress(device);
  if (!address) {
    throw new Error('Classic device address missing');
  }

  stopClassicAcceptor();
  await RNBluetoothClassic.cancelDiscovery().catch(() => null);
  await wait(300);

  if (activeConnection?.transport === 'CLASSIC') {
    const activeAddress = getClassicAddress(activeConnection.device);
    if (activeAddress === address) {
      LogsService.add('classic', 'Classic Reuse', `${reasonLabel} ${address}`, 'REUSE');
      return activeConnection;
    }
    try {
      await activeConnection.device.disconnect();
    } catch {
      // ignore stale socket close failures
    }
    activeConnection = null;
  }

  try {
    const connected = await RNBluetoothClassic.isDeviceConnected(address);
    if (connected && typeof RNBluetoothClassic.getConnectedDevice === 'function') {
      const existing = await RNBluetoothClassic.getConnectedDevice(address);
      activeConnection = { transport: 'CLASSIC', device: existing };
      classicLineBuffer = '';
      LogsService.add('classic', 'Classic Existing Link', `${reasonLabel} ${address}`, 'REUSE');
      return activeConnection;
    }
  } catch {
    // continue into a fresh connect attempt
  }

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await ensureClassicDisconnected(address);
      await RNBluetoothClassic.cancelDiscovery().catch(() => null);
      const connected = await withTimeout(
        RNBluetoothClassic.connectToDevice(address, CLASSIC_CONNECT_OPTIONS),
        CONNECT_TIMEOUT_MS,
        `Classic connect timeout (${reasonLabel})`,
      );
      if (typeof connected?.clear === 'function') {
        await connected.clear().catch(() => null);
      }
      activeConnection = { transport: 'CLASSIC', device: connected };
      classicLineBuffer = '';
      LogsService.add('classic', 'Classic Connected', `${reasonLabel} ${address} attempt=${attempt}`, 'CONNECTED');
      return activeConnection;
    } catch (error) {
      lastError = error;
      LogsService.add('classic', 'Classic Connect Retry', `${reasonLabel} ${address} attempt=${attempt} ${error.message}`, 'RETRY');
      await wait(500 * attempt);
    }
  }

  throw lastError || new Error(`Classic connect failed (${reasonLabel})`);
};

const cleanupBleChunks = () => {
  const now = Date.now();
  bleChunkBuffers.forEach((entry, key) => {
    if (now - entry.createdAt > BLE_CHUNK_TTL_MS) {
      bleChunkBuffers.delete(key);
    }
  });
};

const prepareBleConnection = async (connection) => {
  if (!connection) {
    return connection;
  }
  try {
    if (typeof connection.requestMTU === 'function') {
      await connection.requestMTU(512);
      LogsService.add('ble', 'MTU Requested', `${connection.id} mtu=512`, 'MTU');
    }
  } catch (error) {
    LogsService.add('ble', 'MTU Request Failed', error.message, 'WARN');
  }
  return connection;
};

const emitBlePayload = (payload, onInvite) => {
  if (!payload) {
    return;
  }

  if (payload.__mlChunk) {
    cleanupBleChunks();
    const key = payload.id;
    if (!key || typeof payload.index !== 'number' || typeof payload.total !== 'number') {
      return;
    }
    const entry = bleChunkBuffers.get(key) || {
      createdAt: Date.now(),
      total: payload.total,
      parts: new Array(payload.total).fill(null),
    };
    entry.parts[payload.index] = payload.data || '';
    bleChunkBuffers.set(key, entry);

    const complete = entry.parts.every((part) => typeof part === 'string');
    if (!complete) {
      return;
    }

    bleChunkBuffers.delete(key);
    try {
      const assembled = JSON.parse(entry.parts.join(''));
      LogsService.add('signal', 'BLE Signal Assembled', assembled.type || 'unknown', 'RX');
      onInvite && onInvite(assembled);
    } catch (error) {
      LogsService.add('signal', 'BLE Assemble Failed', error.message, 'ERROR');
    }
    return;
  }

  LogsService.add('signal', 'BLE Signal', payload.type || 'unknown', 'RX');
  onInvite && onInvite(payload);
};

const pushDiscovered = (device, onDeviceFound) => {
  const exists = discovered.some((d) => d.id === device.id);
  if (exists) {
    return;
  }
  discovered.push(device);
  TransportStateManager.setState(TRANSPORT_STATES.DISCOVERED);
  onDeviceFound && onDeviceFound(device);
};

const hasClassicPermissions = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    const connectGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    return !!connectGranted;
  } catch {
    return false;
  }
};

const syncClassicAcceptor = async (reason = 'sync') => {
  const canStart = await hasClassicPermissions();
  const shouldListen = classicAcceptDesired && canStart && !activeConnection;

  if (!shouldListen) {
    if (classicAcceptorEnabled) {
      classicAcceptorEnabled = false;
      await RNBluetoothClassic.cancelAccept().catch(() => null);
      LogsService.add('classic', 'Acceptor Disabled', `${reason} role=${classicAcceptRole}`, 'STOP');
    }
    return;
  }

  if (classicAcceptorEnabled || classicAcceptLoopActive) {
    return;
  }

  classicAcceptorEnabled = true;
  LogsService.add('classic', 'Acceptor Enabled', `${reason} role=${classicAcceptRole}`, 'LISTEN');
  runClassicAcceptLoop();
};

const startClassicAcceptor = async () => {
  await syncClassicAcceptor('start');
};

const stopClassicAcceptor = () => {
  if (!classicAcceptorEnabled) {
    return;
  }
  classicAcceptorEnabled = false;
  RNBluetoothClassic.cancelAccept().catch(() => null);
  LogsService.add('classic', 'Acceptor Disabled', `manual role=${classicAcceptRole}`, 'STOP');
};

const runClassicAcceptLoop = async () => {
  if (classicAcceptLoopActive) {
    return;
  }

  classicAcceptLoopActive = true;
  LogsService.add('classic', 'Acceptor Started', 'Waiting for incoming classic links', 'LISTEN');

  while (classicAcceptorEnabled) {
    if (activeConnection) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }
    try {
      const accepted = await RNBluetoothClassic.accept(CLASSIC_ACCEPT_OPTIONS);
      if (!classicAcceptorEnabled) {
        break;
      }

      activeConnection = { transport: 'CLASSIC', device: accepted };
      TransportStateManager.setState(TRANSPORT_STATES.CONNECTED);
      classicLineBuffer = '';
      LogsService.add('classic', 'Incoming Connection Accepted', accepted?.address || accepted?.id || 'unknown', 'ACCEPT');
    } catch (error) {
      if (classicAcceptorEnabled) {
        LogsService.add('classic', 'Acceptor Error', error.message, 'ERROR');
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  classicAcceptLoopActive = false;
  LogsService.add('classic', 'Acceptor Stopped', 'Classic accept loop exited', 'STOP');
};

export const BluetoothService = {
  init: () => {
    return new Promise((resolve, reject) => {
      const sub = manager.onStateChange((state) => {
        if (state === 'PoweredOn') {
          sub.remove();
          LogsService.add('ble', 'Bluetooth Ready', 'Bluetooth radio powered on', 'READY');
          if (!disconnectSubscription) {
            disconnectSubscription = RNBluetoothClassic.onDeviceDisconnected((event) => {
              const address = event?.device?.address || event?.address || event?.id;
              const activeAddress = activeConnection?.device?.address || activeConnection?.device?.id;
              if (activeConnection?.transport === 'CLASSIC' && address && activeAddress && address === activeAddress) {
                activeConnection = null;
                TransportStateManager.setState(TRANSPORT_STATES.DISCONNECTED);
                LogsService.add('classic', 'Classic Link Lost', address, 'DISCONNECTED');
                syncClassicAcceptor('disconnect');
              }
            });
          }
          syncClassicAcceptor('init');
          resolve();
        } else if (state === 'PoweredOff') {
          sub.remove();
          LogsService.add('ble', 'Bluetooth Off', 'Enable Bluetooth to continue', 'ERROR');
          reject(new Error('Bluetooth is off'));
        }
      }, true);
    });
  },

  startScan: (onDeviceFound, onScanEnd) => {
    discovered = [];
    TransportStateManager.setState(TRANSPORT_STATES.SCANNING);
    LogsService.add('scan', 'Scan Started', 'Scanning MotoLink BLE service UUID', 'SCAN');

    if (classicDiscoverySubscription?.remove) {
      classicDiscoverySubscription.remove();
      classicDiscoverySubscription = null;
    }

    manager.startDeviceScan([BLE_SERVICE_UUID], { allowDuplicates: false }, (error, device) => {
      if (error) {
        LogsService.add('ble', 'BLE Scan Error', error.message, 'ERROR');
        return;
      }
      if (!device) {
        return;
      }

      const advertised = Array.isArray(device.serviceUUIDs) && device.serviceUUIDs.includes(BLE_SERVICE_UUID);
      if (!advertised) {
        return;
      }

      const parsedRole = BluetoothService._parseRoleFromAdvertisement(device);
      const mlDevice = {
        id: device.id,
        name: device.name || device.localName || 'MotoLink Device',
        address: device.id,
        rssi: device.rssi,
        role: parsedRole,
        type: 'BLE',
        version: MOTOLINK_VERSION,
        rawDevice: device,
      };

      pushDiscovered(mlDevice, onDeviceFound);
      LogsService.add('ble', 'BLE Device Found', `${mlDevice.name} (${mlDevice.id})`, 'DISCOVERED');
    });

    (async () => {
      try {
        classicDiscoverySubscription = RNBluetoothClassic.onDeviceDiscovered((event) => {
          const dev = event?.device || event;
          if (!dev?.address && !dev?.id) {
            return;
          }
          const classic = {
            id: dev.address || dev.id,
            name: dev.name || 'Bluetooth Device',
            address: dev.address || dev.id,
            rssi: typeof dev.rssi === 'number' ? dev.rssi : null,
            role: 'unknown',
            type: 'CLASSIC',
            version: MOTOLINK_VERSION,
            rawDevice: dev,
          };
          pushDiscovered(classic, onDeviceFound);
          LogsService.add('classic', 'Classic Device Found', `${classic.name} (${classic.address})`, 'DISCOVERED');
        });

        const bonded = await RNBluetoothClassic.getBondedDevices();
        bonded.forEach((dev) => {
          const classic = {
            id: dev.address,
            name: dev.name || 'Bluetooth Device',
            address: dev.address,
            rssi: null,
            role: 'unknown',
            type: 'CLASSIC',
            version: MOTOLINK_VERSION,
            rawDevice: dev,
          };
          pushDiscovered(classic, onDeviceFound);
        });
        LogsService.add('classic', 'Bonded Loaded', `${bonded.length} bonded devices`, 'DISCOVERED');
      } catch (error) {
        LogsService.add('classic', 'Bonded Read Error', error.message, 'ERROR');
      }

      try {
        const found = await RNBluetoothClassic.startDiscovery();
        found.forEach((dev) => {
          const classic = {
            id: dev.address || dev.id,
            name: dev.name || 'Bluetooth Device',
            address: dev.address || dev.id,
            rssi: typeof dev.rssi === 'number' ? dev.rssi : null,
            role: 'unknown',
            type: 'CLASSIC',
            version: MOTOLINK_VERSION,
            rawDevice: dev,
          };
          pushDiscovered(classic, onDeviceFound);
        });
        LogsService.add('classic', 'Discovery Finished', `${found.length} classic devices`, 'DONE');
      } catch (error) {
        LogsService.add('classic', 'Discovery Error', error.message, 'ERROR');
      }
    })();

    scanTimer = setTimeout(() => {
      BluetoothService.stopScan();
      LogsService.add('scan', 'Scan Completed', `Found ${discovered.length} devices`, 'DONE');
      onScanEnd && onScanEnd(null);
    }, SCAN_TIMEOUT_MS);
  },

  watchAdapterState: (onState) => {
    if (adapterWatchSubscription?.remove) {
      adapterWatchSubscription.remove();
    }
    adapterWatchSubscription = manager.onStateChange((state) => {
      onState && onState(state);
    }, true);

    return () => {
      if (adapterWatchSubscription?.remove) {
        adapterWatchSubscription.remove();
      }
      adapterWatchSubscription = null;
    };
  },

  stopScan: () => {
    if (scanTimer) {
      clearTimeout(scanTimer);
      scanTimer = null;
    }
    manager.stopDeviceScan();
    RNBluetoothClassic.cancelDiscovery().catch(() => null);
    if (classicDiscoverySubscription?.remove) {
      classicDiscoverySubscription.remove();
    }
    classicDiscoverySubscription = null;
    if (TransportStateManager.getState() === TRANSPORT_STATES.SCANNING) {
      TransportStateManager.setState(TRANSPORT_STATES.IDLE);
    }
  },

  connectForPairing: async (device) => {
    if (device.type === 'CLASSIC') {
      LogsService.add('classic', 'Pairing Attempt', `${device.name} (${device.address})`, 'PAIR');
      await withTimeout(
        RNBluetoothClassic.pairDevice(device.address).catch(() => null),
        PAIR_TIMEOUT_MS,
        'Classic pair request timeout',
      ).catch((error) => {
        LogsService.add('classic', 'Pairing Continue', error.message, 'WARN');
      });

      return connectClassicDevice(device, 'pairing');
    }

    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const connection = await withTimeout(
          manager.connectToDevice(device.id, { autoConnect: false }),
          CONNECT_TIMEOUT_MS,
          'BLE connection timeout',
        );
        await withTimeout(
          connection.discoverAllServicesAndCharacteristics(),
          CONNECT_TIMEOUT_MS,
          'BLE service discovery timeout',
        );
        activeConnection = await prepareBleConnection(connection);
        LogsService.add('ble', 'Connected For Pairing', `${device.name} (${device.id}) attempt=${attempt}`, 'CONNECTED');
        return activeConnection;
      } catch (error) {
        lastError = error;
        LogsService.add('ble', 'Pairing Connect Retry', `attempt=${attempt} ${error.message}`, 'RETRY');
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
    throw lastError || new Error('BLE pairing failed');
  },

  connectSavedDevice: async (device) => {
    if (device.type === 'CLASSIC') {
      const connection = await connectClassicDevice(device, 'reconnect');
      TransportStateManager.setState(TRANSPORT_STATES.CONNECTED);
      LogsService.add('classic', 'Classic Reconnected', `${device.name} (${device.address || device.id})`, 'CONNECTED');
      return connection;
    }

    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const connection = await withTimeout(
          manager.connectToDevice(device.id, { autoConnect: false }),
          CONNECT_TIMEOUT_MS,
          'BLE reconnect timeout',
        );
        await withTimeout(
          connection.discoverAllServicesAndCharacteristics(),
          CONNECT_TIMEOUT_MS,
          'BLE reconnect discovery timeout',
        );
        activeConnection = await prepareBleConnection(connection);
        TransportStateManager.setState(TRANSPORT_STATES.CONNECTED);
        LogsService.add('ble', 'Device Connected', `${device.name} (${device.id}) attempt=${attempt}`, 'CONNECTED');
        return activeConnection;
      } catch (error) {
        lastError = error;
        LogsService.add('ble', 'Reconnect Retry', `attempt=${attempt} ${error.message}`, 'RETRY');
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
    throw lastError || new Error('BLE reconnect failed');
  },

  getActiveConnection: () => activeConnection,

  ensureBluetoothEnabled: async () => {
    try {
      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (enabled) {
        return true;
      }
      if (typeof RNBluetoothClassic.requestBluetoothEnabled === 'function') {
        const result = await RNBluetoothClassic.requestBluetoothEnabled();
        const ok = result === true || result === 'true';
        if (ok) {
          LogsService.add('ble', 'Bluetooth Enabled', 'User enabled Bluetooth', 'READY');
          return true;
        }
      }
      LogsService.add('ble', 'Bluetooth Still Off', 'User did not enable Bluetooth', 'ERROR');
      return false;
    } catch (error) {
      LogsService.add('ble', 'Bluetooth Enable Check Failed', error.message, 'ERROR');
      return false;
    }
  },

  startClassicAcceptor: () => {
    startClassicAcceptor();
  },

  stopClassicAcceptor: () => {
    stopClassicAcceptor();
  },

  setClassicRole: (role) => {
    classicAcceptRole = role || 'none';
    classicAcceptDesired = role === 'pillion';
    LogsService.add('classic', 'Acceptor Role Updated', `role=${classicAcceptRole} listen=${classicAcceptDesired}`, 'ROLE');
    if (classicAcceptDesired) {
      syncClassicAcceptor('role');
      return;
    }
    stopClassicAcceptor();
  },

  sendInvitePacket: async (connectedDevice, payload) => {
    if (
      connectedDevice?.transport === 'CLASSIC' ||
      typeof connectedDevice?.onDataReceived === 'function' ||
      typeof connectedDevice?.device?.onDataReceived === 'function'
    ) {
      const dev = connectedDevice?.device?.write ? connectedDevice.device : connectedDevice;
      try {
        const chunks = buildSignalChunks(payload, CLASSIC_SIGNAL_CHUNK_SIZE);
        if (chunks.length > 1) {
          LogsService.add('signal', 'Classic Chunk Send', `${payload.type} parts=${chunks.length}`, 'TX');
        }
        for (const chunk of chunks) {
          const line = chunk.raw || JSON.stringify(chunk.packet);
          await dev.write(`${line}\n`);
          if (chunks.length > 1) {
            await wait(10);
          }
        }
      } catch (error) {
        LogsService.add('classic', 'Classic Write Failed', error.message, 'ERROR');
        throw error;
      }
      return;
    }

    const chunks = buildSignalChunks(payload, BLE_SIGNAL_CHUNK_SIZE);
    if (chunks.length === 1 && chunks[0].raw) {
      await connectedDevice.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHAR_INVITE_UUID,
        Buffer.from(chunks[0].raw, 'utf8').toString('base64'),
      );
      return;
    }

    LogsService.add('signal', 'BLE Chunk Send', `${payload.type} parts=${chunks.length}`, 'TX');
    for (const chunk of chunks) {
      await connectedDevice.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHAR_INVITE_UUID,
        encodeB64(chunk.packet),
      );
      await wait(30);
    }
  },

  listenForInvite: (connectedDevice, onInvite) => {
    if (
      connectedDevice?.transport === 'CLASSIC' ||
      typeof connectedDevice?.onDataReceived === 'function' ||
      typeof connectedDevice?.device?.onDataReceived === 'function'
    ) {
      const dev = connectedDevice?.device?.onDataReceived ? connectedDevice.device : connectedDevice;
      if (monitorSubscription?.remove) {
        monitorSubscription.remove();
      }
      classicLineBuffer = '';

      monitorSubscription = dev.onDataReceived((event) => {
        const raw = typeof event === 'string' ? event : event?.data || '';
        const text = String(raw || '');
        if (!text) {
          return;
        }

        try {
          const payload = JSON.parse(text);
          emitBlePayload(payload, (message) => {
            LogsService.add('signal', 'Classic Signal', message.type || 'unknown', 'RX');
            onInvite && onInvite(message);
          });
          return;
        } catch {
          // Fall through to buffered parsing for any unexpected non-delimited data.
        }

        classicLineBuffer += text;
        const lines = classicLineBuffer.split('\n');
        classicLineBuffer = lines.pop() || '';

        lines.forEach((line) => {
          if (!line.trim()) {
            return;
          }
          try {
            const payload = JSON.parse(line);
            emitBlePayload(payload, (message) => {
              LogsService.add('signal', 'Classic Signal', message.type || 'unknown', 'RX');
              onInvite && onInvite(message);
            });
          } catch {
            LogsService.add('signal', 'Classic Signal Parse Skipped', 'Partial or malformed packet ignored', 'WARN');
          }
        });
      });

      return () => {
        if (monitorSubscription?.remove) {
          monitorSubscription.remove();
        }
        monitorSubscription = null;
        classicLineBuffer = '';
      };
    }

    if (monitorSubscription) {
      monitorSubscription.remove();
      monitorSubscription = null;
    }

    monitorSubscription = connectedDevice.monitorCharacteristicForService(
      BLE_SERVICE_UUID,
      BLE_CHAR_INVITE_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) {
          if (error) {
            LogsService.add('ble', 'Invite Monitor Error', error.message, 'ERROR');
            activeConnection = null;
            TransportStateManager.setState(TRANSPORT_STATES.DISCONNECTED);
          }
          return;
        }
        const payload = decodeB64(characteristic.value);
        if (!payload) {
          return;
        }
        emitBlePayload(payload, onInvite);
      },
    );

    return () => {
      if (monitorSubscription) {
        monitorSubscription.remove();
        monitorSubscription = null;
      }
    };
  },

  readRSSI: async (deviceId) => {
    if (activeConnection?.transport === 'CLASSIC') {
      return null;
    }
    try {
      const device = await manager.readRSSIForDevice(deviceId);
      return typeof device.rssi === 'number' ? device.rssi : null;
    } catch {
      return null;
    }
  },

  disconnect: async (deviceId) => {
    try {
      if (activeConnection?.transport === 'CLASSIC') {
        await activeConnection.device.disconnect().catch(() => null);
      } else {
        await manager.cancelDeviceConnection(deviceId);
      }
      LogsService.add('ble', 'Disconnected', deviceId, 'DISCONNECTED');
    } finally {
      activeConnection = null;
      classicLineBuffer = '';
      if (monitorSubscription?.remove) {
        monitorSubscription.remove();
      }
      monitorSubscription = null;
      TransportStateManager.setState(TRANSPORT_STATES.DISCONNECTED);
      syncClassicAcceptor('disconnect');
    }
  },

  destroy: () => {
    stopClassicAcceptor();
    if (disconnectSubscription?.remove) {
      disconnectSubscription.remove();
    }
    disconnectSubscription = null;
    if (monitorSubscription?.remove) {
      monitorSubscription.remove();
    }
    monitorSubscription = null;
    if (classicDiscoverySubscription?.remove) {
      classicDiscoverySubscription.remove();
    }
    classicDiscoverySubscription = null;
    if (adapterWatchSubscription?.remove) {
      adapterWatchSubscription.remove();
    }
    adapterWatchSubscription = null;
    bleChunkBuffers = new Map();
    classicLineBuffer = '';
    manager.destroy();
  },

  _parseRoleFromAdvertisement: (device) => {
    if (!device.manufacturerData) {
      return 'unknown';
    }
    try {
      const parsed = decodeB64(device.manufacturerData);
      return parsed?.role || 'unknown';
    } catch {
      return 'unknown';
    }
  },
};

