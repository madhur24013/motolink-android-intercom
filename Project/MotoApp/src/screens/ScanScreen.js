import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, BackHandler, Alert } from 'react-native';
import { C } from '../constants/colors';
import AppHeader from '../components/AppHeader';
import SignalBars from '../components/SignalBars';
import { BluetoothService } from '../services/BluetoothService';
import { LogsService } from '../services/LogsService';

export default function ScanScreen({ navigation }) {
  const [devices, setDevices] = useState([]);
  const [scanning, setScanning] = useState(false);
  const selectingRef = useRef(false);
  const scanAliveRef = useRef(false);

  const goBackSafe = () => {
    BluetoothService.stopScan();
    setScanning(false);
    LogsService.add('scan', 'Back Press', 'Stopping scan and leaving screen', 'BACK');
    if (navigation.canGoBack()) {
      navigation.goBack();
      return true;
    }
    navigation.navigate('RoleSelect');
    return true;
  };

  const start = () => {
    if (scanAliveRef.current) {
      BluetoothService.stopScan();
    }
    scanAliveRef.current = true;
    const run = async () => {
      let foundAny = false;
      const btReady = await BluetoothService.ensureBluetoothEnabled();
      if (!btReady) {
        scanAliveRef.current = false;
        setScanning(false);
        Alert.alert('Bluetooth Required', 'Please enable Bluetooth, then scan again.');
        return;
      }
      BluetoothService.stopScan();
      setDevices([]);
      setScanning(true);
      LogsService.add('scan', 'Scan UI Start', 'User started scan', 'START');

      BluetoothService.startScan(
        (device) => {
          if (!scanAliveRef.current) {
            return;
          }
          foundAny = true;
          setDevices((prev) => {
            if (prev.some((d) => d.id === device.id)) {
              return prev;
            }
            return [...prev, device];
          });
        },
        () => {
          scanAliveRef.current = false;
          setScanning(false);
          if (!foundAny) {
            Alert.alert('No Device Found', 'No MotoLink BLE device found. Keep both phones nearby and try again.');
          }
        },
      );
    };
    run().catch((error) => {
      scanAliveRef.current = false;
      setScanning(false);
      LogsService.add('scan', 'Scan Start Failed', error.message, 'ERROR');
      Alert.alert('Scan Failed', error.message);
    });
  };

  useEffect(() => {
    start();
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => goBackSafe());
    return () => {
      scanAliveRef.current = false;
      BluetoothService.stopScan();
      setScanning(false);
      backSub.remove();
    };
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.device}
      disabled={selectingRef.current}
      onPress={() => {
        if (selectingRef.current) {
          return;
        }
        selectingRef.current = true;
        scanAliveRef.current = false;
        BluetoothService.stopScan();
        setScanning(false);
        LogsService.add('scan', 'Device Selected', item.name, 'SELECT');
        navigation.replace('Pairing', { device: item });
        setTimeout(() => {
          selectingRef.current = false;
        }, 1200);
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.sub}>{item.id}</Text>
        <Text style={styles.sub}>Role: {item.role}</Text>
      </View>
      <SignalBars rssi={item.rssi} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <AppHeader
        title="Scan MotoLink"
        subtitle="MotoLink BLE scan with Bluetooth fallback"
        leftLabel="Back"
        onLeftPress={goBackSafe}
        rightLabel="Rescan"
        onRightPress={start}
      />
      <View style={styles.statusWrap}>
        <Text style={styles.status}>{scanning ? 'Scanning...' : 'Scan complete'}</Text>
      </View>
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No MotoLink devices found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  statusWrap: { paddingHorizontal: 16, paddingTop: 12 },
  status: { color: C.textSub, fontWeight: '700' },
  list: { padding: 16, gap: 10 },
  device: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: { color: C.text, fontWeight: '800', fontSize: 15 },
  sub: { color: C.textSub, marginTop: 2, fontSize: 12 },
  empty: { color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
