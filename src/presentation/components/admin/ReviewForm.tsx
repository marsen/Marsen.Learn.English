"use client";

import { useActionState, useRef } from "react";
import type { ReviewView } from "@/application/examSet/reviewView";
import { timeMark } from "@/domain/examSet/review";
import type { ReviewFormState } from "@/presentation/components/formStates";
import { Alert } from "@/presentation/components/ui/Alert";
import { Button } from "@/presentation/components/ui/Button";
import { reviewErrorText } from "@/presentation/lib/errorMessages";
import { useTranslations } from "next-intl";
import { examSetLabel } from "@/presentation/lib/examSetLabels";

type Props = {
  view: ReviewView;
  audioUrl: string;
  action: (prev: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
};

const box = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm";

/** 老師審稿：聽錄音、看每一題的答案與 AI 示警，寫建議，判合格／不合格。 */
export function ReviewForm({ view, audioUrl, action }: Props) {
  const t = useTranslations();
  const r = (key: string, values?: Record<string, string | number>) =>
    t(`review.${key}`, values);
  const label = (kind: Parameters<typeof examSetLabel>[1], v: string | null) =>
    examSetLabel(t, kind, v);
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
        <h2 className="text-lg font-semibold">{r("audio")}</h2>
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
              {r("audioNote")}
            </label>
            <Button variant="secondary" size="sm" onClick={insertTime}>
              {r("insertTime")}
            </Button>
          </div>
          <textarea
            id="audioNote"
            name="audioNote"
            ref={audioNoteRef}
            rows={3}
            defaultValue={prev?.audioNote ?? ""}
            placeholder={r("audioNotePlaceholder")}
            className={box}
          />
        </div>
      </section>

      {view.warnings.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{r("aiWarnings")}</h2>
          <ul className="grid gap-2 text-sm">
            {view.warnings.map((w) => (
              <li key={w.id} className="rounded-lg bg-card px-4 py-3">
                {w.questionId && <span className="mr-2 font-mono">{w.questionId}</span>}
                {w.message}
                {w.aiRuling && (
                  <span className="ml-2 text-muted-foreground">
                    {t("common.parenthesized", { text: label("aiRuling", w.aiRuling) })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.findings.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{r("aiFindings")}</h2>
          <ul className="grid gap-2 text-sm">
            {view.findings.map((f, i) => {
              const n = view.questions.findIndex((q) => q.questionId === f.questionId);
              return (
                <li key={i} className="rounded-lg bg-card px-4 py-3">
                  <div className="mb-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{n >= 0 ? r("questionN", { n: n + 1 }) : r("wholeSet")}</span>
                    <span>· {label("severity", f.severity)}</span>
                    {f.category && <span>· {label("category", f.category)}</span>}
                  </div>
                  <p>{f.message}</p>
                  {f.suggestion && (
                    <p className="mt-1 text-muted-foreground">
                      {r("suggestion", { text: f.suggestion })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">{r("questions")}</h2>
        {view.instruction && (
          <p className="text-sm italic text-muted-foreground">{view.instruction}</p>
        )}
        <ol className="grid gap-4">
          {view.questions.map((q, i) => (
            <li
              key={q.questionId}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-semibold">{r("questionN", { n: i + 1 })}</span>
                <span className="text-sm text-muted-foreground">
                  {[q.section, q.label].filter(Boolean).join(" › ")}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{r("answer")}</dt>
                <dd className="font-medium">{q.answer}</dd>
                <dt className="text-muted-foreground">{r("accepted")}</dt>
                <dd>
                  {q.accepted.length > 0
                    ? q.accepted.join(t("common.listSeparator"))
                    : t("common.none")}
                </dd>
                <dt className="text-muted-foreground">{r("answerType")}</dt>
                <dd>{label("answerType", q.answerType)}</dd>
                <dt className="text-muted-foreground">{r("answerPolicy")}</dt>
                <dd>{label("answerPolicy", q.answerPolicy)}</dd>
                <dt className="text-muted-foreground">{r("trap")}</dt>
                <dd>
                  {label("trap", q.trap)}
                  {q.wrongValue && ` ${r("wrongValue", { value: q.wrongValue })}`}
                </dd>
                {q.note && (
                  <>
                    <dt className="text-muted-foreground">{r("note")}</dt>
                    <dd>{q.note}</dd>
                  </>
                )}
              </dl>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">{r("questionNote")}</span>
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

      <section className="grid gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">{r("decision")}</h2>
        <div className="flex gap-6">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decision"
              value="approved"
              defaultChecked={prev?.decision === "approved"}
            />
            {r("approved")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decision"
              value="rejected"
              defaultChecked={prev?.decision === "rejected"}
            />
            {r("rejected")}
          </label>
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-medium">{r("comment")}</span>
          <textarea
            name="comment"
            rows={3}
            defaultValue={prev?.comment ?? ""}
            className={box}
          />
        </label>
        {state.problems && state.problems.length > 0 && (
          <Alert tone="error" items={state.problems.map((p) => reviewErrorText(t, p))} />
        )}
        {state.saved && <Alert>{r("saved")}</Alert>}
        <Button type="submit" disabled={isPending} className="justify-self-start">
          {isPending ? t("common.saving") : prev ? r("update") : r("submit")}
        </Button>
      </section>
    </form>
  );
}
