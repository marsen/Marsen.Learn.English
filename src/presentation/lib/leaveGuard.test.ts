import { afterEach, describe, it, expect, vi } from "vitest";
import { installLeaveGuard, leavesPage } from "./leaveGuard";

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

/** 假的 window、document（測試環境是 node，沒有 DOM） */
function fakeBrowser(confirmAnswer: boolean) {
  const win = new EventTarget() as EventTarget & Record<string, unknown>;
  const history = { state: null, pushState: vi.fn(), back: vi.fn() };
  const confirm = vi.fn(() => confirmAnswer);
  Object.assign(win, { history, confirm, location: { href: "/x" } });
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", new EventTarget());
  return { win, history, confirm };
}
const unload = () => {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};
const submit = (form: object) => {
  const e = new Event("submit", { cancelable: true });
  Object.defineProperty(e, "target", { value: form });
  document.dispatchEvent(e);
  return e;
};

describe("installLeaveGuard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("不給選項（考試頁）：重新整理一律問、表單送出先問，行為不變", () => {
    const { confirm, history } = fakeBrowser(false);
    const release = installLeaveGuard(() => "要離開嗎");
    expect(history.pushState).toHaveBeenCalledTimes(1);
    expect(unload()).toBe(true);
    expect(submit({}).defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledWith("要離開嗎");
    release();
    expect(unload()).toBe(false);
  });

  it("shouldAsk 回 false 就不問：重新整理、送出、上一頁都直接放行", () => {
    const { confirm, history } = fakeBrowser(false);
    let dirty = false;
    installLeaveGuard(() => "要離開嗎", undefined, { shouldAsk: () => dirty });
    expect(unload()).toBe(false);
    expect(submit({}).defaultPrevented).toBe(false);
    window.dispatchEvent(new Event("popstate"));
    expect(history.back).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    dirty = true;
    expect(unload()).toBe(false); // 已經放行離開，不再問
  });

  it("shouldAsk 回 true 才問；ignoreForm 的表單送出不問", () => {
    const { confirm } = fakeBrowser(false);
    const mine = { review: true };
    installLeaveGuard(() => "要離開嗎", undefined, {
      shouldAsk: () => true,
      ignoreForm: (f) => f === (mine as unknown as HTMLFormElement),
    });
    expect(submit(mine).defaultPrevented).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(submit({}).defaultPrevented).toBe(true);
    expect(unload()).toBe(true);
  });
});
