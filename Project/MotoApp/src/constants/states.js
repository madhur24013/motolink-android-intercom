export const TRANSPORT_STATES = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  DISCOVERED: 'discovered',
  PAIRING: 'pairing',
  PAIRED: 'paired',
  AUTO_CONNECTING: 'auto_connecting',
  CONNECTED: 'connected',
  CALLING: 'calling',
  INCOMING: 'incoming',
  IN_CALL: 'in_call',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed',
};

export const AUDIO_STATES = {
  IDLE: 'idle',
  TRANSMITTING: 'transmitting',
  RECEIVING: 'receiving',
  MUTED: 'muted',
};

export const CALL_STATES = {
  NONE: 'none',
  OUTGOING: 'outgoing',
  INCOMING: 'incoming',
  ACTIVE: 'active',
  ENDING: 'ending',
};
