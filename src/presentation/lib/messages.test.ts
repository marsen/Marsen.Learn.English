import { describe, it, expect } from "vitest";
import zh from "../../../messages/zh-TW.json";
import en from "../../../messages/en.json";

/** 列出翻譯檔所有的 key（例如 login.title） */
function keysOf(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("翻譯檔", () => {
  it("應該每種語言的 key 都一樣（不會有一邊漏翻）", () => {
    expect(keysOf(en).sort()).toEqual(keysOf(zh).sort());
  });
});
