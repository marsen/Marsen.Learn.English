import { describe, it, expect } from "vitest";
import { loginCodeMail } from "./loginCodeMail";

describe("loginCodeMail", () => {
  const mail = loginCodeMail("042137");

  it("應該把登入碼放在標題，中英文並列", () => {
    expect(mail.subject).toBe("登入碼 Login code：042137");
  });

  it("應該中文在前、英文在後，兩種都有", () => {
    const zh = mail.text.indexOf("你的登入碼是 042137");
    const en = mail.text.indexOf("Your login code is 042137");
    expect(zh).toBeGreaterThan(-1);
    expect(en).toBeGreaterThan(zh);
    expect(mail.html.indexOf("你的登入碼是")).toBeLessThan(
      mail.html.indexOf("Your login code"),
    );
  });

  it("應該讓 HTML 版最上面就是大字的登入碼", () => {
    expect(mail.html.indexOf("042137")).toBeLessThan(mail.html.indexOf("你的登入碼是"));
    expect(mail.html).toContain("didn&#39;t request it");
  });
});
