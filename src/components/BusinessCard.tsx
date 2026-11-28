import React, { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, KeyValue, Notice, Row, Txt } from './ui';
import { Sheet } from './Sheet';
import { alertDialog } from './Dialog';
import { CompanyForm } from './CompanyForm';
import { C, R, SP, T } from '../theme';
import { showToast } from '../store/store';
import { addContact } from '../store/actions';
import { addressOf } from '../store/options';
import { readBusinessCard, type CardPrefill } from '../services/card';
import type { Customer } from '../types';

/**
 * 拍名片建立客戶:拍照或選照片 → AI 讀出公司與聯絡人 → 檢查是否已有這家客戶 → 預填表單,業務確認後建立。
 */
export function BusinessCardFlow({ visible, onClose, onDone, canEditOwner }: { visible: boolean; onClose: () => void; onDone?: (c: Customer) => void; canEditOwner?: boolean }) {
  const [step, setStep] = useState<'choose' | 'reading' | 'result' | 'form'>('choose');
  const [photo, setPhoto] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [res, setRes] = useState<CardPrefill | null>(null);

  const reset = () => {
    setStep('choose');
    setPhoto(null);
    setRes(null);
    setProgress('');
  };
  const close = () => {
    reset();
    onClose();
  };

  const pick = async (camera: boolean) => {
    try {
      if (camera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) {
          alertDialog('相機權限已關閉', '請到手機設定開啟相機權限,或改從相簿選擇。');
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
      const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      setPhoto(a.uri);
      setStep('reading');
      const out = await readBusinessCard(a.uri, a.fileName || 'card.jpg', a.mimeType || 'image/jpeg', setProgress);
      setRes(out);
      setStep('result');
    } catch (e) {
      setStep('choose');
      alertDialog('名片辨識失敗', e instanceof Error ? e.message : '請重新拍攝,名片置中、光線充足、避免反光。');
    }
  };

  if (!visible) return null;
  if (step === 'form' && res) {
    return (
      <CompanyForm
        visible
        title="確認並建立客戶"
        initial={res.customer}
        canEditOwner={canEditOwner}
        onClose={close}
        onSaved={(c) => {
          showToast(`已建立客戶${res.contact ? `與聯絡人 ${res.contact.name}` : ''}`, 'success');
          onDone?.(c);
        }}
      />
    );
  }

  return (
    <Sheet
      visible
      onClose={close}
      title="拍名片建立客戶"
      footer={
        step === 'choose' ? (
          <>
            <Button title="拍攝名片" icon="photo" onPress={() => pick(true)} />
            <Button title="從相簿選擇" variant="secondary" onPress={() => pick(false)} />
          </>
        ) : step === 'result' && res ? (
          <>
            <Button title="建立新客戶" disabled={!res.customer.name} onPress={() => setStep('form')} />
            {res.duplicates[0] && res.contact ? (
              <Button
                title={`加為「${res.duplicates[0].name}」的聯絡人`}
                variant="secondary"
                onPress={() => {
                  const dup = res.duplicates[0];
                  if (!dup.contacts.some((x) => x.name === res.contact!.name)) addContact(dup.id, res.contact!);
                  showToast(`已加入聯絡人 ${res.contact!.name}`, 'success');
                  onDone?.(dup);
                  close();
                }}
              />
            ) : null}
            <Button title="重新拍攝" variant="ghost" onPress={reset} />
          </>
        ) : undefined
      }
    >
      {step === 'choose' ? (
        <Txt size={T.small} color={C.text2}>
          拍下新客戶的名片,AI 會讀出公司名稱、電話、地址、網址,以及聯絡人的姓名、職稱、部門、手機與 Email,預先填好客戶資料,確認後建立。{'\n\n'}
          拍攝建議:名片放平、置中,光線充足,避免反光與手指遮擋。
        </Txt>
      ) : null}

      {step === 'reading' ? (
        <View style={{ alignItems: 'center', paddingVertical: SP.xl }}>
          {photo ? <Image source={{ uri: photo }} style={{ width: 220, height: 130, borderRadius: R.md, marginBottom: SP.lg }} resizeMode="cover" /> : null}
          <ActivityIndicator color={C.teal} />
          <Txt size={T.small} color={C.text2} style={{ marginTop: SP.sm }}>
            {progress || '辨識名片中…'}
          </Txt>
        </View>
      ) : null}

      {step === 'result' && res ? (
        <>
          {res.demo ? <Notice tone="yellow" icon="warn" text="示範模式:沒有設定 AI 伺服器,以下是示範名片資料。設定 AI 伺服器並開啟照片辨識模型後,會讀取實際名片。" /> : null}
          <Row style={{ alignItems: 'flex-start' }} gap={SP.md}>
            {photo ? <Image source={{ uri: photo }} style={{ width: 110, height: 66, borderRadius: R.sm }} resizeMode="cover" /> : null}
            <View style={{ flex: 1 }}>
              <Txt weight="700">{res.customer.name || '(沒有讀到公司名稱)'}</Txt>
              <Txt size={T.small} color={C.text2}>
                {res.contact ? `${res.contact.name}${res.contact.title ? `・${res.contact.title}` : ''}` : '沒有讀到聯絡人'}
              </Txt>
            </View>
          </Row>
          <Card style={{ marginTop: SP.md }}>
            <Txt size={T.small} weight="700" color={C.teal} style={{ marginBottom: 4 }}>
              公司資料
            </Txt>
            <KeyValue k="公司電話" v={res.customer.phone} />
            <KeyValue k="地址" v={addressOf(res.customer as Customer) || undefined} />
            <KeyValue k="網址" v={res.customer.website} />
            <KeyValue k="統一編號" v={res.customer.taxId} />
          </Card>
          {res.contact ? (
            <Card style={{ marginTop: SP.sm }}>
              <Txt size={T.small} weight="700" color={C.teal} style={{ marginBottom: 4 }}>
                聯絡人
              </Txt>
              <KeyValue k="姓名" v={res.contact.name} />
              <KeyValue k="職稱" v={res.contact.title} />
              <KeyValue k="部門" v={res.contact.department} />
              <KeyValue k="手機" v={res.contact.phone} />
              <KeyValue k="Email" v={res.contact.email} />
            </Card>
          ) : null}
          {res.duplicates.length ? (
            <Notice tone="red" icon="warn" text={`系統裡已經有相似的客戶:${res.duplicates.map((d) => d.name).join('、')}。若是同一家公司,請改為「加為聯絡人」,避免重複建立。`} />
          ) : null}
          <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.sm }}>
            按「建立新客戶」後可再修改所有欄位;所屬產業、射出產品等名片上沒有的資料,之後拜訪時由 AI 補上。
          </Txt>
        </>
      ) : null}
    </Sheet>
  );
}
