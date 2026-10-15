// 在 jsdom 裡真的載入頁面、跑 app.js、模擬填表送出。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { startServer } from "../scripts/serve.mjs";

let server;
let base;

before(async () => {
  server = await startServer(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

async function open(path, { fetchImpl, reducedMotion = false } = {}) {
  const dom = await JSDOM.fromURL(base + path, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = fetchImpl || (async () => ({ ok: true }));
      window.console.debug = () => {};
      // jsdom 沒有 matchMedia。這裡補上，並把計時器換成可手動觸發的版本：
      // 測試不用真的等 6 秒，也不會有計時器卡住讓測試程序無法結束。
      window.matchMedia = (query) => ({
        matches: reducedMotion && /reduce/.test(query),
        addEventListener() {},
        removeEventListener() {},
      });
      const timers = (window.__timers = []);
      window.setInterval = (fn, ms) => timers.push({ fn, ms }) - 1;
      window.clearInterval = (id) => {
        timers[id] = null;
      };
    },
  });
  await new Promise((resolve) => {
    if (dom.window.document.readyState === "complete") resolve();
    else dom.window.addEventListener("load", resolve);
  });
  return dom;
}

function fill(dom, { email, timeframe, website }) {
  const { document } = dom.window;
  document.getElementById("email").value = email ?? "";
  if (timeframe) document.getElementById("timeframe").value = timeframe;
  if (website) document.getElementById("website").value = website;
}

function submit(dom) {
  const form = dom.window.document.getElementById("waitlist-form");
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true, bubbles: true }));
  return new Promise((resolve) => setTimeout(resolve, 20));
}

for (const page of ["listening", "fluency"]) {
  test(`${page}：頁面載入，表單與草稿提示列都在`, async () => {
    const dom = await open(`/${page}/?src=ptt`);
    const { document } = dom.window;
    assert.ok(document.getElementById("waitlist-form"));
    assert.equal(document.body.dataset.page, page);
    const bar = document.querySelector(".devbar");
    assert.ok(bar, "草稿提示列應該出現");
    // 提示列要如實反映頁面狀態：還有待填區塊才提醒，填完了就不該再說有。
    const html = await (await fetch(base + `/${page}/`)).text();
    const todos = (html.match(/data-todo/g) || []).length;
    if (todos > 0) assert.match(bar.textContent, new RegExp(`還有 ${todos} 個待填區塊`));
    else assert.doesNotMatch(bar.textContent, /待填/);
    assert.match(bar.textContent, /本機測試模式/);
  });

  test(`${page}：本機模式送出，來源與頁面都會記下`, async () => {
    const dom = await open(`/${page}/?src=ptt&utm_campaign=oct-test`);
    fill(dom, { email: "  Someone@Example.com ", timeframe: page === "listening" ? "1-3m" : "now" });
    await submit(dom);

    const stored = JSON.parse(dom.window.localStorage.getItem("waitlist.local-submissions"));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].email, "someone@example.com");
    assert.equal(stored[0].page, page);
    assert.equal(stored[0].src, "ptt");
    assert.equal(stored[0].utm_campaign, "oct-test");
    assert.match(stored[0].submitted_at, /^\d{4}-\d{2}-\d{2}T/);

    const { document } = dom.window;
    assert.equal(document.getElementById("waitlist-form").hidden, true);
    assert.equal(document.getElementById("waitlist-done").hidden, false);

    const names = dom.window.__events.map((e) => e.name);
    assert.ok(names.includes("form_submit_success"));
    const success = dom.window.__events.find((e) => e.name === "form_submit_success");
    assert.equal(success.props.src, "ptt");
  });

  test(`${page}：email 格式不對時顯示怎麼修正，且不儲存`, async () => {
    const dom = await open(`/${page}/`);
    fill(dom, { email: "not-an-email" });
    await submit(dom);
    const { document } = dom.window;
    assert.match(document.getElementById("waitlist-status").textContent, /請輸入有效的 email/);
    assert.equal(document.getElementById("email").getAttribute("aria-invalid"), "true");
    assert.equal(dom.window.localStorage.getItem("waitlist.local-submissions"), null);
    assert.equal(document.getElementById("waitlist-form").hidden, false);
  });

  test(`${page}：蜜罐被填就不送出也不儲存`, async () => {
    let calls = 0;
    const dom = await open(`/${page}/`, { fetchImpl: async () => (calls++, { ok: true }) });
    dom.window.WAITLIST_CONFIG.formEndpoint = "https://forms.example.test/submit";
    fill(dom, { email: "bot@example.com", website: "http://spam.example" });
    await submit(dom);
    assert.equal(calls, 0);
    assert.equal(dom.window.localStorage.getItem("waitlist.local-submissions"), null);
  });

  test(`${page}：有設定端點就用 POST 送出，並套用欄位對照`, async () => {
    const calls = [];
    const dom = await open(`/${page}/?src=dcard`, {
      fetchImpl: async (url, options) => (calls.push({ url, options }), { ok: true }),
    });
    dom.window.WAITLIST_CONFIG.formEndpoint = "https://forms.example.test/submit";
    dom.window.WAITLIST_CONFIG.fieldMap = { email: "entry.111", src: "entry.444" };
    fill(dom, { email: "a@example.com" });
    await submit(dom);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://forms.example.test/submit");
    assert.equal(calls[0].options.method, "POST");
    const body = calls[0].options.body;
    assert.equal(body.get("entry.111"), "a@example.com");
    assert.equal(body.get("entry.444"), "dcard");
    assert.equal(body.get("page"), page);
    assert.equal(body.get("email"), null, "被改名的欄位不應該再用原名送出");
    assert.equal(dom.window.localStorage.getItem("waitlist.local-submissions"), null, "遠端模式不該寫入本機");
  });

  test(`${page}：送出失敗時顯示錯誤、按鈕可再按、表單仍在`, async () => {
    const dom = await open(`/${page}/`, {
      fetchImpl: async () => {
        throw new Error("network down");
      },
    });
    dom.window.WAITLIST_CONFIG.formEndpoint = "https://forms.example.test/submit";
    dom.window.WAITLIST_CONFIG.contactEmail = "me@example.com";
    fill(dom, { email: "a@example.com" });
    await submit(dom);

    const { document } = dom.window;
    assert.match(document.getElementById("waitlist-status").textContent, /送出失敗.*me@example\.com/);
    assert.equal(document.querySelector('button[type="submit"]').disabled, false);
    assert.equal(document.getElementById("waitlist-form").hidden, false);
    assert.ok(dom.window.__events.some((e) => e.name === "form_submit_failure"));
  });

  test(`${page}：伺服器回應非 2xx 也視為失敗`, async () => {
    const dom = await open(`/${page}/`, { fetchImpl: async () => ({ ok: false, status: 500 }) });
    dom.window.WAITLIST_CONFIG.formEndpoint = "https://forms.example.test/submit";
    fill(dom, { email: "a@example.com" });
    await submit(dom);
    assert.equal(dom.window.document.getElementById("waitlist-form").hidden, false);
    assert.match(dom.window.document.getElementById("waitlist-status").textContent, /送出失敗/);
  });
}

test("來源參數：同一個工作階段重新載入不帶參數時，沿用先前記下的來源", async () => {
  const dom = await open("/listening/?src=ptt");
  const stored = dom.window.sessionStorage.getItem("waitlist.tracking");
  assert.ok(stored);
  assert.equal(JSON.parse(stored).src, "ptt");

  // jsdom 視窗裡建立的物件和測試程式的 Object 不同世界，先轉成純 JSON 再比較。
  const read = (search, referrer) => JSON.parse(JSON.stringify(dom.window.__waitlist.readTracking(search, referrer)));
  assert.deepEqual(read("?src=dcard&foo=1", ""), { src: "dcard" });
  assert.deepEqual(read("", "https://www.ptt.cc/bbs/x"), { ref: "www.ptt.cc" });
  assert.deepEqual(read("?src=a%00b", ""), { src: "ab" }, "控制字元要被清掉");
});

test("CTA 按鈕與表單開始填寫都會記錄事件", async () => {
  const dom = await open("/listening/");
  const { document } = dom.window;
  document.querySelector('[data-track="cta"]').dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  document.getElementById("email").dispatchEvent(new dom.window.Event("focusin", { bubbles: true }));
  document.getElementById("timeframe").dispatchEvent(new dom.window.Event("focusin", { bubbles: true }));
  const names = dom.window.__events.map((e) => e.name);
  assert.equal(names.filter((n) => n === "cta_click").length, 1);
  assert.equal(names.filter((n) => n === "form_start").length, 1, "form_start 只該記一次");
});

test("本機伺服器不提供程式碼以外的檔案，也擋路徑跳脫", async () => {
  for (const path of ["/package.json", "/scripts/serve.mjs", "/.git/config", "/tests/page.test.mjs"]) {
    const res = await fetch(base + path);
    assert.equal(res.status, 404, path);
  }
  const traversal = await fetch(base + "/%2e%2e/%2e%2e/etc/passwd");
  assert.ok([403, 404].includes(traversal.status));
  const ok = await fetch(base + "/listening/");
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("content-type"), /text\/html/);
});

// ---- 標題輪播 ---------------------------------------------------------------

function slideState(dom) {
  const slides = [...dom.window.document.querySelectorAll("[data-slide]")];
  return slides.map((slide) => slide.classList.contains("is-active"));
}

function activeIndexes(dom) {
  return slideState(dom).flatMap((on, i) => (on ? [i + 1] : []));
}

const liveTimers = (dom) => dom.window.__timers.filter(Boolean);

test("輪播：三個標題、只有一個 h1、第一個預設顯示（沒有 JS 也看得到標題）", async () => {
  const html = await (await fetch(base + "/listening/")).text();
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/data-slide/g) || []).length, 3);
  assert.equal((html.match(/class="slide is-active"/g) || []).length, 1);
  assert.match(html, /給準備雅思的人/);
  assert.match(html, /雅思聽力練習，題題都是新的/);
  assert.match(html, /雅思聽力題做完了？/);
});

test("輪播：載入後建立控制列，圓點標示目前是哪一個", async () => {
  const dom = await open("/listening/");
  const { document } = dom.window;
  assert.deepEqual(activeIndexes(dom), [1]);
  assert.equal(document.querySelectorAll(".carousel-dot").length, 3);
  assert.equal(document.querySelectorAll(".carousel-btn").length, 2);
  const current = [...document.querySelectorAll(".carousel-dot")].map((d) => d.getAttribute("aria-current"));
  assert.deepEqual(current, ["true", "false", "false"]);
  assert.equal(document.querySelector("[data-carousel]").dataset.current, "1");
  assert.match(document.querySelector(".carousel-dot").getAttribute("aria-label"), /第 1 個標題，共 3 個/);
});

test("輪播：上一個、下一個、圓點都能換頁，到頭會繞回來", async () => {
  const dom = await open("/listening/");
  const { document } = dom.window;
  const click = (el) => el.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  const [prev, next] = document.querySelectorAll(".carousel-btn");
  const dots = document.querySelectorAll(".carousel-dot");

  click(next);
  assert.deepEqual(activeIndexes(dom), [2]);
  click(next);
  click(next);
  assert.deepEqual(activeIndexes(dom), [1], "第 3 個再按下一個要回到第 1 個");
  click(prev);
  assert.deepEqual(activeIndexes(dom), [3], "第 1 個按上一個要到最後一個");
  click(dots[1]);
  assert.deepEqual(activeIndexes(dom), [2]);
  assert.equal(dots[1].getAttribute("aria-current"), "true");
  assert.equal(dots[2].getAttribute("aria-current"), "false");
  assert.equal(document.querySelector("[data-carousel]").dataset.current, "2");
  assert.equal(dom.window.__events.filter((e) => e.name === "headline_change").length, 5);
  assert.equal(dom.window.__events.find((e) => e.name === "headline_change").props.via, "next");
});

test("輪播：自動換頁，滑鼠移上去暫停、移開恢復", async () => {
  const dom = await open("/listening/");
  const { document } = dom.window;
  const root = document.querySelector("[data-carousel]");
  assert.equal(liveTimers(dom).length, 1);
  assert.equal(liveTimers(dom)[0].ms, 6000);

  liveTimers(dom)[0].fn();
  assert.deepEqual(activeIndexes(dom), [2], "計時器觸發後換到下一個");

  root.dispatchEvent(new dom.window.Event("mouseenter"));
  assert.equal(liveTimers(dom).length, 0, "滑鼠移上去就暫停");
  root.dispatchEvent(new dom.window.Event("mouseleave"));
  assert.equal(liveTimers(dom).length, 1, "移開後恢復");

  root.dispatchEvent(new dom.window.Event("focusin", { bubbles: true }));
  assert.equal(liveTimers(dom).length, 0, "鍵盤聚焦進來也暫停");
});

test("輪播：使用者自己按過一次之後，不會再自動換頁", async () => {
  const dom = await open("/listening/");
  const { document } = dom.window;
  const root = document.querySelector("[data-carousel]");
  document.querySelectorAll(".carousel-btn")[1].dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  assert.equal(liveTimers(dom).length, 0);
  assert.equal(root.getAttribute("aria-live"), "polite");
  root.dispatchEvent(new dom.window.Event("mouseleave"));
  root.dispatchEvent(new dom.window.Event("focusout", { bubbles: true }));
  assert.equal(liveTimers(dom).length, 0, "移開滑鼠或離開焦點都不能重新啟動自動換頁");
});

test("輪播：使用者開了「減少動態效果」就不自動換頁，但仍可手動切換", async () => {
  const dom = await open("/listening/", { reducedMotion: true });
  assert.equal(dom.window.__timers.length, 0);
  document_click(dom, ".carousel-btn:last-of-type");
  assert.deepEqual(activeIndexes(dom), [2]);
});

function document_click(dom, selector) {
  dom.window.document.querySelector(selector).dispatchEvent(new dom.window.Event("click", { bubbles: true }));
}

test("輪播：按主按鈕時，記錄當下看到的是第幾個標題", async () => {
  const dom = await open("/listening/");
  const { document } = dom.window;
  document.querySelectorAll(".carousel-btn")[1].dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  document.querySelector('[data-track="cta"]').dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  const cta = dom.window.__events.find((e) => e.name === "cta_click");
  assert.equal(cta.props.headline, 2);
});

test("流利度頁也有同樣的三段輪播，按鈕事件帶標題編號", async () => {
  const dom = await open("/fluency/");
  const { document } = dom.window;
  assert.equal(document.querySelectorAll("[data-slide]").length, 3);
  assert.equal(document.querySelectorAll("h1").length, 1);
  assert.equal(document.querySelectorAll(".carousel-controls").length, 1);
  document.querySelector('[data-track="cta"]').dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  const cta = dom.window.__events.find((e) => e.name === "cta_click");
  assert.equal(cta.props.headline, 1);
});

test("聽力頁目前沒有待填區塊以外的內容缺漏：標題、價格、常見問題都已填", async () => {
  const html = await (await fetch(base + "/listening/")).text();
  assert.equal((html.match(/data-todo/g) || []).length, 0);
  assert.match(html, /測試期間免費，正式價格待訂/);
  assert.match(html, /題目是 AI 寫的原創內容，再轉成語音，不是官方真題/);
  assert.match(html, /還在準備中，還沒有確定的日期/);
});
