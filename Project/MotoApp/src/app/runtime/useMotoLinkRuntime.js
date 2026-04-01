import {useEffect, useRef} from 'react';
import {Alert} from 'react-native';
import {BluetoothService} from '../../services/BluetoothService';
import {LogsService} from '../../services/LogsService';
import {TransportStateManager} from '../../services/TransportStateManager';
import {TRANSPORT_STATES} from '../../constants/states';
import {CallService} from '../../services/CallService';
import {Storage} from '../../storage/Storage';
import {PairingService} from '../../services/PairingService';

const REPAIR_REQUIRED_REASONS = new Set([
  'identity_mismatch',
  'peer_identity_missing',
  'missing_auth_fields',
]);

const getConnectionId = active =>
  active?.transport === 'CLASSIC'
    ? active?.device?.address || active?.device?.id || null
    : active?.id || null;

const buildRePairMessage = reason => {
  if (reason === 'peer_identity_missing') {
    return 'This device needs to be paired again to restore trust validation.';
  }
  if (reason === 'missing_auth_fields') {
    return 'MotoLink trust validation changed. Pair both phones again before continuing.';
  }
  return 'This device needs to be paired again before MotoLink can continue securely.';
};

export const useMotoLinkRuntime = navigationRef => {
  const lastInviteRef = useRef(null);
  const trustAlertVisibleRef = useRef(false);

  useEffect(() => {
    let stopSignalMonitor = null;
    let monitoredConnectionId = null;
    let stopAdapterWatch = null;
    let unsubscribeConnection = null;

    const detachSignalMonitor = reason => {
      if (!stopSignalMonitor && !monitoredConnectionId) {
        return;
      }
      stopSignalMonitor && stopSignalMonitor();
      stopSignalMonitor = null;
      monitoredConnectionId = null;
      LogsService.add(
        'signal',
        'Signal Monitor Detached',
        reason || 'No active connection',
        'MONITOR',
      );
    };

    const handleRePairFlow = reason => {
      if (trustAlertVisibleRef.current) {
        return;
      }

      trustAlertVisibleRef.current = true;
      Alert.alert('Re-pair Required', buildRePairMessage(reason), [
        {
          text: 'Later',
          style: 'cancel',
          onPress: () => {
            trustAlertVisibleRef.current = false;
          },
        },
        {
          text: 'Re-pair Now',
          onPress: async () => {
            try {
              const current = BluetoothService.getActiveConnection();
              const connectionId = getConnectionId(current);
              if (connectionId) {
                await BluetoothService.disconnect(connectionId).catch(
                  () => null,
                );
              }
              PairingService.forgetDevice();
              Storage.clearRePairRequired();
              navigationRef.current?.reset({
                index: 0,
                routes: [{name: 'Scan'}],
              });
            } finally {
              trustAlertVisibleRef.current = false;
            }
          },
        },
      ]);
    };

    const attachSignalMonitor = active => {
      const nextId = getConnectionId(active);

      if (!active || !nextId) {
        detachSignalMonitor('No active connection');
        return;
      }

      if (nextId === monitoredConnectionId) {
        return;
      }

      detachSignalMonitor('Connection changed');
      monitoredConnectionId = nextId;
      stopSignalMonitor = BluetoothService.listenForInvite(
        active,
        async signal => {
          try {
            if (!signal?.type) {
              return;
            }

            const handshake = await PairingService.handleHandshakeSignal(
              signal,
            );
            if (handshake?.handled) {
              return;
            }

            const trustStatus = PairingService.getSignalTrustStatus(signal);
            if (!trustStatus.trusted) {
              LogsService.add(
                'security',
                'Signal Rejected',
                `${trustStatus.reason || 'unknown'} expected=${
                  trustStatus.expectedPeerIdentityId || 'unknown'
                } got=${trustStatus.senderIdentityId || 'unknown'}`,
                'WARN',
              );

              if (REPAIR_REQUIRED_REASONS.has(trustStatus.reason)) {
                PairingService.markRePairRequired(
                  PairingService.getSavedDevice(),
                  {
                    senderIdentityId: trustStatus.senderIdentityId || null,
                    reason: trustStatus.reason || 'identity_mismatch',
                  },
                );
                handleRePairFlow(trustStatus.reason);
              }
              return;
            }

            const route = navigationRef.current?.getCurrentRoute?.()?.name;
            if (signal?.type === 'invite') {
              const inviteKey = `${signal.sessionId || 'none'}-${
                signal.ts || 'na'
              }`;
              if (
                lastInviteRef.current === inviteKey &&
                route === 'IncomingCall'
              ) {
                return;
              }
              lastInviteRef.current = inviteKey;
              CallService.setSignalingChannel(
                active,
                active?.device || CallService.getPartnerDevice(),
              );
              CallService.setIncomingInvite(
                signal,
                CallService.getPartnerDevice(),
              );
              LogsService.add(
                'call',
                'Incoming Invite',
                `Session ${signal.sessionId}`,
                'INCOMING',
              );
              if (route !== 'IncomingCall') {
                navigationRef.current?.navigate('IncomingCall', {
                  inviteData: signal,
                });
              }
              return;
            }

            await CallService.handleIncomingSignal(signal);
            if (signal?.type === 'end' || signal?.type === 'decline') {
              if (route !== 'Home') {
                navigationRef.current?.reset({
                  index: 0,
                  routes: [{name: 'Home'}],
                });
              }
            }
          } catch (error) {
            LogsService.add(
              'signal',
              'Signal Handler Failed',
              error.message,
              'ERROR',
            );
          }
        },
      );
      LogsService.add('signal', 'Signal Monitor Attached', nextId, 'MONITOR');
    };

    BluetoothService.init()
      .then(() => {
        Storage.getOrCreateLocalIdentity();
        BluetoothService.setClassicRole(Storage.getRole());
        LogsService.add(
          'app',
          'BLE Initialized',
          'Startup successful',
          'READY',
        );
      })
      .catch(err => {
        LogsService.add('app', 'BLE Init Failed', err.message, 'ERROR');
      });

    const unsubTransport = TransportStateManager.subscribe(state => {
      const route = navigationRef.current?.getCurrentRoute?.()?.name;
      const role = Storage.getRole();
      const paired = PairingService.getSavedDevice();
      const passiveClassic =
        role === 'pillion' &&
        (paired?.preferredTransport === 'CLASSIC' ||
          paired?.type === 'CLASSIC');
      if (
        state === TRANSPORT_STATES.DISCONNECTED ||
        state === TRANSPORT_STATES.RECONNECTING
      ) {
        if (passiveClassic) {
          LogsService.add(
            'reconnect',
            'Passive Reconnect Skipped',
            'Pillion waiting for incoming classic link',
            'PASSIVE',
          );
          return;
        }
        if (route !== 'Reconnect') {
          navigationRef.current?.reset({
            index: 0,
            routes: [{name: 'Reconnect'}],
          });
        }
      }
    });

    unsubscribeConnection = BluetoothService.subscribeActiveConnection(
      active => {
        attachSignalMonitor(active);
      },
    );

    stopAdapterWatch = BluetoothService.watchAdapterState(state => {
      if (state === 'PoweredOff') {
        LogsService.add(
          'ble',
          'Bluetooth Powered Off',
          'Adapter turned off while app running',
          'ERROR',
        );
        Alert.alert(
          'Bluetooth Off',
          'Turn Bluetooth on to continue using MotoLink.',
        );
      }
    });

    return () => {
      detachSignalMonitor('Runtime cleanup');
      unsubscribeConnection && unsubscribeConnection();
      stopAdapterWatch && stopAdapterWatch();
      unsubTransport();
      BluetoothService.destroy();
    };
  }, [navigationRef]);
};
