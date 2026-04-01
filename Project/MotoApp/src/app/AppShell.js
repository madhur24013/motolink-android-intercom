import React, {useRef} from 'react';
import AppNavigator from '../navigation/AppNavigator';
import {useMotoLinkRuntime} from './runtime/useMotoLinkRuntime';

export default function AppShell() {
  const navigationRef = useRef(null);
  useMotoLinkRuntime(navigationRef);
  return <AppNavigator navigationRef={navigationRef} />;
}
