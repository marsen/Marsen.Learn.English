"use client";

import { useTranslations } from "next-intl";
import type { SectionProgress } from "@/presentation/lib/reviewSections";

/** 目前的分頁：段號，或總結 */
export type ReviewTab = number | "summary";

type Props = {
  progress: SectionProgress[];
  tab: ReviewTab;
  /** 錄音正在播哪一段（只提示，不換分頁） */
  playing: number | null;
  onTab: (tab: ReviewTab) => void;
};

/**
 * 步驟條：S1→S2→S3→S4→總結，每一步標狀態（✓、剩幾項、還沒開始）和正在播哪段。
 * 電腦一排；手機收成一行（例如「② Section 2・剩 3 項 ▾」），點開看全部。
 */
export function StepBar({ progress, tab, playing, onTab }: Props) {
  const t = useTranslations("review.flow");
  const circled = (i: number) => String.fromCodePoint(0x2460 + i);
  const statusText = (p: SectionProgress) =>
    p.status === "done"
      ? "✓"
      : p.status === "inProgress"
        ? t("left", { count: p.pending })
        : t("notStarted");
  const steps: { tab: ReviewTab; name: string; status: string; done: boolean }[] = [
    ...progress.map((p) => ({
      tab: p.section,
      name: t("sectionN", { n: p.section }),
      status: statusText(p),
      done: p.status === "done",
    })),
    {
      tab: "summary" as const,
      name: t("summary"),
      status: progress.every((p) => p.status === "done") ? t("readyToSubmit") : "",
      done: false,
    },
  ];
  const current = steps.findIndex((s) => s.tab === tab);
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
        onTab(s.tab);
      }}
      aria-current={s.tab === tab ? "step" : undefined}
      data-step={s.tab}
      className={`flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 text-left text-xs ring-1 ring-inset ${s.tab === tab ? "bg-primary-soft font-semibold ring-primary" : "ring-border hover:bg-muted"} ${full ? "w-full" : ""}`}
    >
      <span>{circled(i)}</span>
      <span className="truncate">{s.name}</span>
      {s.status && (
        <span className={s.done ? "text-accent" : "text-muted-foreground"}>
          {s.done ? s.status : `・${s.status}`}
        </span>
      )}
      {playing !== null && s.tab === playing && (
        <span className="text-primary-hover" aria-label={t("playingHere")}>
          {` ♪ ${t("playing")}`}
        </span>
      )}
    </button>
  );

  return (
    <nav aria-label={t("steps")} data-step-bar className="mt-2">
      <ol className="hidden flex-wrap items-center gap-1.5 md:flex">
        {steps.map((s, i) => (
          <li key={String(s.tab)} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground">›</span>}
            <Step s={s} i={i} />
          </li>
        ))}
      </ol>
      <details className="md:hidden">
        <summary className="cursor-pointer text-sm font-semibold">
          {circled(current)} {steps[current]?.name}
          {steps[current]?.status &&
            (steps[current].done
              ? ` ${steps[current].status}`
              : `・${steps[current].status}`)}
          {playing !== null && playing !== tab && ` · ♪ ${t("sectionN", { n: playing })}`}
          {" ▾"}
        </summary>
        <ol className="mt-1 grid gap-1">
          {steps.map((s, i) => (
            <li key={String(s.tab)}>
              <Step s={s} i={i} full />
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}
