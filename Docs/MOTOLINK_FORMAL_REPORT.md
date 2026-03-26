# MOTO LINK

## Formal Project Report

---

## Title Page

**Project Title:** MotoLink  
**Project Type:** Mini Project / Final Year Project / College Project  
**Domain:** Mobile Application Development / Wireless Communication  
**Platform:** Android  
**Technology Stack:** React Native, Bluetooth Classic, BLE, WebRTC, MMKV

**Submitted By:**  
Name: ________________________  
Roll No.: ____________________  
Class / Semester: ____________  
Department: __________________

**Submitted To:**  
Guide Name: __________________  
Department: __________________  
College Name: ________________

**Academic Year:** 2025-2026

---

## Certificate

This is to certify that the project report entitled **"MotoLink"** is a bonafide work carried out by **________________________** under my guidance and supervision for the partial fulfillment of the requirements for the award of the degree/diploma in **________________________** during the academic year **2025-2026**.

The work presented in this report is original and has not been submitted elsewhere for the award of any other degree or diploma.

**Project Guide**  
Signature: ____________________  
Name: ________________________  
Date: ________________________

**Head of Department**  
Signature: ____________________  
Name: ________________________  
Date: ________________________

---

## Declaration

I hereby declare that the project report titled **"MotoLink"** submitted by me is an original record of work carried out by me under the guidance of **________________________**. This report has not been submitted to any other university or institution for the award of any degree, diploma, or certificate.

**Student Signature:** ____________________  
**Name:** ________________________________  
**Date:** ________________________________

---

## Acknowledgement

I would like to express my sincere gratitude to my project guide, faculty members, and department for their continuous support, guidance, and encouragement during the development of this project. I also thank my college for providing the necessary environment and resources to complete this work successfully.

I would also like to acknowledge all the software libraries, tools, and open-source technologies that made the implementation of MotoLink possible.

---

## Abstract

MotoLink is an Android intercom application designed for communication between a rider and a pillion using two mobile phones. The project focuses on short-range device discovery, pairing, signaling, and live voice transmission in a practical mobile environment.

The application is developed using React Native and integrates Bluetooth Classic and BLE for device discovery, pairing, and signaling. Once a call is accepted, the live voice path is carried using WebRTC over a shared local Wi-Fi network or hotspot. The application also provides role selection, auto-connect support, reconnect logic, persistent paired-device storage, logging, and in-call controls such as mute, speaker/earpiece routing, and push-to-talk.

The main objective of this project is to provide a lightweight rider-to-pillion communication solution with a mobile-first implementation and a modular service-based architecture.

---

## Index

1. Introduction  
2. Problem Statement  
3. Objectives  
4. Existing System  
5. Proposed System  
6. Technology Stack  
7. System Architecture  
8. Module Description  
9. Functional Flow  
10. Testing and Validation  
11. Limitations  
12. Future Scope  
13. Conclusion  
14. Bibliography  
15. Appendix

---

## 1. Introduction

Communication between a rider and a pillion is often difficult while travelling. Traditional phone calls are not ideal for this purpose because they are not optimized for quick pairing, local transport discovery, intercom-style calling, or simplified call controls. MotoLink is designed to solve this problem by providing a dedicated Android-based intercom application.

MotoLink uses a role-based approach where one device can act as the rider and the other as the pillion. It provides a streamlined flow for permissions, device discovery, pairing, call initiation, incoming call handling, and in-call audio control.

---

## 2. Problem Statement

The major problem addressed by this project is the lack of a lightweight, local, mobile communication system for rider-to-pillion use cases. Standard communication applications are built for internet calling or cellular calling, but they do not provide:

1. Bluetooth-based partner discovery
2. quick device pairing for repeated local usage
3. role-based rider and pillion behavior
4. dedicated intercom-style controls
5. simplified reconnect logic for local use

MotoLink addresses these gaps through a purpose-built Android application.

---

## 3. Objectives

The major objectives of MotoLink are:

1. to allow two Android devices to discover and pair with each other
2. to support rider and pillion role selection
3. to establish a signaling channel using Bluetooth
4. to provide live voice communication using WebRTC
5. to persist paired device and settings using local storage
6. to support reconnect and auto-connect flows
7. to provide call controls such as mute, speaker, earpiece, and push-to-talk
8. to maintain application logs for debugging and monitoring

---

## 4. Existing System

The conventional approach for communication between two riders generally depends on:

1. standard phone calls
2. internet-based messaging applications
3. dedicated hardware intercom devices

These approaches have limitations:

1. phone calls depend on mobile network availability
2. messaging apps are not designed for fast intercom use
3. hardware intercom systems increase cost
4. standard apps do not provide local pairing-centered communication flow

---

## 5. Proposed System

MotoLink proposes a mobile application-based intercom architecture with the following design:

1. Bluetooth is used for scan, discovery, pairing, and signaling
2. WebRTC is used for real-time voice media
3. MMKV is used for persistent local storage
4. React Navigation is used for screen transitions
5. Android native audio routing is used for speaker and earpiece control

The current stabilized working model is:

1. Bluetooth Classic as the primary signaling transport
2. BLE support for scan flow where available
3. both phones connected to the same Wi-Fi or hotspot for live voice path

---

## 6. Technology Stack

### Frontend
1. React Native
2. JavaScript
3. React Navigation Stack

### Android Native
1. Kotlin
2. Android AudioManager

### Connectivity
1. `react-native-bluetooth-classic`
2. `react-native-ble-plx`
3. `react-native-webrtc`

### Storage and Utilities
1. `react-native-mmkv`
2. custom logs service
3. transport state manager

---

## 7. System Architecture

### High-Level Architecture

1. **UI Layer**
   - Splash screen
   - permissions screen
   - role selection screen
   - scan and pairing screens
   - home, incoming call, call, reconnect, settings, and logs screens

2. **Service Layer**
   - Bluetooth service
   - pairing service
   - call service
   - audio service
   - reconnect service
   - logs service
   - transport state manager

3. **Storage Layer**
   - MMKV-based persistent storage for role, paired device, settings, and logs

### Communication Architecture

1. device discovery begins from the scan screen
2. paired devices are saved for future auto-connect
3. rider can initiate a call from the home screen
4. invite is sent through Bluetooth signaling
5. pillion receives the incoming call screen
6. WebRTC offer and answer are exchanged
7. local network path is used for real-time audio

---

## 8. Module Description

### 8.1 Permissions Module
This module requests and validates:

1. Bluetooth scan permission
2. Bluetooth connect permission
3. Bluetooth advertise permission
4. record audio permission
5. fine location permission

The module blocks progress until required permissions are granted.

### 8.2 Role Selection Module
This module allows the user to choose:

1. rider
2. pillion

The selected role is saved in MMKV and used later in connection behavior.

### 8.3 Scan Module
This module:

1. starts scan for discoverable devices
2. shows devices in real time
3. supports Bluetooth Classic fallback for discovery
4. stops scan after timeout

### 8.4 Pairing Module
This module:

1. connects the selected device
2. stores paired device details
3. saves session token and connection metadata
4. prepares signaling channel after successful pairing

### 8.5 Call Service Module
This module:

1. creates call session ID
2. sends outgoing invite packets
3. receives answer, end, and decline signals
4. tracks call state
5. handles peer connection state changes

### 8.6 Audio Module
This module:

1. initializes microphone
2. creates peer connection
3. applies audio constraints
4. manages mute and push-to-talk
5. routes audio between speaker and earpiece
6. closes and releases resources at call end

### 8.7 Reconnect Module
This module:

1. attempts reconnect on saved device
2. supports reconnect retry phases
3. updates transport state
4. supports auto-connect behavior on app start

### 8.8 Logs Module
This module:

1. stores important events
2. persists logs in MMKV
3. provides logs to the logs screen
4. supports log clearing

---

## 9. Functional Flow

### Basic Functional Flow

1. user opens the application
2. app checks permissions
3. user selects rider or pillion role
4. app checks for paired device
5. if no device is paired, scan starts
6. selected device is paired and stored
7. rider starts call
8. pillion receives invite
9. call is accepted
10. both phones enter call screen
11. voice is transmitted
12. call ends and both return to home

### In-Call Functions

1. mute / unmute
2. speaker / earpiece switch
3. push-to-talk mode
4. full duplex mode
5. RTT and jitter display

---

## 10. Testing and Validation

The project has been tested through:

1. repeated Android release builds
2. installation on physical Android phones
3. scan flow validation
4. pairing validation
5. incoming call behavior validation
6. transport state validation
7. launcher icon and packaging checks

### Key Validation Areas

1. Bluetooth initialization
2. permission flow
3. device discovery
4. pairing persistence
5. incoming call reception
6. audio route control
7. reconnect behavior
8. log persistence

---

## 11. Limitations

The current stabilized version has these practical limitations:

1. live audio depends on both phones sharing the same Wi-Fi or hotspot
2. Bluetooth is used for signaling, not direct voice transport
3. the project is Android-focused
4. advanced background notification behavior can still be improved further

---

## 12. Future Scope

Possible future enhancements include:

1. export logs from the application UI
2. stronger background incoming call alerts
3. signed production-ready APK or AAB
4. improved reconnect UX
5. richer network diagnostics
6. optional analytics for connection quality

---

## 13. Conclusion

MotoLink is a practical Android-based rider-to-pillion communication application that integrates Bluetooth discovery and signaling with WebRTC audio. The system is modular, service-driven, and built for a realistic mobile intercom workflow. It demonstrates how Bluetooth transport management, role-based mobile design, local storage, and real-time media communication can be integrated into a unified Android application.

The project successfully addresses the need for a specialized local communication system and provides a strong foundation for further enhancement and academic presentation.

---

## 14. Bibliography

1. React Native Documentation
2. Android Developer Documentation
3. React Navigation Documentation
4. react-native-webrtc Documentation
5. react-native-bluetooth-classic Documentation
6. react-native-ble-plx Documentation
7. MMKV Documentation

---

## 15. Appendix

### Project Folder Overview

```text
MotoApp/
  android/
  ios/
  src/
    components/
    constants/
    navigation/
    screens/
    services/
    storage/
  package.json
  index.js
  MOTOLINK_COLLEGE_DOCUMENTATION.md
  MOTOLINK_FORMAL_REPORT.md
```

### Important Stored Data

1. user role
2. paired device
3. app settings
4. logs

### Main Screens

1. Splash
2. Permissions
3. Role Select
4. Scan
5. Pairing
6. Auto Connect
7. Home
8. Incoming Call
9. Call
10. Reconnect
11. Settings
12. Logs

---

## End of Report
