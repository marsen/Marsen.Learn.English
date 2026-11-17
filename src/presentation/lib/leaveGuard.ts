/**
 * 考試進行中，學生要離開這頁先問一聲（AC-1）：
 * ① beforeunload：重新整理、關分頁、整頁跳轉（瀏覽器自己的提示，文字不能改；iPhone Safari 不支援）
 * ② 在 document 用 capture 攔連結的 click 和表單 submit（左側選單、登出）
 * ③ 進來時多推一筆歷史紀錄，按上一頁先回到這筆，問過再真的離開
 * 回傳 release()：交卷前一定要先呼叫，不然交卷後跳成績頁會又跳出提醒。
 */
export function installLeaveGuard(message: string): () => void {
  // 已經按「確定離開」：後面的 beforeunload 不要再問一次
  let leaving = false;
  let released = false;

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (leaving) return;
    e.preventDefault();
    // 舊版 Chrome、Edge 要設 returnValue 才會問
    e.returnValue = "";
  };

  const ask = (e: Event) => {
    if (leaving) return;
    if (window.confirm(message)) {
      leaving = true;
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const onClick = (e: MouseEvent) => {
    if (!(e.target instanceof Element)) return;
    const a = e.target.closest("a[href]");
    if (!(a instanceof HTMLAnchorElement)) return;
    if (!leavesPage(a, e)) return;
    ask(e);
  };

  const onSubmit = (e: SubmitEvent) => ask(e);

  const onPopState = () => {
    if (released) return;
    if (!leaving && window.confirm(message)) {
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
