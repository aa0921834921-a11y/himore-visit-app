import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { getState, setState } from '../store/store';

// 錄音檔存在 App 的文件夾(只在本機)。網頁版沒有檔案系統,錄音以瀏覽器暫存網址保存,重新整理後無法回放。

const isWeb = Platform.OS === 'web';

function recordingsDir(): Directory {
  const dir = new Directory(Paths.document, 'recordings');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** 把錄音暫存檔搬到 App 文件夾,回傳新位置 */
export function persistAudio(tempUri: string, name: string): string {
  if (isWeb || !tempUri) return tempUri;
  try {
    const src = new File(tempUri);
    const ext = src.extension || '.m4a';
    const dest = new File(recordingsDir(), `${name}${ext.startsWith('.') ? ext : `.${ext}`}`);
    if (dest.exists) dest.delete();
    src.copySync(dest);
    return dest.uri;
  } catch {
    return tempUri;
  }
}

export function deleteAudio(uri?: string) {
  if (isWeb || !uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // 檔案已不存在
  }
}

/** 錄音檔佔用空間(位元組) */
export function audioUsageBytes(): number {
  if (isWeb) return 0;
  try {
    return recordingsDir()
      .list()
      .reduce((sum, item) => (item instanceof File ? sum + (item.info().size || 0) : sum), 0);
  } catch {
    return 0;
  }
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** 依後台設定的保存天數,刪除已入庫且過期的錄音檔 */
export function cleanupExpiredAudio() {
  const s = getState();
  const limit = Date.now() - s.settings.retentionDays * 86400000;
  const expired = s.visits.filter((v) => v.status === 'confirmed' && v.raw.audioUri && !v.raw.audioDeleted && new Date(v.visitAt).getTime() < limit);
  if (!expired.length) return;
  expired.forEach((v) => {
    deleteAudio(v.raw.audioUri);
    v.raw.dictation?.forEach((d) => deleteAudio(d.audioUri));
  });
  const ids = new Set(expired.map((v) => v.id));
  setState((st) => ({
    ...st,
    visits: st.visits.map((v) => (ids.has(v.id) ? { ...v, raw: { ...v.raw, audioUri: undefined, audioDeleted: true } } : v)),
  }));
}

/** 照片、檔案:複製到 App 文件夾(網頁版保留瀏覽器暫存網址,重新整理後無法開啟) */
export function persistAttachment(uri: string, name: string): string {
  if (isWeb || !uri) return uri;
  try {
    const dir = new Directory(Paths.document, 'attachments');
    if (!dir.exists) dir.create({ intermediates: true });
    const safe = name.replace(/[\\/:*?"<>|]/g, '_');
    const dest = new File(dir, `${Date.now()}_${safe}`);
    new File(uri).copySync(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}
