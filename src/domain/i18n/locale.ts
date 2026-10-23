/**
 * 介面語言。考卷內容維持英文，這裡只決定介面、說明、登入信、錯誤訊息用哪種語言。
 * 新增語言：加在 LOCALES，並在 messages/ 加一份同名的翻譯檔。
 */
export const LOCALES = ["zh-TW", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** 使用者手動選的語言存在這個 cookie（瀏覽器寫、伺服器讀） */
export const LOCALE_COOKIE = "locale";

/** 不是中文也不是英文的瀏覽器，先顯示英文 */
export const FALLBACK_LOCALE: Locale = "en";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/**
 * 決定這個請求用哪種語言：
 * 1. 使用者手動選過（cookie）→ 用它
 * 2. 瀏覽器偏好語言（Accept-Language）依序找：中文（含簡體，先顯示繁中）→ zh-TW；英文 → en
 * 3. 都沒有 → 英文
 */
export function resolveLocale(input: {
  cookie: string | null | undefined;
  acceptLanguage: string | null | undefined;
}): Locale {
  if (isLocale(input.cookie)) return input.cookie;
  for (const lang of preferredLanguages(input.acceptLanguage ?? "")) {
    if (lang.startsWith("zh")) return "zh-TW";
    if (lang.startsWith("en")) return "en";
  }
  return FALLBACK_LOCALE;
}

/** Accept-Language 依 q 值由高到低排好，全部轉小寫（例如 "zh-tw"、"en-us"） */
function preferredLanguages(header: string): string[] {
  return header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) : 1, i };
    })
    .filter((x) => x.tag && x.tag !== "*" && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((x) => x.tag);
}
