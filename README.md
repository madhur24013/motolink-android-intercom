# MotoLink Android Intercom

MotoLink is a React Native Android intercom app for rider and pillion communication on two phones.
The app uses Bluetooth for discovery/signaling and WebRTC for live audio.

## Current Status

- Platform target: Android
- Stage: Late MVP / release candidate
- iOS support: Not verified in this repository
- Release output verified locally: APK + AAB

## Core Features

1. Rider and pillion role selection flow
2. Bluetooth device scan, pair, reconnect
3. WebRTC audio call flow with in-call controls
4. Pair trust validation and re-pair recovery
5. Persistent storage for settings/device/session state
6. Runtime support/privacy links in app settings
7. Release build guards for signing and runtime config

## Tech Stack

- React Native 0.73
- React Navigation
- `react-native-bluetooth-classic`
- `react-native-ble-plx`
- `react-native-webrtc`
- `react-native-mmkv`
- Android Kotlin native modules

## Repository Layout

```text
motolink-android-intercom/
  APK/                     # release artifacts (when exported)
  Assets/                  # branding assets
  Docs/                    # privacy and project documentation
  Project/
    MotoApp/               # main React Native app
      android/
      ios/
      src/
  LICENSE.md
  README.md
  README_STRUCTURE.txt
```

## Quick Start

```bash
cd Project/MotoApp
npm ci
npm run android
```

## Release Build (Windows-safe)

```bash
cd Project/MotoApp
npm run android:build-safe
powershell -ExecutionPolicy Bypass -File .\scripts\build-android.ps1 -Task :app:assembleRelease
powershell -ExecutionPolicy Bypass -File .\scripts\build-android.ps1 -Task :app:bundleRelease
```

Release outputs:

- `Project/MotoApp/android/app/build/outputs/apk/release/app-release.apk`
- `Project/MotoApp/android/app/build/outputs/bundle/release/app-release.aab`

## Required Local Release Config

Do not commit secrets. Configure locally in:

- `Project/MotoApp/android/keystore.properties`
- `Project/MotoApp/android/release-config.properties`

Use examples:

- `Project/MotoApp/android/keystore.properties.example`
- `Project/MotoApp/android/release-config.properties.example`

## Documentation

- `Docs/PRIVACY_POLICY.md`
- `Docs/MOTOLINK_LOGIC_FLOW.md`
- `Docs/MOTOLINK_COLLEGE_DOCUMENTATION.md`
- `Docs/MOTOLINK_FORMAL_REPORT.md`

## License

See `LICENSE.md`.
This repository is published for showcase, academic reference, and evaluation use.
