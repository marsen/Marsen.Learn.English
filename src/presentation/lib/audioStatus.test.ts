import { describe, it, expect } from "vitest";
import { isAudioUnreadable } from "./audioStatus";

describe("isAudioUnreadable", () => {
  it("播放器出錯（例如錄音 404、格式壞掉）時算讀不到", () => {
    expect(isAudioUnreadable({ error: { code: 4 }, networkState: 1 })).toBe(true);
  });
  it("找不到能播的來源時算讀不到", () => {
    expect(isAudioUnreadable({ error: null, networkState: 3 })).toBe(true);
  });
  it("還在載入或已經載好時不算讀不到", () => {
    expect(isAudioUnreadable({ error: null, networkState: 2 })).toBe(false);
    expect(isAudioUnreadable({ error: null, networkState: 1 })).toBe(false);
  });
});
