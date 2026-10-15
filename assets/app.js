// 候補頁共用腳本：來源追蹤、事件記錄、表單送出。沒有任何外部相依。
(() => {
  "use strict";

  const TRACKING_KEY = "waitlist.tracking";
  const LOCAL_SUBMISSIONS_KEY = "waitlist.local-submissions";
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const TRACKING_PARAMS = ["src", "utm_source", "utm_medium", "utm_campaign"];

  // 設定在送出時才讀，方便在不重新載入頁面的情況下調整（測試也會用到）。
  const getConfig = () =>
    Object.assign(
      { formEndpoint: "", formMode: "cors", fieldMap: {}, contactEmail: "" },
      window.WAITLIST_CONFIG || {}
    );

  const page = document.body.dataset.page || "unknown";
  const events = (window.__events = []);

  function storage(kind) {
    try {
      const store = window[kind];
      store.setItem("__probe", "1");
      store.removeItem("__probe");
      return store;
    } catch (error) {
      return null;
    }
  }
  const session = storage("sessionStorage");
  const persistent = storage("localStorage");

  // ---- 來源追蹤 ---------------------------------------------------------

  function clean(value) {
    return String(value || "")
      .replace(/[\u0000-\u001f]/g, "")
      .trim()
      .slice(0, 80);
  }

  function readTracking(search, referrer) {
    const params = new URLSearchParams(search);
    const result = {};
    for (const key of TRACKING_PARAMS) {
      const value = clean(params.get(key));
      if (value) result[key] = value;
    }
    if (referrer) {
      try {
        result.ref = clean(new URL(referrer).hostname);
      } catch (error) {
        /* 無效的 referrer 直接略過 */
      }
    }
    return result;
  }

  function resolveTracking() {
    const fresh = readTracking(window.location.search, document.referrer);
    let stored = {};
    try {
      stored = JSON.parse((session && session.getItem(TRACKING_KEY)) || "{}");
    } catch (error) {
      stored = {};
    }
    // 網址帶了新的來源參數就以新的為準；否則沿用同一個工作階段先前記下的來源，
    // 這樣使用者重新整理或從別頁回來時，來源不會遺失。
    const hasFreshCampaign = TRACKING_PARAMS.some((key) => fresh[key]);
    const merged = hasFreshCampaign ? Object.assign({}, fresh) : Object.assign({}, fresh, stored);
    if (stored.ref && !hasFreshCampaign) merged.ref = stored.ref;
    if (session) {
      try {
        session.setItem(TRACKING_KEY, JSON.stringify(merged));
      } catch (error) {
        /* 儲存失敗不影響使用 */
      }
    }
    return merged;
  }

  const tracking = resolveTracking();

  // ---- 事件記錄 ---------------------------------------------------------
  // 有裝統計服務（Plausible、Umami、GA）就會一併送出；沒有的話只記在 window.__events。

  function track(name, props) {
    const payload = Object.assign({ page }, tracking.src ? { src: tracking.src } : {}, props || {});
    events.push({ name, props: payload, at: Date.now() });
    try {
      if (typeof window.plausible === "function") window.plausible(name, { props: payload });
      if (window.umami && typeof window.umami.track === "function") window.umami.track(name, payload);
      if (typeof window.gtag === "function") window.gtag("event", name, payload);
    } catch (error) {
      /* 統計服務出錯不能影響表單 */
    }
    if (typeof console !== "undefined" && console.debug) console.debug("[track]", name, payload);
  }

  // ---- 表單 -------------------------------------------------------------

  const form = document.getElementById("waitlist-form");
  const statusEl = document.getElementById("waitlist-status");
  const doneEl = document.getElementById("waitlist-done");

  function setStatus(message, kind) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.dataset.kind = kind || "";
  }

  function buildPayload(fields) {
    const payload = {
      page,
      email: fields.email,
      timeframe: fields.timeframe || "",
      submitted_at: new Date().toISOString(),
    };
    for (const key of Object.keys(tracking)) payload[key] = tracking[key];
    return payload;
  }

  function applyFieldMap(payload, fieldMap) {
    const mapped = {};
    for (const [key, value] of Object.entries(payload)) {
      mapped[(fieldMap && fieldMap[key]) || key] = value;
    }
    return mapped;
  }

  async function submitPayload(payload) {
    const config = getConfig();
    if (!config.formEndpoint) {
      // 本機測試模式：只存在這個瀏覽器，並提醒自己這不是真的送出。
      if (persistent) {
        const list = JSON.parse(persistent.getItem(LOCAL_SUBMISSIONS_KEY) || "[]");
        list.push(payload);
        persistent.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(list));
      }
      return { mode: "local" };
    }
    const noCors = config.formMode === "no-cors";
    const response = await fetch(config.formEndpoint, {
      method: "POST",
      body: new URLSearchParams(applyFieldMap(payload, config.fieldMap)),
      mode: noCors ? "no-cors" : "cors",
      headers: noCors ? undefined : { Accept: "application/json" },
    });
    if (!noCors && !response.ok) throw new Error("HTTP " + response.status);
    return { mode: "remote" };
  }

  function showDone() {
    if (form) form.hidden = true;
    if (doneEl) {
      doneEl.hidden = false;
      doneEl.focus();
    }
  }

  function contactHint() {
    const { contactEmail } = getConfig();
    return contactEmail ? "，或直接寄信到 " + contactEmail : "";
  }

  if (form) {
    let started = false;
    let submitting = false;
    const emailInput = form.elements.namedItem("email");
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener("focusin", () => {
      if (started) return;
      started = true;
      track("form_start");
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;

      // 蜜罐欄位：真人看不到也不會填。被填了就當作機器人，假裝成功但不送出。
      const honeypot = form.elements.namedItem("website");
      if (honeypot && honeypot.value) {
        showDone();
        return;
      }

      const email = String(emailInput.value || "").trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email)) {
        setStatus("請輸入有效的 email，例如 name@example.com。", "error");
        emailInput.setAttribute("aria-invalid", "true");
        emailInput.focus();
        track("form_invalid");
        return;
      }
      emailInput.removeAttribute("aria-invalid");

      const timeframeField = form.elements.namedItem("timeframe");
      const payload = buildPayload({ email, timeframe: timeframeField ? timeframeField.value : "" });

      submitting = true;
      submitButton.disabled = true;
      setStatus("送出中…", "pending");
      try {
        const result = await submitPayload(payload);
        track("form_submit_success", { mode: result.mode, timeframe: payload.timeframe });
        setStatus("", "");
        showDone();
      } catch (error) {
        track("form_submit_failure");
        setStatus("送出失敗，請稍後再試" + contactHint() + "。", "error");
        submitButton.disabled = false;
      } finally {
        submitting = false;
      }
    });
  }

  // ---- 按鈕與頁面雜項 ---------------------------------------------------

  document.querySelectorAll('[data-track="cta"]').forEach((el) => {
    el.addEventListener("click", () => {
      track("cta_click");
      const emailInput = form && form.elements.namedItem("email");
      if (emailInput) setTimeout(() => emailInput.focus({ preventScroll: true }), 0);
    });
  });

  document.querySelectorAll("[data-contact]").forEach((el) => {
    el.textContent = getConfig().contactEmail;
  });

  // ---- 草稿提示列：還有待填區塊或表單沒接上時，在畫面角落提醒，避免誤上線 ----

  function renderDevBar() {
    const todos = document.querySelectorAll("[data-todo]").length;
    const localMode = !getConfig().formEndpoint;
    if (!todos && !localMode) return;
    const bar = document.createElement("div");
    bar.className = "devbar";
    bar.setAttribute("role", "note");
    const lines = [];
    if (todos) lines.push("草稿：還有 " + todos + " 個待填區塊");
    if (localMode) lines.push("本機測試模式：表單資料不會送出");
    bar.textContent = lines.join("　");
    document.body.appendChild(bar);
  }
  renderDevBar();

  window.__waitlist = { readTracking, track };
})();
