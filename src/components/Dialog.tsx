import React, { useState, useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { C, R, SP, T } from '../theme';
import { Button, Field, Txt } from './ui';

// 跨平台確認視窗(網頁版的 Alert 不支援按鈕,所以自己做一個)。

interface DialogReq {
  id: number;
  title: string;
  message?: string;
  ok?: string;
  cancel?: string | null;
  danger?: boolean;
  input?: { placeholder?: string; initial?: string; multiline?: boolean };
  resolve: (v: { ok: boolean; text?: string }) => void;
}

let queue: DialogReq[] = [];
let seq = 1;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());

function push(req: Omit<DialogReq, 'id' | 'resolve'>): Promise<{ ok: boolean; text?: string }> {
  return new Promise((resolve) => {
    queue = [...queue, { ...req, id: seq++, resolve }];
    emit();
  });
}

export async function confirmDialog(opts: { title: string; message?: string; ok?: string; cancel?: string | null; danger?: boolean }): Promise<boolean> {
  const r = await push(opts);
  return r.ok;
}

export async function promptDialog(opts: { title: string; message?: string; ok?: string; placeholder?: string; initial?: string; multiline?: boolean }): Promise<string | null> {
  const r = await push({ title: opts.title, message: opts.message, ok: opts.ok, cancel: '取消', input: { placeholder: opts.placeholder, initial: opts.initial, multiline: opts.multiline } });
  return r.ok ? r.text ?? '' : null;
}

export function alertDialog(title: string, message?: string) {
  return push({ title, message, ok: '知道了', cancel: null });
}

export function DialogHost() {
  const q = useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => {
        ls.delete(l);
      };
    },
    () => queue,
    () => queue,
  );
  const cur = q[0];
  if (!cur) return null;
  const close = (ok: boolean, text?: string) => {
    cur.resolve({ ok, text });
    queue = queue.slice(1);
    emit();
  };
  return <DialogBox key={cur.id} req={cur} onClose={close} />;
}

function DialogBox({ req, onClose }: { req: DialogReq; onClose: (ok: boolean, text?: string) => void }) {
  const [text, setText] = useState(req.input?.initial || '');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onClose(false)}>
      <View style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => (req.cancel === null ? undefined : onClose(false))} />
        <View style={styles.box}>
          <Txt size={T.h3} weight="700" style={{ marginBottom: SP.sm }}>
            {req.title}
          </Txt>
          {req.message ? (
            <Txt color={C.text2} style={{ marginBottom: SP.lg }}>
              {req.message}
            </Txt>
          ) : null}
          {req.input ? <Field value={text} onChangeText={setText} placeholder={req.input.placeholder} multiline={req.input.multiline} autoFocus={Platform.OS !== 'web'} /> : null}
          <View style={{ gap: SP.sm }}>
            <Button title={req.ok || '確定'} variant={req.danger ? 'danger' : 'primary'} onPress={() => onClose(true, text)} />
            {req.cancel !== null ? <Button title={req.cancel || '取消'} variant="secondary" onPress={() => onClose(false)} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.overlay, alignItems: 'center', justifyContent: 'center', padding: SP.xl },
  box: { width: '100%', maxWidth: 400, backgroundColor: C.bg, borderColor: C.line, borderWidth: 1, borderRadius: R.xl, padding: SP.xl },
});
