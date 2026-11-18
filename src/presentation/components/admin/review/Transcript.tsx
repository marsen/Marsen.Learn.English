"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { ReviewTurn } from "@/application/examSet/reviewView";
import { clock } from "@/presentation/lib/reviewTime";
import { TimeButton, type Seek } from "./TimeText";

/** 從意見點過來要看的那一句；n 每點一次加一，同一句再點也會再捲一次 */
export type TranscriptFocus = { turn: string; n: number };

/** 完整考卷的句子編號是 s1-t12：照 Section 分組；單段考卷整份一組（section 是 null） */
function groupBySection(turns: ReviewTurn[]) {
  const groups: { section: number | null; turns: ReviewTurn[] }[] = [];
  for (const x of turns) {
    const m = /^s(\d+)-/.exec(x.id);
    const section = m ? Number(m[1]) : null;
    const last = groups.at(-1);
    if (last && last.section === section) last.turns.push(x);
    else groups.push({ section, turns: [x] });
  }
  return groups;
}

/**
 * 逐字稿：點時間跳過去聽，正在播的那句會亮起來。
 * 播放中不自動捲（老師在看別的地方時不會被拉走）；只有從意見點過來才把那句捲進畫面。
 */
export function Transcript({
  turns,
  current,
  focus,
  onSeek,
}: {
  turns: ReviewTurn[];
  current: string | null;
  focus: TranscriptFocus | null;
  onSeek: Seek;
}) {
  const t = useTranslations("review");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focus) return;
    listRef.current
      ?.querySelector(`[data-turn="${CSS.escape(focus.turn)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">{t("transcript")}</h2>
      <p className="text-sm text-muted-foreground">{t("transcriptHint")}</p>
      <div
        ref={listRef}
        className="mt-2 grid max-h-[70vh] gap-3 overflow-auto text-sm leading-relaxed"
      >
        {groupBySection(turns).map((g) => (
          <div key={g.section ?? "all"}>
            {g.section !== null && (
              <h3 className="sticky top-0 z-[1] bg-surface py-1 font-semibold">
                {t("transcriptSection", { n: g.section })}
              </h3>
            )}
            <ol className="grid gap-1">
              {g.turns.map((x) => (
                <li
                  key={x.id}
                  data-turn={x.id}
                  className={`grid grid-cols-[4rem_minmax(0,1fr)] gap-x-2 rounded px-1.5 py-0.5 sm:grid-cols-[4rem_4.5rem_minmax(0,1fr)] ${current === x.id ? "bg-primary-soft" : ""} ${focus?.turn === x.id ? "ring-2 ring-primary ring-inset" : ""}`}
                >
                  <span>
                    {x.start !== null && (
                      <TimeButton seconds={x.start} turn={x.id} onSeek={onSeek}>
                        {clock(x.start)}
                      </TimeButton>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {x.id} {x.speaker}
                  </span>
                  <span className="col-span-2 min-w-0 sm:col-span-1">{x.text}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
