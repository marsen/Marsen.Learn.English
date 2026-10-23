import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * 語言切換在瀏覽器完成（LocaleProvider），所以翻譯文字一定要在瀏覽器端元件產生，
 * 否則切換時那一塊會停在舊語言。這個測試擋下伺服器端元件裡的翻譯文字。
 * 唯一例外：頁面的 generateMetadata（瀏覽器頁籤第一次載入的標題）。
 */
const ROOTS = ["src/app", "src/presentation"];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const isClient = (src: string) => /^\s*["']use client["']/.test(src);

/** 拿掉註解（註解裡提到函式名稱不算） */
const withoutComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** 拿掉 generateMetadata 函式本體，剩下的部分不能有 getTranslations */
function withoutMetadata(src: string): string {
  const start = src.indexOf("export async function generateMetadata");
  if (start < 0) return src;
  const end = src.indexOf("\n}\n", start);
  return src.slice(0, start) + src.slice(end < 0 ? src.length : end + 3);
}

describe("多語系規則", () => {
  const serverFiles = ROOTS.flatMap(filesUnder)
    .map((path) => ({ path, src: withoutComments(readFileSync(path, "utf8")) }))
    .filter((f) => !isClient(f.src));

  it("應該不在伺服器端元件用 useTranslations（文字要在瀏覽器產生）", () => {
    const bad = serverFiles
      .filter((f) => /\buseTranslations\b/.test(f.src))
      .map((f) => f.path);
    expect(bad).toEqual([]);
  });

  it("應該只在 generateMetadata 裡用 getTranslations", () => {
    const bad = serverFiles
      .filter((f) => /\bgetTranslations\s*\(/.test(withoutMetadata(f.src)))
      .map((f) => f.path);
    expect(bad).toEqual([]);
  });
});
