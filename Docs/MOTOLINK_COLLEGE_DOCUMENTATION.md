# MotoLink

## Project Documentation

### 1. Project Title
MotoLink: Rider-to-Pillion Bluetooth and Local-Network Intercom for Android

### 2. Abstract
MotoLink is a React Native Android application designed for two-phone communication between a rider and a pillion. The application uses Bluetooth for discovery, pairing, and signaling, and uses WebRTC for real-time voice transmission after a call is accepted. The current working architecture is optimized for two Android phones on the same Wi-Fi network or hotspot. In this design, Bluetooth is responsible for device-level connection control and call signaling, while WebRTC handles the live audio stream.

### 3. Problem Statement
Bike riders and pillion passengers often need a lightweight communication system without depending on a normal phone call interface. Standard calling apps are not built for short-range transport pairing, quick reconnect behavior, and simple in-call controls such as push-to-talk, mute, and speaker routing. MotoLink addresses this by providing a role-based intercom system tailored for rider and pillion communication.

### 4. Objectives
1. Discover nearby MotoLink partner phones.
2. Pair two phones and persist the paired device.
3. Allow rider and pillion role selection.
4. Establish a call using Bluetooth signaling.
5. Transmit live voice using WebRTC.
6. Provide in-call controls such as mute, speaker/earpiece, and push-to-talk.
7. Maintain logs and persistent state using MMKV.
8. Recover cleanly from disconnects and failed links.

### 5. Technology Stack
1. React Native `0.73.4`
2. React `18.2.0`
3. Android native modules in Kotlin
4. `react-native-bluetooth-classic` for Bluetooth Classic connection and signaling
5. `react-native-ble-plx` for BLE scan support
6. `react-native-webrtc` for audio call transport
7. `react-native-mmkv` for storage
8. `react-navigation` stack navigator for screen flow

### 6. Current Working Architecture
#### 6.1 High-Level Design
1. Bluetooth scan discovers devices.
2. Pairing establishes the active Bluetooth transport.
3. Bluetooth sends signaling messages such as `invite`, `answer`, `ice`, `decline`, and `end`.
4. Both phones must be on the same Wi-Fi or hotspot for WebRTC media.
5. WebRTC carries the actual voice stream between the two phones.

#### 6.2 Practical Design Choice
The project originally explored multiple connection ideas. The stabilized implementation currently works with this model:

1. Bluetooth Classic is the primary signaling channel.
2. BLE is used for scan support where applicable.
3. WebRTC audio is expected to run over a shared local network path.

This approach was chosen because Bluetooth-only audio transport is significantly more complex and less reliable in a React Native mobile codebase.

### 7. Core Application Modules
#### 7.1 Permissions Module
The permissions flow ensures the app has:
1. `BLUETOOTH_SCAN`
2. `BLUETOOTH_CONNECT`
3. `BLUETOOTH_ADVERTISE`
4. `RECORD_AUDIO`
5. `ACCESS_FINE_LOCATION`

The app blocks forward navigation until required permissions are granted.

#### 7.2 Storage Module
The application uses MMKV only. No AsyncStorage is used. Persistent items include:
1. selected role
2. paired device
3. user settings
4. logs

#### 7.3 Bluetooth Module
The Bluetooth layer is responsible for:
1. scanning devices
2. connecting paired devices
3. maintaining the active connection
4. sending and receiving signaling packets
5. reconnect behavior

For Classic transport, messages are sent as JSON strings with newline delimiting. Large signaling payloads are chunked and reassembled safely.

#### 7.4 Call Service
The call service controls:
1. session creation
2. outgoing invite generation
3. incoming invite handling
4. call accept/decline/end behavior
5. call state transitions

#### 7.5 Audio Service
The audio service manages:
1. microphone initialization
2. `RTCPeerConnection` creation
3. SDP offer and answer generation
4. remote stream attachment
5. mute
6. push-to-talk
7. speaker and earpiece routing
8. call teardown

#### 7.6 Transport State Manager
The transport state system keeps the app synchronized across screens. Major states include:
1. `idle`
2. `scanning`
3. `discovered`
4. `pairing`
5. `paired`
6. `auto_connecting`
7. `connected`
8. `calling`
9. `incoming`
10. `in_call`
11. `reconnecting`
12. `disconnected`
13. `failed`

### 8. Screen Flow
1. `SplashScreen`
2. `PermissionsScreen`
3. `RoleSelectScreen`
4. `ScanScreen`
5. `PairingScreen`
6. `AutoConnectScreen`
7. `HomeScreen`
8. `IncomingCallScreen`
9. `CallScreen`
10. `ReconnectScreen`
11. `SettingsScreen`
12. `LogsScreen`

### 9. End-to-End Working Flow
1. App launches.
2. User grants permissions.
3. User selects `Rider` or `Pillion`.
4. Devices are scanned and one phone is paired.
5. Paired device details are saved in MMKV.
6. On later launch, app attempts auto-connect if a saved device exists.
7. Rider taps `Start Call`.
8. Invite is sent over Bluetooth signaling.
9. Pillion receives the incoming call screen.
10. On acceptance, WebRTC offer/answer completes.
11. Voice is transmitted over the local network.
12. Call can be ended from either phone.
13. Both phones return to the home screen.

### 10. Important Functional Features
#### 10.1 Role-Based Logic
The app supports two fixed roles:
1. Rider
2. Pillion

The role affects connection behavior. For example, the pillion side acts as the Classic listening side while the rider side initiates the link.

#### 10.2 Call Controls
The in-call screen supports:
1. mute/unmute
2. speaker/earpiece switching
3. full duplex mode
4. push-to-talk mode
5. call stats such as RTT and jitter

#### 10.3 Logging
Every major transport and call event is written through `LogsService.add()`. Logs are stored in MMKV and shown in the logs screen.

### 11. Android Permissions and Hardware Requirements
#### 11.1 Permissions
MotoLink relies on Bluetooth, microphone, vibration, and network permissions. These are declared in the Android manifest and checked in the app flow.

#### 11.2 Hardware
1. Android phone with Bluetooth support
2. Android phone microphone
3. Android audio output
4. shared Wi-Fi network or hotspot for voice

### 12. Limitations
1. The current working call architecture depends on both phones sharing the same Wi-Fi or hotspot for audio.
2. Bluetooth is not carrying the actual voice stream in the present implementation.
3. The app is Android-focused in its current stabilized state.
4. Background-call handling can be improved further in future versions.

### 13. Testing Summary
The stabilized project has been tested through iterative on-device fixes in these areas:
1. scan flow
2. pairing flow
3. Classic signaling
4. incoming call handling
5. app exit/crash conditions
6. call controls
7. audio route handling
8. reconnect handling

Multiple release builds were generated and installed on physical Android devices during debugging.

### 14. Security and Data Handling
1. Paired device information is stored locally in MMKV.
2. No cloud database is used.
3. Session-level call signals are exchanged between paired phones.
4. The app is designed for local device-to-device operation rather than centralized server control.

### 15. Future Scope
1. exportable logs from the app UI
2. stronger background incoming-call notifications
3. signed production release package
4. enhanced reconnect UX
5. optional richer diagnostics for network and media quality

### 16. Conclusion
MotoLink is a role-based Android intercom application that combines Bluetooth signaling with WebRTC voice. Its design focuses on simple rider-to-pillion communication, persistent pairing, lightweight navigation, and direct call controls. The current implementation provides a practical local-network intercom model and a modular codebase that can be extended in future academic or production work.

### 17. Project Structure Reference
```text
MotoApp/
  android/
  src/
    components/
    constants/
    navigation/
    screens/
    services/
    storage/
  index.js
  package.json
  MOTOLINK_COLLEGE_DOCUMENTATION.md
```

### 18. Credits
Project Name: MotoLink

Platform: React Native Android

Primary Use Case: Rider-to-Pillion Intercom Communication
