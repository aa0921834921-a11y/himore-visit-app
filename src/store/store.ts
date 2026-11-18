import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from '../types';
import { buildSeed, DEFAULT_SETTINGS } from './seed';

// 本機資料庫:整份狀態存在手機本機(AsyncStorage;網頁版為瀏覽器儲存)。
// POC 沒有伺服器,所以不同手機之間的資料不會互通;正式版改接後端時,只需替換這一層。

const KEY = 'himore-visit-poc/v1';

let state: AppState = buildSeed();
let hydrated = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, 250);
}

export async function hydrate(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      state = { ...buildSeed(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
    } else {
      state = buildSeed();
      scheduleSave();
    }
  } catch {
    state = buildSeed();
  }
  hydrated = true;
  emit();
}

export function isHydrated() {
  return hydrated;
}

export function getState(): AppState {
  return state;
}

export function setState(updater: (s: AppState) => AppState) {
  state = updater(state);
  scheduleSave();
  emit();
}

export async function resetDemoData() {
  state = buildSeed();
  await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** 取得整份狀態;狀態改變時元件重新繪製。 */
export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => hydrated, () => hydrated);
}

// ---- 暫時性事件(不存檔):提示訊息 ----
export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'warn' | 'error';
  action?: { label: string; href: string };
}

let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
let toastSeq = 1;

export function showToast(text: string, tone: Toast['tone'] = 'info', action?: Toast['action'], ms = 3800) {
  const t: Toast = { id: toastSeq++, text, tone, action };
  toasts = [...toasts, t];
  toastListeners.forEach((l) => l());
  setTimeout(() => dismissToast(t.id), ms);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  toastListeners.forEach((l) => l());
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => {
        toastListeners.delete(l);
      };
    },
    () => toasts,
    () => toasts,
  );
}

// ---- 網路狀態(不存檔)----
let online = true;
let wifi = true;
const netListeners = new Set<() => void>();
export function setNetwork(isOnline: boolean, isWifi: boolean) {
  if (online === isOnline && wifi === isWifi) return;
  online = isOnline;
  wifi = isWifi;
  netListeners.forEach((l) => l());
}
export function isOnline() {
  return online;
}
/** 是否可以上傳:有網路,且若設定為「僅 Wi-Fi 上傳」時需連在 Wi-Fi */
export function canUpload() {
  return online && (!state.settings.uploadOnWifiOnly || wifi);
}
export function useOnline(): boolean {
  return useSyncExternalStore(
    (l) => {
      netListeners.add(l);
      return () => {
        netListeners.delete(l);
      };
    },
    () => online,
    () => online,
  );
}
