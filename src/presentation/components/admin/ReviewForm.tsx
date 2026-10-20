"use client";

import { useActionState, useRef } from "react";
import type { ReviewView } from "@/application/examSet/reviewView";
import { timeMark } from "@/domain/examSet/review";
import type { ReviewFormState } from "@/presentation/components/formStates";
import {
  aiRulingLabel,
  answerPolicyLabel,
  answerTypeLabel,
  categoryLabel,
  severityLabel,
  trapLabel,
} from "@/presentation/lib/examSetLabels";

type Props = {
  view: ReviewView;
  audioUrl: string;
  action: (prev: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
};

const box = "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm";

/** 老師審稿：聽錄音、看每一題的答案與 AI 示警，寫建議，判合格／不合格。 */
export function ReviewForm({ view, audioUrl, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, {});
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioNoteRef = useRef<HTMLTextAreaElement>(null);
  const prev = view.review;
  const prevNote = (qid: string) =>
    prev?.questionNotes.find((n) => n.questionId === qid)?.note ?? "";

  const insertTime = () => {
    const el = audioNoteRef.current;
    if (!el) return;
    const mark = `${timeMark(audioRef.current?.currentTime ?? 0)} `;
    const at = el.selectionStart ?? el.value.length;
    el.value = el.value.slice(0, at) + mark + el.value.slice(at);
    el.focus();
    el.selectionStart = el.selectionEnd = at + mark.length;
  };

  return (
    <form action={formAction} className="grid gap-8">
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">錄音</h2>
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={audioUrl}
          className="w-full"
        />
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="audioNote" className="text-sm font-medium">
              錄音建議（選填）
            </label>
            <button
              type="button"
              onClick={insertTime}
              className="rounded border border-border px-2 py-1 text-xs"
            >
              插入目前時間
            </button>
          </div>
          <textarea
            id="audioNote"
            name="audioNote"
            ref={audioNoteRef}
            rows={3}
            defaultValue={prev?.audioNote ?? ""}
            placeholder="例如：[01:23] 這句講太快，聽不清楚門牌號碼"
            className={box}
          />
        </div>
      </section>

      {view.warnings.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">AI 提出的疑慮</h2>
          <ul className="grid gap-2 text-sm">
            {view.warnings.map((w) => (
              <li key={w.id} className="rounded-lg bg-card px-4 py-3">
                {w.questionId && <span className="mr-2 font-mono">{w.questionId}</span>}
                {w.message}
                {w.aiRuling && (
                  <span className="ml-2 text-muted-foreground">
                    （{aiRulingLabel(w.aiRuling)}）
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.findings.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">AI 審稿的其他發現</h2>
          <ul className="grid gap-2 text-sm">
            {view.findings.map((f, i) => {
              const n = view.questions.findIndex((q) => q.questionId === f.questionId);
              return (
                <li key={i} className="rounded-lg bg-card px-4 py-3">
                  <div className="mb-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{n >= 0 ? `第 ${n + 1} 題` : "整套"}</span>
                    <span>· {severityLabel(f.severity)}</span>
                    {f.category && <span>· {categoryLabel(f.category)}</span>}
                  </div>
                  <p>{f.message}</p>
                  {f.suggestion && (
                    <p className="mt-1 text-muted-foreground">建議：{f.suggestion}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">每一題</h2>
        {view.instruction && (
          <p className="text-sm italic text-muted-foreground">{view.instruction}</p>
        )}
        <ol className="grid gap-4">
          {view.questions.map((q, i) => (
            <li
              key={q.questionId}
              className="rounded-xl border border-border bg-white p-4"
            >
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-semibold">第 {i + 1} 題</span>
                <span className="text-sm text-muted-foreground">
                  {[q.section, q.label].filter(Boolean).join(" › ")}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">標準答案</dt>
                <dd className="font-medium">{q.answer}</dd>
                <dt className="text-muted-foreground">也算對的寫法</dt>
                <dd>{q.accepted.length > 0 ? q.accepted.join("、") : "（沒有）"}</dd>
                <dt className="text-muted-foreground">答案類型</dt>
                <dd>{answerTypeLabel(q.answerType)}</dd>
                <dt className="text-muted-foreground">答案規則</dt>
                <dd>{answerPolicyLabel(q.answerPolicy)}</dd>
                <dt className="text-muted-foreground">干擾陷阱</dt>
                <dd>
                  {trapLabel(q.trap)}
                  {q.wrongValue && `（錄音先出現的錯誤答案：${q.wrongValue}）`}
                </dd>
                {q.note && (
                  <>
                    <dt className="text-muted-foreground">出題說明</dt>
                    <dd>{q.note}</dd>
                  </>
                )}
              </dl>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">這題的建議（選填）</span>
                <textarea
                  name={`note:${q.questionId}`}
                  rows={2}
                  defaultValue={prevNote(q.questionId)}
                  className={box}
                />
              </label>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-white p-4">
        <h2 className="text-lg font-semibold">判定</h2>
        <div className="flex gap-6">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decision"
              value="approved"
              defaultChecked={prev?.decision === "approved"}
            />
            合格
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decision"
              value="rejected"
              defaultChecked={prev?.decision === "rejected"}
            />
            不合格
          </label>
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-medium">整體意見（選填）</span>
          <textarea
            name="comment"
            rows={3}
            defaultValue={prev?.comment ?? ""}
            className={box}
          />
        </label>
        {state.problems && state.problems.length > 0 && (
          <ul className="list-disc rounded-lg bg-destructive/10 py-3 pr-4 pl-8 text-sm text-destructive">
            {state.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {state.saved && (
          <p className="rounded-lg bg-card px-4 py-3 text-sm">已儲存審稿。</p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="justify-self-start rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground disabled:opacity-60"
        >
          {isPending ? "儲存中…" : prev ? "更新審稿" : "送出審稿"}
        </button>
      </section>
    </form>
  );
}
