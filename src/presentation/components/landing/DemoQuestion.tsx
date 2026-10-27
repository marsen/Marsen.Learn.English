"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { LandingDemoView } from "@/application/exam/landingDemo";
import { matchesAnswer } from "@/domain/exam/grading";
import { ExamPaper } from "@/presentation/components/exam/ExamPaper";
import { Wave } from "./icons";

type Stage = "idle" | "playing" | "ended";

/**
 * 首頁的「先試做一題」：從正式題組剪下來的一段錄音（只播一次、不能暫停），
 * 邊聽邊填，交卷用正式的批改規則。播放時不顯示對話文字（不然變成考閱讀），交卷後才給逐字稿。
 */
export function DemoQuestion({
  demo,
  examHref,
}: {
  demo: LandingDemoView;
  examHref: string;
}) {
  const td = useTranslations("landing.demo");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const play = () => {
    if (stage !== "idle") return;
    const audio = new Audio(demo.audioUrl);
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () =>
      setProgress(Math.min(1, audio.currentTime / demo.duration)),
    );
    audio.addEventListener("ended", () => {
      setProgress(1);
      setStage("ended");
    });
    setStage("playing");
    audio.play().catch(() => {
      setError(true);
      setStage("idle");
      audioRef.current = null;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    audioRef.current?.pause();
    setStage("ended");
    setSubmitted(true);
  };

  const results = demo.answers.map((a) => ({
    ...a,
    ok: matchesAnswer(a, answers[a.questionId] ?? ""),
  }));
  const quoteOf = (turnId: string) => demo.evidence.find((e) => e.turn === turnId)?.quote;

  const status = error
    ? td("playFailed")
    : stage === "idle"
      ? td("idle")
      : stage === "playing"
        ? td("playing")
        : td("ended");

  return (
    <div className="rounded-3xl border border-primary-soft bg-card/60 p-6 md:p-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={play}
          disabled={stage !== "idle" || submitted}
          aria-label={td("playAria")}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition hover:scale-105 hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            {status}
          </p>
        </div>
        <Wave paused={stage !== "playing"} className="text-accent" />
      </div>

      <form onSubmit={submit} className="mt-6" autoComplete="off">
        <ExamPaper
          paper={demo.paper}
          answers={answers}
          onChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
          disabled={submitted}
          highlight={null}
        />
        {!submitted && (
          <button
            disabled={stage === "idle"}
            className="mt-6 rounded-full bg-primary px-6 py-2.5 font-medium text-primary-foreground transition hover:scale-105 hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
          >
            {td("submit")}
          </button>
        )}
      </form>

      {submitted && (
        <div className="mt-6 grid gap-4" aria-live="polite">
          {results.map((r) => (
            <p
              key={r.questionId}
              className={`text-lg font-semibold ${r.ok ? "text-accent" : "text-primary-hover"}`}
            >
              {r.ok ? td("correct") : td("wrong", { answer: r.answer })}
            </p>
          ))}
          <details className="rounded-2xl bg-surface px-5 py-4" open>
            <summary className="cursor-pointer font-medium">{td("transcript")}</summary>
            <ol className="mt-3 grid gap-2 text-sm">
              {demo.transcript.map((line) => {
                const quote = quoteOf(line.id);
                return (
                  <li
                    key={line.id}
                    className={quote ? "rounded-md bg-primary-soft/50 px-2" : "px-2"}
                  >
                    <b className="mr-1">{line.speaker}:</b>
                    {line.text}
                  </li>
                );
              })}
            </ol>
          </details>
          <a href={examHref} className="font-medium text-primary underline">
            {td("fullTest")}
          </a>
        </div>
      )}
    </div>
  );
}
