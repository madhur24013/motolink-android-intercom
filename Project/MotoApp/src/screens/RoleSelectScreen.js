import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../constants/colors';
import AppHeader from '../components/AppHeader';
import { Storage } from '../storage/Storage';
import { PairingService } from '../services/PairingService';
import { LogsService } from '../services/LogsService';
import { BluetoothService } from '../services/BluetoothService';

export default function RoleSelectScreen({ navigation }) {
  const onSelect = (role) => {
    Storage.saveRole(role);
    BluetoothService.setClassicRole(role);
    LogsService.add('profile', 'Role Selected', role, 'ROLE');
    const paired = PairingService.getSavedDevice();
    if (!paired) {
      navigation.replace('Scan');
      return;
    }
    navigation.replace(role === 'rider' ? 'AutoConnect' : 'Home');
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Choose Role" subtitle="Role is advertised over BLE" />
      <View style={styles.content}>
        <TouchableOpacity style={styles.card} onPress={() => onSelect('rider')}>
          <Text style={styles.title}>Rider</Text>
          <Text style={styles.sub}>Front seat. Usually starts calls.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => onSelect('pillion')}>
          <Text style={styles.title}>Pillion</Text>
          <Text style={styles.sub}>Back seat. Receives incoming call invites.</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, padding: 16, gap: 14 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 18,
  },
  title: { color: C.primary, fontSize: 22, fontWeight: '900' },
  sub: { color: C.textSub, marginTop: 6 },
});
