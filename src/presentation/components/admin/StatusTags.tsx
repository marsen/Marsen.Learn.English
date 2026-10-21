import type { StatusTag } from "@/domain/examSet/statusTags";

// U+FE0E 強制文字樣式，符號才吃得到顏色
const CHECK = "✔︎";
const CROSS = "✘";
const WARN = "⚠︎";

const TAGS: Record<
  StatusTag,
  { who: string; mark: string; title: string; className: string }
> = {
  FULL_PASS: {
    who: "✅",
    mark: "",
    title: "全 PASS：AI 與老師都通過",
    className: "bg-accent ring-accent",
  },
  AIP: {
    who: "🤖",
    mark: CHECK,
    title: "AI 審稿通過",
    className: "bg-accent-soft/60 text-accent-hover ring-accent-soft",
  },
  AI_WARN: {
    who: "🤖",
    mark: WARN,
    title: "AI 有疑慮，請老師留意",
    className: "bg-primary-soft/60 text-primary-hover ring-primary/30",
  },
  TP: {
    who: "🍵",
    mark: CHECK,
    title: "老師審稿通過（考得到）",
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  TR: {
    who: "🍵",
    mark: CROSS,
    title: "老師退回（考不到）",
    className: "bg-destructive/10 text-destructive ring-destructive/30",
  },
  WAIT: {
    who: "🍵",
    mark: "…",
    title: "待審：還沒有老師審過（考不到）",
    className: "bg-muted text-muted-foreground ring-border",
  },
};

/** 題組審核狀態，滑過看說明（規則在 domain/examSet/statusTags.ts） */
export function StatusTags({ tags }: { tags: StatusTag[] }) {
  return (
    <span className="inline-flex gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          role="img"
          aria-label={TAGS[t].title}
          title={TAGS[t].title}
          className={`inline-flex h-7 cursor-help items-center gap-1 rounded-full px-2 text-sm leading-none font-bold whitespace-nowrap ring-1 ring-inset ${TAGS[t].className}`}
        >
          <span aria-hidden="true">{TAGS[t].who}</span>
          {TAGS[t].mark && <span aria-hidden="true">{TAGS[t].mark}</span>}
        </span>
      ))}
    </span>
  );
}
