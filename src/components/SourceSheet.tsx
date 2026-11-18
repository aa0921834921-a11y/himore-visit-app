import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Sheet } from './Sheet';
import { Chip, Icon, Row, Txt } from './ui';
import { C, R, SP, T } from '../theme';
import { useAppState } from '../store/store';
import { currentUser, questionById } from '../store/selectors';
import type { Segment, Visit } from '../types';
import { fmtClock } from '../lib/util';

const SRC_LABEL = { recording: '現場錄音', dictation: '業務口述', text: '文字輸入' } as const;

/** 逐字稿播放:只有錄音的業務本人可以聽 */
export function useSegmentPlayer(visit?: Visit) {
  const s = useAppState();
  const me = currentUser(s);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | undefined>();
  const canPlay = !!visit && me?.id === visit.salesId && !visit.raw.audioDeleted;

  const audioFor = (sg: Segment): { uri: string; start: number } | undefined => {
    if (!visit || !canPlay) return undefined;
    if (sg.source === 'recording' && visit.raw.audioUri) return { uri: visit.raw.audioUri, start: sg.start || 0 };
    if (sg.questionId) {
      const d = visit.raw.dictation?.find((x) => x.questionId === sg.questionId);
      if (d?.audioUri) return { uri: d.audioUri, start: 0 };
    }
    return undefined;
  };

  const toggle = async (sg: Segment) => {
    const a = audioFor(sg);
    if (!a) return;
    if (playingId === sg.id && status.playing) {
      player.pause();
      setPlayingId(undefined);
      return;
    }
    try {
      player.replace({ uri: a.uri });
      await player.seekTo(a.start);
      player.play();
      setPlayingId(sg.id);
    } catch {
      setPlayingId(undefined);
    }
  };

  return { canPlay, audioFor, toggle, playingId: status.playing ? playingId : undefined };
}

export function SegmentList({ visit, highlight = [], onlyHighlighted = false }: { visit: Visit; highlight?: string[]; onlyHighlighted?: boolean }) {
  const s = useAppState();
  const p = useSegmentPlayer(visit);
  const segs = (visit.raw.segments || []).filter((sg) => !onlyHighlighted || highlight.includes(sg.id));
  if (!segs.length) {
    return (
      <Txt color={C.text2} style={{ paddingVertical: SP.md }}>
        沒有對應的原文。此欄位可能由業務手動編輯,或內容為「未知」。
      </Txt>
    );
  }
  return (
    <View>
      {segs.map((sg) => {
        const hit = highlight.includes(sg.id);
        const audio = p.audioFor(sg);
        const q = questionById(s, sg.questionId);
        return (
          <View key={sg.id} style={[styles.seg, hit && styles.segHit]}>
            <Row style={{ marginBottom: 4 }} gap={6}>
              <Chip label={sg.speaker || SRC_LABEL[sg.source]} tone={sg.speaker === '語者未確認' ? 'yellow' : sg.speaker === '客戶' ? 'teal' : 'gray'} />
              {sg.start !== undefined ? (
                <Txt size={T.tiny + 1} color={C.text3}>
                  {fmtClock(sg.start * 1000).slice(3)}
                </Txt>
              ) : null}
              {q ? (
                <Txt size={T.tiny + 1} color={C.text3} numberOfLines={1} style={{ flex: 1 }}>
                  {q.code} {q.text}
                </Txt>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              {audio ? (
                <Pressable onPress={() => p.toggle(sg)} hitSlop={8} accessibilityLabel="播放這段錄音">
                  <Icon name={p.playingId === sg.id ? 'pause' : 'play'} size={20} color={C.teal} />
                </Pressable>
              ) : null}
            </Row>
            <Txt color={hit ? C.text : C.text2}>{sg.text}</Txt>
          </View>
        );
      })}
      {!p.canPlay && visit.source !== 'text' ? (
        <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.sm }}>
          {visit.raw.audioDeleted ? '錄音已超過保存天數並刪除。' : '錄音只有錄製的業務本人可以播放。'}
        </Txt>
      ) : null}
    </View>
  );
}

/** 點來源圖示看原文 */
export function SourceSheet({ visible, onClose, visit, segmentIds, title, footer }: { visible: boolean; onClose: () => void; visit: Visit; segmentIds: string[]; title?: string; footer?: React.ReactNode }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <Sheet visible={visible} onClose={onClose} title={title || '原文'} footer={footer}>
      <SegmentList visit={visit} highlight={segmentIds} onlyHighlighted={!showAll && segmentIds.length > 0} />
      {segmentIds.length > 0 ? (
        <Pressable onPress={() => setShowAll(!showAll)} style={{ paddingVertical: SP.md }}>
          <Txt size={T.small} color={C.teal}>
            {showAll ? '只看相關片段' : '查看完整逐字稿'}
          </Txt>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  seg: { borderRadius: R.md, borderWidth: 1, borderColor: C.lineSoft, padding: SP.md, marginBottom: SP.sm, backgroundColor: 'rgba(9,33,43,0.7)' },
  segHit: { borderColor: C.yellow, backgroundColor: 'rgba(255,213,79,0.07)' },
});
