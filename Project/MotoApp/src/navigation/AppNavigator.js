import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import SplashScreen from '../screens/SplashScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
import RoleSelectScreen from '../screens/RoleSelectScreen';
import ScanScreen from '../screens/ScanScreen';
import PairingScreen from '../screens/PairingScreen';
import AutoConnectScreen from '../screens/AutoConnectScreen';
import HomeScreen from '../screens/HomeScreen';
import IncomingCallScreen from '../screens/IncomingCallScreen';
import CallScreen from '../screens/CallScreen';
import ReconnectScreen from '../screens/ReconnectScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LogsScreen from '../screens/LogsScreen';

const Stack = createStackNavigator();

export default function AppNavigator({ navigationRef }) {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#070B12' },
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Permissions" component={PermissionsScreen} />
        <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="Pairing" component={PairingScreen} />
        <Stack.Screen name="AutoConnect" component={AutoConnectScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="IncomingCall" component={IncomingCallScreen} />
        <Stack.Screen name="Call" component={CallScreen} />
        <Stack.Screen name="Reconnect" component={ReconnectScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Logs" component={LogsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
