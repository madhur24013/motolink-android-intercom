import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { checkMultiple, requestMultiple, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { C } from '../constants/colors';
import AppHeader from '../components/AppHeader';
import { LogsService } from '../services/LogsService';
import { BluetoothService } from '../services/BluetoothService';

const REQUIRED = Platform.Version >= 31
  ? [
      PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
      PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
      PERMISSIONS.ANDROID.BLUETOOTH_ADVERTISE,
      PERMISSIONS.ANDROID.RECORD_AUDIO,
      PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    ]
  : [
      PERMISSIONS.ANDROID.RECORD_AUDIO,
      PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    ];

export default function PermissionsScreen({ navigation }) {
  const [statusMap, setStatusMap] = useState({});

  const allGranted = useMemo(
    () => REQUIRED.every((p) => statusMap[p] === RESULTS.GRANTED),
    [statusMap],
  );

  const checkNow = async () => {
    const map = await checkMultiple(REQUIRED);
    setStatusMap(map);
    LogsService.add('perm', 'Permission Checked', JSON.stringify(map), 'CHECK');
  };

  const requestNow = async () => {
    const map = await requestMultiple(REQUIRED);
    setStatusMap(map);
    LogsService.add('perm', 'Permission Requested', JSON.stringify(map), 'REQUEST');
    const denied = REQUIRED.filter((p) => map[p] !== RESULTS.GRANTED);
    if (denied.length > 0) {
      LogsService.add('perm', 'Permission Denied', denied.join(', '), 'DENIED');
      Alert.alert('Permissions Required', 'MotoLink cannot continue until every required permission is granted.');
    }
  };

  useEffect(() => {
    checkNow().catch(() => null);
  }, []);

  return (
    <View style={styles.root}>
      <AppHeader title="Permissions" subtitle="Required for BLE and real-time voice" />
      <ScrollView contentContainerStyle={styles.content}>
        {REQUIRED.map((p) => (
          <View key={p} style={styles.item}>
            <Text style={styles.name}>{p.replace('android.permission.', '')}</Text>
            <Text style={styles.state}>{statusMap[p] || 'unknown'}</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.btn} onPress={checkNow}>
          <Text style={styles.btnTxt}>Check Status</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={requestNow}>
          <Text style={styles.btnTxt}>Request Permissions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, !allGranted && styles.disabled]}
          disabled={!allGranted}
          onPress={async () => {
            const btReady = await BluetoothService.ensureBluetoothEnabled();
            if (!btReady) {
              LogsService.add('perm', 'Bluetooth Check Failed', 'Bluetooth still disabled after permission grant', 'ERROR');
              Alert.alert('Bluetooth Required', 'Please turn on Bluetooth to continue.');
              return;
            }
            LogsService.add('perm', 'Continue', 'All required permissions granted', 'OK');
            navigation.navigate('RoleSelect');
          }}
        >
          <Text style={styles.btnTxt}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 10 },
  item: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 12,
  },
  name: { color: C.text, fontWeight: '700', fontSize: 13 },
  state: { color: C.textSub, marginTop: 4 },
  btn: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: C.primaryDim,
    borderWidth: 1,
    borderColor: C.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnTxt: { color: C.primary, fontWeight: '800' },
  disabled: { opacity: 0.4 },
});

