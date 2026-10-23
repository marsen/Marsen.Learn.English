"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** 送出表單時用的欄位名稱（值是 6 位數字串） */
  name: string;
  length: number;
  /** 上一次輸入錯了：方格變紅、晃一下 */
  invalid?: boolean;
  disabled?: boolean;
  /** 給螢幕閱讀器的名稱 */
  label: string;
};

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/**
 * 登入碼方格：一格一個數字。
 * - 輸入後跳下一格；刪除鍵在空格時退回上一格；左右鍵移動
 * - 貼上或手機自動帶入整串數字：從目前這格往後填滿
 * - 填滿最後一格就自動送出表單
 * 要清空重來時，由外層換 key 重新掛載。
 */
export function CodeInput({ name, length, invalid, disabled, label }: Props) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const value = digits.join("");

  // 填滿就送出（每次填滿只送一次；輸錯後外層會重新掛載，清空重來）
  useEffect(() => {
    if (value.length === length) boxes.current[0]?.form?.requestSubmit();
  }, [value, length]);

  const focus = (i: number) =>
    boxes.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  /** 從第 i 格開始放入一串數字 */
  const fillFrom = (i: number, text: string) => {
    const incoming = onlyDigits(text)
      .slice(0, length - i)
      .split("");
    if (incoming.length === 0) return;
    setDigits((d) => {
      const next = [...d];
      incoming.forEach((c, k) => (next[i + k] = c));
      return next;
    });
    focus(i + incoming.length);
  };

  const clearAt = (i: number) => setDigits((d) => d.map((c, k) => (k === i ? "" : c)));

  return (
    <div
      role="group"
      aria-label={label}
      className={`flex justify-between gap-2 ${invalid ? "shake" : ""}`}
    >
      <input type="hidden" name={name} value={value} />
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          id={i === 0 ? `${name}-0` : undefined}
          aria-label={`${label} ${i + 1}`}
          aria-invalid={invalid || undefined}
          value={digit}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={i === 0}
          maxLength={length}
          onChange={(e) => {
            const typed = onlyDigits(e.target.value);
            if (typed === "") clearAt(i);
            else
              fillFrom(i, typed.length > 1 && digit ? typed.replace(digit, "") : typed);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digit && i > 0) {
              e.preventDefault();
              clearAt(i - 1);
              focus(i - 1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              focus(i - 1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              focus(i + 1);
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            fillFrom(i, e.clipboardData.getData("text"));
          }}
          onFocus={(e) => e.target.select()}
          className={`h-14 w-full min-w-0 rounded-lg border-2 bg-surface text-center font-mono text-2xl font-semibold transition-colors focus:outline-none disabled:opacity-60 ${
            invalid
              ? "border-destructive text-destructive"
              : "border-border focus:border-primary"
          }`}
        />
      ))}
    </div>
  );
}
