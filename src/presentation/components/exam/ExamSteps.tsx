"use client";

import { useTranslations } from "next-intl";

/** 完整考卷的分頁：段號，或最後的交卷頁 */
export type ExamPage = number | "submit";

type Props = {
  /** 各段還有幾題沒填（unansweredBySection） */
  left: { section: number; left: number }[];
  page: ExamPage;
  /** 錄音正在播哪一段（只提示，不換頁） */
  playing: number | null;
  onPage: (page: ExamPage) => void;
};

/**
 * 考試頁的步驟條：S1→S2→S3→S4→交卷，每一步標「剩 n 題沒填」或 ✓，♪ 標錄音在哪段。
 * 上面一行寫「正在看 Section n・♪ 錄音在 Section m」，兩個段號寫法不同才不會混淆。
 * 電腦一排；手機收成那一行，點開看全部。
 *
 * 長相照 admin/review/StepBar.tsx（審稿頁），狀態和翻譯不同所以先不共用；同樣子第三次出現再抽共用元件。
 */
export function ExamSteps({ left, page, playing, onPage }: Props) {
  const t = useTranslations("exam.paging");
  const circled = (i: number) => String.fromCodePoint(0x2460 + i);
  const steps: { page: ExamPage; name: string; status: string; done: boolean }[] = [
    ...left.map((s) => ({
      page: s.section,
      name: t("sectionN", { n: s.section }),
      status: s.left > 0 ? t("left", { count: s.left }) : "✓",
      done: s.left === 0,
    })),
    { page: "submit" as const, name: t("submitTitle"), status: "", done: false },
  ];
  const where = [
    page === "submit" ? t("viewingSubmit") : t("viewing", { n: page }),
    playing !== null ? t("audioAt", { n: playing }) : null,
  ]
    .filter(Boolean)
    .join("・");

  const Step = ({
    s,
    i,
    full,
  }: {
    s: (typeof steps)[number];
    i: number;
    full?: boolean;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        // 手機：選了就收起來
        e.currentTarget.closest("details")?.removeAttribute("open");
        onPage(s.page);
      }}
      aria-current={s.page === page ? "step" : undefined}
      data-step={s.page}
      className={`flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 text-left text-xs ring-1 ring-inset ${s.page === page ? "bg-primary-soft font-semibold ring-primary" : "ring-border hover:bg-muted"} ${full ? "w-full" : ""}`}
    >
      <span>{circled(i)}</span>
      <span className="truncate">{s.name}</span>
      {s.status && (
        <span className={s.done ? "text-accent" : "text-muted-foreground"}>
          {s.done ? s.status : `・${s.status}`}
        </span>
      )}
      {playing !== null && s.page === playing && (
        <span className="text-primary-hover" aria-label={t("audioHere")}>
          {" ♪"}
        </span>
      )}
    </button>
  );

  return (
    <nav aria-label={t("steps")} data-exam-steps>
      <div className="hidden gap-1.5 md:grid">
        <p className="text-sm">{where}</p>
        <ol className="flex flex-wrap items-center gap-1.5">
          {steps.map((s, i) => (
            <li key={String(s.page)} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground">›</span>}
              <Step s={s} i={i} />
            </li>
          ))}
        </ol>
      </div>
      <details className="md:hidden">
        <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
          {where}
          {" ▾"}
        </summary>
        <ol className="mt-1 grid gap-1">
          {steps.map((s, i) => (
            <li key={String(s.page)}>
              <Step s={s} i={i} full />
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}
