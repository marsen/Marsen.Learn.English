import { describe, it, expect } from "vitest";
import {
  isUsable,
  loginTokenExpiry,
  normalizeLoginCode,
  LOGIN_TOKEN_TTL_MINUTES,
  MAX_CODE_ATTEMPTS,
} from "./loginToken";

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

  it(`應該拒絕輸錯 ${MAX_CODE_ATTEMPTS} 次的碼`, () => {
    const usable = { ...base, usedAt: null };
    expect(isUsable({ ...usable, failedAttempts: MAX_CODE_ATTEMPTS - 1 }, now)).toBe(
      true,
    );
    expect(isUsable({ ...usable, failedAttempts: MAX_CODE_ATTEMPTS }, now)).toBe(false);
  });
});

describe("normalizeLoginCode", () => {
  it("應該去掉空白，只接受 6 位數字", () => {
    expect(normalizeLoginCode(" 123 456 ")).toBe("123456");
    expect(normalizeLoginCode("12345")).toBeNull();
    expect(normalizeLoginCode("1234567")).toBeNull();
    expect(normalizeLoginCode("12a456")).toBeNull();
  });
});
