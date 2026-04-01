# MotoLink App (Project/MotoApp)

This directory contains the React Native app used by the MotoLink Android intercom project.

## What This App Does

- Scans nearby Bluetooth devices
- Pairs rider and pillion phones
- Restores link via reconnect flow
- Starts and receives intercom calls
- Uses WebRTC for live audio
- Stores settings and paired state in MMKV

## Prerequisites

- Node.js 18+
- Android SDK + platform tools
- Java 17
- Android device or emulator

## Install and Run

```bash
npm ci
npm run android
```

## Build Commands

Debug build:

```bash
npm run android:build-safe
```

Release APK:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\build-android.ps1 -Task :app:assembleRelease
```

Release AAB (Play upload):

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\build-android.ps1 -Task :app:bundleRelease
```

## Release Configuration

Local-only files (ignored from git):

- `android/keystore.properties`
- `android/release-config.properties`

Templates:

- `android/keystore.properties.example`
- `android/release-config.properties.example`

Important: never commit real passwords, TURN secrets, or private credentials.

## Output Paths

- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## Notes

- Android is the primary verified runtime in this repository.
- Keep support/privacy text aligned with actual app behavior.
