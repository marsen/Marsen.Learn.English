"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { matchesAnswer } from "@/domain/exam/grading";
import { LANDING } from "@/presentation/content/landing";
import { Wave } from "./icons";

const T = LANDING.demo;

// 示意題的答案卡，用跟正式考試一樣的批改規則；答錯的提示在翻譯檔 landing.demo.hints.<題號>
const KEY = {
  q1: { answer: "37", accepted: [], policy: "digits_only" as const },
  q2: { answer: "mornings", accepted: ["morning"], policy: "exact_word" as const },
};

/** 首頁的「試做一題」：文字代替錄音（只播一次），交卷用正式的批改規則。 */
export function DemoQuestion() {
  const t = useTranslations("landing.demo");
  const [line, setLine] = useState(-1);
  const [ended, setEnded] = useState(false);
  const [answers, setAnswers] = useState({ q1: "", q2: "" });
  const [result, setResult] = useState<{ score: number; hints: string[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const play = () => {
    if (line >= 0) return;
    const step = (i: number) => {
      setLine(i);
      timer.current = setTimeout(
        () => (i + 1 < T.lines.length ? step(i + 1) : setEnded(true)),
        2200,
      );
    };
    step(0);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const checks = (Object.keys(KEY) as (keyof typeof KEY)[]).map((q) => ({
      ok: matchesAnswer(KEY[q], answers[q]),
      hint: t(`hints.${q}`),
    }));
    setResult({
      score: checks.filter((c) => c.ok).length,
      hints: checks.filter((c) => !c.ok).map((c) => c.hint),
    });
  };

  const playing = line >= 0 && !ended;
  const status = line < 0 ? t("idle") : ended ? t("ended") : t("playing");
  const input =
    "border-0 border-b border-foreground bg-transparent px-1 focus:outline-none focus:ring-2 focus:ring-primary-soft";

  return (
    <div className="rounded-3xl border border-primary-soft bg-card/60 p-6 md:p-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={play}
          disabled={line >= 0}
          aria-label={t("playAria")}
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
              style={{ width: `${((line + 1) / T.lines.length) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{status}</p>
        </div>
        <Wave paused={!playing} className="text-accent" />
      </div>

      <p className="mt-6 min-h-14 rounded-2xl bg-surface px-5 py-4 italic">
        {line >= 0 ? T.lines[line] : ""}
      </p>

      <form
        onSubmit={submit}
        className="mt-6 rounded-2xl bg-surface p-5 md:p-6"
        autoComplete="off"
      >
        <p className="text-center font-semibold text-heading">{T.paperTitle}</p>
        <p className="mt-1 text-center text-sm text-muted-foreground italic">
          {T.instruction}
        </p>
        <div className="mt-5 space-y-4">
          <label className="flex flex-wrap items-center gap-2">
            <span>• Address:</span>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              1
            </span>
            <input
              aria-label="Question 1"
              value={answers.q1}
              onChange={(e) => setAnswers((a) => ({ ...a, q1: e.target.value }))}
              className={`w-24 ${input}`}
            />
            <span>Maple Court</span>
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <span>• Preferred time:</span>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              2
            </span>
            <input
              aria-label="Question 2"
              value={answers.q2}
              onChange={(e) => setAnswers((a) => ({ ...a, q2: e.target.value }))}
              className={`w-32 ${input}`}
            />
          </label>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-foreground transition hover:scale-105 hover:bg-primary-hover">
            {t("submit")}
          </button>
          {result && (
            <p
              className={`text-sm font-medium ${result.score === 2 ? "text-accent" : "text-primary-hover"}`}
              aria-live="polite"
            >
              {result.score} / 2　{result.hints.join("")}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
