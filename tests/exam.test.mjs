// 測驗頁：核心邏輯的單元測試，加上在 jsdom 裡走完整個流程（預覽、播放、檢查、結果）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { startServer } from "../scripts/serve.mjs";
import * as core from "../exam/core.mjs";

const SET = "s1-gym-0001";
const load = async (f) => JSON.parse(await readFile(new URL(`../content/sets/${SET}/${f}`, import.meta.url)));

test("gradeAnswers：全對、全空、混合；每題有題號、對錯、你寫的、正解", async () => {
  const plan = await load("plan.json");
  const all = Object.fromEntries(plan.answers.map((a) => [a.question_id, a.answer]));
  const r = core.gradeAnswers(plan, all);
  assert.equal(r.total, plan.answers.length);
  assert.equal(r.count, plan.answers.length);
  assert.deepEqual(r.results.map((x) => x.number), plan.answers.map((_, i) => i + 1));
  assert.equal(core.gradeAnswers(plan, {}).total, 0);
  const half = core.gradeAnswers(plan, { ...all, [plan.answers[0].question_id]: "zzz" });
  assert.equal(half.total, plan.answers.length - 1);
  assert.equal(half.results[0].correct, false);
  assert.equal(half.results[0].given, "zzz");
  assert.equal(half.results[0].expected, plan.answers[0].answer);
});

test("formatClock", () => {
  assert.equal(core.formatClock(30), "0:30");
  assert.equal(core.formatClock(125), "2:05");
  assert.equal(core.formatClock(-3), "0:00");
});

let server, base;
before(async () => { server = await startServer(0); base = `http://127.0.0.1:${server.address().port}`; });
after(() => server.close());

async function openExam({ audio = false } = {}) {
  const html = await (await fetch(`${base}/exam/index.html?set=${SET}`)).text();
  const dom = new JSDOM(html, { url: `${base}/exam/index.html?set=${SET}`, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  const timers = [];
  w.setInterval = (fn) => timers.push(fn) - 1;
  w.clearInterval = (id) => { timers[id] = null; };
  // 沒有錄音檔時，HEAD audio/full.mp3 會是 404；audio=true 時假裝有。
  w.fetch = (p, opt) => (audio && /full\.mp3$/.test(String(p)) ? Promise.resolve({ ok: true }) : fetch(new URL(p, w.location.href), opt));
  const played = [];
  class FakeAudio {
    constructor(src) { this.src = src; this.listeners = {}; played.push(this); }
    addEventListener(n, f) { this.listeners[n] = f; }
    play() { this.playing = true; return Promise.resolve(); }
    pause() { this.playing = false; }
    end() { this.listeners.ended?.(); }
  }
  w.Audio = FakeAudio;
  w.__core = core;
  const src = (await readFile(new URL("../exam/app.js", import.meta.url), "utf8"))
    .replace(/import \{([^}]*)\} from "\.\/core\.mjs";/, "const {$1} = window.__core;");
  w.eval(src);
  for (let i = 0; i < 50 && !w.__examReady; i++) await new Promise((r) => setTimeout(r, 20));
  const tick = () => { for (const t of timers) t?.(); };
  return { w, d: w.document, tick, played };
}

const begin = async (d) => { d.getElementById("start").click(); for (let i = 0; i < 50 && d.getElementById("exam").hidden; i++) await new Promise((r) => setTimeout(r, 20)); };

test("頁面：程式裡沒有瀏覽器語音合成", async () => {
  const src = await readFile(new URL("../exam/app.js", import.meta.url), "utf8");
  assert.ok(!/speechSynthesis|SpeechSynthesisUtterance|getVoices/.test(src));
  const { d } = await openExam();
  assert.equal(d.getElementById("start").disabled, false);
});

test("頁面：答題卷有分段標題與行內前後文，空格編號連續", async () => {
  const plan = await load("plan.json"), paper = await load("paper.json");
  const { d } = await openExam();
  await begin(d);
  const heads = [...d.querySelectorAll("#paper h2.section")].map((h) => h.textContent);
  assert.deepEqual(heads, [...new Set(paper.rows.map((r) => r.section).filter(Boolean))]);
  assert.ok(heads.length >= 2);
  assert.equal(d.querySelectorAll("#paper .line .num").length, plan.answers.length);
  assert.deepEqual([...d.querySelectorAll("#paper .num")].map((n) => n.textContent), plan.answers.map((_, i) => String(i + 1)));
  const inline = paper.rows.find((r) => r.inline);
  assert.ok(inline, "至少有一列是行內句型");
  const line = d.querySelector(`#paper input[data-q="${inline.parts.find((p) => p.blank).blank}"]`).parentElement;
  assert.ok(!line.textContent.startsWith(`${inline.label}:`), "行內句型不另外印標籤");
  assert.ok(inline.parts.some((p) => p.text && line.textContent.includes(p.text)), "前後文有印出來");
});

test("頁面：沒有錄音檔時，預覽後可以直接填答題卷，不播任何聲音，做完看到結果", async () => {
  const plan = await load("plan.json");
  const { d, tick, played } = await openExam();
  await begin(d);
  const inputs = () => [...d.querySelectorAll("#paper input[data-q]")];
  assert.ok(!d.querySelector("#paper table"));
  assert.ok(d.querySelector("#paper-instruction b"), "說明裡的全大寫片語加粗");
  assert.ok(inputs().every((i) => i.disabled), "預覽時不能填");
  for (let i = 0; i < 60; i++) tick();
  assert.ok(inputs().every((i) => !i.disabled), "預覽結束後可以填");
  assert.equal(played.length, 0, "沒有錄音檔就不播");
  assert.match(d.getElementById("status").textContent, /還沒有錄音/);
  inputs().forEach((el, i) => { el.value = i === 0 ? "wrong" : plan.answers[i].answer; });
  d.getElementById("skip").click(); // 結束作答，進入檢查
  for (let i = 0; i < 40; i++) tick();
  assert.equal(d.getElementById("result").hidden, false);
  assert.equal(d.getElementById("score").textContent, `${plan.answers.length - 1} / ${plan.answers.length}`);
  assert.equal(d.querySelectorAll("#result-table tr.bad").length, 1);
  const bad = d.querySelector("#result-table tr.bad");
  assert.equal(bad.cells[1].textContent, "wrong");
  assert.equal(bad.cells[2].textContent, plan.answers[0].answer, "答錯的題顯示正解");
});

test("頁面：有錄音檔時播一次，播完進入檢查倒數", async () => {
  const { d, tick, played } = await openExam({ audio: true });
  await begin(d);
  for (let i = 0; i < 60; i++) tick();
  assert.equal(played.length, 1);
  assert.match(played[0].src, /audio\/full\.mp3$/);
  assert.equal(played[0].playing, true);
  played[0].end();
  assert.match(d.getElementById("status").textContent, /檢查/);
});

test("頁面：送出鈕在作答中就能提早送出", async () => {
  const { d, tick, w } = await openExam();
  await begin(d);
  for (let i = 0; i < 60; i++) tick();
  d.getElementById("paper-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  assert.equal(d.getElementById("result").hidden, false);
  assert.match(d.getElementById("score").textContent, /^0 \/ /);
});
