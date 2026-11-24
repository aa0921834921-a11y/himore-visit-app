import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import type { AppState, Visit } from '../types';
import { customerById, industriesOf, purposeOf, questionById, userById } from '../store/selectors';
import { fmtDate, fmtDateTime, toCsv } from '../lib/util';

const STATUS_LABEL: Record<string, string> = {
  answered: '已回覆',
  partial: '部分回覆',
  uncovered: '未蒐集',
  not_provided: '客戶未提供',
  na: '不適用',
};

export const VISIT_STATUS_LABEL: Record<Visit['status'], string> = {
  draft: '草稿',
  processing: '處理中',
  pending_confirm: '待確認',
  confirmed: '已入庫',
  failed: '處理失敗',
};

export function answerStatusLabel(s: string) {
  return STATUS_LABEL[s] || s;
}

/** S10 複製文字用的格式 */
export function visitToText(s: AppState, v: Visit): string {
  const c = customerById(s, v.customerId);
  const u = userById(s, v.salesId);
  const a = v.ai;
  const lines: string[] = [];
  lines.push(`【拜訪紀錄】${c?.name || '未指定客戶'}(${c?.code || '—'})`);
  lines.push(`拜訪編號:${v.code}|日期:${fmtDateTime(v.visitAt)}|業務:${u?.name || '—'}|類型:${v.visitType}`);
  if (a) {
    lines.push('');
    lines.push(`重點:${a.summary.keyPoints.text}`);
    lines.push(`客戶需求:${a.summary.needs.text}`);
    lines.push(`競品:${a.summary.competitors.text}`);
    lines.push(`異議:${a.summary.objections.text}`);
    lines.push(`下一步:${a.summary.nextSteps.text}`);
    if (a.answers.length) {
      lines.push('');
      lines.push('題庫回覆:');
      a.answers.forEach((x) => {
        const q = questionById(s, x.questionId);
        const val = x.answer || (x.reason ? `(${answerStatusLabel(x.status)}:${x.reason})` : `(${answerStatusLabel(x.status)})`);
        lines.push(`${q?.code || ''} ${q?.text || ''}${x.required ? '[必答]' : ''}:${val}`);
      });
    }
    const todos = a.todos.filter((t) => t.keep);
    if (todos.length) {
      lines.push('');
      lines.push('待辦:');
      todos.forEach((t) => lines.push(`・${t.content}${t.due ? `(${fmtDate(t.due)})` : ''}`));
    }
  }
  return lines.join('\n');
}

export async function copyText(text: string) {
  await Clipboard.setStringAsync(text);
}

/** B4 下載 CSV:欄位依文案表 T-B4-14;「限定」敏感度的偏好與避免事項預設不匯出 */
export function buildVisitsCsv(s: AppState, visits: Visit[], includeRestricted = false): string {
  const header = ['拜訪編號', '客戶編號', '客戶名稱', '統編', '客戶分類', '產業別', '拜訪日期', '拜訪人員', '拜訪類型', '目的', '需求', '追蹤事項', '輸入來源', '狀態', '題目與回覆', '摘要', '偏好與避免事項', '補充內容', '附件', '確認時間'];
  const srcLabel = { recording: '現場錄音', dictation: '業務口述', text: '文字輸入' } as const;
  const rows = visits.map((v) => {
    const c = customerById(s, v.customerId);
    const u = userById(s, v.salesId);
    const a = v.ai;
    const qa = (a?.answers || [])
      .map((x) => {
        const q = questionById(s, x.questionId);
        return `${q?.code || ''} ${q?.text || ''}:${x.answer || answerStatusLabel(x.status)}${x.reason ? `(${x.reason})` : ''}`;
      })
      .join(' / ');
    const summary = a ? `重點:${a.summary.keyPoints.text} 需求:${a.summary.needs.text} 競品:${a.summary.competitors.text} 異議:${a.summary.objections.text} 下一步:${a.summary.nextSteps.text}` : '';
    const todos = s.todos.filter((t) => t.visitId === v.id).map((t) => `${t.content}${t.due ? `(${t.due})` : ''}`).join(' / ');
    const prefs = s.preferences
      .filter((p) => p.sourceVisitId === v.id && (includeRestricted || p.sensitivity === 'normal'))
      .map((p) => `${p.type === 'avoid' ? '避免' : '偏好'}:${p.content}`)
      .join(' / ');
    const sups = (v.raw.supplements || []).map((x) => x.text || '(補充口述錄音)').join(' / ');
    const atts = (v.raw.attachments || []).map((x) => x.name).join(' / ');
    const needs = a && a.summary.needs.text !== '未知' ? a.summary.needs.text : '';
    const follow = todos || (a && a.summary.nextSteps.text !== '未知' ? a.summary.nextSteps.text : '');
    return [v.code, c?.code, c?.name, c?.taxId, c?.category, industriesOf(c).join('、'), fmtDate(v.visitAt), u?.name, v.visitType, purposeOf(v, s), needs, follow, srcLabel[v.source], VISIT_STATUS_LABEL[v.status], qa, summary, prefs, sups, atts, v.confirmedAt ? fmtDateTime(v.confirmedAt) : ''];
  });
  return toCsv([header, ...rows]);
}

/** 存成檔案並開啟分享(手機)或直接下載(網頁) */
export async function saveCsv(filename: string, csv: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  const f = new File(Paths.cache, filename);
  if (f.exists) f.delete();
  f.create();
  await f.write(csv);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(f.uri, { mimeType: 'text/csv', dialogTitle: '下載 CSV', UTI: 'public.comma-separated-values-text' });
  }
}

/** 讀取使用者選的 CSV 檔內容 */
export async function readPickedText(uri: string, webFile?: unknown): Promise<string> {
  if (Platform.OS === 'web') {
    if (webFile && typeof (webFile as Blob).text === 'function') return (webFile as Blob).text();
    const res = await fetch(uri);
    return res.text();
  }
  return new File(uri).text();
}

/** 存成一般文字檔(報告 .txt / .json) */
export async function saveTextFile(filename: string, content: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  const f = new File(Paths.cache, filename);
  if (f.exists) f.delete();
  f.create();
  await f.write(content);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType, dialogTitle: '匯出報告' });
}
