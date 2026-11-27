import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Header, Screen } from "../../../components/Screen";
import {
  Button,
  Card,
  Checkbox,
  Chip,
  FactChip,
  Field,
  Icon,
  IconButton,
  Notice,
  Row,
  Segmented,
  Txt,
} from "../../../components/ui";
import { Ring } from "../../../components/Ring";
import { CustomerPicker, ReasonSheet } from "../../../components/Pickers";
import { SourceSheet } from "../../../components/SourceSheet";
import { PrefSheet } from "../../../components/PrefSheet";
import { Sheet } from "../../../components/Sheet";
import { promptDialog } from "../../../components/Dialog";
import { AttachmentList } from "../../../components/Attachments";
import { OutOfScope } from "../../../components/Report";
import { buildVisitReport } from "../../../services/report";
import { C, R, SP, T } from "../../../theme";
import { useAppState } from "../../../store/store";
import {
  currentUser,
  customerById,
  isHandled,
  purposeOf,
  questionById,
  requiredProgress,
  salesUsers,
  setById,
  userById,
  visitById,
} from "../../../store/selectors";
import { confirmVisit, patchVisit } from "../../../store/actions";
import { answerStatusLabel } from "../../../services/export";
import {
  addDays,
  fmtDateTime,
  fmtShortDate,
  uid,
  ymd,
} from "../../../lib/util";
import type {
  AnalysisResult,
  AnswerItem,
  SummaryKey,
  TodoSuggestion,
  Visit,
} from "../../../types";

// S09 確認與編輯:單頁快速確認(T-S09-01~T-S09-14)。預設只顯示需要人處理的例外。

const SUMMARY: { key: SummaryKey; title: string }[] = [
  { key: "keyPoints", title: "拜訪摘要" },
  { key: "needs", title: "客戶需求" },
  { key: "competitors", title: "競品" },
  { key: "objections", title: "異議" },
  { key: "nextSteps", title: "下一步" },
];
const SRC = {
  recording: "現場錄音",
  dictation: "業務口述",
  text: "文字輸入",
} as const;

type Tab = "summary" | "bank" | "todo" | "pref";

export default function Confirm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();
  const v = visitById(s, id);
  const me = currentUser(s);
  const [tab, setTab] = useState<Tab>("summary");
  const [source, setSource] = useState<{
    ids: string[];
    title: string;
    factId?: string;
    uncId?: string;
  } | null>(null);
  const [editKey, setEditKey] = useState<SummaryKey | null>(null);
  const [draft, setDraft] = useState("");
  const [answerQ, setAnswerQ] = useState<AnswerItem | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [prefOpen, setPrefOpen] = useState(false);
  const [pickCustomer, setPickCustomer] = useState(false);
  const [ownerFor, setOwnerFor] = useState<string | null>(null);

  const prog = requiredProgress(v);
  const a = v?.ai;
  if (!v || !a) {
    return (
      <Screen header={<Header title="確認與編輯" />}>
        <Notice tone="gray" text="找不到可確認的內容。" />
      </Screen>
    );
  }
  const c = customerById(s, v.customerId);
  const set = setById(s, v.questionSetId);
  const editable = v.status === "pending_confirm";
  const unviewed = a.facts.filter((f) => !f.viewed);
  const unresolved = a.uncertainties.filter((u) => !u.resolved);
  const pendingPrefs = a.prefs.filter((p) => p.decision === "pending");
  const optional = a.answers.filter((x) => !x.required);
  const locked =
    prog.unhandled.length > 0 || unviewed.length > 0 || !v.customerId;

  const upd = (fn: (x: AnalysisResult) => AnalysisResult, countEdit = true) =>
    patchVisit(v.id, (x: Visit) => ({
      ...x,
      ai: x.ai ? fn(x.ai) : x.ai,
      editCount: x.editCount + (countEdit ? 1 : 0),
    }));

  const setAnswer = (qid: string, patch: Partial<AnswerItem>) =>
    upd((x) => ({
      ...x,
      answers: x.answers.map((y) =>
        y.questionId === qid ? { ...y, ...patch } : y,
      ),
    }));
  /** 看過原文:同一段原文中的黃底項目一併視為已查看 */
  const markFactViewed = (factId: string) =>
    upd((x) => {
      const seg = x.facts.find((f) => f.id === factId)?.sourceSegmentId;
      return {
        ...x,
        facts: x.facts.map((f) =>
          f.id === factId || (seg && f.sourceSegmentId === seg)
            ? { ...f, viewed: true }
            : f,
        ),
      };
    }, false);
  const setTodo = (tid: string, patch: Partial<TodoSuggestion>) =>
    upd((x) => ({
      ...x,
      todos: x.todos.map((t) => (t.id === tid ? { ...t, ...patch } : t)),
    }));

  const doConfirm = () => {
    confirmVisit(v.id);
    router.replace(`/visit/${v.id}/done`);
  };

  const lockMsg = !v.customerId
    ? "請先選擇客戶"
    : prog.unhandled.length
      ? `還差 ${prog.unhandled.length} 題必答未處理`
      : unviewed.length
        ? `還有 ${unviewed.length} 個黃底項目未查看原文`
        : "";

  const sortedRequired = [...a.answers.filter((x) => x.required)].sort(
    (p, q) => Number(isHandled(p)) - Number(isHandled(q)),
  );

  return (
    <Screen
      bg="base"
      header={
        <Header
          title="確認與編輯"
          onBack={() =>
            router.canGoBack() ? router.back() : router.replace("/home")
          }
        />
      }
      footer={
        editable ? (
          <>
            {locked ? (
              <Txt size={T.small} color={C.yellow} center>
                {lockMsg}
              </Txt>
            ) : null}
            <Button title="確認並入庫" disabled={locked} onPress={doConfirm} />
            <Button
              title="稍後確認"
              variant="secondary"
              onPress={() => router.replace("/home")}
            />
          </>
        ) : undefined
      }
    >
      {a.mock ? (
        <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.md }}>
          目前為模擬 AI 的示範整理結果;正式版接上 AI 服務後會依實際內容整理。
        </Txt>
      ) : null}

      {/* 頂部:客戶(AI 建議可改)、時間、來源 */}
      <Card style={{ marginTop: SP.md }}>
        <Pressable
          disabled={!editable || !!v.scheduleId}
          onPress={() => setPickCustomer(true)}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <View style={{ flex: 1 }}>
            <Txt size={T.h3} weight="700" color={c ? C.text : C.yellow}>
              {c?.name || "尚未指定客戶(點此選擇)"}
            </Txt>
            <Txt size={T.small} color={C.text2}>
              {fmtDateTime(v.visitAt)}・{v.visitType}
            </Txt>
          </View>
          {editable && !v.scheduleId ? (
            <Icon name="edit" size={18} color={C.text2} />
          ) : null}
        </Pressable>
        <Pressable
          disabled={!editable}
          onPress={async () => {
            const t = await promptDialog({
              title: "拜訪目的",
              initial: purposeOf(v, s) || "",
              placeholder: "例:確認導入規格與交期",
            });
            if (t !== null)
              patchVisit(v.id, { purpose: t.trim() || undefined });
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: SP.sm,
          }}
        >
          <Txt
            size={T.small}
            color={purposeOf(v, s) ? C.text : C.yellow}
            style={{ flex: 1 }}
          >
            拜訪目的:{purposeOf(v, s) || "未填寫(點此補上)"}
            {!v.purpose && v.ai?.purpose ? "(AI 判斷)" : ""}
          </Txt>
          {editable ? <Icon name="edit" size={16} color={C.text2} /> : null}
        </Pressable>
        <Row style={{ marginTop: SP.sm, flexWrap: "wrap" }}>
          <Chip
            label={v.raw.audioImported ? "匯入錄音" : SRC[v.source]}
            tone="orange"
            icon={
              v.source === "recording"
                ? "mic"
                : v.source === "dictation"
                  ? "dictate"
                  : "text"
            }
          />
          {a.suggestedCustomerId &&
          a.suggestedCustomerId === v.customerId &&
          !v.scheduleId ? (
            <Chip label="客戶為 AI 建議" tone="yellow" icon="ai" />
          ) : null}
          {set ? <Chip label={set.name} tone="gray" icon="bank" /> : null}
        </Row>
      </Card>

      {/* 題庫覆蓋(D-004) */}
      {a.answers.length ? (
        <Card
          style={{ marginTop: SP.md }}
          tone={prog.unhandled.length ? "danger" : "default"}
          onPress={() => setTab("bank")}
        >
          <Row gap={SP.lg}>
            <Ring
              value={prog.handled}
              total={prog.total}
              color={prog.unhandled.length ? C.orange : C.teal}
            />
            <View style={{ flex: 1 }}>
              <Txt size={T.h3} weight="700">
                必答 {prog.handled} / {prog.total}
              </Txt>
              <Txt size={T.small} color={C.text2}>
                選答 {optional.filter(isHandled).length} / {optional.length}
              </Txt>
              {prog.unhandled.length ? (
                <Txt
                  size={T.small}
                  color="#FF6B66"
                  style={{ marginTop: 4 }}
                  numberOfLines={2}
                >
                  尚有 {prog.unhandled.length} 題必答未處理:
                  {prog.unhandled
                    .map((x) => {
                      const q = questionById(s, x.questionId);
                      return `${q?.code} ${q?.text.replace(/[??]$/, "")}`;
                    })
                    .join("、")}
                </Txt>
              ) : (
                <Txt size={T.small} color={C.teal} style={{ marginTop: 4 }}>
                  必答題都已處理
                </Txt>
              )}
            </View>
          </Row>
          {editable && a.answers.some((x) => x.status === "uncovered") ? (
            <View style={{ marginTop: SP.md }}>
              <Txt
                size={T.tiny + 1}
                color={C.text3}
                style={{ marginBottom: SP.xs }}
              >
                紅色題目是內容中沒有提到的。可補錄口述、打字或上傳照片/檔案,AI
                會重新比對。
              </Txt>
              <Button
                title={`補充資料(${a.answers.filter((x) => x.status === "uncovered").length} 題未蒐集)`}
                variant="secondary"
                small
                icon="attach"
                onPress={() => router.push(`/visit/${v.id}/supplement`)}
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      {v.raw.supplements?.length || v.raw.attachments?.length || editable ? (
        <Card style={{ marginTop: SP.md }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt weight="700">附件與補充</Txt>
            {editable ? (
              <Button
                title="補充資料"
                variant="secondary"
                full={false}
                onPress={() => router.push(`/visit/${v.id}/supplement`)}
              />
            ) : null}
          </Row>
          {(v.raw.supplements || []).map((x) => (
            <Txt
              key={x.id}
              size={T.small}
              color={C.text2}
              style={{ marginTop: 4 }}
            >
              ・{x.kind === "text" ? "補充文字" : "補充口述"}:
              {x.text || "(錄音)"}
            </Txt>
          ))}
          {v.raw.attachments?.length ? (
            <View style={{ marginTop: SP.sm }}>
              <AttachmentList items={v.raw.attachments} />
            </View>
          ) : null}
          {!v.raw.supplements?.length && !v.raw.attachments?.length ? (
            <Txt size={T.small} color={C.text3} style={{ marginTop: 4 }}>
              沒有補充內容。可後補口述、文字、照片或檔案,再重新整理。
            </Txt>
          ) : null}
        </Card>
      ) : null}

      <Segmented
        value={tab}
        onChange={setTab}
        style={{ marginTop: SP.lg, marginBottom: SP.md }}
        options={[
          {
            value: "summary",
            label: "摘要",
            badge: unviewed.length + unresolved.length || undefined,
          },
          {
            value: "bank",
            label: "題庫",
            badge: prog.unhandled.length || undefined,
          },
          { value: "todo", label: "待辦" },
          {
            value: "pref",
            label: "偏好",
            badge: pendingPrefs.length || undefined,
          },
        ]}
      />

      {tab === "summary" ? (
        <>
          {a.facts.length ? (
            <Card tone="warn" style={{ marginBottom: SP.md }}>
              <Txt
                size={T.small}
                color={C.text2}
                style={{ marginBottom: SP.sm }}
              >
                金額、數量、日期、型號與承諾:確認前請點開原文核對
              </Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {a.facts.map((f) => (
                  <FactChip
                    key={f.id}
                    label={f.text}
                    viewed={f.viewed}
                    onPress={() =>
                      setSource({
                        ids: f.sourceSegmentId ? [f.sourceSegmentId] : [],
                        title: `原文:${f.text}`,
                        factId: f.id,
                      })
                    }
                  />
                ))}
              </View>
            </Card>
          ) : null}
          {unresolved.map((u) => (
            <Pressable
              key={u.id}
              onPress={() =>
                setSource({
                  ids: u.sourceSegmentId ? [u.sourceSegmentId] : [],
                  title: "AI 不確定的內容",
                  uncId: u.id,
                })
              }
            >
              <Notice tone="red" icon="warn" text={`AI 不確定:${u.text}`} />
            </Pressable>
          ))}
          <Card style={{ marginBottom: SP.md }}>
            <Txt
              size={T.small}
              weight="700"
              color={C.teal}
              style={{ marginBottom: 4 }}
            >
              題庫之外的內容
            </Txt>
            <OutOfScope r={buildVisitReport(s, v)} />
          </Card>
          {SUMMARY.map(({ key, title }) => {
            const f = a.summary[key];
            const unknown = f.text === "未知";
            return (
              <Card key={key} style={{ marginBottom: SP.md }}>
                <Row
                  style={{ justifyContent: "space-between", marginBottom: 4 }}
                >
                  <Txt size={T.small} weight="700" color={C.teal}>
                    {title}
                  </Txt>
                  <Row gap={0}>
                    <IconButton
                      name="folder"
                      size={18}
                      color={C.text2}
                      label="查看原文"
                      onPress={() =>
                        setSource({
                          ids: f.sourceSegmentIds,
                          title: `原文:${title}`,
                        })
                      }
                    />
                    {editable ? (
                      <IconButton
                        name="edit"
                        size={18}
                        color={C.text2}
                        label="編輯"
                        onPress={() => {
                          setEditKey(key);
                          setDraft(unknown ? "" : f.text);
                        }}
                      />
                    ) : null}
                  </Row>
                </Row>
                {editKey === key ? (
                  <>
                    <Field
                      value={draft}
                      onChangeText={setDraft}
                      multiline
                      autoFocus
                    />
                    <Row gap={SP.md}>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="取消"
                          variant="secondary"
                          small
                          onPress={() => setEditKey(null)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="儲存"
                          small
                          onPress={() => {
                            upd((x) => ({
                              ...x,
                              summary: {
                                ...x.summary,
                                [key]: {
                                  ...x.summary[key],
                                  text: draft.trim() || "未知",
                                },
                              },
                            }));
                            setEditKey(null);
                          }}
                        />
                      </View>
                    </Row>
                  </>
                ) : (
                  <Txt color={unknown ? C.text3 : C.text}>{f.text}</Txt>
                )}
              </Card>
            );
          })}
        </>
      ) : null}

      {tab === "bank" ? (
        a.answers.length === 0 ? (
          <Notice tone="gray" icon="bank" text="這次拜訪沒有使用題組。" />
        ) : (
          <>
            <Txt
              size={T.small}
              color={C.text2}
              weight="700"
              style={{ marginBottom: SP.sm }}
            >
              必答題
            </Txt>
            {sortedRequired.map((x) => (
              <AnswerRow
                key={x.questionId}
                item={x}
                onPress={() => {
                  setAnswerQ(x);
                  setAnswerDraft(x.answer);
                }}
              />
            ))}
            {optional.length ? (
              <Txt
                size={T.small}
                color={C.text2}
                weight="700"
                style={{ marginTop: SP.lg, marginBottom: SP.sm }}
              >
                選答題
              </Txt>
            ) : null}
            {optional.map((x) => (
              <AnswerRow
                key={x.questionId}
                item={x}
                onPress={() => {
                  setAnswerQ(x);
                  setAnswerDraft(x.answer);
                }}
              />
            ))}
          </>
        )
      ) : null}

      {tab === "todo" ? (
        <>
          <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.sm }}>
            待辦建議:勾選要保留的項目。沒有明確日期就留空,不猜。
          </Txt>
          {a.todos.length === 0 ? (
            <Notice
              tone="gray"
              icon="check"
              text="AI 沒有找到待辦事項,可自行新增。"
            />
          ) : null}
          {a.todos.map((t) => (
            <Card key={t.id} style={{ marginBottom: SP.sm }}>
              <Row style={{ alignItems: "flex-start" }}>
                <Checkbox
                  checked={t.keep}
                  onPress={() => editable && setTodo(t.id, { keep: !t.keep })}
                />
                <View style={{ flex: 1 }}>
                  <Field
                    value={t.content}
                    onChangeText={(x) => setTodo(t.id, { content: x })}
                    editable={editable}
                    style={{ marginBottom: SP.sm }}
                  />
                  <Row style={{ flexWrap: "wrap" }} gap={6}>
                    <Chip
                      label={`負責:${userById(s, t.ownerId)?.name || "—"}`}
                      tone="gray"
                      icon="user"
                      onPress={() => editable && setOwnerFor(t.id)}
                    />
                    <Chip
                      label={t.due ? `期限 ${fmtShortDate(t.due)}` : "無期限"}
                      tone={t.due ? "yellow" : "gray"}
                      icon="calendar"
                    />
                    {editable
                      ? [
                          { l: "今天", d: ymd() },
                          { l: "明天", d: ymd(addDays(new Date(), 1)) },
                          { l: "一週後", d: ymd(addDays(new Date(), 7)) },
                          { l: "清除", d: undefined },
                        ].map((o) => (
                          <Chip
                            key={o.l}
                            label={o.l}
                            tone="teal"
                            selected={false}
                            onPress={() => setTodo(t.id, { due: o.d })}
                          />
                        ))
                      : null}
                  </Row>
                </View>
              </Row>
            </Card>
          ))}
          {editable ? (
            <Button
              title="+新增待辦"
              variant="secondary"
              small
              onPress={() =>
                upd((x) => ({
                  ...x,
                  todos: [
                    ...x.todos,
                    {
                      id: uid("t"),
                      content: "",
                      ownerId: me?.id || v.salesId,
                      keep: true,
                    },
                  ],
                }))
              }
            />
          ) : null}
        </>
      ) : null}

      {tab === "pref" ? (
        <>
          {a.prefs.length === 0 ? (
            <Notice tone="gray" icon="star" text="沒有偵測到偏好與避免事項。" />
          ) : (
            <>
              {pendingPrefs.length ? (
                <Button
                  title={`偵測到 ${a.prefs.length} 項偏好與避免事項,逐張確認`}
                  icon="star"
                  onPress={() => setPrefOpen(true)}
                  style={{ marginBottom: SP.md }}
                />
              ) : null}
              {a.prefs.map((p) => (
                <Card
                  key={p.id}
                  style={{ marginBottom: SP.sm }}
                  tone={p.type === "avoid" ? "danger" : "default"}
                >
                  <Row
                    style={{ justifyContent: "space-between", marginBottom: 4 }}
                  >
                    <Chip
                      label={`${p.type === "avoid" ? "避免事項" : "偏好"}${p.sensitivity === "restricted" ? "(限定)" : ""}`}
                      tone={p.type === "avoid" ? "red" : "teal"}
                    />
                    <Chip
                      label={
                        p.decision === "accepted"
                          ? "已接受"
                          : p.decision === "skipped"
                            ? "已略過"
                            : "待確認"
                      }
                      tone={
                        p.decision === "accepted"
                          ? "teal"
                          : p.decision === "skipped"
                            ? "gray"
                            : "yellow"
                      }
                    />
                  </Row>
                  <Txt weight="600">{p.content}</Txt>
                  {editable && p.decision !== "pending" ? (
                    <Pressable
                      onPress={() =>
                        upd(
                          (x) => ({
                            ...x,
                            prefs: x.prefs.map((y) =>
                              y.id === p.id ? { ...y, decision: "pending" } : y,
                            ),
                          }),
                          false,
                        )
                      }
                      style={{ marginTop: 6 }}
                    >
                      <Txt size={T.small} color={C.teal}>
                        重新確認
                      </Txt>
                    </Pressable>
                  ) : null}
                </Card>
              ))}
              <Txt
                size={T.tiny + 1}
                color={C.text3}
                style={{ marginTop: SP.sm }}
              >
                接受的項目會在入庫時寫入客戶檔案;可全部略過。
              </Txt>
            </>
          )}
        </>
      ) : null}

      {/* 原文 */}
      {source ? (
        <SourceSheet
          visible
          visit={v}
          segmentIds={source.ids}
          title={source.title}
          onClose={() => {
            if (source.factId) markFactViewed(source.factId);
            setSource(null);
          }}
          footer={
            source.uncId && editable ? (
              <Button
                title="已核對,內容無誤"
                onPress={() => {
                  upd(
                    (x) => ({
                      ...x,
                      uncertainties: x.uncertainties.map((u) =>
                        u.id === source.uncId ? { ...u, resolved: true } : u,
                      ),
                    }),
                    false,
                  );
                  setSource(null);
                }}
              />
            ) : source.factId ? (
              <Button
                title="已核對"
                onPress={() => {
                  if (source.factId) markFactViewed(source.factId);
                  setSource(null);
                }}
              />
            ) : undefined
          }
        />
      ) : null}

      {/* 題目編輯 */}
      <Sheet
        visible={!!answerQ && !reasonFor}
        onClose={() => setAnswerQ(null)}
        title={
          answerQ
            ? `${questionById(s, answerQ.questionId)?.code} ${answerQ.required ? "必答" : "選答"}`
            : ""
        }
        footer={
          answerQ && editable ? (
            <>
              <Button
                title="儲存回覆"
                disabled={!answerDraft.trim()}
                onPress={() => {
                  setAnswer(answerQ.questionId, {
                    answer: answerDraft.trim(),
                    status: "answered",
                    reason: undefined,
                  });
                  setAnswerQ(null);
                }}
              />
              <Button
                title="客戶未提供/不適用"
                variant="secondary"
                onPress={() => setReasonFor(answerQ.questionId)}
              />
            </>
          ) : undefined
        }
      >
        {answerQ ? (
          <>
            <Txt size={T.h3} weight="700" style={{ marginBottom: SP.sm }}>
              {questionById(s, answerQ.questionId)?.text}
            </Txt>
            <Row style={{ marginBottom: SP.md }}>
              <Chip
                label={answerStatusLabel(answerQ.status)}
                tone={isHandled(answerQ) ? "teal" : "red"}
              />
              {answerQ.reason ? (
                <Chip label={answerQ.reason} tone="yellow" />
              ) : null}
            </Row>
            <Field
              label="回覆內容(可用鍵盤語音輸入補述)"
              value={answerDraft}
              onChangeText={setAnswerDraft}
              multiline
              editable={editable}
              placeholder="補一段口述或文字"
            />
            {answerQ.sourceSegmentIds.length ? (
              <Button
                title="查看原文"
                variant="ghost"
                small
                icon="folder"
                onPress={() => {
                  const ids = answerQ.sourceSegmentIds;
                  setAnswerQ(null);
                  setSource({ ids, title: "原文" });
                }}
              />
            ) : null}
          </>
        ) : null}
      </Sheet>
      <ReasonSheet
        visible={!!reasonFor}
        onClose={() => setReasonFor(null)}
        onSubmit={(r) => {
          if (reasonFor)
            setAnswer(reasonFor, {
              status: r.status,
              reason: r.reason,
              answer: "",
            });
          setReasonFor(null);
          setAnswerQ(null);
        }}
      />

      <PrefSheet
        visible={prefOpen && pendingPrefs.length > 0}
        onClose={() => setPrefOpen(false)}
        prefs={a.prefs}
        onDecide={(pid, patch) =>
          upd(
            (x) => ({
              ...x,
              prefs: x.prefs.map((p) =>
                p.id === pid ? { ...p, ...patch } : p,
              ),
            }),
            !!patch.content,
          )
        }
      />

      <CustomerPicker
        visible={pickCustomer}
        selectedId={v.customerId}
        onClose={() => setPickCustomer(false)}
        onPick={(cu) => {
          patchVisit(v.id, { customerId: cu.id });
          setPickCustomer(false);
        }}
      />

      <Sheet
        visible={!!ownerFor}
        onClose={() => setOwnerFor(null)}
        title="選擇負責人"
      >
        {salesUsers(s).map((u) => (
          <Pressable
            key={u.id}
            onPress={() => {
              if (ownerFor) setTodo(ownerFor, { ownerId: u.id });
              setOwnerFor(null);
            }}
            style={styles.ownerRow}
          >
            <Icon name="user" size={20} color={C.text2} />
            <Txt style={{ marginLeft: SP.md }}>
              {u.name}({u.team})
            </Txt>
          </Pressable>
        ))}
      </Sheet>
    </Screen>
  );
}

function AnswerRow({
  item,
  onPress,
}: {
  item: AnswerItem;
  onPress: () => void;
}) {
  const s = useAppState();
  const q = questionById(s, item.questionId);
  const handled = isHandled(item);
  const red = (item.required && !handled) || item.status === "uncovered";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.answer,
        red && styles.answerRed,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
        <Txt size={T.small} weight="700" color={red ? "#FF6B66" : C.text2}>
          {q?.code}
          {item.required ? "・必答" : "・選答"}
        </Txt>
        <Chip
          label={
            item.reason
              ? `${answerStatusLabel(item.status)}:${item.reason}`
              : answerStatusLabel(item.status)
          }
          tone={
            item.status === "answered"
              ? "teal"
              : item.status === "partial"
                ? "yellow"
                : item.status === "uncovered"
                  ? item.required
                    ? "red"
                    : "gray"
                  : "yellow"
          }
        />
      </Row>
      <Txt weight="600">{q?.text}</Txt>
      {item.answer ? (
        <Txt size={T.small} color={C.text2} style={{ marginTop: 4 }}>
          {item.answer}
        </Txt>
      ) : red ? (
        <Txt size={T.small} color={C.text3} style={{ marginTop: 4 }}>
          點此補一段口述或文字,或標「客戶未提供/不適用」並選原因
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  answer: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.md,
    padding: SP.md,
    marginBottom: SP.sm,
    backgroundColor: "rgba(9,33,43,0.94)",
  },
  answerRed: { borderColor: C.red, backgroundColor: "rgba(58,18,24,0.55)" },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SP.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.lineSoft,
  },
});
