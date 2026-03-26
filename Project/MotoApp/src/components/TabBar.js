import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../constants/colors';

export default function TabBar({ tabs, activeTab, onChange }) {
  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity key={tab.key} style={[styles.tab, active && styles.active]} onPress={() => onChange(tab.key)}>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 4,
  },
  tab: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  active: {
    backgroundColor: C.primaryDim,
  },
  label: {
    color: C.textSub,
    fontWeight: '700',
    fontSize: 12,
  },
  labelActive: {
    color: C.primary,
  },
});
