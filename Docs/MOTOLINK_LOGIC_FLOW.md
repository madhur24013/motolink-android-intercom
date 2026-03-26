# MotoLink Logic Flow

## Overview

MotoLink is a two-phone Android intercom app for rider and pillion communication.

The app uses:

1. Bluetooth for discovery, pairing, and signaling
2. WebRTC for live audio media
3. MMKV for local persistence

## High-Level Flow

1. App launches
2. Permissions are requested
3. Bluetooth state is checked
4. User selects role: rider or pillion
5. App checks MMKV for a saved paired device
6. If a saved device exists, auto-connect starts
7. If no saved device exists, manual scan starts
8. Device is paired and saved
9. Home screen shows connected state
10. Rider starts a call
11. Pillion receives the incoming call
12. Both phones enter the call screen
13. Audio flows through WebRTC
14. Ending the call returns both phones to home

## Module Responsibilities

### 1. Permissions

Handled in `src/screens/PermissionsScreen.js`

Responsibilities:

1. Request Bluetooth permissions
2. Request microphone permission
3. Request location permission
4. Block navigation until required permissions are granted
5. Check Bluetooth adapter state before continuing

### 2. Role Selection

Handled in `src/screens/RoleSelectScreen.js`

Responsibilities:

1. Save user role to MMKV
2. Read paired device from MMKV
3. Send user to auto-connect when a paired device exists
4. Send user to scan when no paired device exists

### 3. Discovery and Pairing

Handled mainly in:

1. `src/services/BluetoothService.js`
2. `src/services/PairingService.js`
3. `src/screens/ScanScreen.js`
4. `src/screens/PairingScreen.js`

Responsibilities:

1. Discover nearby devices
2. Connect with Bluetooth transport
3. Discover services and characteristics when BLE is used
4. Save paired device metadata to MMKV

Saved fields include:

1. `id`
2. `name`
3. `address`
4. `role`
5. `type`
6. `version`
7. `sessionToken`
8. `pairedAt`
9. `lastSeen`
10. `preferredTransport`

### 4. Auto-Connect and Reconnect

Handled mainly in:

1. `src/services/ReconnectService.js`
2. `src/screens/AutoConnectScreen.js`
3. `src/screens/ReconnectScreen.js`

Responsibilities:

1. Load saved paired device
2. Reconnect using saved transport details
3. Update phase status such as searching, found, connecting, connected
4. Retry failed reconnects with backoff
5. Return to scan or home when reconnect fails

### 5. Signaling

Handled mainly in:

1. `src/services/CallService.js`
2. `src/services/BluetoothService.js`

Responsibilities:

1. Send call control packets between phones
2. Handle signal types:
   - `invite`
   - `answer`
   - `ice`
   - `decline`
   - `end`
3. Open incoming call screen when invite is received
4. Keep malformed packets from crashing the app

## Call Logic

### Outgoing Call

1. Rider taps call button
2. Microphone is initialized
3. RTCPeerConnection is created
4. Offer SDP is generated
5. Offer is sent over Bluetooth signaling
6. Caller waits for answer

### Incoming Call

1. Pillion receives invite packet
2. Incoming call screen opens
3. On accept, microphone is initialized
4. Remote offer is applied
5. Answer SDP is created
6. Answer is sent back to rider

### In-Call Behavior

1. Both devices exchange ICE or complete SDP negotiation
2. Audio track is enabled according to mode
3. Speaker or earpiece route is applied
4. Mute and push-to-talk control the outgoing audio track

### Call End

1. End signal is sent to partner
2. Peer connection is closed
3. Media tracks are stopped
4. Transport returns to connected state
5. Call event is logged

## Audio Logic

Handled mainly in `src/services/AudioService.js`

Responsibilities:

1. Create local media stream
2. Configure WebRTC peer connection
3. Attach remote audio stream
4. Toggle speaker or earpiece output
5. Enable or disable microphone track for mute and PTT

## Storage Logic

Handled mainly in `src/storage/Storage.js`

MMKV stores:

1. User role
2. Paired device
3. Settings
4. Logs

## State Management

Handled mainly in `src/services/TransportStateManager.js`

States:

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

## Logging

Handled mainly in `src/services/LogsService.js`

Responsibilities:

1. Record app events
2. Persist logs through MMKV
3. Help diagnose scan, connection, call, and audio issues

## Deployment Package

The packaged repository includes:

1. Full project source code
2. Release APK
3. Technical documentation
4. Formal academic report
5. Logo asset
