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

async function open(path, { fetchImpl } = {}) {
  const dom = await JSDOM.fromURL(base + path, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = fetchImpl || (async () => ({ ok: true }));
      window.console.debug = () => {};
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
    assert.match(bar.textContent, /待填區塊/);
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
