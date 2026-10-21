import type { StatusTag } from "@/domain/examSet/statusTags";

const TAGS: Record<StatusTag, { label: string; title: string; className: string }> = {
  FULL_PASS: {
    label: "全 PASS",
    title: "AI 與老師都通過",
    className: "bg-accent text-accent-foreground ring-accent",
  },
  AIP: {
    label: "AIP",
    title: "AI 審稿通過",
    className: "bg-accent-soft/60 text-accent-hover ring-accent-soft",
  },
  AI_WARN: {
    label: "AI ⚠",
    title: "AI 有疑慮，請老師留意",
    className: "bg-primary-soft/60 text-primary-hover ring-primary/30",
  },
  TP: {
    label: "TP",
    title: "老師審稿通過（考得到）",
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  TR: {
    label: "退回",
    title: "老師審稿不通過（考不到）",
    className: "bg-destructive/10 text-destructive ring-destructive/30",
  },
  WAIT: {
    label: "待審",
    title: "還沒有老師審過（考不到）",
    className: "bg-muted text-muted-foreground ring-border",
  },
};

/** 題組狀態籤（規則在 domain/examSet/statusTags.ts） */
export function StatusTags({ tags }: { tags: StatusTag[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          title={TAGS[t].title}
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${TAGS[t].className}`}
        >
          {TAGS[t].label}
        </span>
      ))}
    </span>
  );
}
