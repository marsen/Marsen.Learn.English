import { describe, it, expect } from "vitest";
import { waitedDays } from "./waiting";

describe("waitedDays", () => {
  const now = new Date("2026-10-21T10:00:00Z");
  it("應該把未滿一天算成 0 天（今天）", () => {
    expect(waitedDays(new Date("2026-10-21T01:00:00Z"), now)).toBe(0);
  });
  it("應該算出等了幾天", () => {
    expect(waitedDays(new Date("2026-10-17T09:00:00Z"), now)).toBe(4);
  });
});
