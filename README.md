# MotoLink

MotoLink is a React Native Android Bluetooth intercom app for rider and pillion helmet communication. It uses Bluetooth for discovery and signaling, MMKV for persistence, and WebRTC audio over shared Wi-Fi or hotspot networking.

## Repository

- Repository name: `motolink-android-intercom`
- GitHub URL: `https://github.com/madhur24013/motolink-android-intercom`
- Release APK: `https://github.com/madhur24013/motolink-android-intercom/releases/tag/v1.0.0`

## Search Keywords

React Native, Android, Bluetooth intercom, rider pillion communication, motorcycle helmet communication, Bluetooth Classic, BLE, WebRTC audio, MMKV storage, Kotlin audio routing.

## Package Layout

```text
MotoLink_Complete/
  APK/
    MotoLink-app-release.apk
  Assets/
    MotoLink_Logo.png
  Docs/
    MOTOLINK_COLLEGE_DOCUMENTATION.md
    MOTOLINK_FORMAL_REPORT.md
    MOTOLINK_LOGIC_FLOW.md
  Project/
    MotoApp/
      android/
      ios/
      src/
      package.json
      index.js
  LICENSE.md
  README.md
  README_STRUCTURE.txt
```

## Features

1. Rider and pillion role selection
2. Bluetooth device discovery and pairing
3. Bluetooth signaling for call control
4. WebRTC audio calling on shared network
5. MMKV storage for role, paired device, settings, and logs
6. In-call controls for mute, speaker, earpiece, and push-to-talk
7. Reconnect flow for dropped transport sessions
8. Separate academic and technical documentation

## Stack

1. React Native
2. React Navigation
3. `react-native-bluetooth-classic`
4. `react-native-ble-plx`
5. `react-native-webrtc`
6. `react-native-mmkv`
7. Kotlin Android native module for audio routing

## Key Paths

1. App source: `Project/MotoApp`
2. Release APK: `APK/MotoLink-app-release.apk`
3. Technical documentation: `Docs/MOTOLINK_COLLEGE_DOCUMENTATION.md`
4. Formal report: `Docs/MOTOLINK_FORMAL_REPORT.md`
5. Logic flow: `Docs/MOTOLINK_LOGIC_FLOW.md`
6. Logo asset: `Assets/MotoLink_Logo.png`

## Local Setup

```bash
cd Project/MotoApp
npm install
npx react-native run-android
```

## Build Release APK

```bash
cd Project/MotoApp/android
gradlew assembleRelease
```

## Copyright

Copyright (c) 2026 Madhur24013. All rights reserved.

This repository is published for showcase, academic reference, and portfolio use. No copying, redistribution, resale, or commercial reuse is permitted without explicit permission from the copyright holder.

## Notes

1. The packaged source tree contains the full React Native project.
2. The APK is included separately for direct installation.
3. Documentation is split so the repository can be used for both development and academic submission.
