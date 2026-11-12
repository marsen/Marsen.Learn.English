import { describe, it, expect } from "vitest";
import { loginRequestState } from "./loginRequestState";

const email = "a@b.com";
const cooldown = {
  ok: false as const,
  error: { code: "cooldown" as const, seconds: 38 },
};

describe("loginRequestState", () => {
  it("寄出成功：進入輸入登入碼的步驟，開發模式附上登入碼", () => {
    expect(
      loginRequestState({
        prev: {},
        email,
        result: { ok: true },
        devCode: "123456",
        now: 1,
      }),
    ).toEqual({ sentTo: email, sentAt: 1, devCode: "123456" });
  });

  it("寄出成功：正式環境不附登入碼", () => {
    expect(
      loginRequestState({ prev: {}, email, result: { ok: true }, devCode: null, now: 1 }),
    ).toEqual({ sentTo: email, sentAt: 1, devCode: undefined });
  });

  it("開發模式被冷卻擋下（例如重新整理後再按）：帶著上一組碼進入輸入登入碼的步驟", () => {
    expect(
      loginRequestState({ prev: {}, email, result: cooldown, devCode: "123456", now: 5 }),
    ).toEqual({ error: cooldown.error, sentTo: email, sentAt: 5, devCode: "123456" });
  });

  it("開發模式在輸入登入碼的步驟按重寄被擋：沿用原本的寄出時間，不清掉已輸入的碼", () => {
    const prev = { sentTo: email, sentAt: 1, devCode: "123456" };
    expect(
      loginRequestState({ prev, email, result: cooldown, devCode: "123456", now: 5 }),
    ).toEqual({ error: cooldown.error, sentTo: email, sentAt: 1, devCode: "123456" });
  });

  it("正式環境被冷卻擋下：維持原本的行為，不給登入碼", () => {
    expect(
      loginRequestState({ prev: {}, email, result: cooldown, devCode: null, now: 5 }),
    ).toEqual({ error: cooldown.error, email, sentTo: undefined, sentAt: undefined });
  });

  it("其他錯誤：即使是開發模式也留在原本的步驟", () => {
    const result = { ok: false as const, error: { code: "emailHourlyLimit" as const } };
    expect(
      loginRequestState({ prev: {}, email, result, devCode: "123456", now: 5 }),
    ).toEqual({ error: result.error, email, sentTo: undefined, sentAt: undefined });
  });
});
