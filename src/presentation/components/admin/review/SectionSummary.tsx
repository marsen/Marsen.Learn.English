"use client";

import { useTranslations } from "next-intl";
import type { AiNote } from "@/application/examSet/reviewView";
import { Button } from "@/presentation/components/ui/Button";
import type { SectionProgress } from "@/presentation/lib/reviewSections";
import type { DraftAiAction } from "./NoteCard";
import { TimeText, type Seek } from "./TimeText";

type Props = {
  progress: SectionProgress;
  /** AI 對這段整段的意見（不屬於某一題） */
  aiNotes: AiNote[];
  aiActions: ReadonlyMap<string, DraftAiAction>;
  onHandle: (ref: string) => void;
  onRestore: (ref: string) => void;
  /** 這段開頭宣讀（sN-intro）的秒數；沒有就不顯示播放 */
  start: number | null;
  onPlayStart: () => void;
  turnStarts: ReadonlyMap<string, number>;
  onSeek: Seek;
};

/**
 * 每段分頁最上面的小結（可折疊）：這段 OK／有問題／待處理數、AI 對整段的意見（可標為已處理，
 * 不算進段落完成）、▶ 從 Section n 開頭播。
 */
export function SectionSummary(p: Props) {
  const t = useTranslations("review");
  const n = p.progress.section;
  return (
    <details
      open
      data-section-summary={n}
      className="rounded-xl border border-border bg-surface px-4 py-3 text-sm"
    >
      <summary className="cursor-pointer font-semibold">
        {t("flow.summaryTitle", { n })}
        <span className="ml-2 font-normal text-muted-foreground">
          {[
            t("summaryOk", { count: p.progress.ok }),
            t("summaryBad", { count: p.progress.bad }),
            t("pending", { count: p.progress.pending }),
          ].join(t("summaryJoin"))}
          {p.aiNotes.length > 0 &&
            ` · ${t("flow.sectionAiCount", { count: p.aiNotes.length })}`}
        </span>
      </summary>
      <div className="mt-2 grid gap-2">
        {p.start !== null && (
          <div>
            <Button size="xs" variant="secondary" onClick={p.onPlayStart}>
              ▶ {t("flow.playSection", { n })}
            </Button>
          </div>
        )}
        {p.aiNotes.length > 0 && (
          <ul className="grid gap-1.5">
            {p.aiNotes.map((note) => {
              const a = p.aiActions.get(note.ref);
              return (
                <li
                  key={note.ref}
                  className={`grid gap-1 rounded-lg px-3 py-2 ${a ? "bg-muted" : "bg-card"}`}
                >
                  <p>
                    <TimeText
                      text={a?.action === "edited" ? a.text : note.message}
                      turnStarts={p.turnStarts}
                      section={n}
                      onSeek={p.onSeek}
                    />
                  </p>
                  {note.suggestion && (
                    <p className="text-xs text-muted-foreground">
                      {t("suggestion", { text: note.suggestion })}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    {a ? (
                      <>
                        <span className="rounded bg-surface px-1.5">
                          {t("handledTag")}
                        </span>
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => p.onRestore(note.ref)}
                        >
                          {t("restore")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => p.onHandle(note.ref)}
                      >
                        {t("markHandled")}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t("flow.sectionAiHint")}</p>
      </div>
    </details>
  );
}
