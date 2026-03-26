import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { C } from '../constants/colors';
import { Storage } from '../storage/Storage';
import { PairingService } from '../services/PairingService';
import { LogsService } from '../services/LogsService';
import AppHeader from '../components/AppHeader';

export default function SettingsScreen({ navigation }) {
  const [settings, setSettings] = useState(Storage.getSettings());

  const toggle = (key) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    Storage.saveSettings(next);
    LogsService.add('settings', 'Setting Changed', `${key}=${next[key]}`, 'SET');
  };

  return (
    <View style={styles.root}>
      <AppHeader
        title="Settings"
        leftLabel="Back"
        rightLabel="Home"
        onLeftPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
        onRightPress={() => navigation.navigate('Home')}
      />
      <View style={styles.content}>
        {Object.keys(settings).map((key) => (
          <View key={key} style={styles.row}>
            <Text style={styles.key}>{key}</Text>
            <Switch value={!!settings[key]} onValueChange={() => toggle(key)} />
          </View>
        ))}

        <TouchableOpacity
          style={styles.forget}
          onPress={() => {
            PairingService.forgetDevice();
            navigation.navigate('Scan');
          }}
        >
          <Text style={styles.forgetTxt}>Forget Paired Device</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 10 },
  row: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.surface,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  key: { color: C.text, fontWeight: '700' },
  forget: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.error,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  forgetTxt: { color: C.error, fontWeight: '800' },
});
