// 測驗頁：核心邏輯的單元測試，加上在 jsdom 裡走完整個流程（預覽、播放、檢查、結果）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { startServer } from "../scripts/serve.mjs";
import * as core from "../exam/core.mjs";

const SET = "s1-gym-0002";
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
  // audio=false：假裝沒有錄音檔；audio=true：假裝有 mp3，但不給 timing.json（舊流程）；audio="timed"：用真的 timing.json。
  w.fetch = (p, opt) => {
    const u = String(p);
    if (/audio\/full\.mp3$/.test(u)) return Promise.resolve({ ok: !!audio });
    if (/audio\/timing\.json$/.test(u) && audio !== "timed") return Promise.resolve({ ok: false });
    return fetch(new URL(p, w.location.href), opt);
  };
  const played = [];
  class FakeAudio {
    constructor(src) { this.src = src; this.listeners = {}; played.push(this); }
    addEventListener(n, f) { this.listeners[n] = f; }
    at(t) { this.currentTime = t; this.listeners.timeupdate?.(); }
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

test("頁面：paragraph 的分段連成一小段文字，list 的分段才有圓點行", async () => {
  const paper = await load("paper.json");
  const { d } = await openExam();
  await begin(d);
  const paras = paper.section_styles ? Object.entries(paper.section_styles).filter(([, v]) => v === "paragraph").map(([k]) => k) : [];
  assert.ok(paras.length >= 2);
  const heads = [...d.querySelectorAll("#paper h2.section")];
  for (const h of heads) {
    const group = h.nextElementSibling;
    if (paras.includes(h.textContent)) {
      assert.equal(group.tagName, "P", `${h.textContent} 是一小段文字`);
      assert.ok(group.querySelectorAll(".line").length >= 1);
      assert.ok([...group.querySelectorAll(".line")].every((l) => l.tagName === "SPAN"), "句子接在同一段裡，不是一行一行");
    } else assert.equal(group.tagName, "DIV");
  }
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

test("核心：eventAt／viewOf／questionLabel 依 timing.json 判斷畫面狀態", async () => {
  const t = JSON.parse(await readFile(new URL(`../content/sets/${SET}/audio/timing.json`, import.meta.url)));
  const pause1 = t.events.find((e) => e.id === "pause1");
  const mid = (pause1.start + pause1.end) / 2;
  assert.equal(core.eventAt(t.events, mid).id, "pause1");
  const v = core.viewOf(core.eventAt(t.events, mid), mid);
  assert.equal(v.kind, "read");
  assert.deepEqual(v.questions, [1, 4]);
  assert.ok(Math.abs(v.remaining - (pause1.end - mid)) < 1e-9);
  const check = t.events.find((e) => e.id === "check");
  assert.equal(core.viewOf(check, check.start + 1).kind, "check");
  assert.equal(core.viewOf(t.events[1], 0).kind, "listen");
  assert.equal(core.eventAt(t.events, 1e6), null);
  assert.equal(core.questionLabel([1, 4]), "第 1–4 題");
  assert.equal(core.questionLabel([5, 6]), "第 5、6 題");
});

test("頁面：有 timing.json 時，看題停頓、題號標示、檢查階段都跟著錄音走，播完批改", async () => {
  const t = JSON.parse(await readFile(new URL(`../content/sets/${SET}/audio/timing.json`, import.meta.url)));
  const { d, played } = await openExam({ audio: "timed" });
  await begin(d);
  assert.equal(played.length, 1, "不先跑頁面自己的看題倒數，直接播錄音");
  const a = played[0];
  const p2 = t.events.find((e) => e.id === "pause2");
  a.at(p2.start + 5);
  assert.match(d.getElementById("status").textContent, /看題時間：第 5、6 題/);
  assert.equal(d.getElementById("clock").textContent, d.defaultView.__core.formatClock(p2.end - p2.start - 5));
  const lit = [...d.querySelectorAll("#paper input.look")].map((i) => i.dataset.q);
  assert.deepEqual(lit, ["q05", "q06"]);
  const turn = t.events.find((e) => e.type === "turn");
  a.at(turn.start + 1);
  assert.match(d.getElementById("status").textContent, /錄音播放中/);
  assert.equal(d.querySelectorAll("#paper input.look").length, 0);
  const check = t.events.find((e) => e.id === "check");
  a.at(check.start + 1);
  assert.match(d.getElementById("status").textContent, /檢查/);
  a.end();
  assert.equal(d.getElementById("result").hidden, false);
});
