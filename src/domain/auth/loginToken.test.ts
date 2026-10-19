import { describe, it, expect } from "vitest";
import { isUsable, loginTokenExpiry, LOGIN_TOKEN_TTL_MINUTES } from "./loginToken";

const now = new Date("2026-10-19T12:00:00Z");

describe("loginTokenExpiry", () => {
  it(`應該在 ${LOGIN_TOKEN_TTL_MINUTES} 分鐘後過期`, () => {
    expect(loginTokenExpiry(now).getTime() - now.getTime()).toBe(
      LOGIN_TOKEN_TTL_MINUTES * 60_000,
    );
  });
});

describe("isUsable", () => {
  const base = { tokenHash: "h", email: "a@b.co", expiresAt: loginTokenExpiry(now) };

  it("應該接受沒用過、沒過期的碼", () => {
    expect(isUsable({ ...base, usedAt: null }, now)).toBe(true);
  });

  it("應該拒絕用過的碼", () => {
    expect(isUsable({ ...base, usedAt: now }, now)).toBe(false);
  });

  it("應該拒絕過期的碼", () => {
    const later = new Date(base.expiresAt.getTime() + 1);
    expect(isUsable({ ...base, usedAt: null }, later)).toBe(false);
  });
});
