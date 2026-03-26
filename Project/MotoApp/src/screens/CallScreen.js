import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import KeepAwake from 'react-native-keep-awake';
import { C } from '../constants/colors';
import { AudioService } from '../services/AudioService';
import { CallService } from '../services/CallService';
import { LogsService } from '../services/LogsService';
import { Storage } from '../storage/Storage';
import AppHeader from '../components/AppHeader';
import Waveform from '../components/Waveform';

export default function CallScreen({ navigation, route }) {
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [fullDuplex, setFullDuplex] = useState(false);
  const [stats, setStats] = useState({ rttMs: null, jitterMs: null });
  const [txActive, setTxActive] = useState(false);

  useEffect(() => {
    KeepAwake.activate();
    const settings = Storage.getSettings();
    const initialFullDuplex = !settings.pttMode;
    const initialSpeaker = !!settings.speakerDefault;
    setFullDuplex(initialFullDuplex);
    setSpeaker(initialSpeaker);
    AudioService.applyCallPreferences(settings);

    const secTimer = setInterval(() => setSeconds((s) => s + 1), 1000);
    const statsTimer = setInterval(async () => {
      const next = await AudioService.getStats();
      setStats(next);
    }, 3000);

    LogsService.add(
      'call',
      'Call Screen Open',
      `${route.params?.mode || 'unknown'} ptt=${settings.pttMode} speaker=${initialSpeaker}`,
      'OPEN',
    );

    return () => {
      clearInterval(secTimer);
      clearInterval(statsTimer);
      KeepAwake.deactivate();
    };
  }, [route.params?.mode]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    AudioService.setMuted(next);
  };

  const toggleSpeaker = () => {
    const next = !speaker;
    setSpeaker(next);
    AudioService.setSpeaker(next);
  };

  const toggleMode = () => {
    const next = !fullDuplex;
    setFullDuplex(next);
    AudioService.setFullDuplex(next);
  };

  const end = async () => {
    await CallService.endCall(seconds);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <View style={styles.root}>
      <AppHeader title="In Call" subtitle={`Duration ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`} />
      <View style={styles.content}>
        <View style={styles.statsCard}>
          <Text style={styles.stat}>RTT: {stats.rttMs ?? '--'} ms</Text>
          <Text style={styles.stat}>Jitter: {stats.jitterMs ?? '--'} ms</Text>
          <Text style={styles.stat}>Mode: {fullDuplex ? 'Full Duplex' : 'Push-to-Talk'}</Text>
        </View>

        <Waveform active={txActive || fullDuplex} />

        <TouchableOpacity
          style={[styles.ptt, fullDuplex && styles.disabled]}
          disabled={fullDuplex}
          onPressIn={() => {
            setTxActive(true);
            AudioService.startTransmitting();
          }}
          onPressOut={() => {
            setTxActive(false);
            AudioService.stopTransmitting();
          }}
        >
          <Text style={styles.pttTxt}>{fullDuplex ? 'PTT disabled in full duplex' : 'Hold to Talk'}</Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <TouchableOpacity style={styles.ctrl} onPress={toggleMute}><Text style={styles.ctrlTxt}>{muted ? 'Unmute' : 'Mute'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.ctrl} onPress={toggleSpeaker}><Text style={styles.ctrlTxt}>{speaker ? 'Earpiece' : 'Speaker'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.ctrl} onPress={toggleMode}><Text style={styles.ctrlTxt}>{fullDuplex ? 'PTT' : 'Full'}</Text></TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.end} onPress={end}><Text style={styles.endTxt}>End Call</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, padding: 16, gap: 14 },
  statsCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 12,
    gap: 6,
  },
  stat: { color: C.textSub },
  ptt: {
    borderRadius: 16,
    backgroundColor: C.primary,
    alignItems: 'center',
    paddingVertical: 22,
  },
  pttTxt: { color: C.bg, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  row: { flexDirection: 'row', gap: 10 },
  ctrl: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: C.surface,
  },
  ctrlTxt: { color: C.text, fontWeight: '700' },
  end: {
    marginTop: 'auto',
    borderWidth: 1,
    borderColor: C.error,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  endTxt: { color: C.error, fontWeight: '900' },
});
