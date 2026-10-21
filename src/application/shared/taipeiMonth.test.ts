import { describe, it, expect } from "vitest";
import { monthOf, monthRange, shiftMonth, startOfMonthInTaipei } from "./taipeiMonth";

describe("taipeiMonth", () => {
  it("應該用台灣時間算月初與月份", () => {
    expect(startOfMonthInTaipei(new Date("2026-10-21T09:00:00Z")).toISOString()).toBe(
      "2026-09-30T16:00:00.000Z",
    );
    // UTC 還是 10/31，台灣已經是 11/1
    const late = new Date("2026-10-31T17:00:00Z");
    expect(startOfMonthInTaipei(late).toISOString()).toBe("2026-10-31T16:00:00.000Z");
    expect(monthOf(late)).toBe("2026-11");
  });

  it("應該算出一個月的範圍", () => {
    expect(monthRange("2026-12")).toEqual({
      from: new Date("2026-11-30T16:00:00.000Z"),
      to: new Date("2026-12-31T16:00:00.000Z"),
    });
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("abc")).toBeNull();
  });

  it("應該能跨年移動月份", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});
