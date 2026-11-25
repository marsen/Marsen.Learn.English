"use client";

import { splitTimeRefs } from "@/presentation/lib/reviewTime";

/** 跳到錄音的某個時間；有句子編號的話，逐字稿那句也捲進畫面、亮起來 */
export type Seek = (seconds: number, turn?: string) => void;

/**
 * 文字裡的 [mm:ss] 和句子編號（t12、s1-t12）變成可以點的時間，點了跳到錄音那裡。
 * section：這段文字屬於完整考卷的第幾段（只寫 t12 時用來對到 s{n}-t12）
 */
export function TimeText({
  text,
  turnStarts,
  section = null,
  onSeek,
}: {
  text: string;
  turnStarts: ReadonlyMap<string, number>;
  section?: number | null;
  onSeek: Seek;
}) {
  return (
    <>
      {splitTimeRefs(text, turnStarts, section).map((s, i) =>
        s.kind === "text" ? (
          <span key={i}>{s.text}</span>
        ) : (
          <TimeButton key={i} seconds={s.seconds} turn={s.turn} onSeek={onSeek}>
            {s.text}
          </TimeButton>
        ),
      )}
    </>
  );
}

export function TimeButton({
  seconds,
  turn,
  onSeek,
  children,
}: {
  seconds: number;
  turn?: string;
  onSeek: Seek;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onSeek(seconds, turn)}
      className="font-mono text-[0.85em] text-primary-hover underline"
    >
      {children}
    </button>
  );
}
