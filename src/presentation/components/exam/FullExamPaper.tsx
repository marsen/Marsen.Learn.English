"use client";

import { useTranslations } from "next-intl";
import type { FullPaperView } from "@/application/exam/paperView";
import { ExamPaper } from "./ExamPaper";

type Props = {
  paper: FullPaperView;
  answers: Record<string, string>;
  onChange: (questionId: string, value: string) => void;
  disabled: boolean;
  /** 看題時間要看的題號範圍（全卷題號），這些題目會標黃 */
  highlight: [number, number] | null;
};

/** 題號圓圈（和填空題同一個樣子） */
function Num({ n }: { n: number }) {
  return (
    <span className="mr-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {n}
    </span>
  );
}

/**
 * 完整考卷（四個 section）：每段一個標題，段內依區塊畫——
 * 填空沿用 2.x 的答題卷、單選用 A/B/C 單選鈕、配對用選項字母的下拉選單。
 */
export function FullExamPaper({ paper, answers, onChange, disabled, highlight }: Props) {
  const t = useTranslations("exam.full");
  const lit = (n: number) => highlight !== null && n >= highlight[0] && n <= highlight[1];

  return (
    <div className="grid gap-6">
      {paper.sections.map((section) => (
        <section key={section.ielts} className="grid gap-3">
          <h2 className="font-semibold">
            {t("sectionHeading", {
              n: section.ielts,
              a: section.first,
              b: section.last,
            })}
          </h2>
          {section.blocks.map((block, bi) => {
            if (block.kind === "form")
              return (
                <ExamPaper
                  key={bi}
                  paper={block.paper}
                  answers={answers}
                  onChange={onChange}
                  disabled={disabled}
                  highlight={highlight}
                />
              );
            if (block.kind === "choice")
              return (
                <div
                  key={bi}
                  className="rounded-xl border border-border bg-surface px-5 py-4 leading-loose"
                >
                  {block.instruction && (
                    <p className="mb-3 italic">{block.instruction}</p>
                  )}
                  {block.questions.map((q) => (
                    <fieldset
                      key={q.questionId}
                      className={`my-3 rounded-lg px-2 ${lit(q.number) ? "bg-yellow-100" : ""}`}
                    >
                      <legend className="flex items-center">
                        <Num n={q.number} />
                        {q.stem}
                      </legend>
                      {q.options.map((o) => (
                        <label key={o.key} className="ml-8 flex items-center gap-2">
                          <input
                            type="radio"
                            name={q.questionId}
                            value={o.key}
                            disabled={disabled}
                            checked={answers[q.questionId] === o.key}
                            onChange={() => onChange(q.questionId, o.key)}
                          />
                          <b>{o.key}</b> {o.text}
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
              );
            return (
              <div
                key={bi}
                className="rounded-xl border border-border bg-surface px-5 py-4 leading-loose"
              >
                {block.instruction && <p className="mb-3 italic">{block.instruction}</p>}
                <ul className="mb-3 rounded-lg border border-border px-4 py-2">
                  {block.options.map((o) => (
                    <li key={o.key}>
                      <b>{o.key}</b> {o.text}
                    </li>
                  ))}
                </ul>
                {block.items.map((it) => (
                  <label
                    key={it.questionId}
                    className={`my-2 flex items-center gap-2 rounded-lg px-2 ${lit(it.number) ? "bg-yellow-100" : ""}`}
                  >
                    <Num n={it.number} />
                    <span className="flex-1">{it.text}</span>
                    <select
                      aria-label={t("matchingLabel", { n: it.number })}
                      disabled={disabled}
                      value={answers[it.questionId] ?? ""}
                      onChange={(e) => onChange(it.questionId, e.target.value)}
                      className="rounded border border-border bg-background px-2 py-1"
                    >
                      <option value="">{t("choose")}</option>
                      {block.options.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.key}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
