import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { BluetoothService } from './services/BluetoothService';
import { LogsService } from './services/LogsService';
import { TransportStateManager } from './services/TransportStateManager';
import { TRANSPORT_STATES } from './constants/states';
import { CallService } from './services/CallService';
import { Storage } from './storage/Storage';
import { PairingService } from './services/PairingService';

export default function App() {
  const navigationRef = useRef(null);
  const lastInviteRef = useRef(null);

  useEffect(() => {
    let stopSignalMonitor = null;
    let monitorConnectionId = null;
    let stopAdapterWatch = null;

    BluetoothService.init()
      .then(() => {
        BluetoothService.setClassicRole(Storage.getRole());
        LogsService.add('app', 'BLE Initialized', 'Startup successful', 'READY');
      })
      .catch((err) => {
        LogsService.add('app', 'BLE Init Failed', err.message, 'ERROR');
      });

    const unsub = TransportStateManager.subscribe((state) => {
      const route = navigationRef.current?.getCurrentRoute?.()?.name;
      const role = Storage.getRole();
      const paired = PairingService.getSavedDevice();
      const passiveClassic = role === 'pillion' && (paired?.preferredTransport === 'CLASSIC' || paired?.type === 'CLASSIC');
      if (state === TRANSPORT_STATES.DISCONNECTED || state === TRANSPORT_STATES.RECONNECTING) {
        if (passiveClassic) {
          LogsService.add('reconnect', 'Passive Reconnect Skipped', 'Pillion waiting for incoming classic link', 'PASSIVE');
          return;
        }
        if (route !== 'Reconnect') {
          navigationRef.current?.reset({
            index: 0,
            routes: [{ name: 'Reconnect' }],
          });
        }
      }
    });

    const monitorTimer = setInterval(() => {
      const active = BluetoothService.getActiveConnection();
      const id = active?.transport === 'CLASSIC'
        ? active?.device?.address || active?.device?.id || null
        : active?.id || null;

      if (!active || !id) {
        if (monitorConnectionId) {
          stopSignalMonitor && stopSignalMonitor();
          stopSignalMonitor = null;
          monitorConnectionId = null;
          LogsService.add('signal', 'Signal Monitor Detached', 'No active connection', 'MONITOR');
        }
        return;
      }

      if (id === monitorConnectionId) {
        return;
      }

      stopSignalMonitor && stopSignalMonitor();
      monitorConnectionId = id;
      stopSignalMonitor = BluetoothService.listenForInvite(active, async (signal) => {
        try {
          if (!signal?.type) {
            return;
          }
          const route = navigationRef.current?.getCurrentRoute?.()?.name;
          if (signal?.type === 'invite') {
            const inviteKey = `${signal.sessionId || 'none'}-${signal.ts || 'na'}`;
            if (lastInviteRef.current === inviteKey && route === 'IncomingCall') {
              return;
            }
            lastInviteRef.current = inviteKey;
            CallService.setSignalingChannel(active, active?.device || CallService.getPartnerDevice());
            CallService.setIncomingInvite(signal, CallService.getPartnerDevice());
            LogsService.add('call', 'Incoming Invite', `Session ${signal.sessionId}`, 'INCOMING');
            if (route !== 'IncomingCall') {
              navigationRef.current?.navigate('IncomingCall', { inviteData: signal });
            }
            return;
          }
          await CallService.handleIncomingSignal(signal);
          if (signal?.type === 'end' || signal?.type === 'decline') {
            if (route !== 'Home') {
              navigationRef.current?.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            }
          }
        } catch (error) {
          LogsService.add('signal', 'Signal Handler Failed', error.message, 'ERROR');
        }
      });
      LogsService.add('signal', 'Signal Monitor Attached', id, 'MONITOR');
    }, 1200);

    stopAdapterWatch = BluetoothService.watchAdapterState((state) => {
      if (state === 'PoweredOff') {
        LogsService.add('ble', 'Bluetooth Powered Off', 'Adapter turned off while app running', 'ERROR');
        Alert.alert('Bluetooth Off', 'Turn Bluetooth on to continue using MotoLink.');
      }
    });

    return () => {
      clearInterval(monitorTimer);
      stopSignalMonitor && stopSignalMonitor();
      stopAdapterWatch && stopAdapterWatch();
      unsub();
      BluetoothService.destroy();
    };
  }, []);

  return <AppNavigator navigationRef={navigationRef} />;
}
