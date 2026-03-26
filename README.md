# MotoLink

Android rider-to-pillion intercom application using Bluetooth discovery/signaling and WebRTC audio over a shared local Wi-Fi or hotspot.

## Repository Name
`motolink-android-intercom`

## Suggested Description
MotoLink is a React Native Android intercom app for rider and pillion communication using Bluetooth signaling, MMKV persistence, and WebRTC audio.

## Project Contents

```text
MotoLink_Complete/
  APK/
    MotoLink-app-release.apk
  Assets/
    MotoLink_Logo.png
  Docs/
    MOTOLINK_COLLEGE_DOCUMENTATION.md
    MOTOLINK_FORMAL_REPORT.md
  Project/
    MotoApp/
      android/
      ios/
      src/
      package.json
      index.js
```

## Main Features

1. rider and pillion role selection
2. Bluetooth device scan and pairing
3. Bluetooth Classic signaling for call control
4. WebRTC-based voice communication
5. MMKV-based local storage
6. in-call controls such as mute, speaker, earpiece, and push-to-talk
7. reconnect flow and persistent paired-device logic
8. logs screen and persistent log storage

## Technology Stack

1. React Native
2. React Navigation
3. react-native-bluetooth-classic
4. react-native-ble-plx
5. react-native-webrtc
6. react-native-mmkv
7. Kotlin native Android module for audio routing

## Important Paths

1. App source: `Project/MotoApp`
2. Release APK: `APK/MotoLink-app-release.apk`
3. Technical documentation: `Docs/MOTOLINK_COLLEGE_DOCUMENTATION.md`
4. Formal report: `Docs/MOTOLINK_FORMAL_REPORT.md`
5. Logo asset: `Assets/MotoLink_Logo.png`

## Run Locally

```bash
cd Project/MotoApp
npm install
npx react-native run-android
```

## Notes

1. The packaged source tree contains the React Native app project.
2. The APK is provided separately for direct installation.
3. The documentation files are separated from the code for cleaner academic submission.
