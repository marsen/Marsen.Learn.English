"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ExamSheet,
  StartExamResult,
  SubmitExamResult,
} from "@/application/exam/examResult";
import { ExamPaper } from "./ExamPaper";
import { Alert } from "@/presentation/components/ui/Alert";
import { Button } from "@/presentation/components/ui/Button";
import {
  eventAt,
  formatClock,
  questionRange,
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

/** 錯誤：翻譯檔 exam.errors.* 的代碼，交卷失敗時帶原因 */
type RunnerError =
  | { code: "unavailable" | "audioFailed" | "audioInterrupted" | "autoplayBlocked" }
  | { code: "submitFailed"; message: string };

/**
 * 考試流程：說明 → 開始（錄音只播一次，不能暫停、倒轉）→ 邊聽邊填 → 錄音結束自動交卷，或自己按交卷。
 * 看題停頓、最後檢查都照錄音時間軸。
 */
/** 錄音出錯時最多自動重試幾次（成功播放後重新計算） */
const MAX_AUDIO_RETRIES = 3;

export function ExamRunner({ title, audioUrl, start, submit }: Props) {
  const [stage, setStage] = useState<Stage>("intro");
  const [sheet, setSheet] = useState<ExamSheet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<ExamPhaseView | null>(null);
  const [error, setError] = useState<RunnerError | null>(null);
  // 錄音進度（只顯示，不能拖：錄音在背景播，畫面上沒有播放器）
  const [played, setPlayed] = useState<{ at: number; total: number } | null>(null);
  const t = useTranslations("exam");
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
      if (r.ok) {
        setStage("submitted");
        window.location.assign(`/exam/result/${r.attemptId}`);
      } else if (r.reason === "already_submitted") {
        setStage("submitted");
        window.location.assign(`/exam/result/${attemptId}`);
      } else throw new Error(t("errors.attemptNotFound"));
    } catch (e) {
      setError({ code: "submitFailed", message: (e as Error).message });
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
      setError({ code: "unavailable" });
      return;
    }
    setSheet(r.sheet);
    setStage("running");
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => {
      const total = r.sheet.timing.totalSeconds || audio.duration;
      if (total > 0) setPlayed({ at: Math.min(audio.currentTime, total), total });
      const v = viewOf(
        eventAt(r.sheet.timing.events, audio.currentTime),
        audio.currentTime,
      );
      if (v) setPhase(v);
    });
    audio.addEventListener("ended", () => handIn(r.sheet.attemptId));
    // 播放出錯（例如 R2 短效網址過期、網路斷一下）：回網站拿新的網址，從原本的秒數接著播
    let retries = 0;
    audio.addEventListener("error", () => {
      if (retries >= MAX_AUDIO_RETRIES) {
        setError({ code: "audioFailed" });
        return;
      }
      retries += 1;
      const at = audio.currentTime;
      audio.src = audioUrl;
      audio.addEventListener(
        "loadedmetadata",
        () => {
          audio.currentTime = at;
          audio.play().catch(() => setError({ code: "audioInterrupted" }));
        },
        { once: true },
      );
      audio.load();
    });
    audio.addEventListener("playing", () => {
      retries = 0;
    });
    // 只有瀏覽器擋自動播放才提示；載入失敗由上面的 error 自動重試處理
    audio.play().catch((e: unknown) => {
      if (e instanceof DOMException && e.name === "NotAllowedError")
        setError({ code: "autoplayBlocked" });
    });
  };

  const errorText =
    error &&
    t(`errors.${error.code}`, "message" in error ? { message: error.message } : {});

  if (stage === "intro") {
    return (
      <div className="grid gap-4">
        <p>{t.rich("intro", { title, b: (chunks) => <b>{chunks}</b> })}</p>
        {errorText && <Alert tone="error">{errorText}</Alert>}
        <Button onClick={begin} className="justify-self-start">
          {t("start")}
        </Button>
      </div>
    );
  }

  if (stage === "submitted") {
    return (
      <div className="grid gap-2">
        <Alert>{t("submitted")}</Alert>
      </div>
    );
  }

  const questionsText = (q: [number, number]) => {
    const r = questionRange(q);
    return t(`questions.${r.kind}`, { a: r.a, b: r.b });
  };
  const status =
    phase === null
      ? t("statusStart")
      : phase.kind === "listen"
        ? t("statusListen")
        : phase.kind === "check"
          ? t("statusCheck", { clock: formatClock(phase.remaining) })
          : phase.questions
            ? t("statusReadQuestions", {
                questions: questionsText(phase.questions),
                clock: formatClock(phase.remaining),
              })
            : t("statusRead", { clock: formatClock(phase.remaining) });

  return (
    <div className="grid gap-4">
      <div className="sticky top-0 z-10 rounded-lg bg-background/95 py-2">
        <p className="font-medium" aria-live="polite">
          {status}
        </p>
        {played && (
          <div className="mt-2 flex items-center gap-3">
            <div
              role="progressbar"
              aria-label={t("progressAria")}
              aria-valuemin={0}
              aria-valuemax={Math.round(played.total)}
              aria-valuenow={Math.round(played.at)}
              className="h-2 flex-1 overflow-hidden rounded-full bg-border"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${(played.at / played.total) * 100}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatClock(played.at)} / {formatClock(played.total)}
            </span>
          </div>
        )}
      </div>
      {errorText && <Alert tone="error">{errorText}</Alert>}
      {sheet && (
        <ExamPaper
          paper={sheet.paper}
          answers={answers}
          onChange={changeAnswer}
          disabled={stage !== "running"}
          highlight={phase?.kind === "read" ? phase.questions : null}
        />
      )}
      <Button
        disabled={stage !== "running" || !sheet}
        onClick={() => sheet && handIn(sheet.attemptId)}
        className="justify-self-start"
      >
        {stage === "submitting" ? t("submitting") : t("submit")}
      </Button>
    </div>
  );
}
