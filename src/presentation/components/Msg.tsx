"use client";

import { useTranslations } from "next-intl";

/**
 * 在伺服器端元件（頁面）裡放一句翻譯文字：文字在瀏覽器產生，切換語言時會跟著變。
 * 例如 <Msg id="dashboard.title" />、<Msg id="review.questionCount" values={{ count: 10 }} />
 */
export function Msg({
  id,
  values,
}: {
  id: string;
  values?: Record<string, string | number>;
}) {
  const t = useTranslations();
  return <>{t(id, values)}</>;
}
