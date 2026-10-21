import { describe, it, expect } from "vitest";
import { waitedLabel } from "./waiting";

describe("waitedLabel", () => {
  const now = new Date("2026-10-21T10:00:00Z");
  it("應該把未滿一天顯示成今天", () => {
    expect(waitedLabel(new Date("2026-10-21T01:00:00Z"), now)).toBe("今天");
  });
  it("應該顯示等了幾天", () => {
    expect(waitedLabel(new Date("2026-10-17T09:00:00Z"), now)).toBe("4 天");
  });
});
