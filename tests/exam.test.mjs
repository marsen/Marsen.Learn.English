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

test("pickVoices：偏好 en-GB；只有一個聲音時靠音高區分兩人", () => {
  const us = { lang: "en-US", name: "us" }, gb = { lang: "en-GB", name: "gb" }, gb2 = { lang: "en-GB", name: "gb2" }, fr = { lang: "fr-FR" };
  assert.equal(core.pickVoices([fr, us, gb, gb2]).A.voice, gb);
  assert.equal(core.pickVoices([fr, us, gb, gb2]).B.voice, gb2);
  const one = core.pickVoices([gb]);
  assert.equal(one.A.voice, one.B.voice);
  assert.notEqual(one.A.pitch, one.B.pitch);
  assert.equal(core.pickVoices([fr]).A.voice, null);
});

test("formatClock", () => {
  assert.equal(core.formatClock(30), "0:30");
  assert.equal(core.formatClock(125), "2:05");
  assert.equal(core.formatClock(-3), "0:00");
});

let server, base;
before(async () => { server = await startServer(0); base = `http://127.0.0.1:${server.address().port}`; });
after(() => server.close());

async function openExam({ speech = true } = {}) {
  const html = await (await fetch(`${base}/exam/index.html?set=${SET}`)).text();
  const dom = new JSDOM(html, { url: `${base}/exam/index.html?set=${SET}`, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  const timers = [];
  w.setInterval = (fn) => timers.push(fn) - 1;
  w.clearInterval = (id) => { timers[id] = null; };
  w.fetch = (p) => fetch(new URL(p, w.location.href));
  const spoken = [];
  const utterances = [];
  if (speech) {
    w.__speech = {
      synth: { getVoices: () => [], speak: (u) => { spoken.push(u.text); utterances.push(u); }, cancel() {} },
      Utterance: class { constructor(text) { this.text = text; } },
    };
  }
  w.__core = core;
  w.eval = w.eval; // jsdom 的 eval 在 window 作用域
  const src = (await readFile(new URL("../exam/app.js", import.meta.url), "utf8"))
    .replace(/import \{([^}]*)\} from "\.\/core\.mjs";/, "const {$1} = window.__core;")
    .replace("export function speakAll", "function speakAll");
  w.eval(src);
  for (let i = 0; i < 50 && !w.__examReady; i++) await new Promise((r) => setTimeout(r, 20));
  const tick = () => { for (const t of timers) t?.(); };
  const playAll = async () => { for (let i = 0; i < 500 && utterances.length; i++) { const u = utterances.shift(); u.onend?.(); } };
  return { w, d: w.document, tick, spoken, utterances, playAll };
}

test("頁面：載入後可開始；沒有語音時擋住並提示", async () => {
  const ok = await openExam();
  assert.equal(ok.d.getElementById("start").disabled, false);
  assert.equal(ok.d.getElementById("speech-warning").hidden, true);
  const no = await openExam({ speech: false });
  assert.equal(no.d.getElementById("start").disabled, true);
  assert.equal(no.d.getElementById("speech-warning").hidden, false);
});

test("頁面：預覽期間不能填、播放才能填；整份只播一次；做完看到結果", async () => {
  const plan = await load("plan.json"), script = await load("script.json");
  const { d, tick, spoken, utterances, playAll } = await openExam();
  d.getElementById("start").click();
  for (let i = 0; i < 50 && d.getElementById("exam").hidden; i++) await new Promise((r) => setTimeout(r, 20));
  const inputs = () => [...d.querySelectorAll("#paper input[data-q]")];
  assert.ok(!d.querySelector("#paper table"), "不是表格，是雅思式的行內填空");
  assert.equal(d.querySelectorAll("#paper .line .num").length, plan.answers.length, "每個空格前有編號圓圈");
  assert.ok(d.querySelector("#paper-instruction b"), "說明裡的全大寫片語加粗");
  assert.equal(inputs().length, plan.answers.length);
  assert.ok(inputs().every((i) => i.disabled), "預覽時不能填");
  assert.equal(spoken.length, 0, "預覽時還沒播音");
  // 預覽倒數走完
  for (let i = 0; i < 60; i++) tick();
  assert.ok(inputs().every((i) => !i.disabled), "播放時可以填");
  assert.equal(spoken.length, 1, "第一輪開始念");
  assert.equal(spoken[0], script.turns[0].text);
  // 播完所有輪次，每輪只念一次
  await playAll();
  assert.deepEqual(spoken, script.turns.map((t) => t.text));
  // 填答案：第一題故意填錯，其餘照標準答案
  inputs().forEach((el, i) => { el.value = i === 0 ? "wrong" : plan.answers[i].answer; });
  for (let i = 0; i < 40; i++) tick(); // 檢查倒數走完，自動送出
  assert.equal(d.getElementById("result").hidden, false);
  assert.equal(d.getElementById("score").textContent, `${plan.answers.length - 1} / ${plan.answers.length}`);
  assert.equal(d.querySelectorAll("#result-table tr.bad").length, 1);
  assert.equal(d.querySelectorAll("#result-table tr.ok").length, plan.answers.length - 1);
  const bad = d.querySelector("#result-table tr.bad");
  assert.equal(bad.cells[1].textContent, "wrong");
  assert.equal(bad.cells[2].textContent, plan.answers[0].answer, "答錯的題顯示正解");
  assert.equal(spoken.length, script.turns.length, "結果頁沒有重播整份錄音");
});

test("頁面：送出鈕在播放中就能提早送出", async () => {
  const { d, tick, w } = await openExam();
  d.getElementById("start").click();
  for (let i = 0; i < 50 && d.getElementById("exam").hidden; i++) await new Promise((r) => setTimeout(r, 20));
  for (let i = 0; i < 60; i++) tick();
  d.getElementById("paper-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  assert.equal(d.getElementById("result").hidden, false);
  assert.match(d.getElementById("score").textContent, /^0 \/ /);
});
