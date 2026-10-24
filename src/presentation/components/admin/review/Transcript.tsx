"use client";

import { useTranslations } from "next-intl";
import type { ReviewTurn } from "@/application/examSet/reviewView";
import { clock } from "@/presentation/lib/reviewTime";
import { TimeButton } from "./TimeText";

/** 逐字稿：點時間跳過去聽，正在播的那句會亮起來 */
export function Transcript({
  turns,
  current,
  onSeek,
}: {
  turns: ReviewTurn[];
  current: string | null;
  onSeek: (seconds: number) => void;
}) {
  const t = useTranslations("review");
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">{t("transcript")}</h2>
      <p className="text-sm text-muted-foreground">{t("transcriptHint")}</p>
      <ol className="mt-2 grid max-h-96 gap-1 overflow-auto text-sm leading-relaxed">
        {turns.map((x) => (
          <li
            key={x.id}
            className={`grid grid-cols-[4rem_2.5rem_1fr] gap-2 rounded px-1.5 py-0.5 ${current === x.id ? "bg-primary-soft" : ""}`}
          >
            <span>
              {x.start !== null && (
                <TimeButton seconds={x.start} onSeek={onSeek}>
                  {clock(x.start)}
                </TimeButton>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {x.id} {x.speaker}
            </span>
            <span className="min-w-0">{x.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
