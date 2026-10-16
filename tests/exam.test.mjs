// 測驗頁：核心邏輯的單元測試，加上在 jsdom 裡走完整個流程（預覽、播放、檢查、結果）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { startServer } from "../scripts/serve.mjs";
import * as core from "../exam/core.mjs";
import * as authMod from "../exam/auth.mjs";
import * as configMod from "../exam/config.js";
import { gradeAnswers } from "../generator/grade.mjs";

const SET = "s1-gym-0002";
const load = async (f) => JSON.parse(await readFile(new URL(`../content/sets/${SET}/${f}`, import.meta.url)));

test("gradeAnswers：全對、全空、混合；每題有題號、對錯、你寫的、正解", async () => {
  const plan = await load("plan.json");
  const all = Object.fromEntries(plan.answers.map((a) => [a.question_id, a.answer]));
  const r = gradeAnswers(plan, all);
  assert.equal(r.total, plan.answers.length);
  assert.equal(r.count, plan.answers.length);
  assert.deepEqual(r.results.map((x) => x.number), plan.answers.map((_, i) => i + 1));
  assert.equal(gradeAnswers(plan, {}).total, 0);
  const half = gradeAnswers(plan, { ...all, [plan.answers[0].question_id]: "zzz" });
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

const until = async (fn, ms = 2000) => { for (let i = 0; i < ms / 20 && !fn(); i++) await new Promise((r) => setTimeout(r, 20)); };

// 在 jsdom 開考試頁。後端是 scripts/serve.mjs 裡的開發用假後端（跑同一份 api/_core.mjs）。
// 有錄音的題組（s1-gym-0002）走時間軸流程；沒有錄音的題組（例如 s1-car-0001）走開發用流程。
async function openExam({ set = SET, failFinish = 0, as = "tester@example.com", href, pending } = {}) {
  const url = `${base}${href ?? `/exam/index.html?set=${set}`}`;
  const html = await (await fetch(url)).text();
  const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  const timers = [];
  w.setInterval = (fn) => timers.push(fn) - 1;
  w.clearInterval = (id) => { timers[id] = null; };
  const calls = [];
  let fails = failFinish;
  w.fetch = (p, opt = {}) => {
    const u = new URL(p, w.location.href);
    calls.push({ path: u.pathname, method: opt.method ?? "GET", headers: opt.headers ?? {}, body: opt.body });
    if (u.pathname === "/api/finish" && fails > 0) { fails--; return Promise.resolve(new w.Response(JSON.stringify({ error: "連線失敗" }), { status: 500 })); }
    return fetch(u, opt);
  };
  w.Response = Response;
  // as：已登入的信箱（開發登入的 token 是 dev-信箱）；null 就是免登入的訪客。pending：預先放進瀏覽器的「還沒領結果的作答」。
  if (as) w.localStorage.setItem("exam-auth", JSON.stringify({ access_token: `dev-${as}`, expires_at: 9999999999 }));
  if (pending) w.localStorage.setItem("exam-pending", JSON.stringify(pending));
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
  w.__mods = { core, auth: authMod, config: configMod };
  const src = (await readFile(new URL("../exam/app.js", import.meta.url), "utf8"))
    .replace(/import \{([^}]*)\} from "\.\/(\w+)\.(?:mjs|js)";/g, 'const {$1} = window.__mods["$2"];');
  w.eval(src);
  await until(() => w.__examReady);
  const d = w.document;
  await until(() => !d.getElementById("exam").hidden || !d.getElementById("email").hidden || !d.getElementById("result").hidden || !d.getElementById("start").disabled);
  const tick = () => { for (const t of timers) t?.(); };
  return { w, d, tick, played, calls };
}

const begin = async (d) => { d.getElementById("start").click(); await until(() => !d.getElementById("exam").hidden); };
const visible = (d) => ["email", "intro", "exam", "result", "feedback"].filter((id) => !d.getElementById(id).hidden);

test("頁面：程式裡沒有瀏覽器語音合成，也不載入批改程式與標準答案", async () => {
  const src = await readFile(new URL("../exam/app.js", import.meta.url), "utf8");
  assert.ok(!/speechSynthesis|SpeechSynthesisUtterance|getVoices/.test(src));
  assert.ok(!/generator\/|plan\.json|gradeAnswers/.test(src), "前端不碰標準答案");
  const core2 = await readFile(new URL("../exam/core.mjs", import.meta.url), "utf8");
  assert.ok(!/generator\//.test(core2));
});

test("頁面：免登入直接看到題組清單（不要求登入）；登入後才顯示信箱與登出、給回饋", async () => {
  const guest = await openExam({ as: null });
  assert.deepEqual(visible(guest.d), ["intro"]);
  assert.equal(guest.d.getElementById("who-box").hidden, true);
  assert.equal(guest.d.getElementById("to-feedback").hidden, true, "回饋要登入才能送");
  assert.ok([...guest.d.querySelectorAll("#set-select option")].some((o) => o.value === SET));
  assert.equal(guest.d.getElementById("set-select").value, SET, "網址的 ?set= 會選到那一組");
  const { d } = await openExam();
  assert.deepEqual(visible(d), ["intro"]);
  assert.match(d.getElementById("who").textContent, /tester@example\.com/);
  assert.equal(d.getElementById("to-feedback").hidden, false);
  d.getElementById("logout").click();
  assert.equal(d.getElementById("who-box").hidden, true);
  assert.equal(d.getElementById("to-feedback").hidden, true);
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

test("頁面：沒有錄音的題組（開發用）：預覽後可以填答題卷，不播聲音，做完由伺服器批改", async () => {
  const plan = JSON.parse(await readFile(new URL("../content/sets/s1-car-0001/plan.json", import.meta.url)));
  const { d, tick, played, calls } = await openExam({ set: "s1-car-0001" });
  await begin(d);
  const inputs = () => [...d.querySelectorAll("#paper input[data-q]")];
  assert.ok(d.querySelector("#paper-instruction b"), "說明裡的全大寫片語加粗");
  assert.ok(inputs().every((i) => i.disabled), "預覽時不能填");
  for (let i = 0; i < 60; i++) tick();
  assert.ok(inputs().every((i) => !i.disabled), "預覽結束後可以填");
  assert.equal(played.length, 0, "沒有錄音檔就不播");
  assert.match(d.getElementById("status").textContent, /還沒有錄音/);
  inputs().forEach((el, i) => { el.value = i === 0 ? "wrong" : plan.answers[i].answer; });
  d.getElementById("skip").click(); // 結束作答，進入檢查
  for (let i = 0; i < 40; i++) tick();
  await until(() => !d.getElementById("result").hidden);
  assert.equal(d.getElementById("score").textContent, `${plan.answers.length - 1} / ${plan.answers.length}`);
  const bad = d.querySelector("#result-table tr.bad");
  assert.equal(d.querySelectorAll("#result-table tr.bad").length, 1);
  assert.equal(bad.cells[1].textContent, "wrong");
  assert.equal(bad.cells[2].textContent, plan.answers[0].answer, "答錯的題顯示正解");
  const finish = calls.find((c) => c.path === "/api/finish");
  assert.match(finish.headers.Authorization, /^Bearer dev-/);
  assert.ok(!calls.some((c) => /plan\.json|script\.json/.test(c.path)), "瀏覽器沒有去讀標準答案或逐字稿");
});

test("頁面：送出鈕在作答中就能提早送出（走伺服器批改）", async () => {
  const { d, w } = await openExam();
  await begin(d);
  d.getElementById("paper-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  await until(() => !d.getElementById("result").hidden);
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

test("頁面：有時間軸時，看題停頓、題號標示、檢查階段都跟著錄音走，播完由伺服器批改", async () => {
  const t = JSON.parse(await readFile(new URL(`../content/sets/${SET}/audio/timing.json`, import.meta.url)));
  const { d, played } = await openExam();
  await begin(d);
  assert.equal(played.length, 1, "不先跑頁面自己的看題倒數，直接播錄音");
  assert.match(played[0].src, /audio\/full\.mp3$/);
  const a = played[0];
  const p2 = t.events.find((e) => e.id === "pause2");
  a.at(p2.start + 5);
  assert.match(d.getElementById("status").textContent, /看題時間：第 5、6 題/);
  assert.equal(d.getElementById("clock").textContent, core.formatClock(p2.end - p2.start - 5));
  assert.deepEqual([...d.querySelectorAll("#paper input.look")].map((i) => i.dataset.q), ["q05", "q06"]);
  a.at(t.events.find((e) => e.type === "turn").start + 1);
  assert.match(d.getElementById("status").textContent, /錄音播放中/);
  assert.equal(d.querySelectorAll("#paper input.look").length, 0);
  a.at(t.events.find((e) => e.id === "check").start + 1);
  assert.match(d.getElementById("status").textContent, /檢查/);
  a.end();
  await until(() => !d.getElementById("result").hidden);
  assert.equal(d.getElementById("result").hidden, false);
});

test("頁面：送出失敗時留在答題卷、答案還在，再按一次就成功；同一次作答只算一次", async () => {
  const { d, w, calls } = await openExam({ failFinish: 1 });
  await begin(d);
  const first = d.querySelector("#paper input[data-q]");
  first.value = "my answer";
  d.getElementById("paper-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  await until(() => /送出失敗/.test(d.getElementById("status").textContent));
  assert.match(d.getElementById("status").textContent, /送出失敗：連線失敗/);
  assert.equal(first.value, "my answer");
  assert.equal(d.getElementById("result").hidden, true);
  assert.equal(d.getElementById("submit").disabled, false);
  d.getElementById("paper-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  await until(() => !d.getElementById("result").hidden);
  assert.equal(calls.filter((c) => c.path === "/api/finish").length, 2);
  assert.equal(server.dev.attempts.size > 0, true);
  const done = [...server.dev.attempts.values()].filter((a) => a.finished_at);
  assert.ok(done.some((a) => a.answers.q01 === "my answer"));
});

test("頁面：回饋表單——什麼都沒填不送；送出後伺服器有紀錄，掛在剛才那次作答", async () => {
  const { d, w } = await openExam();
  await begin(d);
  d.getElementById("paper-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  await until(() => !d.getElementById("result").hidden);
  d.getElementById("result-feedback").click();
  assert.deepEqual(visible(d), ["feedback"]);
  const before = server.dev.feedback.length;
  d.getElementById("feedback-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 50));
  assert.match(d.getElementById("feedback-message-status").textContent, /至少填一項/);
  assert.equal(server.dev.feedback.length, before);
  d.querySelector('input[name="rating"][value="4"]').checked = true;
  d.querySelector('input[name="audio_ok"][value="no"]').checked = true;
  d.getElementById("feedback-message").value = "拼字聽不清楚";
  d.getElementById("feedback-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  await until(() => /謝謝/.test(d.getElementById("feedback-message-status").textContent));
  const row = server.dev.feedback.at(-1);
  assert.equal(row.rating, 4);
  assert.equal(row.audio_ok, false);
  assert.equal(row.message, "拼字聽不清楚");
  assert.match(row.attempt_id, /^dev-attempt-/);
  d.getElementById("feedback-cancel").click();
  assert.deepEqual(visible(d), ["result"]);
});

test("頁面：從題組清單直接給回饋（不掛作答）；登入過期（401）會登出並說明", async () => {
  const { d, w } = await openExam();
  d.getElementById("to-feedback").click();
  d.getElementById("feedback-message").value = "整體不錯";
  d.getElementById("feedback-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  await until(() => /謝謝/.test(d.getElementById("feedback-message-status").textContent));
  assert.equal(server.dev.feedback.at(-1).attempt_id, undefined);
  w.localStorage.setItem("exam-auth", JSON.stringify({ access_token: "bad-token", expires_at: 9999999999 }));
  d.getElementById("feedback-send").disabled = false;
  d.getElementById("feedback-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  await until(() => /登入已過期/.test(d.getElementById("feedback-message-status").textContent));
  assert.match(d.getElementById("feedback-message-status").textContent, /再點一次信箱裡的結果連結/);
  d.getElementById("feedback-cancel").click();
  await until(() => !d.getElementById("intro").hidden);
  assert.equal(d.getElementById("who-box").hidden, true, "過期的登入已清掉");
});

test("故事：做完一套看到分數 → 結果頁給「做下一套」→ 回清單時已完成的有標記、預設選沒做過的", async () => {
  server.dev.attempts.clear();
  const { d, w, tick } = await openExam({ set: "s1-car-0001" });
  await begin(d);
  for (let k = 0; k < 60; k++) tick();
  d.getElementById("paper-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  await until(() => !d.getElementById("result").hidden);
  await until(() => !d.getElementById("next-set").hidden);
  const next = d.getElementById("next-set");
  assert.match(next.textContent, /^做下一套：/);
  assert.notEqual(next.dataset.set, "s1-car-0001", "下一套不是剛做完的這套");
  d.getElementById("again").click();
  await until(() => !d.getElementById("intro").hidden && !d.getElementById("start").disabled);
  const opts = [...d.querySelectorAll("#set-select option")];
  const done = opts.find((o) => o.value === "s1-car-0001");
  assert.match(done.textContent, /已完成 \d+\/\d+/);
  assert.notEqual(d.getElementById("set-select").value, "s1-car-0001", "預設選沒做過的");
  assert.equal(opts.filter((o) => /已完成/.test(o.textContent)).length, 1);
});

test("故事：全部做完後結果頁說明沒有更多題組，而不是留空", async () => {
  server.dev.attempts.clear();
  const { d, w, tick } = await openExam({ set: "s1-car-0001" });
  const total = d.querySelectorAll("#set-select option").length;
  for (let i = 0; i < total; i++) {
    if (i > 0) { d.getElementById("next-set").click(); await until(() => !d.getElementById("exam").hidden); }
    else await begin(d);
    for (let k = 0; k < 60; k++) tick();
  d.getElementById("paper-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
    await until(() => !d.getElementById("result").hidden && (!d.getElementById("next-set").hidden || !d.getElementById("next-note").hidden));
  }
  assert.equal(d.getElementById("next-set").hidden, true);
  assert.match(d.getElementById("next-note").textContent, /都做完了/);
});

// ---- 免登入故事：訪客作答 → 留信箱 → 收到結果連結 → 看結果 ----
const submitNow = async (d, w, tick) => {
  for (let k = 0; k < 60; k++) tick();
  d.getElementById("paper-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
};

test("故事（訪客）：作答送出後不顯示分數，要留信箱；寄出連結，點連結才看到結果，之後可以做下一套", async () => {
  server.dev.attempts.clear(); server.dev.mails.length = 0;
  const guest = await openExam({ as: null, set: "s1-car-0001" });
  const { d, w, tick, calls } = guest;
  await begin(d);
  const plan = JSON.parse(await readFile(new URL("../content/sets/s1-car-0001/plan.json", import.meta.url)));
  [...d.querySelectorAll("#paper input[data-q]")].forEach((el, i) => { el.value = plan.answers[i].answer; });
  await submitNow(d, w, tick);
  await until(() => !d.getElementById("email").hidden);
  assert.deepEqual(visible(d), ["email"], "只看到留信箱，沒有分數");
  assert.equal(d.getElementById("score").textContent, "");
  const fin = calls.find((c) => c.path === "/api/finish");
  assert.equal(fin.headers.Authorization, undefined, "訪客不帶登入");
  assert.ok(JSON.parse(fin.body).claim_token, "帶作答密鑰");
  const [att] = [...server.dev.attempts.values()];
  assert.ok(att.finished_at && att.score === plan.answers.length, "批改已存在伺服器");
  assert.equal(att.user_id, null);
  d.getElementById("email-input").value = "Student@Example.com";
  d.getElementById("email-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  await until(() => /已寄出結果連結/.test(d.getElementById("email-message").textContent));
  assert.match(d.getElementById("email-message").textContent, /student@example\.com.*第 1\/3 封/);
  assert.equal(server.dev.mails.length, 1);
  assert.equal(server.dev.mails[0].email, "student@example.com");
  assert.equal(d.getElementById("dev-link-box").hidden, false, "本機開發才有直接開連結");
  // 點信箱裡的連結：新的瀏覽器分頁，帶 ?result=… 與登入 token
  const link = new URL(d.getElementById("dev-link").href);
  const opened = await openExam({ as: null, href: `/exam/index.html${link.search}${link.hash}` });
  await until(() => !opened.d.getElementById("result").hidden);
  assert.equal(opened.d.getElementById("score").textContent, `${plan.answers.length} / ${plan.answers.length}`);
  assert.equal(opened.d.querySelectorAll("#result-table tr.ok").length, plan.answers.length);
  assert.equal(att.user_id, "dev-student@example.com", "信箱驗證後作答綁到這個帳號");
  assert.equal(opened.w.location.search, "", "網址已清乾淨");
  await until(() => !opened.d.getElementById("next-set").hidden);
  assert.match(opened.d.getElementById("next-set").textContent, /^做下一套：/);
  opened.d.getElementById("result-feedback").click();
  assert.deepEqual(visible(opened.d), ["feedback"], "看過結果才能給回饋");
});

test("故事（訪客）：別人的信箱不能看這次結果；寄信次數有上限；信箱格式不對不寄", async () => {
  server.dev.attempts.clear(); server.dev.mails.length = 0;
  const { d, w, tick } = await openExam({ as: null, set: "s1-car-0001" });
  await begin(d);
  await submitNow(d, w, tick);
  await until(() => !d.getElementById("email").hidden);
  const mail = async (v) => { d.getElementById("email-input").value = v; d.getElementById("email-form").dispatchEvent(new w.Event("submit", { cancelable: true })); await new Promise((r) => setTimeout(r, 60)); };
  await mail("不是信箱");
  assert.equal(server.dev.mails.length, 0);
  await mail("a@example.com"); await mail("a@example.com"); await mail("a@example.com");
  assert.equal(server.dev.mails.length, 3);
  await mail("a@example.com");
  assert.equal(server.dev.mails.length, 3, "第 4 次不寄");
  assert.match(d.getElementById("email-message").textContent, /寄過太多次/);
  const id = [...server.dev.attempts.keys()][0];
  const other = await openExam({ as: null, href: `/exam/index.html?result=${id}#access_token=dev-b%40example.com&expires_in=3600` });
  await until(() => !other.d.getElementById("load-warning").hidden);
  assert.deepEqual(visible(other.d), ["intro"]);
  assert.match(other.d.getElementById("load-warning").textContent, /找不到這次作答的結果/);
});

test("故事（訪客）：重新整理後，還沒領的結果會回到留信箱；沒有登入又沒有密鑰的結果連結會說明失效", async () => {
  server.dev.attempts.clear();
  const resumed = await openExam({ as: null, pending: { attempt_id: "x", claim_token: "y", finished: true } });
  assert.deepEqual(visible(resumed.d), ["email"]);
  assert.match(resumed.d.getElementById("email-message").textContent, /還沒領取/);
  const stale = await openExam({ as: null, href: "/exam/index.html?result=abc" });
  await until(() => !stale.d.getElementById("load-warning").hidden);
  assert.deepEqual(visible(stale.d), ["intro"]);
  assert.match(stale.d.getElementById("load-warning").textContent, /結果連結已失效/);
});
