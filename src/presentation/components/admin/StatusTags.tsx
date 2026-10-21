import type { StatusTag } from "@/domain/examSet/statusTags";

/** 圖示路徑（24×24、線條風格，跟側邊欄一致） */
const ICONS: Record<StatusTag, React.ReactNode> = {
  // 徽章打勾
  FULL_PASS: (
    <>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  // 星芒（AI）
  AIP: (
    <>
      <path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0Z" />
    </>
  ),
  // 三角驚嘆號
  AI_WARN: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  // 人＋打勾（老師通過）
  TP: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m16 11 2 2 4-4" />
    </>
  ),
  // 人＋叉（老師退回）
  TR: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m17 8 5 5" />
      <path d="m22 8-5 5" />
    </>
  ),
  // 時鐘（待審）
  WAIT: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
};

const TAGS: Record<StatusTag, { title: string; className: string }> = {
  FULL_PASS: {
    title: "全 PASS：AI 與老師都通過",
    className: "bg-accent text-accent-foreground ring-accent",
  },
  AIP: {
    title: "AI 審稿通過",
    className: "bg-accent-soft/60 text-accent-hover ring-accent-soft",
  },
  AI_WARN: {
    title: "AI 有疑慮，請老師留意",
    className: "bg-primary-soft/60 text-primary-hover ring-primary/30",
  },
  TP: {
    title: "老師審稿通過（考得到）",
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  TR: {
    title: "老師退回（考不到）",
    className: "bg-destructive/10 text-destructive ring-destructive/30",
  },
  WAIT: {
    title: "待審：還沒有老師審過（考不到）",
    className: "bg-muted text-muted-foreground ring-border",
  },
};

/** 題組狀態圖示，滑過看說明（規則在 domain/examSet/statusTags.ts） */
export function StatusTags({ tags }: { tags: StatusTag[] }) {
  return (
    <span className="inline-flex gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          role="img"
          aria-label={TAGS[t].title}
          title={TAGS[t].title}
          className={`inline-flex h-7 w-7 cursor-help items-center justify-center rounded-full ring-1 ring-inset ${TAGS[t].className}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            {ICONS[t]}
          </svg>
        </span>
      ))}
    </span>
  );
}
