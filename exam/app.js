// 測驗頁：說明 → 預覽（看題倒數）→ 播放（只播一次）→ 檢查倒數 → 批改 → 顯示對錯與正解。
// 標準答案目前放在前端（content/sets/<id>/plan.json），只適合測試版。
import { gradeAnswers, pickVoices, formatClock } from "./core.mjs";

const $ = (id) => document.getElementById(id);
const state = { phase: "intro", data: null, profile: null, timer: null, remaining: 0, onSkip: null };

async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`讀不到 ${path}`);
  return res.json();
}

function setPhase(p) {
  state.phase = p;
  const show = p === "intro" ? "intro" : p === "result" ? "result" : "exam";
  for (const el of document.querySelectorAll("[data-phase]")) el.hidden = el.dataset.phase !== show;
}

// 說明文字裡的全大寫片語（NO MORE THAN TWO WORDS AND/OR A NUMBER）照雅思格式加粗。
function renderInstruction(el, text) {
  el.textContent = "";
  let last = 0;
  for (const m of text.matchAll(/[A-Z][A-Z/]+(?: [A-Z/]+)*/g)) {
    el.append(document.createTextNode(text.slice(last, m.index)));
    const b = document.createElement("b");
    b.textContent = m[0];
    el.append(b);
    last = m.index + m[0].length;
  }
  el.append(document.createTextNode(text.slice(last)));
}

// 題目卷照雅思答題卷的樣子：每一列是「標籤：文字 ①＿＿＿ 文字」，空格是行內底線欄位，前面有編號圓圈。
function renderPaper(paper) {
  $("paper-title").textContent = paper.title;
  renderInstruction($("paper-instruction"), paper.instruction);
  const box = $("paper");
  box.textContent = "";
  let n = 0;
  for (const row of paper.rows) {
    const line = document.createElement("div");
    line.className = "line";
    line.append(document.createTextNode(`${row.label}: `));
    for (const part of row.parts) {
      if (part.text !== undefined) { line.append(document.createTextNode(part.text + " ")); continue; }
      n++;
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(n);
      const input = document.createElement("input");
      input.type = "text";
      input.dataset.q = part.blank;
      input.disabled = true;
      input.setAttribute("aria-label", `Question ${n}`);
      input.autocapitalize = "off";
      input.spellcheck = false;
      line.append(num, input, document.createTextNode(" "));
    }
    box.append(line);
  }
}

function inputs() { return [...document.querySelectorAll("#paper input[data-q]")]; }
function setInputsEnabled(on) { for (const i of inputs()) i.disabled = !on; $("submit").disabled = !on; }

function countdown(seconds, label, onDone) {
  clearInterval(state.timer);
  state.remaining = seconds;
  const tick = () => { $("clock").textContent = formatClock(state.remaining); $("status").textContent = label; };
  tick();
  state.timer = setInterval(() => {
    state.remaining -= 1;
    tick();
    if (state.remaining <= 0) { clearInterval(state.timer); state.timer = null; onDone(); }
  }, 1000);
  state.onSkip = () => { clearInterval(state.timer); state.timer = null; onDone(); };
}

// 語音：一輪一輪念，只念一次。speech 可由測試替換。
export function speakAll(turns, speech, onDone) {
  const voices = pickVoices(speech.synth.getVoices());
  let i = 0;
  const next = () => {
    if (i >= turns.length) return onDone();
    const t = turns[i++];
    const u = new speech.Utterance(t.text);
    const v = voices[t.speaker] ?? voices.A;
    if (v.voice) u.voice = v.voice;
    u.lang = v.voice?.lang ?? "en-GB";
    u.pitch = v.pitch; u.rate = v.rate;
    u.onend = next;
    u.onerror = next;
    speech.synth.speak(u);
  };
  next();
}

function getSpeech() {
  const w = window;
  if (w.__speech) return w.__speech;
  if (!w.speechSynthesis || !w.SpeechSynthesisUtterance) return null;
  return { synth: w.speechSynthesis, Utterance: w.SpeechSynthesisUtterance };
}

function startPreview() {
  setPhase("exam");
  renderPaper(state.data.paper);
  setInputsEnabled(false);
  $("skip").hidden = false;
  countdown(state.profile.preview_seconds.value, "先看題目。倒數結束後錄音開始播放，只播一次。", startPlayback);
}

function startPlayback() {
  state.phase = "playing";
  setInputsEnabled(true);
  $("skip").hidden = true;
  $("clock").textContent = "";
  $("status").textContent = "錄音播放中，邊聽邊填。";
  inputs()[0]?.focus();
  speakAll(state.data.script.turns, getSpeech(), startCheck);
}

function startCheck() {
  state.phase = "check";
  $("skip").hidden = false;
  countdown(state.profile.check_seconds.value, "播放結束，檢查你的答案。", finish);
}

function collect() {
  const a = {};
  for (const i of inputs()) a[i.dataset.q] = i.value;
  return a;
}

function finish() {
  if (state.phase === "result") return;
  clearInterval(state.timer);
  state.timer = null;
  try { getSpeech()?.synth.cancel(); } catch { /* 沒有在念就算了 */ }
  showResult(gradeAnswers(state.data.plan, collect()));
}

function showResult(result) {
  setPhase("result");
  $("score").textContent = `${result.total} / ${result.count}`;
  const table = $("result-table");
  table.textContent = "";
  const head = table.insertRow();
  for (const h of ["題號", "你寫的", "正解"]) { const th = document.createElement("th"); th.textContent = h; head.append(th); }
  for (const r of result.results) {
    const tr = table.insertRow();
    tr.className = r.correct ? "ok" : "bad";
    tr.dataset.q = r.question_id;
    tr.insertCell().textContent = `${r.number} ${r.correct ? "✓" : "✗"}`;
    tr.insertCell().textContent = r.given || "（空白）";
    tr.insertCell().textContent = r.expected;
  }
}

async function loadSet(id) {
  const base = `../content/sets/${id}`;
  const [paper, plan, script] = await Promise.all([getJson(`${base}/paper.json`), getJson(`${base}/plan.json`), getJson(`${base}/script.json`)]);
  state.data = { paper, plan, script };
}

async function init() {
  const sets = await getJson("sets.json");
  state.profile = await getJson("../config/exam-profile.json");
  const select = $("set-select");
  for (const s of sets) { const o = document.createElement("option"); o.value = s.id; o.textContent = `${s.title}（${s.id}）`; select.append(o); }
  const wanted = new URLSearchParams(location.search).get("set");
  if (wanted && sets.some((s) => s.id === wanted)) select.value = wanted;
  const speech = getSpeech();
  $("speech-warning").hidden = !!speech;
  const start = $("start");
  start.textContent = "開始";
  start.disabled = !speech;
  start.addEventListener("click", async () => {
    start.disabled = true;
    try { await loadSet(select.value); startPreview(); }
    catch (e) { $("speech-warning").textContent = String(e.message); $("speech-warning").hidden = false; start.disabled = false; }
  });
  $("skip").addEventListener("click", () => state.onSkip?.());
  $("paper-form").addEventListener("submit", (e) => { e.preventDefault(); if (state.phase === "playing" || state.phase === "check") finish(); });
  $("again").addEventListener("click", () => { setPhase("intro"); $("start").disabled = !getSpeech(); });
  window.__examReady = true;
}

init().catch((e) => { document.body.prepend(Object.assign(document.createElement("p"), { className: "warn", textContent: `載入失敗：${e.message}` })); });
