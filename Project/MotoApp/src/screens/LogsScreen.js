import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { C } from '../constants/colors';
import AppHeader from '../components/AppHeader';
import { LogsService } from '../services/LogsService';

export default function LogsScreen({ navigation }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const unsub = LogsService.subscribe(setLogs);
    return unsub;
  }, []);

  return (
    <View style={styles.root}>
      <AppHeader title="Logs" leftLabel="Back" onLeftPress={() => navigation.goBack()} />

      <View style={styles.content}>
        <TouchableOpacity style={styles.clearBtn} onPress={() => LogsService.clear()}>
          <Text style={styles.clearTxt}>Clear Logs</Text>
        </TouchableOpacity>

        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <View style={styles.logItem}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.detail}>{item.detail}</Text>
              <Text style={styles.meta}>{item.type} • {item.sub} • {item.time}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No logs yet</Text>}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, padding: 16, gap: 12 },
  clearBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: C.error,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearTxt: { color: C.error, fontWeight: '800' },
  logItem: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.surface,
    padding: 10,
  },
  label: { color: C.primary, fontWeight: '800' },
  detail: { color: C.textSub, marginTop: 2 },
  meta: { color: C.textMuted, marginTop: 4, fontSize: 11 },
  empty: { color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
