import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { C } from '../constants/colors';
import AppHeader from '../components/AppHeader';
import { PairingService } from '../services/PairingService';
import { ReconnectService } from '../services/ReconnectService';
import { CallService } from '../services/CallService';
import { Storage } from '../storage/Storage';

export default function AutoConnectScreen({ navigation }) {
  const [phase, setPhase] = useState('Preparing reconnect...');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const role = Storage.getRole();
    if (role && role !== 'rider') {
      navigation.replace('Home');
      return undefined;
    }

    const saved = PairingService.getSavedDevice();
    if (!saved) {
      navigation.replace('Scan');
      return undefined;
    }

    ReconnectService.start(
      saved,
      {
        mode: 'auto',
        onAttempt: (a) => {
          setAttempt(a);
        },
        onPhase: (nextPhase, info) => {
          if (nextPhase === 'searching') {
            setPhase(`Searching for ${saved.name}`);
          } else if (nextPhase === 'found') {
            setPhase(`Found ${info?.device?.name || saved.name}`);
          } else if (nextPhase === 'connecting') {
            setPhase(`Connecting to ${info?.device?.name || saved.name}`);
          } else if (nextPhase === 'connected') {
            setPhase(`Connected to ${info?.device?.name || saved.name}`);
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
          setPhase('Auto connect failed');
          Alert.alert('Auto Connect Failed', 'Could not reconnect automatically. Continue with manual scan.');
          navigation.replace('Scan');
        },
      },
    );

    return () => ReconnectService.stop();
  }, [navigation]);

  return (
    <View style={styles.root}>
      <AppHeader title="Auto Connect" subtitle="Reconnecting saved partner" />
      <View style={styles.content}>
        <Text style={styles.phase}>{phase}</Text>
        <Text style={styles.sub}>Attempt: {attempt}</Text>

        <TouchableOpacity style={styles.btn} onPress={() => navigation.replace('Scan')}>
          <Text style={styles.btnTxt}>Skip to Scan</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16 },
  phase: { color: C.text, fontSize: 16, fontWeight: '700' },
  sub: { color: C.textSub, marginTop: 8 },
  btn: {
    marginTop: 20,
    backgroundColor: C.secondaryDim,
    borderColor: C.secondary,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnTxt: { color: C.secondary, fontWeight: '800' },
});
