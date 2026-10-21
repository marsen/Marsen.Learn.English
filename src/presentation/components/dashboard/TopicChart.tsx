/** 情境主題統計（目前是假資料，之後接真的） */
const FAKE_TOPICS: { label: string; count: number }[] = [
  { label: "健身房", count: 4 },
  { label: "租車", count: 3 },
  { label: "圖書館", count: 2 },
  { label: "飯店", count: 1 },
  { label: "看醫生", count: 0 },
];

export function TopicChart() {
  const max = Math.max(1, ...FAKE_TOPICS.map((t) => t.count));
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <ul className="grid gap-2">
        {FAKE_TOPICS.map((t) => (
          <li
            key={t.label}
            className={`relative flex items-center justify-between overflow-hidden rounded-md px-3 py-1.5 text-sm ${
              t.count === 0 ? "bg-destructive/10 text-destructive" : "bg-muted"
            }`}
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 bg-primary-soft"
              style={{ width: `${(t.count / max) * 100}%` }}
            />
            <span className="relative">{t.label}</span>
            <b className="relative">{t.count}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
