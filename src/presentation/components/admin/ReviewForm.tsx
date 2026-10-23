"use client";

import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import type { ReviewView } from "@/application/examSet/reviewView";
import type { ReviewFormState } from "@/presentation/components/formStates";
import { Alert } from "@/presentation/components/ui/Alert";
import { Button } from "@/presentation/components/ui/Button";
import { reviewErrorText } from "@/presentation/lib/errorMessages";
import { questionAt, stackCards, turnAt } from "@/presentation/lib/reviewTime";
import {
  NoteCard,
  type DraftAiAction,
  type DraftNote,
  type Editing,
} from "./review/NoteCard";
import { ReviewPaper } from "./review/ReviewPaper";
import { Transcript } from "./review/Transcript";

type Props = {
  view: ReviewView;
  audioUrl: string;
  action: (prev: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
};

/** 整套／錄音的批註卡代號（考卷上拉線到標題） */
const SET = "set";
/** 寬螢幕才把批註排在考卷旁邊、拉線；窄的排在考卷下面 */
const SIDE_BY_SIDE = "(min-width: 1280px)";

let nextKey = 0;
const newKey = () => `n${(nextKey += 1)}`;

/**
 * 老師審稿：像批改考卷一樣，考卷填好標準答案，每題旁邊是 AI 的意見和老師的意見。
 * 老師可以保留、改寫、刪除 AI 的意見，替任何一題或整套加意見，最後判合格／不合格一起送出。
 */
export function ReviewForm({ view, audioUrl, action }: Props) {
  const t = useTranslations();
  const r = (key: string, values?: Record<string, string | number>) =>
    t(`review.${key}`, values);
  const [state, formAction, isPending] = useActionState(action, {});
  const prev = view.review;

  // ---------- 草稿 ----------
  const [notes, setNotes] = useState<DraftNote[]>(() =>
    (prev?.notes ?? []).map((n) => ({ key: newKey(), target: n.target, text: n.text })),
  );
  const [aiActions, setAiActions] = useState<Map<string, DraftAiAction>>(
    () =>
      new Map(
        (prev?.aiActions ?? []).map((a) => [
          a.ref,
          { action: a.action, text: a.text ?? "" },
        ]),
      ),
  );
  const [editing, setEditing] = useState<Editing | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const targetOf = (key: string) => (key === SET ? null : key);
  const saveNote = (key: string | null, target: string, text: string) => {
    setNotes((ns) =>
      key === null
        ? [...ns, { key: newKey(), target: targetOf(target), text }]
        : ns.map((n) => (n.key === key ? { ...n, text } : n)),
    );
    setEditing(null);
  };
  const setAi = (ref: string, a: DraftAiAction | null) => {
    setAiActions((m) => {
      const next = new Map(m);
      if (a) next.set(ref, a);
      else next.delete(ref);
      return next;
    });
    setEditing(null);
  };

  const payload = JSON.stringify({
    notes: notes.map((n) => ({ target: n.target, text: n.text })),
    aiActions: [...aiActions].map(([ref, a]) => ({
      ref,
      action: a.action,
      text: a.text || null,
    })),
  });

  // ---------- 錄音 ----------
  const audioRef = useRef<HTMLAudioElement>(null);
  const [now, setNow] = useState(0);
  const seek = (seconds: number, play = false) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = seconds;
    setNow(seconds);
    if (play) el.play().catch(() => {});
  };
  const currentTime = () => audioRef.current?.currentTime ?? 0;

  const questions = useMemo(
    () => new Map(view.questions.map((q) => [q.questionId, q])),
    [view.questions],
  );
  const turnStarts = useMemo(
    () =>
      new Map(
        (view.turns ?? []).flatMap((x) => (x.start === null ? [] : [[x.id, x.start]])),
      ),
    [view.turns],
  );
  const ranges = view.questions.map((q) => ({
    questionId: q.questionId,
    start: q.evidence?.start ?? null,
    end: q.evidence?.end ?? null,
  }));
  const listening = questionAt(ranges, now);
  const currentTurn = view.turns ? turnAt(view.turns, now) : null;

  // ---------- 批註卡 ----------
  const aiOf = (target: string) =>
    view.aiNotes.filter((n) => n.questionId === targetOf(target));
  const notesOf = (target: string) => notes.filter((n) => n.target === targetOf(target));
  const counts = new Map(
    view.questions.map((q) => [
      q.questionId,
      notesOf(q.questionId).length +
        aiOf(q.questionId).filter((n) => aiActions.get(n.ref)?.action !== "deleted")
          .length,
    ]),
  );
  // 整套一定有卡；題目有意見、正在看、正在新增意見的才出卡
  const cards = [
    SET,
    ...view.questions
      .map((q) => q.questionId)
      .filter(
        (id) =>
          (counts.get(id) ?? 0) > 0 ||
          aiOf(id).length > 0 ||
          active === id ||
          (editing?.kind === "new" && editing.target === id),
      ),
  ];

  const select = (target: string) => {
    setActive(target);
    if (target !== SET && notesOf(target).length === 0 && aiOf(target).length === 0)
      setEditing({ kind: "new", target });
  };

  // 窄螢幕：點空格後捲到那張卡
  const scrollTo = useRef<string | null>(null);
  const selectFromPaper = (target: string) => {
    select(target);
    scrollTo.current = target;
  };
  useEffect(() => {
    const target = scrollTo.current;
    scrollTo.current = null;
    if (!target || window.matchMedia(SIDE_BY_SIDE).matches) return;
    document
      .querySelector(`[data-card="${target}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ---------- 排位置、拉線（寬螢幕） ----------
  const boardRef = useRef<HTMLDivElement>(null);
  const marginRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const layout = () => {
      const board = boardRef.current;
      const margin = marginRef.current;
      const svg = svgRef.current;
      if (!board || !margin || !svg) return;
      const cardEls = [...margin.querySelectorAll<HTMLElement>("[data-card]")];
      if (!window.matchMedia(SIDE_BY_SIDE).matches) {
        for (const el of cardEls) el.style.top = "";
        margin.style.height = "";
        svg.replaceChildren();
        return;
      }
      const B = board.getBoundingClientRect();
      const M = margin.getBoundingClientRect();
      const paperRight = board.firstElementChild?.getBoundingClientRect().right ?? M.left;
      const anchors = cardEls.map((el) =>
        board
          .querySelector(`[data-anchor="${el.dataset.card}"]`)
          ?.getBoundingClientRect(),
      );
      const tops = stackCards(
        cardEls.map((el, i) => ({
          want: anchors[i] ? anchors[i].top + anchors[i].height / 2 - M.top - 18 : 0,
          height: el.offsetHeight,
        })),
        10,
      );
      const ns = "http://www.w3.org/2000/svg";
      const shapes: SVGElement[] = [];
      cardEls.forEach((el, i) => {
        el.style.top = `${tops[i]}px`;
        const a = anchors[i];
        if (!a) return;
        // 從空格底線下方出發，走行距的空隙，不壓到字
        const x1 = a.right - B.left + 2;
        const y1 = a.bottom - B.top + 3;
        const xm = paperRight - B.left + 8;
        const x2 = M.left - B.left;
        const y2 = M.top - B.top + tops[i] + 18;
        const on = active === el.dataset.card;
        const path = document.createElementNS(ns, "path");
        path.setAttribute(
          "d",
          `M${x1},${y1} H${xm} C${xm + 24},${y1} ${x2 - 24},${y2} ${x2},${y2}`,
        );
        path.setAttribute(
          "class",
          on
            ? "fill-none stroke-primary stroke-2"
            : "fill-none stroke-muted-foreground/40",
        );
        const dot = document.createElementNS(ns, "circle");
        dot.setAttribute("cx", String(x1));
        dot.setAttribute("cy", String(y1));
        dot.setAttribute("r", "3");
        dot.setAttribute("class", on ? "fill-primary" : "fill-muted-foreground/40");
        shapes.push(path, dot);
      });
      const last = cardEls.at(-1);
      margin.style.height = last ? `${tops[tops.length - 1] + last.offsetHeight}px` : "";
      svg.replaceChildren(...shapes);
    };
    layout();
    const ro = new ResizeObserver(layout);
    if (marginRef.current) ro.observe(marginRef.current);
    if (boardRef.current) ro.observe(boardRef.current);
    window.addEventListener("resize", layout);
    marginRef.current?.addEventListener("toggle", layout, true);
    const margin = marginRef.current;
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", layout);
      margin?.removeEventListener("toggle", layout, true);
    };
  });

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="payload" value={payload} />

      <div className="sticky top-14 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={audioUrl}
          onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
          onSeeked={(e) => setNow(e.currentTarget.currentTime)}
          className="w-full"
        />
        {!view.turns && (
          <p className="mt-1 text-xs text-muted-foreground">{r("noTranscript")}</p>
        )}
      </div>

      <div
        ref={boardRef}
        className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-12"
      >
        <ReviewPaper
          paper={view.paper}
          questions={questions}
          active={active}
          listening={listening}
          counts={counts}
          onSelect={selectFromPaper}
          onPlay={(id) => {
            const start = questions.get(id)?.evidence?.start;
            if (start != null) seek(start, true);
          }}
        />
        <div ref={marginRef} className="relative grid min-w-0 gap-3 xl:block">
          {cards.map((target) => (
            <div key={target} data-card={target} className="xl:absolute xl:inset-x-0">
              <NoteCard
                target={target}
                question={target === SET ? null : (questions.get(target) ?? null)}
                aiNotes={aiOf(target)}
                aiActions={aiActions}
                notes={notesOf(target)}
                active={active === target}
                editing={editing}
                setEditing={(e) => {
                  setEditing(e);
                  setActive(target);
                }}
                onSaveNote={saveNote}
                onRemoveNote={(key) => setNotes((ns) => ns.filter((n) => n.key !== key))}
                onAiEdit={(ref, text) =>
                  setAi(ref, text === null ? null : { action: "edited", text })
                }
                onAiDelete={(ref, reason) =>
                  setAi(ref, { action: "deleted", text: reason })
                }
                onAiRestore={(ref) => setAi(ref, null)}
                onSelect={() => setActive(target)}
                currentTime={currentTime}
                turnStarts={turnStarts}
                onSeek={(s) => seek(s)}
              />
            </div>
          ))}
        </div>
        <svg
          ref={svgRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible xl:block"
        />
      </div>

      {view.turns && (
        <Transcript turns={view.turns} current={currentTurn} onSeek={(s) => seek(s)} />
      )}

      <section className="grid gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">{r("decision")}</h2>
        <div className="flex gap-6">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decision"
              value="approved"
              defaultChecked={prev?.decision === "approved"}
            />
            {r("approved")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decision"
              value="rejected"
              defaultChecked={prev?.decision === "rejected"}
            />
            {r("rejected")}
          </label>
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-medium">{r("comment")}</span>
          <textarea
            name="comment"
            rows={3}
            defaultValue={prev?.comment ?? ""}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </label>
        {state.problems && state.problems.length > 0 && (
          <Alert tone="error" items={state.problems.map((p) => reviewErrorText(t, p))} />
        )}
        {state.saved && <Alert>{r("saved")}</Alert>}
        <Button type="submit" disabled={isPending} className="justify-self-start">
          {isPending ? t("common.saving") : prev ? r("update") : r("submit")}
        </Button>
      </section>
    </form>
  );
}
