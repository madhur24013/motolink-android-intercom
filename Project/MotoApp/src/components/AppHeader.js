import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { C } from '../constants/colors';

export default function AppHeader({ title, subtitle, leftLabel, rightLabel, onLeftPress, onRightPress }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <TouchableOpacity disabled={!onLeftPress} onPress={onLeftPress} style={styles.sideBtn}>
          <Text style={styles.sideTxt}>{leftLabel || ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={!onRightPress} onPress={onRightPress} style={styles.sideBtn}>
          <Text style={styles.sideTxt}>{rightLabel || ''}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sideBtn: {
    minWidth: 70,
    paddingVertical: 6,
  },
  sideTxt: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: C.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: C.textSub,
    marginTop: 4,
    fontSize: 13,
  },
});
