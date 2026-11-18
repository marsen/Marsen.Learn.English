"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/presentation/components/ui/Button";
import type { Missing, SectionProgress } from "@/presentation/lib/reviewSections";

type Props = {
  progress: SectionProgress;
  /** 這段還沒判過的題目：題號、題目代號、缺什麼 */
  missing: { questionId: string; number: number; missing: Missing[] }[];
  /** 前一段還沒完成（完成要照順序）；null＝不用等 */
  waitFor: number | null;
  /** 有下一段就是段號，最後一段是 null（下一步是總結） */
  next: number | null;
  onComplete: () => void;
  onJump: (questionId: string) => void;
};

/**
 * 每段底部：「這段完成，前往下一段」。這段每題都判過、前一段已完成才按得下；
 * 按不下去時逐題列出缺什麼，點了跳到那題。
 */
export function SectionFooter(p: Props) {
  const t = useTranslations("review.flow");
  const n = p.progress.section;
  const done = p.progress.status === "done";
  const ready = p.missing.length === 0 && p.waitFor === null;
  const why = (m: Missing) =>
    m.kind === "unjudged"
      ? t("missingUnjudged")
      : m.kind === "aiOpen"
        ? t("missingAi", { count: m.count })
        : t("missingConfirm");
  return (
    <section
      data-section-footer={n}
      className="grid gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={!ready} onClick={p.onComplete}>
          {done
            ? p.next === null
              ? t("goSummary")
              : t("goNext", { n: p.next })
            : p.next === null
              ? t("completeToSummary", { n })
              : t("complete", { n, next: p.next })}
        </Button>
        {done && (
          <span className="font-semibold text-accent">✓ {t("sectionDone", { n })}</span>
        )}
        {p.waitFor !== null && (
          <span className="text-muted-foreground">{t("waitFor", { n: p.waitFor })}</span>
        )}
      </div>
      {p.missing.length > 0 && (
        <ul className="grid gap-1" data-missing>
          {p.missing.map((m) => (
            <li key={m.questionId}>
              <button
                type="button"
                onClick={() => p.onJump(m.questionId)}
                className="text-left text-primary-hover underline"
              >
                {t("missingLine", {
                  n: m.number,
                  what: m.missing.map(why).join(t("missingJoin")),
                })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
