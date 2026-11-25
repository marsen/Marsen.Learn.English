export type LeaveGuardOptions = {
  /** 每次要離開時才問：回 false 就不問、直接放行（審稿頁：沒有暫存就不問）。沒給＝一律問 */
  shouldAsk?: () => boolean;
  /** 這個表單送出不算離開（審稿頁自己的送出） */
  ignoreForm?: (form: HTMLFormElement) => boolean;
};

/**
 * 考試進行中，學生要離開這頁先問一聲（AC-1）：
 * ① beforeunload：重新整理、關分頁、整頁跳轉（瀏覽器自己的提示，文字不能改；iPhone Safari 不支援）
 * ② 在 document 用 capture 攔連結的 click 和表單 submit（左側選單、登出）
 * ③ 進來時多推一筆歷史紀錄，按上一頁先回到這筆，問過再真的離開
 * message 每次問的時候才讀（考試中切換介面語言也跟著換）。
 * 回傳 release()：交卷前一定要先呼叫，不然交卷後跳成績頁會又跳出提醒。
 */
export function installLeaveGuard(
  message: () => string,
  /** 考試中按登出、又按「確定離開」時呼叫（清掉這次的暫存答案；其他離開方式不清，回到考試頁時拿去交卷（AC-3）） */
  onLogoutConfirmed?: () => void,
  options: LeaveGuardOptions = {},
): () => void {
  const shouldAsk = () => options.shouldAsk?.() ?? true;
  // 已經按「確定離開」：後面的 beforeunload 不要再問一次
  let leaving = false;
  let released = false;

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (leaving || !shouldAsk()) return;
    e.preventDefault();
    // 舊版 Chrome、Edge 要設 returnValue 才會問
    e.returnValue = "";
  };

  /** 問學生；回傳是不是確定離開 */
  const ask = (e: Event): boolean => {
    if (leaving || !shouldAsk()) return true;
    if (window.confirm(message())) {
      leaving = true;
      return true;
    }
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  const onClick = (e: MouseEvent) => {
    if (!(e.target instanceof Element)) return;
    const a = e.target.closest("a[href]");
    if (!(a instanceof HTMLAnchorElement)) return;
    if (!leavesPage(a, e)) return;
    ask(e);
  };

  const onSubmit = (e: SubmitEvent) => {
    const form = e.target as HTMLFormElement | null;
    if (form && options.ignoreForm?.(form)) return;
    if (ask(e) && isLogoutForm(e.target)) onLogoutConfirmed?.();
  };

  const onPopState = () => {
    if (released) return;
    // 不用問：照常回上一頁（進來時多推的那筆也要跳過）
    if (!leaving && !shouldAsk()) {
      leaving = true;
      window.history.back();
      return;
    }
    if (!leaving && window.confirm(message())) {
      leaving = true;
      window.history.back();
      return;
    }
    if (!leaving)
      window.history.pushState(window.history.state, "", window.location.href);
  };

  window.history.pushState(window.history.state, "", window.location.href);
  window.addEventListener("beforeunload", onBeforeUnload);
  document.addEventListener("click", onClick, true);
  document.addEventListener("submit", onSubmit, true);
  window.addEventListener("popstate", onPopState);

  return () => {
    if (released) return;
    released = true;
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("submit", onSubmit, true);
    window.removeEventListener("popstate", onPopState);
  };
}

/** 這個連結點下去會不會離開這頁：開新分頁、下載、同頁錨點不算 */
export function leavesPage(
  a: Pick<HTMLAnchorElement, "target" | "hasAttribute" | "getAttribute">,
  e: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;
  const href = a.getAttribute("href") ?? "";
  return !href.startsWith("#");
}

/** 登出的表單（AppSidebar 的 <form data-logout>） */
export function isLogoutForm(target: EventTarget | null): boolean {
  return (
    typeof HTMLFormElement !== "undefined" &&
    target instanceof HTMLFormElement &&
    target.hasAttribute("data-logout")
  );
}
