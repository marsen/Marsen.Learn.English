import { describe, it, expect } from "vitest";
import { isAudioUnreadable } from "./audioStatus";

describe("isAudioUnreadable", () => {
  it("播放器出錯（例如錄音 404、格式壞掉）時算讀不到", () => {
    expect(isAudioUnreadable({ error: { code: 4 } })).toBe(true);
  });
  it("沒有錯誤時不算讀不到（剛開始載入的短暫狀態也不算，避免閃一下提示）", () => {
    expect(isAudioUnreadable({ error: null })).toBe(false);
  });
});
