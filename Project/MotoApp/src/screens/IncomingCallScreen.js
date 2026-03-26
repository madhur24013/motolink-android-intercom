import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import { C } from '../constants/colors';
import { CALL_AUTO_MISS_SECONDS } from '../constants/config';
import { CallService } from '../services/CallService';
import { LogsService } from '../services/LogsService';
import { BluetoothService } from '../services/BluetoothService';
import AppHeader from '../components/AppHeader';

export default function IncomingCallScreen({ route, navigation }) {
  const inviteData = route?.params?.inviteData;
  const [secondsLeft, setSecondsLeft] = useState(CALL_AUTO_MISS_SECONDS);

  const stopRingSafely = () => {
    try {
      Vibration.cancel();
    } catch (error) {
      LogsService.add('call', 'Incoming Ring Stop Failed', error.message, 'WARN');
    }
  };

  const startRingSafely = () => {
    try {
      Vibration.vibrate([0, 800, 600], true);
      LogsService.add('call', 'Incoming Ring Started', `Session ${inviteData.sessionId}`, 'RING');
    } catch (error) {
      LogsService.add('call', 'Incoming Ring Failed', error.message, 'WARN');
    }
  };

  useEffect(() => {
    if (!inviteData?.sessionId) {
      LogsService.add('call', 'Incoming Screen Missing Invite', 'Incoming route opened without invite data', 'ERROR');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
      return undefined;
    }
    // Keep incoming alert fully inside the app. Native ringtone playback was
    // pushing some phones out to the launcher/app-protect flow.
    startRingSafely();

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          stopRingSafely();
          CallService.declineCall(inviteData.sessionId).catch(() => null);
          LogsService.add('call', 'Missed Call', `Session ${inviteData.sessionId}`, 'MISSED');
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      stopRingSafely();
      LogsService.add('call', 'Incoming Ring Stopped', `Session ${inviteData.sessionId}`, 'RING');
    };
  }, [inviteData?.sessionId, navigation]);

  const accept = async () => {
    stopRingSafely();
    const active = BluetoothService.getActiveConnection();
    if (active) {
      CallService.setSignalingChannel(active, active?.device || CallService.getPartnerDevice());
      LogsService.add('call', 'Incoming Channel Bound', active?.transport || 'unknown', 'CHANNEL');
    }
    await CallService.acceptCall(inviteData, () => null);
    navigation.replace('Call', { mode: 'incoming', sessionId: inviteData.sessionId });
  };

  const decline = async () => {
    stopRingSafely();
    await CallService.declineCall(inviteData.sessionId);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Incoming Call" subtitle={`Session ${inviteData.sessionId}`} />
      <View style={styles.content}>
        <Text style={styles.head}>MotoLink incoming voice call</Text>
        <Text style={styles.sub}>Auto miss in {secondsLeft}s</Text>

        <TouchableOpacity style={styles.accept} onPress={accept}>
          <Text style={styles.btnTxtDark}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.decline} onPress={decline}>
          <Text style={styles.btnTxt}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, padding: 16, justifyContent: 'center', gap: 14 },
  head: { color: C.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  sub: { color: C.warn, textAlign: 'center' },
  accept: { backgroundColor: C.success, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  decline: { borderColor: C.error, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnTxtDark: { color: C.bg, fontWeight: '900' },
  btnTxt: { color: C.error, fontWeight: '900' },
});
