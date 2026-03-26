import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { C } from '../constants/colors';
import { Storage } from '../storage/Storage';
import { PairingService } from '../services/PairingService';
import { LogsService } from '../services/LogsService';
import { BluetoothService } from '../services/BluetoothService';

export default function SplashScreen({ navigation }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 900, useNativeDriver: false }).start();

    const route = async () => {
      const role = Storage.getRole();
      const paired = PairingService.getSavedDevice();
      BluetoothService.setClassicRole(role);
      LogsService.add('app', 'Splash Check', `role=${role || 'none'} paired=${paired ? 'yes' : 'no'}`, 'BOOT');

      if (role && paired) {
        navigation.replace(role === 'rider' ? 'AutoConnect' : 'Home');
        return;
      }
      if (role && !paired) {
        navigation.replace('Scan');
        return;
      }
      navigation.replace('Permissions');
    };

    const timer = setTimeout(route, 950);
    return () => clearTimeout(timer);
  }, [navigation, progress]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>MotoLink</Text>
      <Text style={styles.sub}>Rider to Pillion. Offline. Real-time.</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  brand: {
    color: C.primary,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sub: {
    color: C.textSub,
    marginTop: 10,
    marginBottom: 28,
  },
  track: {
    width: '78%',
    height: 10,
    borderRadius: 8,
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    backgroundColor: C.primary,
  },
});
