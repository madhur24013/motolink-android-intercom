import React from 'react';
import { View, StyleSheet } from 'react-native';
import { C } from '../constants/colors';

export default function SignalBars({ rssi }) {
  const value = typeof rssi === 'number' ? rssi : -120;
  const level = value >= -60 ? 4 : value >= -72 ? 3 : value >= -84 ? 2 : value >= -96 ? 1 : 0;

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.bar, { height: 4 + i * 5 }, i <= level ? styles.on : styles.off]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 28,
  },
  bar: {
    width: 6,
    borderRadius: 2,
  },
  on: {
    backgroundColor: C.success,
  },
  off: {
    backgroundColor: C.border,
  },
});
