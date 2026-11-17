import { describe, it, expect } from "vitest";
import { leavesPage } from "./leaveGuard";

const link = (href: string, attrs: { target?: string; download?: boolean } = {}) => ({
  target: attrs.target ?? "",
  hasAttribute: (n: string) => n === "download" && !!attrs.download,
  getAttribute: (n: string) => (n === "href" ? href : null),
});
const click = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};

describe("leavesPage", () => {
  it("一般點選單連結會離開這頁", () => {
    expect(leavesPage(link("/exam"), click)).toBe(true);
  });

  it("開新分頁、下載、同頁錨點不算離開", () => {
    expect(leavesPage(link("/exam", { target: "_blank" }), click)).toBe(false);
    expect(leavesPage(link("/exam"), { ...click, metaKey: true })).toBe(false);
    expect(leavesPage(link("/exam"), { ...click, button: 1 })).toBe(false);
    expect(leavesPage(link("/a.mp3", { download: true }), click)).toBe(false);
    expect(leavesPage(link("#q3"), click)).toBe(false);
  });
});
