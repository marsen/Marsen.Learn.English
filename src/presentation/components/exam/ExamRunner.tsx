"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import type {
  ExamSheet,
  StartExamResult,
  SubmitExamResult,
} from "@/application/exam/examResult";
import { ExamPaper } from "./ExamPaper";
import { FullExamPaper } from "./FullExamPaper";
import { ExamSubmitPage } from "./ExamSubmitPage";
import { ExamSteps, type ExamPage } from "./ExamSteps";
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
  findDraftForSet,
  questionIdsOf,
  saveDraft,
  unansweredBySection,
  unansweredCount,
} from "@/presentation/lib/examDraft";
import { installLeaveGuard } from "@/presentation/lib/leaveGuard";

type Props = {
  setId: string;
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

/** 暫存不會在這頁以外被改，不用訂閱變化 */
const noSubscribe = () => () => {};

export function ExamRunner({ setId, overview, audioUrl, start, submit }: Props) {
  const volumeTestRef = useRef<HTMLAudioElement | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [sheet, setSheet] = useState<ExamSheet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<ExamPhaseView | null>(null);
  // 完整考卷：錄音現在播到第幾段（空檔沿用上一段）
  const [section, setSection] = useState<number | null>(null);
  // 完整考卷：學生正在看哪一頁（自己翻，錄音換段時不跟著換）
  const [page, setPage] = useState<ExamPage | null>(null);
  const [error, setError] = useState<RunnerError | null>(null);
  // 錄音進度（只顯示，不能拖：錄音在背景播，畫面上沒有播放器）
  const [played, setPlayed] = useState<{ at: number; total: number } | null>(null);
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

  // 上次考試中重新整理、離開（沒交卷）：回到考試頁就用暫存的答案交卷，進成績頁（#285 AC-3）。
  // 暫存只在瀏覽器：伺服器端當作沒有，所以用 useSyncExternalStore 讀
  const leftAttempt = useSyncExternalStore(
    noSubscribe,
    () => findDraftForSet(browserStorage(), setId)?.attemptId ?? null,
    () => null,
  );
  // 交不出去（網站找不到那次作答，例如換了帳號；或網路斷掉）：照常顯示考試說明
  const [resumeFailed, setResumeFailed] = useState(false);
  const resuming = leftAttempt !== null && !resumeFailed && stage === "intro";
  useEffect(() => {
    // 只在考試說明頁：開始考試後這次的暫存也會被找到，不能拿去交
    if (!leftAttempt || resumeFailed || stage !== "intro") return;
    const draft = findDraftForSet(browserStorage(), setId);
    if (!draft) return;
    let cancelled = false;
    submit(draft.attemptId, draft.answers)
      .then((r) => {
        if (cancelled) return;
        clearDraft(browserStorage(), draft.attemptId);
        if (r.ok || r.reason === "already_submitted")
          window.location.assign(
            `/exam/result/${r.ok ? r.attemptId : draft.attemptId}?left=1`,
          );
        else setResumeFailed(true);
      })
      .catch(() => {
        // 網路斷掉之類：暫存留著，下次回來再交
        if (!cancelled) setResumeFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [leftAttempt, resumeFailed, stage, setId, submit]);

  useEffect(() => {
    if (stage !== "running" || releaseGuardRef.current) return;
    const attemptId = sheet?.attemptId;
    const release = installLeaveGuard(
      () => leaveConfirmRef.current,
      () => {
        if (attemptId) clearDraft(browserStorage(), attemptId);
      },
    );
    // iPhone Safari 沒有離開提醒：至少擋掉往下拉就重新整理的手勢
    const root = document.documentElement;
    const overscroll = root.style.overscrollBehavior;
    root.style.overscrollBehavior = "none";
    releaseGuardRef.current = () => {
      release();
      root.style.overscrollBehavior = overscroll;
    };
  }, [stage, sheet]);

  /** 交卷完成要跳成績頁：先拿掉離開提醒、刪掉瀏覽器裡的暫存答案 */
  const leaveTo = (attemptId: string, url: string) => {
    clearDraft(browserStorage(), attemptId);
    releaseGuardRef.current?.();
    releaseGuardRef.current = null;
    setStage("submitted");
    window.location.assign(url);
  };

  /**
   * 交卷。resumeAudio：交卷失敗回到作答時，錄音從原本的秒數接著播（完整考卷學生自己按交卷時用；
   * 錄音已播完觸發的自動交卷、單段考卷照舊不播）
   */
  const handIn = async (attemptId: string, resumeAudio = false) => {
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
      const audio = audioRef.current;
      // 暫停時位置還在，play() 從原秒數接著播；播完了就不播（不然會從頭開始）。
      // 播不起來（載入失敗）由錄音的 error 事件處理，這裡不蓋掉「交卷失敗」的訊息
      if (resumeAudio && audio && !audio.ended) audio.play().catch(() => undefined);
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
    // 一開始就存一份（還沒填也存）：一題都沒填就重新整理，回來也能交卷
    saveDraft(browserStorage(), {
      attemptId: r.sheet.attemptId,
      setId: r.sheet.setId,
      answers: {},
    });
    setSheet(r.sheet);
    if (r.sheet.fullPaper) setPage(r.sheet.fullPaper.sections[0]?.ielts ?? "submit");
    setStage("running");
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => {
      const total = r.sheet.timing.totalSeconds || audio.duration;
      if (total > 0) setPlayed({ at: Math.min(audio.currentTime, total), total });
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
          // 交卷中：只換好網址、停在原秒數，不播（交卷失敗時才從這裡接著播）
          if (handingInRef.current) return;
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
        <ul className="grid list-disc gap-1 pl-5">
          <li className="font-medium">{t("overview", overview)}</li>
          <li>{t("rules.start")}</li>
          <li>{t.rich("rules.once", { b: (chunks) => <b>{chunks}</b> })}</li>
          <li>{t("rules.autoSubmit")}</li>
          {overview.sections > 1 && <li>{t("paging.onlyForward")}</li>}
        </ul>
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

  if (resuming) {
    return (
      <div className="grid gap-2">
        <Alert>{t("resuming")}</Alert>
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

  /** 翻頁只換畫哪一段：錄音在 audioRef、答案在 answersRef，都不跟著動 */
  const goTo = (p: ExamPage) => {
    setPage(p);
    window.scrollTo({ top: 0 });
  };
  const pages: ExamPage[] = sheet?.fullPaper
    ? [...sheet.fullPaper.sections.map((s) => s.ielts), "submit"]
    : [];
  const pageIndex = page === null ? -1 : pages.indexOf(page);
  // 交卷頁是最後一頁，所以上一頁一定是段號
  const prevPage = pageIndex > 0 ? (pages[pageIndex - 1] as number) : null;
  const nextPage =
    pageIndex >= 0 && pageIndex < pages.length - 1 ? pages[pageIndex + 1] : null;
  const submitButton = (
    <Button
      disabled={stage !== "running" || !sheet}
      onClick={() => sheet && confirmHandIn(sheet)}
      className="justify-self-start"
    >
      {stage === "submitting" ? t("submitting") : t("submit")}
    </Button>
  );

  // 錄音進度（只顯示，不能拖）
  const progressBar = played && (
    <div className="flex items-center gap-3">
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
  );

  // key 不同：開始後整塊換掉，說明文字不會被當成狀態列沿用（瀏覽器翻譯外掛改過 DOM 時會殘留）
  return (
    <div key="running" className="grid gap-4">
      {sheet?.fullPaper && page !== null ? (
        // 完整考卷：狀態列、錯誤、步驟條一起黏在頂端，翻到哪頁都看得到錄音播到哪。
        // 頂端讓出網站的頂列（手機 61px、電腦 h-14），和審稿頁 ReviewForm 的錄音列同一個位置
        <div className="sticky top-[61px] z-10 grid gap-2 rounded-lg bg-background/95 py-2 md:top-14">
          <p className="font-medium" aria-live="polite">
            {section !== null && t("statusSection", { n: section })}
            {status}
          </p>
          {progressBar}
          {errorText && <Alert tone="error">{errorText}</Alert>}
          <ExamSteps
            left={unansweredBySection(sheet.fullPaper, answers)}
            page={page}
            playing={section}
            onPage={goTo}
          />
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-10 grid gap-2 rounded-lg bg-background/95 py-2">
            <p className="font-medium" aria-live="polite">
              {section !== null && t("statusSection", { n: section })}
              {status}
            </p>
            {progressBar}
          </div>
          {errorText && <Alert tone="error">{errorText}</Alert>}
        </>
      )}
      {sheet?.fullPaper && typeof page === "number" && (
        <FullExamPaper
          paper={sheet.fullPaper}
          section={page}
          answers={answers}
          onChange={changeAnswer}
          disabled={stage !== "running"}
          highlight={phase?.kind === "read" ? phase.questions : null}
        />
      )}
      {sheet?.fullPaper && page === "submit" && (
        <ExamSubmitPage
          left={unansweredBySection(sheet.fullPaper, answers)}
          disabled={stage !== "running"}
          submitting={stage === "submitting"}
          onGo={goTo}
          onHandIn={() => void handIn(sheet.attemptId, true)}
        />
      )}
      {sheet?.fullPaper && (
        <nav aria-label={t("paging.nav")} className="flex flex-wrap gap-2">
          {prevPage !== null && (
            <Button variant="secondary" onClick={() => goTo(prevPage)}>
              {t("paging.prev", { n: prevPage })}
            </Button>
          )}
          {nextPage !== null && (
            <Button
              variant="secondary"
              onClick={() => goTo(nextPage)}
              className="ml-auto"
            >
              {nextPage === "submit"
                ? t("paging.toSubmit")
                : t("paging.next", { n: nextPage })}
            </Button>
          )}
        </nav>
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
      {sheet && !sheet.fullPaper && submitButton}
    </div>
  );
}
