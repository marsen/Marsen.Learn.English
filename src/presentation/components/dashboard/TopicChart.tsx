"use client";

import { useTranslations } from "next-intl";

/** 情境主題統計（目前是假資料，之後接真的）；主題名稱在翻譯檔 adminDashboard.topics.* */
const FAKE_TOPICS: { key: string; count: number }[] = [
  { key: "gym", count: 4 },
  { key: "carRental", count: 3 },
  { key: "library", count: 2 },
  { key: "hotel", count: 1 },
  { key: "doctor", count: 0 },
];

export function TopicChart() {
  const t = useTranslations("adminDashboard.topics");
  const max = Math.max(1, ...FAKE_TOPICS.map((x) => x.count));
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <ul className="grid gap-2">
        {FAKE_TOPICS.map((x) => (
          <li
            key={x.key}
            className={`relative flex items-center justify-between overflow-hidden rounded-md px-3 py-1.5 text-sm ${
              x.count === 0 ? "bg-destructive/10 text-destructive" : "bg-muted"
            }`}
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 bg-primary-soft"
              style={{ width: `${(x.count / max) * 100}%` }}
            />
            <span className="relative">{t(x.key)}</span>
            <b className="relative">{x.count}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
