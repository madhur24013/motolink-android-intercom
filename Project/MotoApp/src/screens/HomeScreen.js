import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { C } from '../constants/colors';
import { PairingService } from '../services/PairingService';
import { BluetoothService } from '../services/BluetoothService';
import { CallService } from '../services/CallService';
import { TransportStateManager } from '../services/TransportStateManager';
import { LogsService } from '../services/LogsService';
import AppHeader from '../components/AppHeader';
import TransportBanner from '../components/TransportBanner';
import SignalBars from '../components/SignalBars';

export default function HomeScreen({ navigation }) {
  const [transportState, setTransportState] = useState(TransportStateManager.getState());
  const [logs, setLogs] = useState([]);
  const [rssi, setRssi] = useState(null);
  const [calling, setCalling] = useState(false);
  const paired = useMemo(() => PairingService.getSavedDevice(), []);

  useEffect(() => {
    const unsubState = TransportStateManager.subscribe(setTransportState);
    const unsubLogs = LogsService.subscribe(setLogs);
    if (BluetoothService.getActiveConnection()) {
      CallService.setSignalingChannel(BluetoothService.getActiveConnection(), paired);
    }

    const poll = setInterval(async () => {
      if (!paired) {
        return;
      }
      const value = await BluetoothService.readRSSI(paired.id);
      if (typeof value === 'number') {
        setRssi(value);
      }
    }, 5000);

    return () => {
      clearInterval(poll);
      unsubState();
      unsubLogs();
    };
  }, [paired]);

  return (
    <View style={styles.root}>
      <AppHeader
        title="MotoLink"
        subtitle={paired ? `Paired: ${paired.name}` : 'No paired device'}
        leftLabel="Settings"
        rightLabel="Logs"
        onLeftPress={() => navigation.navigate('Settings')}
        onRightPress={() => navigation.navigate('Logs')}
      />

      <View style={styles.content}>
        <TransportBanner state={transportState} />

        <View style={styles.signalCard}>
          <Text style={styles.cardTitle}>Signal</Text>
          <SignalBars rssi={rssi} />
          <Text style={styles.cardSub}>{typeof rssi === 'number' ? `${rssi} dBm` : 'No RSSI yet'}</Text>
        </View>

        <TouchableOpacity
          style={[styles.callBtn, (!paired || calling || transportState !== 'connected') && styles.disabled]}
          disabled={!paired || calling || transportState !== 'connected'}
          onPress={async () => {
            if (!paired) {
              return;
            }
            try {
              setCalling(true);
              const result = await CallService.initiateCall(paired, () => null);
              navigation.navigate('Call', { mode: 'outgoing', sessionId: result?.sessionId || CallService.getSessionId() });
            } catch (error) {
              LogsService.add('call', 'Call Start Failed', error.message, 'ERROR');
              Alert.alert('Call Failed', error.message);
            } finally {
              setCalling(false);
            }
          }}
        >
          <Text style={styles.callTxt}>{calling ? 'Calling...' : 'Start Call'}</Text>
        </TouchableOpacity>

        <Text style={styles.logTitle}>Recent Logs</Text>
        <FlatList
          data={logs.slice(0, 8)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          renderItem={({ item }) => (
            <View style={styles.logItem}>
              <Text style={styles.logLabel}>{item.label}</Text>
              <Text style={styles.logDetail}>{item.detail}</Text>
              <Text style={styles.logTime}>{item.time}</Text>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, padding: 16, gap: 12 },
  signalCard: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: { color: C.text, fontWeight: '800', marginBottom: 8 },
  cardSub: { color: C.textSub, marginTop: 10 },
  callBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
  },
  callTxt: { color: C.bg, fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.4 },
  logTitle: { color: C.text, fontWeight: '800', marginTop: 4 },
  logItem: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: C.surface,
  },
  logLabel: { color: C.primary, fontWeight: '800' },
  logDetail: { color: C.textSub, marginTop: 3, fontSize: 12 },
  logTime: { color: C.textMuted, marginTop: 4, fontSize: 11 },
});
