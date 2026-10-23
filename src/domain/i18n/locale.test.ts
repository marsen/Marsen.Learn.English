import { describe, it, expect } from "vitest";
import { resolveLocale } from "./locale";

const r = (cookie: string | null, acceptLanguage: string | null) =>
  resolveLocale({ cookie, acceptLanguage });

describe("resolveLocale", () => {
  it("應該優先用使用者手動選的語言", () => {
    expect(r("en", "zh-TW,zh;q=0.9")).toBe("en");
    expect(r("zh-TW", "en-US")).toBe("zh-TW");
  });

  it("應該忽略不認得的 cookie，改看瀏覽器", () => {
    expect(r("ja", "zh-TW")).toBe("zh-TW");
  });

  it("應該把中文瀏覽器（含簡體）都先顯示繁中", () => {
    expect(r(null, "zh-TW,zh;q=0.9,en;q=0.8")).toBe("zh-TW");
    expect(r(null, "zh-CN")).toBe("zh-TW");
  });

  it("應該讓英文瀏覽器（含菲律賓英文）顯示英文", () => {
    expect(r(null, "en-PH,en;q=0.9")).toBe("en");
  });

  it("應該依偏好順序找第一個有的語言", () => {
    expect(r(null, "ja-JP,ja;q=0.9,zh-TW;q=0.8,en;q=0.7")).toBe("zh-TW");
    expect(r(null, "fil;q=0.9,en;q=0.8,zh;q=0.5")).toBe("en");
    expect(r(null, "en;q=0.5,zh-TW;q=0.9")).toBe("zh-TW");
  });

  it("應該在不是中文也不是英文時顯示英文", () => {
    expect(r(null, "ja-JP,ja;q=0.9")).toBe("en");
    expect(r(null, "th")).toBe("en");
    expect(r(null, null)).toBe("en");
    expect(r(null, "")).toBe("en");
  });
});
