import { LOG_MAX_ENTRIES } from '../constants/config';
import { Storage } from '../storage/Storage';

let logs = Storage.getLogs();
let listeners = [];

export const LogsService = {
  add: (type, label, detail, sub) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      label,
      detail,
      sub,
      ts: Date.now(),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    logs = [entry, ...logs].slice(0, LOG_MAX_ENTRIES);
    Storage.saveLogs(logs);
    try {
      // Mirror app logs into logcat so runtime failures can be pulled from release builds.
      console.log(`[MotoLink][${type}][${sub || 'LOG'}] ${label}${detail ? ` :: ${detail}` : ''}`);
    } catch {
      // ignore log mirroring failures
    }
    listeners.forEach((fn) => fn([...logs]));
    return entry;
  },

  getAll: () => [...logs],

  clear: () => {
    logs = [];
    Storage.clearLogs();
    listeners.forEach((fn) => fn([]));
  },

  subscribe: (fn) => {
    listeners.push(fn);
    fn([...logs]);
    return () => {
      listeners = listeners.filter((x) => x !== fn);
    };
  },
};
