"use client";

import { useTranslations } from "next-intl";
import type { SectionProgress } from "@/presentation/lib/reviewSections";

/** 還沒處理的 AI 意見（總結頁提醒用）：所屬段、題號（整段／整套是 null） */
export type OpenAiNote = {
  ref: string;
  section: number | null;
  questionId: string | null;
  number: number | null;
  message: string;
};

type Props = {
  progress: SectionProgress[];
  openAi: OpenAiNote[];
  onSection: (section: number) => void;
  onNote: (note: OpenAiNote) => void;
};

/**
 * 總結分頁的上半：四段進度並排（點了回那段）、還沒處理的 AI 意見（提醒，不擋送出）。
 * 整套的判定和整套 AI 意見是旁邊的「整套」批註卡；總評、合格／不合格、送出在下面。
 */
export function ReviewSummaryTab({ progress, openAi, onSection, onNote }: Props) {
  const t = useTranslations("review");
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4" data-review-summary>
      <h2 data-anchor="set" className="font-semibold">
        {t("flow.summaryHeading")}
      </h2>
      <ol className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {progress.map((p) => (
          <li key={p.section}>
            <button
              type="button"
              onClick={() => onSection(p.section)}
              className="grid w-full gap-0.5 rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <b>
                {t("flow.sectionN", { n: p.section })}{" "}
                {p.status === "done" ? (
                  <span className="text-accent">✓</span>
                ) : (
                  <span className="font-normal text-muted-foreground">
                    {p.status === "notStarted"
                      ? t("flow.notStarted")
                      : p.pending === 0
                        ? t("flow.awaitingDone")
                        : t("flow.left", { count: p.pending })}
                  </span>
                )}
              </b>
              <span className="text-xs text-muted-foreground">
                {[
                  t("summaryOk", { count: p.ok }),
                  t("summaryBad", { count: p.bad }),
                ].join(t("summaryJoin"))}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {openAi.length > 0 ? (
        <section className="grid min-w-0 grid-cols-1 gap-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <h3 className="font-semibold">
            {t("flow.openAiTitle", { count: openAi.length })}
          </h3>
          <p className="text-xs text-muted-foreground">{t("flow.openAiNote")}</p>
          <ul className="grid min-w-0 grid-cols-1 gap-1">
            {openAi.map((n) => (
              <li key={n.ref}>
                <button
                  type="button"
                  onClick={() => onNote(n)}
                  className="block w-full truncate text-left hover:underline"
                >
                  <span className="mr-1 text-muted-foreground">
                    {n.section === null
                      ? t("wholeSet")
                      : n.number === null
                        ? t("flow.wholeSection", { n: n.section })
                        : `${t("flow.sectionN", { n: n.section })} · ${t("questionN", { n: n.number })}`}
                  </span>
                  {n.message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">{t("flow.noOpenAi")}</p>
      )}
    </div>
  );
}
