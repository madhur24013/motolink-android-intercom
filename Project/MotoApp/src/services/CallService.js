import { AudioService } from './AudioService';
import { BluetoothService } from './BluetoothService';
import { LogsService } from './LogsService';
import { TRANSPORT_STATES, CALL_STATES } from '../constants/states';
import { TransportStateManager } from './TransportStateManager';
import { Storage } from '../storage/Storage';
import { WEBRTC_LOCAL_NETWORK_ONLY, WEBRTC_TRICKLE_ICE } from '../constants/config';

let callState = CALL_STATES.NONE;
let sessionId = null;
let partnerDevice = null;
let signalingChannel = null;
let callStartedAt = null;
let disconnectTimer = null;

const clearDisconnectTimer = () => {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
};

export const CallService = {
  setSignalingChannel: (channel, device) => {
    signalingChannel = channel;
    if (device) {
      partnerDevice = device;
    }
    LogsService.add(
      'signal',
      'Signaling Channel Set',
      `${channel?.transport || 'unknown'}:${device?.address || device?.id || 'unknown'}`,
      'CHANNEL',
    );
  },

  setIncomingInvite: (inviteData, device) => {
    callState = CALL_STATES.INCOMING;
    sessionId = inviteData?.sessionId || sessionId;
    if (device) {
      partnerDevice = device;
    }
    TransportStateManager.setState(TRANSPORT_STATES.INCOMING);
    LogsService.add('call', 'Incoming Call Ready', `Session ${sessionId}`, 'INCOMING');
  },

  initiateCall: async (device, onCallStateChange) => {
    callState = CALL_STATES.OUTGOING;
    sessionId = `SESS-${Date.now()}`;
    partnerDevice = device;
    callStartedAt = Date.now();
    clearDisconnectTimer();
    TransportStateManager.setState(TRANSPORT_STATES.CALLING);

    await AudioService.initMicrophone();

    AudioService.createPeerConnection(
      WEBRTC_TRICKLE_ICE ? (candidate) => CallService._sendSignal({ type: 'ice', sessionId, candidate }) : null,
      (stream) => onCallStateChange && onCallStateChange('stream', stream),
      (state) => CallService._handlePeerConnectionState(state),
    );

    const offer = await AudioService.createOffer();

    await CallService._sendSignal({
      type: 'invite',
      sessionId,
      callerId: 'self',
      callerName: Storage.getRole() === 'pillion' ? 'MotoLink Pillion' : 'MotoLink Rider',
      role: Storage.getRole() || 'unknown',
      offer,
      codec: 'OPUS',
      transport: signalingChannel?.transport || BluetoothService.getActiveConnection()?.transport || device?.preferredTransport || device?.type || 'BLE',
      networkMode: WEBRTC_LOCAL_NETWORK_ONLY ? 'local_lan' : 'internet',
      ts: Date.now(),
    });

    LogsService.add('call', 'Call Initiated', `Calling ${device.name}${WEBRTC_LOCAL_NETWORK_ONLY ? ' over same Wi-Fi/hotspot' : ''}`, 'OUTGOING');
    onCallStateChange && onCallStateChange('outgoing', { sessionId });
    return { sessionId };
  },

  acceptCall: async (inviteData, onCallStateChange) => {
    callState = CALL_STATES.ACTIVE;
    sessionId = inviteData.sessionId;
    callStartedAt = Date.now();
    clearDisconnectTimer();
    TransportStateManager.setState(TRANSPORT_STATES.IN_CALL);

    await AudioService.initMicrophone();

    AudioService.createPeerConnection(
      WEBRTC_TRICKLE_ICE ? (candidate) => CallService._sendSignal({ type: 'ice', sessionId, candidate }) : null,
      (stream) => onCallStateChange && onCallStateChange('stream', stream),
      (state) => CallService._handlePeerConnectionState(state),
    );

    const answer = await AudioService.createAnswer(inviteData.offer);
    await CallService._sendSignal({ type: 'answer', sessionId, answer, ts: Date.now() });

    LogsService.add('call', 'Call Accepted', `Session ${sessionId}`, 'ACTIVE');
    onCallStateChange && onCallStateChange('active', { sessionId });
    return { sessionId };
  },

  declineCall: async (id) => {
    clearDisconnectTimer();
    await CallService._sendSignal({ type: 'decline', sessionId: id, ts: Date.now() });
    callState = CALL_STATES.NONE;
    sessionId = null;
    callStartedAt = null;
    TransportStateManager.setState(TRANSPORT_STATES.CONNECTED);
    LogsService.add('call', 'Call Declined', `Session ${id}`, 'DECLINED');
  },

  endCall: async (durationSeconds) => {
    const sid = sessionId;
    const startedAt = callStartedAt;
    callState = CALL_STATES.ENDING;
    clearDisconnectTimer();
    await CallService._sendSignal({ type: 'end', sessionId: sid, ts: Date.now() }).catch(() => null);
    AudioService.endCall();
    callState = CALL_STATES.NONE;
    sessionId = null;
    callStartedAt = null;
    TransportStateManager.setState(TRANSPORT_STATES.CONNECTED);

    const safeDurationSeconds = typeof durationSeconds === 'number'
      ? durationSeconds
      : Math.max(0, Math.floor((Date.now() - (startedAt || Date.now())) / 1000));
    const mins = Math.floor(safeDurationSeconds / 60);
    const secs = safeDurationSeconds % 60;
    LogsService.add('call', 'Call Ended', `Duration ${mins}m ${secs}s`, 'ENDED');
  },

  handleIncomingSignal: async (signal) => {
    if (!signal || !signal.type) {
      return;
    }
    if (signal.sessionId && sessionId && signal.sessionId !== sessionId) {
      LogsService.add('signal', 'Stale Signal Ignored', `${signal.type}:${signal.sessionId}`, 'SKIP');
      return;
    }

    if (signal.type === 'answer') {
      clearDisconnectTimer();
      await AudioService.setAnswer(signal.answer);
      callState = CALL_STATES.ACTIVE;
      TransportStateManager.setState(TRANSPORT_STATES.IN_CALL);
      LogsService.add('call', 'Answer Received', `Session ${signal.sessionId}`, 'ACTIVE');
      return;
    }

    if (signal.type === 'ice') {
      await AudioService.addIceCandidate(signal.candidate);
      return;
    }

    if (signal.type === 'decline') {
      clearDisconnectTimer();
      AudioService.endCall();
      callState = CALL_STATES.NONE;
      sessionId = null;
      callStartedAt = null;
      TransportStateManager.setState(TRANSPORT_STATES.CONNECTED);
      LogsService.add('call', 'Call Declined By Peer', `Session ${signal.sessionId}`, 'DECLINED');
      return;
    }

    if (signal.type === 'end') {
      clearDisconnectTimer();
      AudioService.endCall();
      callState = CALL_STATES.NONE;
      sessionId = null;
      callStartedAt = null;
      TransportStateManager.setState(TRANSPORT_STATES.CONNECTED);
      LogsService.add('call', 'Peer Ended Call', `Session ${signal.sessionId}`, 'ENDED');
    }
  },

  getCallState: () => callState,
  getPartnerDevice: () => partnerDevice,
  getSessionId: () => sessionId,

  _sendSignal: async (payload) => {
    if (!signalingChannel) {
      const active = BluetoothService.getActiveConnection();
      if (active) {
        signalingChannel = active;
      }
    }
    if (!signalingChannel) {
      throw new Error('No BLE signaling channel available');
    }

    await BluetoothService.sendInvitePacket(signalingChannel, payload);
    LogsService.add('signal', 'Signal Sent', payload.type, 'TX');
  },

  _handlePeerConnectionState: (state) => {
    if (state === 'connected' || state === 'completed') {
      clearDisconnectTimer();
      if (callState === CALL_STATES.OUTGOING) {
        callState = CALL_STATES.ACTIVE;
        TransportStateManager.setState(TRANSPORT_STATES.IN_CALL);
        LogsService.add('call', 'Call Media Connected', state, 'ACTIVE');
      }
      return;
    }

    if (state === 'failed' && (callState === CALL_STATES.ACTIVE || callState === CALL_STATES.OUTGOING)) {
      clearDisconnectTimer();
      TransportStateManager.setState(TRANSPORT_STATES.RECONNECTING);
      LogsService.add('call', 'Call Link Lost', state, 'RECONNECT');
      return;
    }

    if (state === 'disconnected' && (callState === CALL_STATES.ACTIVE || callState === CALL_STATES.OUTGOING)) {
      if (!disconnectTimer) {
        LogsService.add('call', 'Call Link Unstable', 'Waiting before reconnect escalation', 'WARN');
        disconnectTimer = setTimeout(() => {
          disconnectTimer = null;
          if (callState === CALL_STATES.ACTIVE || callState === CALL_STATES.OUTGOING) {
            TransportStateManager.setState(TRANSPORT_STATES.RECONNECTING);
            LogsService.add('call', 'Call Link Lost', state, 'RECONNECT');
          }
        }, 12000);
      }
    }
  },
};
