"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ExamSheet,
  StartExamResult,
  SubmitExamResult,
} from "@/application/exam/examResult";
import { ExamPaper } from "./ExamPaper";
import { FullExamPaper } from "./FullExamPaper";
import { Alert } from "@/presentation/components/ui/Alert";
import { Button } from "@/presentation/components/ui/Button";
import {
  eventAt,
  formatClock,
  questionRange,
  sectionOf,
  viewOf,
  type ExamPhaseView,
} from "@/presentation/lib/examTiming";
import {
  browserStorage,
  clearDraft,
  clearOtherDrafts,
  questionIdsOf,
  saveDraft,
  unansweredCount,
} from "@/presentation/lib/examDraft";
import { installLeaveGuard } from "@/presentation/lib/leaveGuard";

type Props = {
  title: string;
  /** 開始前給考生看的：大約幾分鐘、幾題、幾段 */
  overview: { minutes: number; questions: number; sections: number };
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

/** 試音量用的範例錄音（首頁試題的錄音）：不用考卷錄音，不吃取音檔的次數上限 */
const VOLUME_TEST_AUDIO = "/landing-demo/audio.mp3";

export function ExamRunner({ title, overview, audioUrl, start, submit }: Props) {
  const volumeTestRef = useRef<HTMLAudioElement | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [sheet, setSheet] = useState<ExamSheet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<ExamPhaseView | null>(null);
  // 完整考卷：錄音現在播到第幾段（空檔沿用上一段）
  const [section, setSection] = useState<number | null>(null);
  const [error, setError] = useState<RunnerError | null>(null);
  const t = useTranslations("exam");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 給錄音事件（不在 React 流程內）讀最新的答案與是否已在交卷
  const answersRef = useRef<Record<string, string>>({});
  const handingInRef = useRef(false);
  // 離開提醒（考試進行中才有）；交卷跳頁前要先拿掉
  const releaseGuardRef = useRef<(() => void) | null>(null);
  const leaveConfirm = t("leaveConfirm");
  const leaveConfirmRef = useRef(leaveConfirm);
  useEffect(() => {
    leaveConfirmRef.current = leaveConfirm;
  }, [leaveConfirm]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      releaseGuardRef.current?.();
      releaseGuardRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (stage !== "running" || releaseGuardRef.current) return;
    const attemptId = sheet?.attemptId;
    releaseGuardRef.current = installLeaveGuard(
      () => leaveConfirmRef.current,
      () => {
        if (attemptId) clearDraft(browserStorage(), attemptId);
      },
    );
  }, [stage, sheet]);

  /** 交卷完成要跳成績頁：先拿掉離開提醒、刪掉瀏覽器裡的暫存答案 */
  const leaveTo = (attemptId: string, url: string) => {
    clearDraft(browserStorage(), attemptId);
    releaseGuardRef.current?.();
    releaseGuardRef.current = null;
    setStage("submitted");
    window.location.assign(url);
  };

  const handIn = async (attemptId: string) => {
    if (handingInRef.current) return;
    handingInRef.current = true;
    setStage("submitting");
    audioRef.current?.pause();
    try {
      const r = await submit(attemptId, answersRef.current);
      if (r.ok) leaveTo(attemptId, `/exam/result/${r.attemptId}`);
      else if (r.reason === "already_submitted")
        leaveTo(attemptId, `/exam/result/${attemptId}`);
      else {
        // 網站找不到這次作答：暫存的答案也用不到了
        clearDraft(browserStorage(), attemptId);
        throw new Error(t("errors.attemptNotFound"));
      }
    } catch (e) {
      setError({ code: "submitFailed", message: (e as Error).message });
      handingInRef.current = false;
      setStage("running");
    }
  };

  const changeAnswer = (questionId: string, value: string) => {
    answersRef.current = { ...answersRef.current, [questionId]: value };
    setAnswers(answersRef.current);
    if (sheet)
      saveDraft(browserStorage(), {
        attemptId: sheet.attemptId,
        setId: sheet.setId,
        answers: answersRef.current,
      });
  };

  /** 學生自己按「交卷」：先問，寫出還有幾題沒填（錄音播完自動交卷不問） */
  const confirmHandIn = (s: ExamSheet) => {
    const left = unansweredCount(questionIdsOf(s.paper, s.fullPaper), answersRef.current);
    const message =
      left > 0 ? t("confirmSubmitUnanswered", { count: left }) : t("confirmSubmit");
    if (window.confirm(message)) void handIn(s.attemptId);
  };

  const begin = async () => {
    volumeTestRef.current?.pause();
    setError(null);
    const r = await start();
    if (!r.ok) {
      setError({ code: "unavailable" });
      return;
    }
    // 開始新考試：之前沒交卷留下的暫存清掉，只留這次的
    clearOtherDrafts(browserStorage(), r.sheet.attemptId);
    setSheet(r.sheet);
    setStage("running");
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => {
      const event = eventAt(r.sheet.timing.events, audio.currentTime);
      const v = viewOf(event, audio.currentTime);
      if (v) setPhase(v);
      const n = sectionOf(event);
      if (n !== null) setSection(n);
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
      <div key="intro" className="grid gap-4">
        <p>{t.rich("intro", { title, b: (chunks) => <b>{chunks}</b> })}</p>
        <p className="font-medium">{t("overview", overview)}</p>
        <section className="grid gap-2 rounded-xl border border-border bg-surface p-4">
          <h2 className="font-semibold">{t("volumeTest")}</h2>
          <p className="text-sm text-muted-foreground">{t("volumeTestHint")}</p>
          <audio
            ref={volumeTestRef}
            controls
            preload="none"
            src={VOLUME_TEST_AUDIO}
            className="w-full"
          />
        </section>
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

  // key 不同：開始後整塊換掉，說明文字不會被當成狀態列沿用（瀏覽器翻譯外掛改過 DOM 時會殘留）
  return (
    <div key="running" className="grid gap-4">
      <p
        className="sticky top-0 z-10 rounded-lg bg-background/95 py-2 font-medium"
        aria-live="polite"
      >
        {section !== null && t("statusSection", { n: section })}
        {status}
      </p>
      {errorText && <Alert tone="error">{errorText}</Alert>}
      {sheet?.fullPaper && (
        <FullExamPaper
          paper={sheet.fullPaper}
          answers={answers}
          onChange={changeAnswer}
          disabled={stage !== "running"}
          highlight={phase?.kind === "read" ? phase.questions : null}
        />
      )}
      {sheet && !sheet.fullPaper && (
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
        onClick={() => sheet && confirmHandIn(sheet)}
        className="justify-self-start"
      >
        {stage === "submitting" ? t("submitting") : t("submit")}
      </Button>
    </div>
  );
}
