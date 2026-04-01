import {NativeModules} from 'react-native';
import {WEBRTC_LOCAL_NETWORK_ONLY} from '../constants/config';
import {LogsService} from './LogsService';

const {MotoLinkRuntimeConfig} = NativeModules;

const DEFAULT_STUN_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
];

let turnFallbackLogged = false;

const normalizeValue = rawValue => String(rawValue || '').trim();

const normalizeUrls = rawValue => {
  if (Array.isArray(rawValue)) {
    return rawValue.map(value => String(value).trim()).filter(Boolean);
  }

  return String(rawValue || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
};

const getTurnConfig = () => {
  const turnUrls = normalizeUrls(MotoLinkRuntimeConfig?.turnUrls);
  const username = normalizeValue(MotoLinkRuntimeConfig?.turnUsername);
  const credential = normalizeValue(MotoLinkRuntimeConfig?.turnCredential);

  return {
    urls: turnUrls,
    username,
    credential,
    ready: turnUrls.length > 0 && !!username && !!credential,
  };
};

const isDebugBuild = () => {
  if (typeof MotoLinkRuntimeConfig?.isDebugBuild === 'boolean') {
    return MotoLinkRuntimeConfig.isDebugBuild;
  }
  return __DEV__;
};

const buildReleaseConfigErrors = () => {
  const errors = [];
  const turnConfig = getTurnConfig();
  const supportEmail = normalizeValue(MotoLinkRuntimeConfig?.supportEmail);
  const privacyPolicyUrl = normalizeValue(
    MotoLinkRuntimeConfig?.privacyPolicyUrl,
  );

  const supportEmailValid =
    /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(supportEmail);
  const privacyValid = privacyPolicyUrl.startsWith('https://');

  if (!turnConfig.ready) {
    errors.push('TURN relay config is missing.');
  }
  if (!supportEmailValid) {
    errors.push('Support email is missing or invalid.');
  }
  if (!privacyValid) {
    errors.push('Privacy policy URL must be public HTTPS.');
  }

  return errors;
};

export const RuntimeConfigService = {
  buildRtcConfiguration: () => {
    const iceServers = WEBRTC_LOCAL_NETWORK_ONLY
      ? []
      : [{urls: DEFAULT_STUN_URLS}];
    const turnConfig = getTurnConfig();
    const debugBuild = isDebugBuild();

    if (!WEBRTC_LOCAL_NETWORK_ONLY && turnConfig.ready) {
      iceServers.push({
        urls: turnConfig.urls,
        username: turnConfig.username,
        credential: turnConfig.credential,
      });
    } else if (!WEBRTC_LOCAL_NETWORK_ONLY && !debugBuild) {
      throw new Error(
        'MotoLink release build is missing TURN relay configuration. Update release-config.properties before placing calls.',
      );
    } else if (!WEBRTC_LOCAL_NETWORK_ONLY && !turnFallbackLogged) {
      turnFallbackLogged = true;
      LogsService.add(
        'audio',
        'TURN Not Configured',
        'Using STUN-only fallback. Configure MOTOLINK_TURN_URLS, MOTOLINK_TURN_USERNAME, and MOTOLINK_TURN_CREDENTIAL for production relay support.',
        'WARN',
      );
    }

    return {
      bundlePolicy: 'max-bundle',
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: WEBRTC_LOCAL_NETWORK_ONLY ? 0 : 2,
      sdpSemantics: 'unified-plan',
      iceServers,
    };
  },

  describeRtcConfiguration: rtcConfiguration => {
    if (WEBRTC_LOCAL_NETWORK_ONLY) {
      return 'Local network WebRTC mode enabled';
    }

    const hasTurn = (rtcConfiguration?.iceServers || []).some(
      server => !!server?.username && !!server?.credential,
    );

    return hasTurn
      ? 'TURN relay configured for mobile WebRTC'
      : 'STUN-only fallback in use';
  },

  getReleaseConfigErrors: () => buildReleaseConfigErrors(),

  isReleaseConfigReady: () => buildReleaseConfigErrors().length === 0,

  isDebugBuild,

  getSupportEmail: () => normalizeValue(MotoLinkRuntimeConfig?.supportEmail),

  getPrivacyPolicyUrl: () =>
    normalizeValue(MotoLinkRuntimeConfig?.privacyPolicyUrl),
};
