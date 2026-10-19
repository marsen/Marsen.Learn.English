import { describe, it, expect } from "vitest";
import { isValidEmail, normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("應該去空白並轉小寫", () => {
    expect(normalizeEmail("  Admin@Marsen.ME ")).toBe("admin@marsen.me");
  });
});

describe("isValidEmail", () => {
  it("應該接受一般 email", () => {
    expect(isValidEmail("admin@marsen.me")).toBe(true);
  });

  it("應該擋下明顯錯誤的格式", () => {
    expect(isValidEmail("admin")).toBe(false);
    expect(isValidEmail("admin@marsen")).toBe(false);
    expect(isValidEmail("a b@marsen.me")).toBe(false);
  });
});
