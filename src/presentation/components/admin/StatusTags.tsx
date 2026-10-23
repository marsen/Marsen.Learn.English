"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StatusTag } from "@/domain/examSet/statusTags";

// U+FE0E 強制文字樣式，符號才吃得到顏色
const CHECK = "✔︎";
const CROSS = "✘";
const WARN = "⚠︎";

/** 說明文字在翻譯檔 examSet.statusTag.<代碼> */
const TAGS: Record<StatusTag, { who: string; mark: string; className: string }> = {
  FULL_PASS: {
    who: "✅",
    mark: "",
    className: "bg-accent ring-accent",
  },
  AIP: {
    who: "🤖",
    mark: CHECK,
    className: "bg-accent-soft/60 text-accent-hover ring-accent-soft",
  },
  AI_WARN: {
    who: "🤖",
    mark: WARN,
    className: "bg-primary-soft/60 text-primary-hover ring-primary/30",
  },
  TP: {
    who: "🍵",
    mark: CHECK,
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  TR: {
    who: "🍵",
    mark: CROSS,
    className: "bg-destructive/10 text-destructive ring-destructive/30",
  },
  WAIT: {
    who: "🍵",
    mark: "…",
    className: "bg-muted text-muted-foreground ring-border",
  },
};

/** 題組審核狀態，滑過（或 Tab 聚焦）馬上顯示說明（規則在 domain/examSet/statusTags.ts） */
export function StatusTags({ tags }: { tags: StatusTag[] }) {
  return (
    <span className="inline-flex gap-1.5">
      {tags.map((t) => (
        <Tag key={t} tag={t} />
      ))}
    </span>
  );
}

function Tag({ tag }: { tag: StatusTag }) {
  const t = useTranslations("examSet.statusTag");
  const { who, mark, className } = TAGS[tag];
  const title = t(tag);
  // 提示框用 fixed 定位，才不會被表格的 overflow 裁掉
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const show = (e: React.SyntheticEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.bottom + 6 });
  };
  const hide = () => setPos(null);

  return (
    <span
      role="img"
      aria-label={title}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className={`inline-flex h-7 cursor-help items-center gap-1 rounded-full px-2 text-sm leading-none font-bold whitespace-nowrap ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
    >
      <span aria-hidden="true">{who}</span>
      {mark && <span aria-hidden="true">{mark}</span>}
      {pos && (
        <span
          aria-hidden="true"
          className="pointer-events-none fixed z-50 -translate-x-1/2 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-background shadow-lg"
          style={{ left: pos.x, top: pos.y }}
        >
          {title}
        </span>
      )}
    </span>
  );
}
