"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/**
 * 切換語言時更新瀏覽器頁籤上的標題。
 * 第一次載入的標題由頁面的 generateMetadata 在伺服器產生，這個元件只負責之後的切換。
 */
export function DocumentTitle({ id }: { id: string }) {
  const t = useTranslations();
  const title = t(id);
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}
