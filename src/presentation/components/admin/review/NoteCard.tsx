"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import type { AiNote, ReviewQuestion } from "@/application/examSet/reviewView";
import { Button } from "@/presentation/components/ui/Button";
import { examSetLabel } from "@/presentation/lib/examSetLabels";
import { clock } from "@/presentation/lib/reviewTime";
import { aiSeverity, chipSummary, type Severity } from "@/presentation/lib/reviewNotes";
import { TimeButton, TimeText } from "./TimeText";

/** 老師的意見（畫面上的草稿；key 只給 React 用） */
export type DraftNote = { key: string; target: string | null; text: string };

/** 老師對 AI 意見的處理；沒有就是保留 */
export type DraftAiAction = { action: "edited" | "deleted"; text: string };

/** 正在編輯什麼：老師的意見、新增意見、改寫 AI 意見、刪除 AI 意見（填原因） */
export type Editing =
  | { kind: "note"; key: string }
  | { kind: "new"; target: string }
  | { kind: "aiEdit"; ref: string }
  | { kind: "aiDelete"; ref: string };

type Props = {
  /** 題號，或 "set"＝整套／錄音 */
  target: string;
  question: ReviewQuestion | null;
  aiNotes: AiNote[];
  aiActions: ReadonlyMap<string, DraftAiAction>;
  notes: DraftNote[];
  active: boolean;
  editing: Editing | null;
  /** 打開的意見框有沒存的字，老師又想做別的事：在框下面提醒 */
  warnUnsaved: boolean;
  setEditing: (e: Editing | null) => void;
  /** key 是 null＝新增 */
  onSaveNote: (key: string | null, target: string, text: string) => void;
  onRemoveNote: (key: string) => void;
  /** text 是 null＝改回 AI 原文 */
  onAiEdit: (ref: string, text: string | null) => void;
  onAiDelete: (ref: string, reason: string) => void;
  onAiRestore: (ref: string) => void;
  /** 點小標籤：展開這一張 */
  onSelect: () => void;
  /** 按 ✕：收起來 */
  onCollapse: () => void;
  currentTime: () => number;
  turnStarts: ReadonlyMap<string, number>;
  onSeek: (seconds: number) => void;
};

/** 嚴重程度的顏色：提醒灰、注意橘、嚴重紅（小標籤的圓點、意見左邊的色條） */
const DOT: Record<Severity, string> = {
  info: "bg-muted-foreground/40",
  warn: "bg-primary",
  block: "bg-destructive",
};
const BAR: Record<Severity, string> = {
  info: "border-muted-foreground/40",
  warn: "border-primary",
  block: "border-destructive",
};

/**
 * 批註卡：一題（或整套）的 AI 意見與老師的意見。
 * 沒在看的時候縮成一個小標籤（幾則 AI、幾則老師，圓點顏色＝最嚴重的 AI 意見），點了才展開。
 */
export function NoteCard(p: Props) {
  const t = useTranslations();
  const r = (key: string, values?: Record<string, string | number>) =>
    t(`review.${key}`, values);
  const label = (kind: Parameters<typeof examSetLabel>[1], v: string | null) =>
    examSetLabel(t, kind, v);
  const q = p.question;
  const isNew = p.editing?.kind === "new" && p.editing.target === p.target;
  const time = (text: string) => (
    <TimeText text={text} turnStarts={p.turnStarts} onSeek={p.onSeek} />
  );
  const name = q ? r("questionN", { n: q.number }) : r("wholeSet");
  const severityOf = (n: AiNote) => aiSeverity(n);
  const isDeleted = (n: AiNote) => p.aiActions.get(n.ref)?.action === "deleted";

  if (!p.active) {
    const sum = chipSummary(
      p.aiNotes.map((n) => ({ severity: severityOf(n), deleted: isDeleted(n) })),
      p.notes.length,
    );
    const parts = [
      sum.ai > 0 && r("chipAi", { count: sum.ai }),
      sum.teacher > 0 && r("chipTeacher", { count: sum.teacher }),
      sum.deleted > 0 && r("chipDeleted", { count: sum.deleted }),
    ].filter(Boolean);
    // 滑鼠移上去先瞄第一則
    const firstAi = p.aiNotes.find((n) => !isDeleted(n));
    const firstText = firstAi
      ? (p.aiActions.get(firstAi.ref)?.text ?? firstAi.message)
      : p.notes[0]?.text;
    return (
      <button
        type="button"
        onClick={p.onSelect}
        title={firstText ? firstText.slice(0, 80) : undefined}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-0.5 text-[0.8125rem] whitespace-nowrap text-muted-foreground hover:border-primary"
      >
        <b className="text-heading">{name}</b>
        {sum.worst && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[sum.worst]}`} />
        )}
        <span>{parts.length > 0 ? parts.join(" · ") : r("noComments")}</span>
      </button>
    );
  }

  return (
    <div className="grid gap-2 rounded-xl border border-primary bg-surface p-3 text-sm leading-relaxed ring-3 ring-primary-soft">
      <div className="flex items-center gap-2">
        <b className="text-heading">{name}</b>
        {!q && (
          <span title={r("wholeSetHint")} className="cursor-help text-muted-foreground">
            ⓘ
          </span>
        )}
        <button
          type="button"
          onClick={p.onCollapse}
          aria-label={r("close")}
          title={r("close")}
          className="ml-auto grid h-7 w-7 place-items-center rounded-full text-xs text-muted-foreground ring-1 ring-border ring-inset hover:bg-muted"
        >
          ✕
        </button>
      </div>
      {q && (
        <>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              {r("answerDetails")}
            </summary>
            <dl className="mt-1 grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-0.5">
              <dt className="text-muted-foreground">{r("accepted")}</dt>
              <dd>
                {q.accepted.length > 0
                  ? q.accepted.join(t("common.listSeparator"))
                  : t("common.none")}
              </dd>
              <dt className="text-muted-foreground">{r("trap")}</dt>
              <dd>
                {label("trap", q.trap)}
                {q.wrongValue && ` ${r("wrongValue", { value: q.wrongValue })}`}
              </dd>
              <dt className="text-muted-foreground">{r("answerPolicy")}</dt>
              <dd>{label("answerPolicy", q.answerPolicy)}</dd>
              <dt className="text-muted-foreground">{r("answerType")}</dt>
              <dd>{label("answerType", q.answerType)}</dd>
              {q.note && (
                <>
                  <dt className="text-muted-foreground">{r("note")}</dt>
                  <dd>{q.note}</dd>
                </>
              )}
              {q.evidence && (
                <>
                  <dt className="text-muted-foreground">{r("evidence")}</dt>
                  <dd>
                    {q.evidence.start !== null && (
                      <TimeButton seconds={q.evidence.start} onSeek={p.onSeek}>
                        {q.evidence.turn} {clock(q.evidence.start)}
                      </TimeButton>
                    )}{" "}
                    {q.evidence.quote}
                  </dd>
                </>
              )}
            </dl>
          </details>
        </>
      )}

      {p.aiNotes.map((n) => {
        const a = p.aiActions.get(n.ref);
        const deleted = a?.action === "deleted";
        const edited = a?.action === "edited";
        const severity = severityOf(n);
        if (p.editing?.kind === "aiEdit" && p.editing.ref === n.ref)
          return (
            <Editor
              warn={p.warnUnsaved}
              key={n.ref}
              initial={edited ? a.text : n.message}
              placeholder={r("commentPlaceholder")}
              withTime
              currentTime={p.currentTime}
              onCancel={() => p.setEditing(null)}
              onSave={(text) => p.onAiEdit(n.ref, text === n.message ? null : text)}
            />
          );
        return (
          <div
            key={n.ref}
            className={`grid gap-1 rounded-lg border-l-3 px-3 py-2 ${BAR[severity]} ${deleted ? "bg-muted text-muted-foreground" : "bg-card"}`}
          >
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="font-bold text-primary-hover">
                {r("aiSeverity", { severity: label("severity", severity) })}
              </span>
              {edited && (
                <span className="rounded bg-muted px-1.5">{r("editedTag")}</span>
              )}
              {deleted && (
                <span className="rounded bg-surface px-1.5">{r("deletedTag")}</span>
              )}
            </div>
            <p className={deleted ? "line-through" : ""}>
              {time(edited ? a.text : n.message)}
            </p>
            {n.suggestion && !edited && (
              <p className="text-xs text-muted-foreground">
                {r("suggestion", { text: "" })}
                {time(n.suggestion)}
              </p>
            )}
            {edited && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer text-primary-hover">
                  {r("showAiOriginal")}
                </summary>
                {time(n.message)}
                {n.suggestion && (
                  <>
                    {" "}
                    {r("suggestion", { text: "" })}
                    {time(n.suggestion)}
                  </>
                )}
              </details>
            )}
            {deleted && a.text && (
              <p className="border-t border-dashed border-border pt-1 text-xs">
                {r("deleteReason", { text: a.text })}
              </p>
            )}
            {p.editing?.kind === "aiDelete" && p.editing.ref === n.ref ? (
              <Editor
                warn={p.warnUnsaved}
                initial=""
                placeholder={r("deleteReasonPlaceholder")}
                saveLabel={r("delete")}
                danger
                allowEmpty
                currentTime={p.currentTime}
                onCancel={() => p.setEditing(null)}
                onSave={(text) => p.onAiDelete(n.ref, text)}
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {deleted ? (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => p.onAiRestore(n.ref)}
                  >
                    {r("restore")}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => p.setEditing({ kind: "aiEdit", ref: n.ref })}
                    >
                      {r("edit")}
                    </Button>
                    {edited && (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => p.onAiEdit(n.ref, null)}
                      >
                        {r("revertToAi")}
                      </Button>
                    )}
                    <Button
                      variant="dangerSecondary"
                      size="xs"
                      onClick={() => p.setEditing({ kind: "aiDelete", ref: n.ref })}
                    >
                      {r("delete")}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {p.notes.map((n) =>
        p.editing?.kind === "note" && p.editing.key === n.key ? (
          <Editor
            warn={p.warnUnsaved}
            key={n.key}
            initial={n.text}
            placeholder={r("commentPlaceholder")}
            withTime
            currentTime={p.currentTime}
            onCancel={() => p.setEditing(null)}
            onSave={(text) => p.onSaveNote(n.key, p.target, text)}
          />
        ) : (
          <div
            key={n.key}
            className="grid gap-1 rounded-lg border-l-3 border-accent bg-accent-soft px-3 py-2"
          >
            <span className="text-xs font-bold text-accent">{r("byTeacher")}</span>
            <p className="whitespace-pre-wrap">{time(n.text)}</p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => p.setEditing({ kind: "note", key: n.key })}
              >
                {r("edit")}
              </Button>
              <Button
                variant="dangerSecondary"
                size="xs"
                onClick={() => p.onRemoveNote(n.key)}
              >
                {r("delete")}
              </Button>
            </div>
          </div>
        ),
      )}

      {p.aiNotes.length === 0 && p.notes.length === 0 && !isNew && (
        <p className="text-xs text-muted-foreground">{r("noComments")}</p>
      )}

      {isNew ? (
        <Editor
          warn={p.warnUnsaved}
          initial=""
          placeholder={r("commentPlaceholder")}
          withTime
          currentTime={p.currentTime}
          onCancel={() => p.setEditing(null)}
          onSave={(text) => p.onSaveNote(null, p.target, text)}
        />
      ) : (
        <div>
          <button
            type="button"
            onClick={() => p.setEditing({ kind: "new", target: p.target })}
            className="text-sm text-primary underline"
          >
            {r("addComment")}
          </button>
        </div>
      )}
    </div>
  );
}

/** 寫意見的小框：可以插入錄音目前的時間 */
function Editor({
  initial,
  placeholder,
  onSave,
  onCancel,
  currentTime,
  withTime = false,
  saveLabel,
  danger = false,
  allowEmpty = false,
  warn = false,
}: {
  initial: string;
  placeholder: string;
  onSave: (text: string) => void;
  onCancel: () => void;
  currentTime: () => number;
  withTime?: boolean;
  saveLabel?: string;
  danger?: boolean;
  allowEmpty?: boolean;
  warn?: boolean;
}) {
  const t = useTranslations("review");
  const ref = useRef<HTMLTextAreaElement>(null);
  const insertTime = () => {
    const el = ref.current;
    if (!el) return;
    const mark = `${clock(currentTime())} `;
    const at = el.selectionStart ?? el.value.length;
    el.value = el.value.slice(0, at) + mark + el.value.slice(at);
    el.focus();
    el.selectionStart = el.selectionEnd = at + mark.length;
  };
  const save = () => {
    const text = (ref.current?.value ?? "").trim();
    if (text || allowEmpty) onSave(text);
    else onCancel();
  };
  return (
    <div data-editing className="grid gap-1.5">
      <textarea
        ref={ref}
        rows={3}
        autoFocus
        defaultValue={initial}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
      />
      {warn && (
        <p role="alert" className="text-xs text-destructive">
          {t("unsavedComment")}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {withTime && (
          <Button variant="secondary" size="xs" onClick={insertTime}>
            {t("insertTime")}
          </Button>
        )}
        <Button variant={danger ? "danger" : "primary"} size="xs" onClick={save}>
          {saveLabel ?? t("ok")}
        </Button>
        <Button variant="secondary" size="xs" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
