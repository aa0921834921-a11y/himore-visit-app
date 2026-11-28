import { ai } from './ai';
import { canUpload, getState, showToast } from '../store/store';
import { patchVisit, updateSettings } from '../store/actions';
import { customerById, setById, visitQuestionItems } from '../store/selectors';
import { sleep } from '../lib/util';

// 處理流程:上傳 → 轉文字 → 整理重點 → 題庫比對。依實際狀態更新,業務可離開頁面,完成後跳出提示。
// POC 沒有伺服器,「上傳」只在有網路時標記完成;沒網路就先存在手機,恢復連線後自動補傳。

const running = new Set<string>();

export async function runPipeline(visitId: string): Promise<void> {
  if (running.has(visitId)) return;
  running.add(visitId);
  try {
    let v = getState().visits.find((x) => x.id === visitId);
    if (!v || v.status !== 'processing') return;

    // 1 上傳
    if (v.upload !== 'done') {
      patchVisit(visitId, { stage: 1, upload: canUpload() ? 'uploading' : 'pending' });
      if (!canUpload()) return; // 等待恢復連線,由 resumeAll 重新啟動
      await sleep(900);
      patchVisit(visitId, { upload: 'done' });
    }

    // 2 轉文字
    patchVisit(visitId, { stage: 2 });
    v = getState().visits.find((x) => x.id === visitId);
    if (!v) return;
    const s = getState();
    const mock = ai.isMock;
    const note = (m: string) => patchVisit(visitId, { stageNote: m });
    const segments = await ai.transcribe({
      onProgress: note,
      source: v.source,
      audioUri: v.raw.audioUri,
      audioDurationMs: v.raw.audioDurationMs,
      audioParts: v.raw.audioParts,
      text: v.raw.text,
      dictation: v.raw.dictation,
      questions: s.questions,
      marks: v.raw.marks,
      supplements: v.raw.supplements,
      attachments: v.raw.attachments,
    });
    if (mock) await sleep(v.source === 'text' ? 500 : 1600);
    patchVisit(visitId, (x) => ({ ...x, stageNote: undefined, raw: { ...x.raw, segments } }));
    if (!segments.length) throw new Error('沒有轉出任何文字,請確認錄音有聲音或補充文字後重試');

    // 3 整理重點
    patchVisit(visitId, { stage: 3 });
    if (mock) await sleep(1100);
    if (getState().settings.simulateFailureNext) {
      updateSettings({ simulateFailureNext: false });
      patchVisit(visitId, { status: 'failed', error: '整理重點時發生錯誤' });
      showToast('處理失敗,請重試。內容已保存在手機中。', 'error', { label: '查看', href: `/visit/${visitId}/processing` });
      return;
    }

    // 4 題庫比對
    patchVisit(visitId, { stage: 4 });
    const st = getState();
    v = st.visits.find((x) => x.id === visitId);
    if (!v) return;
    const result = await ai.analyze({
      segments,
      source: v.source,
      // 題組 + 前次未取得/部分取得的題目(自動追蹤)
      questionSet: (() => {
        const set = setById(st, v.questionSetId);
        const items = visitQuestionItems(st, v);
        if (!set && !items.length) return undefined;
        return { ...(set || { id: 'tracked', name: '追蹤題目', active: true }), items };
      })(),
      questions: st.questions,
      customer: customerById(st, v.customerId),
      customers: st.customers,
      salesId: v.salesId,
      glossary: st.settings.glossary,
      visitAt: v.visitAt,
      onProgress: note,
    });
    // 錄音中自評已談到的題目:若 AI 沒找到依據,標為「部分回覆」提醒業務補述
    const checked = new Set(v.raw.selfCheckedQuestionIds || []);
    result.answers = result.answers.map((a) =>
      a.status === 'uncovered' && checked.has(a.questionId) ? { ...a, status: 'partial', answer: '業務自評已談到,請補充內容' } : a,
    );
    // 逐題口述標記為「客戶未提供/不適用」的題目
    v.raw.dictation?.forEach((d) => {
      if (!d.status) return;
      result.answers = result.answers.map((a) => (a.questionId === d.questionId ? { ...a, status: d.status!, reason: d.reason, answer: '' } : a));
    });
    if (mock) await sleep(800);
    patchVisit(visitId, (x) => ({
      ...x,
      stage: 5,
      stageNote: undefined,
      status: 'pending_confirm',
      ai: result,
      customerId: x.customerId || result.suggestedCustomerId,
    }));
    if (getState().settings.notifyEnabled) {
      showToast('拜訪紀錄整理完成,請確認後入庫', 'success', { label: '前往確認', href: `/visit/${visitId}/confirm` }, 6000);
    }
  } catch (e) {
    patchVisit(visitId, { status: 'failed', stageNote: undefined, error: e instanceof Error ? e.message : '未知錯誤' });
    showToast('處理失敗,請重試。內容已保存在手機中。', 'error');
  } finally {
    running.delete(visitId);
  }
}

/** App 啟動或恢復連線時,繼續所有未完成的處理 */
export function resumeAll() {
  getState()
    .visits.filter((v) => v.status === 'processing')
    .forEach((v) => {
      runPipeline(v.id);
    });
}

export function retryVisit(visitId: string) {
  patchVisit(visitId, { status: 'processing', error: undefined, stage: 1 });
  runPipeline(visitId);
}

export function isRunning(visitId: string) {
  return running.has(visitId);
}
