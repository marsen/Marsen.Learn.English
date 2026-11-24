"use client";

import { useTranslations } from "next-intl";
import type { ChoiceOption, FullPaperView } from "@/application/exam/paperView";
import type { ReviewQuestion } from "@/application/examSet/reviewView";
import { VerdictMark } from "./NoteCard";
import { ReviewPaper } from "./ReviewPaper";

type Props = {
  paper: FullPaperView;
  questions: ReadonlyMap<string, ReviewQuestion>;
  active: string | null;
  verdicts: ReadonlyMap<string, boolean>;
  listening: string | null;
  /** 判 OK 但還沒判完的題 */
  unfinished?: ReadonlySet<string>;
  onSelect: (questionId: string) => void;
  onPlay: (questionId: string) => void;
  /** 一段一段審：只畫這一段 */
  section: number;
};

/**
 * 完整考卷（四個 section）的審稿考卷：每段一個標題；填空沿用 ReviewPaper，
 * 單選、配對列出題目、選項，正確答案標出來。點題目＝看這一題的意見；▶＝從答案那句開始聽。
 */
export function FullReviewPaper(props: Props) {
  const { paper, questions, active, verdicts, listening, unfinished, onSelect, onPlay } =
    props;
  const sections = paper.sections.filter((s) => s.ielts === props.section);
  const t = useTranslations();

  /** 單選、配對的一題：題號、題目、答案字母、判定；data-anchor 給批註欄拉線用 */
  const Question = ({
    questionId,
    number,
    text,
    options,
  }: {
    questionId: string;
    number: number;
    text: string;
    options: ChoiceOption[] | null;
  }) => {
    const q = questions.get(questionId);
    const on = active === questionId;
    const hearing = listening === questionId;
    const verdict = verdicts.get(questionId);
    return (
      <div className="my-3">
        <div className="flex items-start gap-1">
          {q?.evidence?.start != null && (
            <button
              type="button"
              onClick={() => onPlay(questionId)}
              aria-label={t("review.playFrom", { n: number })}
              title={t("review.playFrom", { n: number })}
              className="mt-0.5 inline-grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.6rem] text-primary-hover ring-1 ring-border ring-inset hover:bg-primary-soft"
            >
              ▶
            </button>
          )}
          <button
            type="button"
            data-anchor={questionId}
            onClick={() => onSelect(questionId)}
            aria-pressed={on}
            className={`flex flex-1 items-start gap-1 rounded px-1 text-left ${on || hearing ? "bg-primary-soft" : "hover:bg-primary-soft"} ${hearing ? "outline-2 outline-primary" : ""} ${verdict === false ? "border-b-2 border-destructive" : ""}`}
          >
            <span className="mx-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {number}
            </span>
            <span className="flex-1">{text}</span>
            <span className="font-semibold">
              {t("review.full.answer", { answer: q?.answer ?? "?" })}
            </span>
            <VerdictMark verdict={verdict} unfinished={unfinished?.has(questionId)} />
          </button>
        </div>
        {options && (
          <ul className="ml-14">
            {options.map((o) => (
              <li
                key={o.key}
                className={o.key === q?.answer ? "font-semibold" : undefined}
              >
                {o.key}. {o.text}
                {o.key === q?.answer && ` ✓`}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="grid min-w-0 gap-4">
      {sections.map((section) => (
        <section key={section.ielts} className="grid gap-3">
          <h3 className="font-semibold">
            {t("exam.full.sectionHeading", {
              n: section.ielts,
              a: section.first,
              b: section.last,
            })}
            {section.title && ` · ${section.title}`}
          </h3>
          {section.blocks.map((block, bi) => {
            if (block.kind === "form")
              return (
                <ReviewPaper
                  key={bi}
                  {...props}
                  paper={block.paper}
                  withSetAnchor={false}
                />
              );
            return (
              <div
                key={bi}
                className="min-w-0 rounded-xl border border-border bg-surface px-5 py-4 leading-loose"
              >
                {block.instruction && <p className="mb-2 italic">{block.instruction}</p>}
                {block.kind === "choice" &&
                  block.questions.map((q) => (
                    <Question
                      key={q.questionId}
                      questionId={q.questionId}
                      number={q.number}
                      text={q.stem}
                      options={q.options}
                    />
                  ))}
                {block.kind === "matching" && (
                  <>
                    <ul className="mb-2 rounded-lg border border-border px-4 py-2">
                      {block.options.map((o) => (
                        <li key={o.key}>
                          <b>{o.key}</b> {o.text}
                        </li>
                      ))}
                    </ul>
                    {block.items.map((it) => (
                      <Question
                        key={it.questionId}
                        questionId={it.questionId}
                        number={it.number}
                        text={it.text}
                        options={null}
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
