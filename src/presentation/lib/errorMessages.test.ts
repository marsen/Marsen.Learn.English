import { describe, it, expect } from "vitest";
import { loginErrorText, reviewErrorText } from "./errorMessages";

describe("loginErrorText", () => {
  it("應該把等待秒數放進訊息", () => {
    expect(loginErrorText({ code: "cooldown", seconds: 30 })).toBe(
      "剛寄過，請等 30 秒再試",
    );
  });

  it("應該每個代碼都有文字", () => {
    for (const code of [
      "invalidEmail",
      "malformedCode",
      "codeExpired",
      "emailHourlyLimit",
      "ipHourlyLimit",
      "signupsFull",
    ] as const) {
      expect(loginErrorText({ code })).not.toBe("");
    }
  });
});

describe("loginErrorText：登入碼", () => {
  it("應該告訴使用者還可以再試幾次", () => {
    expect(loginErrorText({ code: "wrongCode", remaining: 2 })).toBe(
      "登入碼不對，還可以再試 2 次",
    );
  });
});

describe("reviewErrorText", () => {
  it("應該把題號與字數上限放進訊息", () => {
    expect(
      reviewErrorText({ code: "questionNoteTooLong", questionId: "q03", max: 2000 }),
    ).toBe("q03 的建議最多 2000 字");
    expect(reviewErrorText({ code: "unknownQuestion", questionId: "q99" })).toBe(
      "沒有這一題：q99",
    );
  });
});
