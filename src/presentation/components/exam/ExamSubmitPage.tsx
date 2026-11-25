"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/presentation/components/ui/Button";

type Props = {
  /** 各段還有幾題沒填（unansweredBySection） */
  left: { section: number; left: number }[];
  /** 交卷中、或已不在作答時鎖住 */
  disabled: boolean;
  submitting: boolean;
  onGo: (section: number) => void;
  onHandIn: () => void;
};

/**
 * 完整考卷的交卷頁：列各段還有幾題沒填、可以回到那一段；按「交卷」先在頁面上展開確認，
 * 再列一次各段未填，按「確定交卷」才送出。打開確認時焦點放在「再檢查」。
 */
export function ExamSubmitPage({ left, disabled, submitting, onGo, onHandIn }: Props) {
  const t = useTranslations("exam");
  const [confirming, setConfirming] = useState(false);
  const total = left.reduce((n, s) => n + s.left, 0);

  const list = (
    <ul className="grid gap-2">
      {left.map((s) => (
        <li key={s.section} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            {s.left > 0
              ? t("paging.sectionLeft", { n: s.section, count: s.left })
              : t("paging.sectionDone", { n: s.section })}
          </span>
          <Button
            variant="secondary"
            size="xs"
            disabled={disabled}
            onClick={() => onGo(s.section)}
          >
            {t("paging.backTo", { n: s.section })}
          </Button>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="grid gap-4 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-semibold">{t("paging.submitTitle")}</h2>
      {list}
      {!confirming && (
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => setConfirming(true)}
          className="justify-self-start"
        >
          {t("submit")}
        </Button>
      )}
      {confirming && (
        <div
          role="alertdialog"
          aria-labelledby="exam-confirm-title"
          className="grid gap-3 rounded-lg border border-border bg-background p-4"
        >
          <p id="exam-confirm-title" className="font-semibold">
            {total > 0
              ? t("confirmSubmitUnanswered", { count: total })
              : t("confirmSubmit")}
          </p>
          {total > 0 && list}
          <p className="text-sm text-muted-foreground">{t("paging.confirmHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              // 打開確認時焦點在「再檢查」，不是「確定交卷」
              autoFocus
              variant="secondary"
              disabled={submitting}
              onClick={() => setConfirming(false)}
            >
              {t("paging.recheck")}
            </Button>
            <Button disabled={disabled} onClick={onHandIn}>
              {submitting ? t("submitting") : t("paging.confirmSubmit")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
