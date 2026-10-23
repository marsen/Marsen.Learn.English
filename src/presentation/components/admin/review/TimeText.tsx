"use client";

import { splitTimeRefs } from "@/presentation/lib/reviewTime";

/** 文字裡的 [mm:ss] 和句子編號（t12）變成可以點的時間，點了跳到錄音那裡 */
export function TimeText({
  text,
  turnStarts,
  onSeek,
}: {
  text: string;
  turnStarts: ReadonlyMap<string, number>;
  onSeek: (seconds: number) => void;
}) {
  return (
    <>
      {splitTimeRefs(text, turnStarts).map((s, i) =>
        s.kind === "text" ? (
          <span key={i}>{s.text}</span>
        ) : (
          <TimeButton key={i} seconds={s.seconds} onSeek={onSeek}>
            {s.text}
          </TimeButton>
        ),
      )}
    </>
  );
}

export function TimeButton({
  seconds,
  onSeek,
  children,
}: {
  seconds: number;
  onSeek: (seconds: number) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onSeek(seconds)}
      className="font-mono text-[0.85em] text-primary-hover underline"
    >
      {children}
    </button>
  );
}
