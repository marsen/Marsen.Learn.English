"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import type { PaperView } from "@/application/exam/paperView";
import type { ReviewQuestion } from "@/application/examSet/reviewView";

type Props = {
  paper: PaperView;
  questions: ReadonlyMap<string, ReviewQuestion>;
  /** 老師正在看的題目（或 "set"＝整套） */
  active: string | null;
  /** 錄音正在講答案的題目 */
  listening: string | null;
  /** 每題有幾則意見（刪掉的不算） */
  counts: ReadonlyMap<string, number>;
  onSelect: (questionId: string) => void;
  onPlay: (questionId: string) => void;
};

function nextIsPunctuation(
  part: PaperView["sections"][number]["rows"][number]["parts"][number] | undefined,
) {
  return part?.kind === "text" && /^[.,;:!?]/.test(part.text);
}

/** 說明文字裡的全大寫片語照雅思格式加粗（跟考試頁一樣） */
function Instruction({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/[A-Z][A-Z/]+(?: [A-Z/]+)*/g)) {
    out.push(text.slice(last, m.index));
    out.push(<b key={m.index}>{m[0]}</b>);
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return <p className="mb-4 italic">{out}</p>;
}

/**
 * 審稿用的考卷：跟學生看到的一樣（ExamPaper），只是空格裡填好標準答案。
 * 點空格＝看這一題的意見；空格前的 ▶＝從答案那句開始聽。
 * data-anchor 給批註欄拉線用。
 */
export function ReviewPaper({
  paper,
  questions,
  active,
  listening,
  counts,
  onSelect,
  onPlay,
}: Props) {
  const t = useTranslations("review");
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface px-5 py-4 leading-loose">
      <h2 data-anchor="set" className="my-3 text-center font-semibold">
        {paper.title}
      </h2>
      {paper.instruction && <Instruction text={paper.instruction} />}
      {paper.sections.map((section, si) => {
        const Group = section.style === "paragraph" ? "p" : "div";
        return (
          <section key={si}>
            {section.title && (
              <h3 className="mt-5 mb-1 font-semibold">{section.title}</h3>
            )}
            <Group>
              {section.rows.map((row, ri) => {
                const Line = section.style === "paragraph" ? "span" : "div";
                return (
                  <Line key={ri} className={section.style === "paragraph" ? "" : "my-2"}>
                    {section.style === "list" && "• "}
                    {!row.inline && row.label && `${row.label}: `}
                    {row.parts.map((part, pi) => {
                      if (part.kind === "text") return <span key={pi}>{part.text} </span>;
                      const q = questions.get(part.questionId);
                      const n = counts.get(part.questionId) ?? 0;
                      const on = active === part.questionId;
                      const hearing = listening === part.questionId;
                      return (
                        <Fragment key={pi}>
                          <span className="whitespace-nowrap">
                            {q?.evidence?.start != null && (
                              <button
                                type="button"
                                onClick={() => onPlay(part.questionId)}
                                aria-label={t("playFrom", { n: part.number })}
                                title={t("playFrom", { n: part.number })}
                                className="mr-0.5 inline-grid h-6 w-6 place-items-center rounded-full text-[0.6rem] text-primary-hover ring-1 ring-border ring-inset hover:bg-primary-soft"
                              >
                                ▶
                              </button>
                            )}
                            <button
                              type="button"
                              data-anchor={part.questionId}
                              onClick={() => onSelect(part.questionId)}
                              aria-pressed={on}
                              className="rounded"
                            >
                              <span
                                className={`mx-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground ${hearing ? "ring-4 ring-primary-soft" : ""}`}
                              >
                                {part.number}
                              </span>
                              <span
                                className={`inline-block min-w-28 border-b sm:min-w-40 border-foreground px-1 text-left leading-normal font-semibold ${on || hearing ? "bg-primary-soft" : "hover:bg-primary-soft"} ${hearing ? "outline-2 outline-primary" : ""}`}
                              >
                                {q?.answer ?? "?"}
                              </span>
                              {n > 0 && (
                                <sup
                                  className="ml-0.5 text-[0.7rem] font-bold text-primary-hover"
                                  aria-label={t("commentCount", { count: n })}
                                >
                                  {n}
                                </sup>
                              )}
                            </button>
                          </span>
                          {/* 空格放在不換行的範圍外面，太窄時才能換行；下一段是標點就不空 */}
                          {nextIsPunctuation(row.parts[pi + 1]) ? "" : " "}
                        </Fragment>
                      );
                    })}
                    {section.style === "paragraph" && " "}
                  </Line>
                );
              })}
            </Group>
          </section>
        );
      })}
    </div>
  );
}
