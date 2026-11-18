import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Network from 'expo-network';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { hydrate, isOnline, setNetwork, useHydrated } from '../store/store';
import { resumeAll } from '../services/processing';
import { cleanupExpiredAudio } from '../services/files';
import { DialogHost } from '../components/Dialog';
import { ToastHost } from '../components/ToastHost';
import { C } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// 網頁版:把整頁底色設成深色,切換頁面載入時才不會閃白
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.style.backgroundColor = C.bg;
  document.body.style.backgroundColor = C.bg;
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = C.bg;
  document.head.appendChild(meta);
}

function applyNetwork(st: Network.NetworkState) {
  const wasOnline = isOnline();
  const online = st.isConnected !== false && st.isInternetReachable !== false;
  const wifi = st.type === Network.NetworkStateType.WIFI || st.type === Network.NetworkStateType.ETHERNET || st.type === Network.NetworkStateType.UNKNOWN || st.type === undefined;
  setNetwork(online, wifi);
  if (online && !wasOnline) resumeAll(); // 恢復連線:自動補傳
}

export default function RootLayout() {
  const ready = useHydrated();

  useEffect(() => {
    hydrate().then(() => {
      cleanupExpiredAudio();
      resumeAll();
      SplashScreen.hideAsync().catch(() => {});
    });
  }, []);

  useEffect(() => {
    Network.getNetworkStateAsync().then(applyNetwork).catch(() => {});
    const sub = Network.addNetworkStateListener(applyNetwork);
    return () => sub.remove();
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />
      <DialogHost />
      <ToastHost />
    </SafeAreaProvider>
  );
}
