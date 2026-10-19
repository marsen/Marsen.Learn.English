"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ExamSheet,
  StartExamResult,
  SubmitExamResult,
} from "@/application/exam/examResult";
import { ExamPaper } from "./ExamPaper";
import {
  eventAt,
  formatClock,
  questionLabel,
  viewOf,
  type ExamPhaseView,
} from "@/presentation/lib/examTiming";

type Props = {
  title: string;
  audioUrl: string;
  start: () => Promise<StartExamResult>;
  submit: (
    attemptId: string,
    answers: Record<string, string>,
  ) => Promise<SubmitExamResult>;
};

type Stage = "intro" | "running" | "submitting" | "submitted";

/**
 * 考試流程：說明 → 開始（錄音只播一次，不能暫停、倒轉）→ 邊聽邊填 → 錄音結束自動交卷，或自己按交卷。
 * 看題停頓、最後檢查都照錄音時間軸。
 */
export function ExamRunner({ title, audioUrl, start, submit }: Props) {
  const [stage, setStage] = useState<Stage>("intro");
  const [sheet, setSheet] = useState<ExamSheet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<ExamPhaseView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 給錄音事件（不在 React 流程內）讀最新的答案與是否已在交卷
  const answersRef = useRef<Record<string, string>>({});
  const handingInRef = useRef(false);

  useEffect(() => () => audioRef.current?.pause(), []);

  const handIn = async (attemptId: string) => {
    if (handingInRef.current) return;
    handingInRef.current = true;
    setStage("submitting");
    audioRef.current?.pause();
    try {
      const r = await submit(attemptId, answersRef.current);
      if (r.ok || r.reason === "already_submitted") setStage("submitted");
      else throw new Error("找不到這次作答");
    } catch (e) {
      setError(`交卷失敗：${(e as Error).message}。答案還在，請再按一次「交卷」。`);
      handingInRef.current = false;
      setStage("running");
    }
  };

  const changeAnswer = (questionId: string, value: string) => {
    answersRef.current = { ...answersRef.current, [questionId]: value };
    setAnswers(answersRef.current);
  };

  const begin = async () => {
    setError(null);
    const r = await start();
    if (!r.ok) {
      setError("這張考卷現在不能考。");
      return;
    }
    setSheet(r.sheet);
    setStage("running");
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => {
      const v = viewOf(
        eventAt(r.sheet.timing.events, audio.currentTime),
        audio.currentTime,
      );
      if (v) setPhase(v);
    });
    audio.addEventListener("ended", () => handIn(r.sheet.attemptId));
    audio.addEventListener("error", () =>
      setError("錄音播放失敗，你可以繼續作答，再自己按交卷。"),
    );
    audio.play().catch(() => setError("錄音沒辦法自動播放，請重新整理後再試一次。"));
  };

  if (stage === "intro") {
    return (
      <div className="grid gap-4">
        <p>
          《{title}》。按下開始後錄音會直接播放，<b>只播一次，不能暫停或倒轉</b>
          ，跟正式考試一樣。 錄音裡有看題時間和最後檢查時間，錄音結束會自動交卷。
        </p>
        {error && <p className="text-destructive">{error}</p>}
        <button
          type="button"
          onClick={begin}
          className="justify-self-start rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground"
        >
          開始考試
        </button>
      </div>
    );
  }

  if (stage === "submitted") {
    return (
      <div className="grid gap-2">
        <p className="rounded-lg bg-card px-4 py-3">已交卷。批改結果之後會在這裡顯示。</p>
        <a href="/exam" className="text-primary underline">
          回考卷清單
        </a>
      </div>
    );
  }

  const status =
    phase === null
      ? "錄音開始。"
      : phase.kind === "listen"
        ? "錄音播放中，邊聽邊填。"
        : phase.kind === "check"
          ? `檢查你的答案。${formatClock(phase.remaining)}`
          : `看題時間${phase.questions ? `：${questionLabel(phase.questions)}` : ""}　${formatClock(phase.remaining)}`;

  return (
    <div className="grid gap-4">
      <p
        className="sticky top-0 z-10 rounded-lg bg-background/95 py-2 font-medium"
        aria-live="polite"
      >
        {status}
      </p>
      {error && <p className="text-destructive">{error}</p>}
      {sheet && (
        <ExamPaper
          paper={sheet.paper}
          answers={answers}
          onChange={changeAnswer}
          disabled={stage !== "running"}
          highlight={phase?.kind === "read" ? phase.questions : null}
        />
      )}
      <button
        type="button"
        disabled={stage !== "running" || !sheet}
        onClick={() => sheet && handIn(sheet.attemptId)}
        className="justify-self-start rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground disabled:opacity-60"
      >
        {stage === "submitting" ? "交卷中…" : "交卷"}
      </button>
    </div>
  );
}
