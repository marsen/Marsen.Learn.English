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
      "invalidLink",
      "emailHourlyLimit",
      "ipHourlyLimit",
      "signupsFull",
    ] as const) {
      expect(loginErrorText({ code })).not.toBe("");
    }
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
