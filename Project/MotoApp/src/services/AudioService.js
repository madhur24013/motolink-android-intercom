import {
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';
import { NativeModules, Platform } from 'react-native';
import {
  AUDIO_CHANNELS,
  AUDIO_CODEC,
  AUDIO_SAMPLE_RATE,
  WEBRTC_ICE_GATHER_TIMEOUT_MS,
  WEBRTC_LOCAL_NETWORK_ONLY,
  WEBRTC_TRICKLE_ICE,
} from '../constants/config';
import { LogsService } from './LogsService';
import { Storage } from '../storage/Storage';

const { MotoLinkAudioRoute } = NativeModules;

const RTC_CONFIGURATION = {
  bundlePolicy: 'max-bundle',
  iceTransportPolicy: 'all',
  iceCandidatePoolSize: WEBRTC_LOCAL_NETWORK_ONLY ? 0 : 2,
  sdpSemantics: 'unified-plan',
  iceServers: WEBRTC_LOCAL_NETWORK_ONLY ? [] : [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:openrelay.metered.ca:80',
      ],
    },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

const OFFER_OPTIONS = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: false,
  voiceActivityDetection: true,
};

const ANSWER_OPTIONS = {
  voiceActivityDetection: true,
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let pttMode = true;
let isMuted = false;
let pendingIceCandidates = [];
let iceGatherWaiters = [];

const safeNativeAudioCall = async (action, ...args) => {
  if (Platform.OS !== 'android' || !MotoLinkAudioRoute || typeof MotoLinkAudioRoute[action] !== 'function') {
    return false;
  }
  try {
    await MotoLinkAudioRoute[action](...args);
    return true;
  } catch (error) {
    LogsService.add('audio', 'Native Audio Route Failed', `${action}: ${error.message}`, 'WARN');
    return false;
  }
};

const attachRemoteStream = (incomingStream, incomingTrack, onRemoteStream) => {
  let nextRemoteStream = incomingStream || null;
  if (!nextRemoteStream && incomingTrack) {
    nextRemoteStream = new MediaStream([incomingTrack]);
  }
  if (!nextRemoteStream) {
    LogsService.add('audio', 'Remote Stream Missing', 'Track event did not contain a usable audio stream', 'WARN');
    return;
  }

  remoteStream = nextRemoteStream;
  const audioTracks = nextRemoteStream.getAudioTracks();
  audioTracks.forEach((track) => {
    track.enabled = true;
    if (typeof track._setVolume === 'function') {
      track._setVolume(10.0);
    }
  });
  onRemoteStream && onRemoteStream(nextRemoteStream);
  LogsService.add('audio', 'Remote Stream', `Incoming audio stream attached (${audioTracks.length} audio tracks)`, 'RX');
};

const attachLocalMedia = (connection) => {
  if (!connection || !localStream) {
    return;
  }

  try {
    if (typeof connection.addTrack === 'function') {
      localStream.getTracks().forEach((track) => {
        connection.addTrack(track, localStream);
      });
      LogsService.add('audio', 'Local Tracks Added', `${localStream.getTracks().length} tracks via addTrack`, 'TX');
      return;
    }
  } catch (error) {
    LogsService.add('audio', 'Add Track Failed', error.message, 'WARN');
  }

  if (typeof connection.addStream === 'function') {
    connection.addStream(localStream);
    LogsService.add('audio', 'Local Stream Added', `${localStream.getTracks().length} tracks via addStream`, 'TX');
  }
};

const resolveIceGatherWaiters = (state) => {
  if (iceGatherWaiters.length === 0) {
    return;
  }
  const waiters = [...iceGatherWaiters];
  iceGatherWaiters = [];
  waiters.forEach((resolve) => resolve(state));
};

const serializeSessionDescription = (description) => {
  if (!description) {
    return null;
  }
  return {
    type: description.type,
    sdp: description.sdp,
  };
};

export const AudioService = {
  initMicrophone: async () => {
    const settings = Storage.getSettings();
    pttMode = settings.pttMode;
    await safeNativeAudioCall('startCommunication', !!settings.speakerDefault);
    localStream = await mediaDevices.getUserMedia({
      audio: {
        channelCount: AUDIO_CHANNELS,
        sampleRate: AUDIO_SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        googEchoCancellation: true,
        googNoiseSuppression: true,
        googAutoGainControl: true,
      },
      video: false,
    });
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !pttMode;
    });
    isMuted = false;
    LogsService.add(
      'audio',
      'Microphone Ready',
      `Local audio stream initialized ${AUDIO_SAMPLE_RATE}Hz ${AUDIO_CODEC} (${localStream.getAudioTracks().length} audio tracks, ${pttMode ? 'PTT' : 'FULL'})`,
      'READY',
    );
    AudioService.setSpeaker(settings.speakerDefault);
    return localStream;
  },

  createPeerConnection: (onIceCandidate, onRemoteStream, onConnectionStateChange) => {
    if (peerConnection) {
      try {
        peerConnection.close();
      } catch {
        // ignore stale peer close errors
      }
      peerConnection = null;
    }
    peerConnection = new RTCPeerConnection(RTC_CONFIGURATION);
    pendingIceCandidates = [];
    iceGatherWaiters = [];
    LogsService.add(
      'audio',
      'Peer Connection Created',
      WEBRTC_LOCAL_NETWORK_ONLY ? 'Local network WebRTC mode enabled' : 'ICE servers configured for mobile WebRTC',
      'PC',
    );

    attachLocalMedia(peerConnection);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && WEBRTC_TRICKLE_ICE && onIceCandidate) {
        LogsService.add('audio', 'ICE Candidate Created', `${event.candidate.type || 'candidate'} ${event.candidate.sdpMid || 'na'}`, 'ICE');
        onIceCandidate(event.candidate);
      }
      if (!event.candidate) {
        LogsService.add('audio', 'ICE Candidate Gathering', 'Local ICE candidate collection completed', 'ICE');
      }
    };

    peerConnection.ontrack = (event) => {
      attachRemoteStream(event.streams && event.streams[0], event.track, onRemoteStream);
    };

    peerConnection.onaddstream = (event) => {
      attachRemoteStream(event.stream, null, onRemoteStream);
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection?.connectionState || 'unknown';
      LogsService.add('audio', 'Peer Connection State', state, 'PC');
      onConnectionStateChange && onConnectionStateChange(state);
    };

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection?.iceConnectionState || 'unknown';
      LogsService.add('audio', 'ICE Connection State', state, 'ICE');
      if ((state === 'failed' || state === 'disconnected') && onConnectionStateChange) {
        onConnectionStateChange(state);
      }
    };

    peerConnection.onicegatheringstatechange = () => {
      const state = peerConnection?.iceGatheringState || 'unknown';
      LogsService.add('audio', 'ICE Gathering State', state, 'ICE');
      if (state === 'complete') {
        resolveIceGatherWaiters(state);
      }
    };

    return peerConnection;
  },

  createOffer: async () => {
    const offer = await peerConnection.createOffer(OFFER_OPTIONS);
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
    await AudioService.waitForIceGathering();
    const finalOffer = serializeSessionDescription(peerConnection?.localDescription) || offer;
    LogsService.add('audio', 'Offer Created', `WebRTC SDP offer created (${peerConnection?.signalingState || 'unknown'})`, 'OFFER');
    return finalOffer;
  },

  createAnswer: async (offer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    await AudioService._flushPendingIceCandidates();
    const answer = await peerConnection.createAnswer(ANSWER_OPTIONS);
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer));
    await AudioService.waitForIceGathering();
    const finalAnswer = serializeSessionDescription(peerConnection?.localDescription) || answer;
    LogsService.add('audio', 'Answer Created', `WebRTC SDP answer created (${peerConnection?.signalingState || 'unknown'})`, 'ANSWER');
    return finalAnswer;
  },

  setAnswer: async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await AudioService._flushPendingIceCandidates();
    LogsService.add('audio', 'Answer Applied', `Remote SDP answer set (${peerConnection?.signalingState || 'unknown'})`, 'SET');
  },

  addIceCandidate: async (candidate) => {
    if (!WEBRTC_TRICKLE_ICE) {
      LogsService.add('audio', 'ICE Candidate Ignored', 'Trickle ICE disabled in local network mode', 'ICE');
      return;
    }
    if (!peerConnection) {
      return;
    }
    const hasRemoteDescription = !!peerConnection.remoteDescription;
    if (!hasRemoteDescription) {
      pendingIceCandidates.push(candidate);
      LogsService.add('audio', 'ICE Queued', 'Remote description not ready yet', 'QUEUE');
      return;
    }
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    LogsService.add('audio', 'ICE Candidate Applied', `${candidate?.type || 'candidate'} ${candidate?.sdpMid || 'na'}`, 'ICE');
  },

  startTransmitting: () => {
    if (!localStream) {
      return;
    }
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
    LogsService.add('audio', 'PTT Active', 'Transmit enabled', 'TX');
  },

  stopTransmitting: () => {
    if (!localStream) {
      return;
    }
    if (pttMode) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
    LogsService.add('audio', 'PTT Released', 'Transmit disabled', 'IDLE');
  },

  setMuted: (muted) => {
    isMuted = !!muted;
    if (!localStream) {
      return;
    }
    localStream.getAudioTracks().forEach((track) => {
      if (pttMode) {
        track.enabled = false;
      } else {
        track.enabled = !isMuted;
      }
    });
    LogsService.add('audio', isMuted ? 'Muted' : 'Unmuted', 'Microphone state changed', isMuted ? 'MUTED' : 'LIVE');
  },

  setFullDuplex: (enabled) => {
    pttMode = !enabled;
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled && !isMuted;
      });
    }
    LogsService.add('audio', enabled ? 'Full Duplex' : 'PTT Mode', enabled ? 'Always transmitting' : 'Push to talk', 'MODE');
  },

  setSpeaker: (useSpeaker) => {
    safeNativeAudioCall('setSpeaker', !!useSpeaker);
    LogsService.add('audio', 'Speaker Route', useSpeaker ? 'Speaker enabled' : 'Earpiece enabled', 'ROUTE');
  },

  applyCallPreferences: (settings) => {
    const nextSettings = settings || Storage.getSettings();
    AudioService.setFullDuplex(!nextSettings.pttMode);
    AudioService.setSpeaker(!!nextSettings.speakerDefault);
    if (isMuted) {
      AudioService.setMuted(true);
    }
    LogsService.add(
      'audio',
      'Call Preferences Applied',
      `pttMode=${!!nextSettings.pttMode}, speakerDefault=${!!nextSettings.speakerDefault}`,
      'PREF',
    );
  },

  getStats: async () => {
    if (!peerConnection) {
      return { rttMs: null, jitterMs: null };
    }
    const stats = await peerConnection.getStats();
    let rttMs = null;
    let jitterMs = null;

    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
        rttMs = Math.round(report.currentRoundTripTime * 1000);
      }
      if (report.type === 'inbound-rtp' && typeof report.jitter === 'number') {
        jitterMs = Math.round(report.jitter * 1000);
      }
    });

    return { rttMs, jitterMs };
  },

  endCall: () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
        if (typeof track.release === 'function') {
          track.release();
        }
      });
      localStream = null;
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => {
        track.stop();
        if (typeof track.release === 'function') {
          track.release();
        }
      });
      remoteStream = null;
    }
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    isMuted = false;
    pendingIceCandidates = [];
    resolveIceGatherWaiters('closed');
    safeNativeAudioCall('stopCommunication');
    LogsService.add('audio', 'Audio Ended', 'Peer connection closed', 'END');
  },

  waitForIceGathering: async () => {
    if (!peerConnection || !WEBRTC_LOCAL_NETWORK_ONLY) {
      return 'skipped';
    }
    if (peerConnection.iceGatheringState === 'complete') {
      return 'complete';
    }

    LogsService.add('audio', 'ICE Gathering Wait', `Waiting up to ${WEBRTC_ICE_GATHER_TIMEOUT_MS}ms for full local SDP`, 'ICE');
    let waiter = null;
    const result = await Promise.race([
      new Promise((resolve) => {
        waiter = resolve;
        iceGatherWaiters.push(resolve);
      }),
      new Promise((resolve) => {
        setTimeout(() => {
          if (waiter) {
            iceGatherWaiters = iceGatherWaiters.filter((entry) => entry !== waiter);
          }
          resolve('timeout');
        }, WEBRTC_ICE_GATHER_TIMEOUT_MS);
      }),
    ]);

    LogsService.add('audio', 'ICE Gathering Wait Result', String(result), 'ICE');
    return result;
  },

  _flushPendingIceCandidates: async () => {
    if (!peerConnection || !peerConnection.remoteDescription || pendingIceCandidates.length === 0) {
      return;
    }
    const queue = [...pendingIceCandidates];
    pendingIceCandidates = [];
    for (const candidate of queue) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        LogsService.add('audio', 'ICE Apply Failed', error.message, 'ERROR');
      }
    }
  },
};
