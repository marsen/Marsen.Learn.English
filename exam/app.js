// 測驗頁：說明 → 預覽（看題倒數）→ 播放（只播一次）→ 檢查倒數 → 評分 → 結果。
// 標準答案目前放在前端（content/sets/<id>/plan.json），只適合測試版；上帳號後評分搬到伺服器。
import { buildResult, addToHistory, weaknesses, pickVoices, formatClock, TRAP_LABEL, TYPE_LABEL, WEAK_MIN_ATTEMPTS } from "./core.mjs";

const $ = (id) => document.getElementById(id);
const STORE = "exam-history-v1";

const state = { phase: "intro", data: null, profile: null, answers: {}, timer: null, remaining: 0, spoken: false };

function load() { try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; } }
function save(h) { try { localStorage.setItem(STORE, JSON.stringify(h)); } catch { /* 無痕模式等情況存不了，不影響作答 */ } }

async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`讀不到 ${path}`);
  return res.json();
}

function setPhase(p) {
  state.phase = p;
  for (const el of document.querySelectorAll("[data-phase]")) el.hidden = el.dataset.phase !== (p === "intro" ? "intro" : p === "result" ? "result" : "exam");
}

function renderPaper(paper) {
  $("paper-title").textContent = paper.title;
  $("paper-instruction").textContent = paper.instruction;
  const table = $("paper");
  table.textContent = "";
  let n = 0;
  for (const row of paper.rows) {
    const tr = table.insertRow();
    const th = document.createElement("th");
    th.textContent = row.label;
    tr.append(th);
    const td = tr.insertCell();
    for (const part of row.parts) {
      if (part.text !== undefined) { td.append(document.createTextNode(part.text + " ")); continue; }
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
      td.append(num, input);
    }
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
  state.answers = collect();
  const result = buildResult(state.data, state.answers);
  const history = addToHistory(load(), result);
  save(history);
  showResult(result, history);
}

function bars(el, tally, labels) {
  el.textContent = "";
  for (const [k, v] of Object.entries(tally)) {
    const pct = Math.round((v.correct / v.total) * 100);
    const row = document.createElement("div");
    row.className = "bar";
    row.innerHTML = `<span class="lab"></span><span class="track"><span class="fill" style="width:${pct}%"></span></span><span class="pct"></span>`;
    row.querySelector(".lab").textContent = labels[k] ?? k;
    row.querySelector(".pct").textContent = `${v.correct} / ${v.total}`;
    el.append(row);
  }
}

function showResult(result, history) {
  setPhase("result");
  $("score").textContent = `${result.total} / ${result.count}`;
  const table = $("result-table");
  table.textContent = "";
  const head = table.insertRow();
  for (const h of ["題號", "你寫的", "正確答案", "陷阱", "答案在哪一句"]) { const th = document.createElement("th"); th.textContent = h; th.style.width = "auto"; head.append(th); }
  for (const r of result.results) {
    const tr = table.insertRow();
    tr.className = r.correct ? "ok" : "bad";
    tr.dataset.q = r.question_id;
    tr.insertCell().textContent = `${r.number} ${r.correct ? "✓" : "✗"}`;
    tr.insertCell().textContent = r.given || "（空白）";
    tr.insertCell().textContent = r.expected;
    tr.insertCell().textContent = TRAP_LABEL[r.trap] ?? r.trap;
    const td = tr.insertCell();
    td.append(document.createTextNode(r.quote + " "));
    const speech = getSpeech();
    if (speech && r.turn_text) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "listen"; b.textContent = "聽這一輪";
      b.addEventListener("click", () => { speech.synth.cancel(); speakAll([{ speaker: speakerOf(r.turn_id), text: r.turn_text }], speech, () => {}); });
      td.append(b);
    }
  }
  bars($("by-type"), result.byType, TYPE_LABEL);
  bars($("by-trap"), result.byTrap, TRAP_LABEL);
  const weak = weaknesses(history);
  $("weak").textContent = weak.length
    ? `累積作答後，這幾類答對率偏低：${weak.map((w) => `${TRAP_LABEL[w.key]}（${Math.round(w.rate * 100)}%，${w.total} 題）`).join("、")}`
    : `同一類型累積至少 ${WEAK_MIN_ATTEMPTS} 題作答後，才會判斷你常錯哪一種。目前只顯示答對率。`;
}

function speakerOf(turnId) { return state.data.script.turns.find((t) => t.id === turnId)?.speaker ?? "A"; }

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
