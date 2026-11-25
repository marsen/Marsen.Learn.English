import { describe, it, expect } from "vitest";
import { versionHintOf, versionLabel } from "./examSetVersion";

describe("題組列表的版本欄", () => {
  it("2.x 照舊：2.0 沒有逐字稿、2.1 有逐字稿", () => {
    expect(versionLabel({ schemaVersion: 2, schemaMinor: 0 })).toBe("2.0");
    expect(versionHintOf({ schemaVersion: 2, schemaMinor: 0 })).toBe("noTranscript");
    expect(versionLabel({ schemaVersion: 2, schemaMinor: 1 })).toBe("2.1");
    expect(versionHintOf({ schemaVersion: 2, schemaMinor: 1 })).toBe("transcript");
  });

  it("完整考卷顯示 3.0，提示是完整考卷", () => {
    expect(versionLabel({ schemaVersion: 3, schemaMinor: 0 })).toBe("3.0");
    expect(versionHintOf({ schemaVersion: 3, schemaMinor: 0 })).toBe("fullExam");
  });
});
