import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '../../components/TabBar';
import { useAppState } from '../../store/store';
import { currentUser } from '../../store/selectors';

export default function TabsLayout() {
  const s = useAppState();
  const me = currentUser(s);
  if (!me) return <Redirect href="/login" />;
  if (me.role === 'admin') return <Redirect href="/admin" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar state={props.state} navigateToTab={props.navigateToTab} />}>
      <Tabs.Screen name="home" options={{ title: '首頁' }} />
      <Tabs.Screen name="customers" options={{ title: '客戶' }} />
      <Tabs.Screen name="me" options={{ title: '我的' }} />
    </Tabs>
  );
}
