"use client";

import { useTranslations } from "next-intl";

/**
 * 在伺服器端元件（頁面）裡放一句「含連結或粗體」的翻譯文字。
 * 翻譯檔裡可以用：<login>…</login>（連到登入頁）、<b>…</b>（粗體）。
 * 例如 "你現在看到的是公開考卷。<login>登入</login>後可以寫更多。"
 */
export function RichMsg({ id }: { id: string }) {
  const t = useTranslations();
  return (
    <>
      {t.rich(id, {
        login: (chunks) => (
          <a href="/login" className="text-primary underline">
            {chunks}
          </a>
        ),
        b: (chunks) => <b>{chunks}</b>,
      })}
    </>
  );
}
