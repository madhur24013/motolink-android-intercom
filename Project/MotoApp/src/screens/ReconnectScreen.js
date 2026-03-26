import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { C } from '../constants/colors';
import { PairingService } from '../services/PairingService';
import { ReconnectService } from '../services/ReconnectService';
import { CallService } from '../services/CallService';
import { Storage } from '../storage/Storage';
import AppHeader from '../components/AppHeader';

export default function ReconnectScreen({ navigation }) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('Waiting...');

  useEffect(() => {
    const saved = PairingService.getSavedDevice();
    const role = Storage.getRole();
    if (!saved) {
      navigation.replace('Scan');
      return;
    }
    if (role === 'pillion' && (saved.preferredTransport === 'CLASSIC' || saved.type === 'CLASSIC')) {
      setStatus('Waiting for rider to reconnect...');
      const timer = setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }, 1200);
      return () => clearTimeout(timer);
    }

    ReconnectService.start(
      saved,
      {
        mode: 'reconnect',
        onAttempt: (a) => {
          setAttempt(a);
        },
        onPhase: (phase) => {
          if (phase === 'searching') {
            setStatus('Searching for paired device...');
          } else if (phase === 'found') {
            setStatus('Paired device found. Connecting...');
          } else if (phase === 'connecting') {
            setStatus('Restoring Bluetooth link...');
          } else if (phase === 'connected') {
            setStatus('Reconnected');
          }
        },
        onSuccess: ({ channel, device }) => {
          CallService.setSignalingChannel(channel, device);
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        },
        onFailed: () => {
          setStatus('Reconnect failed. Returning home.');
          Alert.alert('Reconnect Failed', 'Could not restore link. Please scan and pair again.');
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        },
      },
    );

    return () => ReconnectService.stop();
  }, [navigation]);

  return (
    <View style={styles.root}>
      <AppHeader title="Reconnect" subtitle="Recovering BLE link" />
      <View style={styles.content}>
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.sub}>Current attempt: {attempt}</Text>

        <TouchableOpacity style={styles.btn} onPress={() => { ReconnectService.stop(); navigation.reset({ index: 0, routes: [{ name: 'Home' }] }); }}>
          <Text style={styles.btnTxt}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 10 },
  status: { color: C.text, fontWeight: '800', fontSize: 16 },
  sub: { color: C.textSub },
  btn: { marginTop: 10, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.warn, alignItems: 'center' },
  btnTxt: { color: C.warn, fontWeight: '800' },
});
