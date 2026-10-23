import { describe, it, expect } from "vitest";
import { createTranslator, type AbstractIntlMessages } from "next-intl";
import zh from "../../../messages/zh-TW.json";
import en from "../../../messages/en.json";
import { loginErrorText, reviewErrorText } from "./errorMessages";

type Translate = Parameters<typeof loginErrorText>[0];
const translatorFor = (locale: string, messages: AbstractIntlMessages) =>
  createTranslator({ locale, messages }) as unknown as Translate;

const translators = {
  "zh-TW": translatorFor("zh-TW", zh),
  en: translatorFor("en", en),
};

describe("loginErrorText", () => {
  it("應該把等待秒數、剩幾次放進訊息", () => {
    const t = translators["zh-TW"];
    expect(loginErrorText(t, { code: "cooldown", seconds: 30 })).toBe(
      "剛寄過，請等 30 秒再試",
    );
    expect(loginErrorText(t, { code: "wrongCode", remaining: 2 })).toBe(
      "登入碼不對，還可以再試 2 次",
    );
    expect(loginErrorText(translators.en, { code: "wrongCode", remaining: 1 })).toBe(
      "Wrong code. 1 try left",
    );
  });
});

describe("reviewErrorText", () => {
  it("應該把題號與字數上限放進訊息", () => {
    const t = translators["zh-TW"];
    expect(
      reviewErrorText(t, { code: "questionNoteTooLong", questionId: "q03", max: 2000 }),
    ).toBe("q03 的建議最多 2000 字");
    expect(reviewErrorText(t, { code: "unknownQuestion", questionId: "q99" })).toBe(
      "沒有這一題：q99",
    );
  });
});
