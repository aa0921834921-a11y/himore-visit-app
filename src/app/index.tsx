import React from 'react';
import { Redirect } from 'expo-router';
import { useAppState } from '../store/store';
import { currentUser } from '../store/selectors';

/** 入口:依登入狀態與角色導向 */
export default function Entry() {
  const s = useAppState();
  const me = currentUser(s);
  if (!me) return <Redirect href="/login" />;
  if (me.role === 'admin') return <Redirect href="/admin" />;
  if (!s.onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
