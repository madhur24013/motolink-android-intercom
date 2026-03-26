import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { C } from '../constants/colors';
import AppHeader from '../components/AppHeader';
import { PairingService } from '../services/PairingService';
import { CallService } from '../services/CallService';
import { TransportStateManager } from '../services/TransportStateManager';
import { TRANSPORT_STATES } from '../constants/states';
import { LogsService } from '../services/LogsService';

export default function PairingScreen({ navigation, route }) {
  const { device } = route.params;
  const [steps, setSteps] = useState([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const result = await PairingService.pair(device, (_idx, msg) => {
          if (!mounted) {
            return;
          }
          setSteps((prev) => [...prev, msg]);
        });
        if (!mounted) {
          return;
        }
        CallService.setSignalingChannel(result.channel, result.pairedDevice);
        TransportStateManager.setState(TRANSPORT_STATES.CONNECTED);
        LogsService.add('pairing', 'Navigate Home', result.pairedDevice.name, 'NAV');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } catch (error) {
        if (!mounted) {
          return;
        }
        setFailed(true);
        LogsService.add('pairing', 'Pairing Failed', error.message, 'ERROR');
        setSteps((prev) => [...prev, `Failed: ${error.message}`]);
      }
    };

    run();
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      LogsService.add('pairing', 'Back Press', 'User returned to scan', 'BACK');
      navigation.replace('Scan');
      return true;
    });

    return () => {
      mounted = false;
      backSub.remove();
    };
  }, [device, navigation]);

  return (
    <View style={styles.root}>
      <AppHeader title="Pairing" subtitle={device.name} leftLabel="Back" onLeftPress={() => navigation.replace('Scan')} />
      <View style={styles.content}>
        {steps.map((s, i) => (
          <View key={`${s}-${i}`} style={styles.stepRow}>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.step}>{s}</Text>
          </View>
        ))}
        {(failed || steps.length > 0) && (
          <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.replace('Scan')}>
            <Text style={styles.retryTxt}>Back To Scan</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 10 },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  dot: { color: C.primary, fontSize: 18, fontWeight: '900' },
  step: { color: C.textSub, flex: 1 },
  retryBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.warn,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  retryTxt: { color: C.warn, fontWeight: '800' },
});
