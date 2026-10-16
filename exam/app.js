// 測驗頁：說明 → 預覽（看題倒數）→ 播放錄音（只播一次）→ 檢查倒數 → 批改 → 顯示對錯與正解。
// 錄音旁有 timing.json 時，看題停頓與最後檢查都以錄音時間軸為準（不再用頁面自己的倒數）。
// 這一版不含任何語音合成。錄音檔（content/sets/<id>/audio/full.mp3）由 M4 產生；沒有檔案時只能先填答題卷。
// 標準答案目前放在前端（content/sets/<id>/plan.json），只適合測試版。
import { gradeAnswers, formatClock, eventAt, viewOf, questionLabel } from "./core.mjs";

const $ = (id) => document.getElementById(id);
const state = { audio: null, phase: "intro", data: null, profile: null, timer: null, remaining: 0, onSkip: null };

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

// 題目卷照雅思答題卷的樣子：分段標題，段內是像隨手筆記的行（list），或連成一小段文字（paragraph）；
// 空格是行內底線欄位，前面有編號圓圈。paper.section_styles 指定每段用哪一種，沒寫就是 list。
// 一般列：「標籤: 前文 ① 後文」；inline 列（有句型）：「前文 ① 後文」，不另外印標籤。
function renderPaper(paper) {
  $("paper-title").textContent = paper.title;
  renderInstruction($("paper-instruction"), paper.instruction);
  const box = $("paper");
  box.textContent = "";
  let n = 0;
  let section = null;
  let group = box;
  for (const row of paper.rows) {
    if (row.section && row.section !== section) {
      section = row.section;
      const h = document.createElement("h2");
      h.className = "section";
      h.textContent = section;
      const paragraph = paper.section_styles?.[section] === "paragraph";
      group = document.createElement(paragraph ? "p" : "div");
      group.className = paragraph ? "group para" : "group";
      box.append(h, group);
    } else if (!row.section && section === null) group = box;
    const line = document.createElement(group.classList.contains("para") ? "span" : "div");
    line.className = "line";
    if (!row.inline) line.append(document.createTextNode(`${row.label}: `));
    for (const [pi, part] of row.parts.entries()) {
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
      const next = row.parts[pi + 1]?.text;
      line.append(num, input, document.createTextNode(next && /^[.,;:!?]/.test(next) ? "" : " "));
    }
    group.append(line);
    if (group.classList.contains("para")) group.append(document.createTextNode(" "));
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

// 錄音：有 audio/full.mp3 就播一次（沒有暫停與倒轉）；沒有就回傳 null。
function playRecording(src, onDone) {
  const audio = new Audio(src);
  state.audio = audio;
  audio.addEventListener("ended", onDone);
  audio.addEventListener("error", onDone);
  audio.play().catch(onDone);
}

// 有 timing.json：整段流程（播報、看題停頓、對話、檢查）都在錄音裡，畫面跟著錄音走。
function startTimed() {
  setPhase("exam");
  renderPaper(state.data.paper);
  setInputsEnabled(true);
  $("skip").textContent = "結束並批改（開發用）";
  $("skip").hidden = false;
  state.onSkip = finish;
  state.phase = "playing";
  const audio = new Audio(state.data.audio);
  state.audio = audio;
  const show = () => {
    const v = viewOf(eventAt(state.data.timing.events, audio.currentTime ?? 0), audio.currentTime ?? 0);
    if (!v) return;
    state.phase = v.kind === "check" ? "check" : "playing";
    $("clock").textContent = v.kind === "listen" ? "" : formatClock(v.remaining);
    $("status").textContent = v.kind === "listen" ? "錄音播放中，邊聽邊填。" : v.kind === "check" ? "檢查你的答案。" : `看題時間：${questionLabel(v.questions)}`;
    const [a, b] = v.questions ?? [0, -1];
    for (const i of inputs()) { const n = Number(i.dataset.q.slice(1)); i.classList.toggle("look", n >= a && n <= b); }
  };
  audio.addEventListener("timeupdate", show);
  audio.addEventListener("ended", finish);
  audio.addEventListener("error", finish);
  $("status").textContent = "錄音開始。";
  audio.play().catch(finish);
}

function startPreview() {
  if (state.data.timing) return startTimed();
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
  inputs()[0]?.focus();
  if (state.data.audio) {
    $("status").textContent = "錄音播放中，邊聽邊填。";
    playRecording(state.data.audio, startCheck);
  } else {
    // 還沒有錄音（M4 才會產生）：先讓人填答題卷，看版面用。
    $("status").textContent = "這一組還沒有錄音（M4 才會產生），可以先填答題卷看版面。";
    $("skip").textContent = "結束作答，進入檢查";
    $("skip").hidden = false;
    state.onSkip = startCheck;
  }
}

function startCheck() {
  state.phase = "check";
  $("skip").textContent = "略過倒數（開發用）";
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
  try { state.audio?.pause(); } catch { /* 沒有在播就算了 */ }
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
  const src = `${base}/audio/full.mp3`;
  const head = await fetch(src, { method: "HEAD" }).catch(() => null);
  const timing = head?.ok ? await getJson(`${base}/audio/timing.json`).catch(() => null) : null;
  state.data = { paper, plan, script, audio: head?.ok ? src : null, timing };
}

async function init() {
  const sets = await getJson("sets.json");
  state.profile = await getJson("../config/exam-profile.json");
  const select = $("set-select");
  for (const s of sets) { const o = document.createElement("option"); o.value = s.id; o.textContent = `${s.title}（${s.id}）`; select.append(o); }
  const wanted = new URLSearchParams(location.search).get("set");
  if (wanted && sets.some((s) => s.id === wanted)) select.value = wanted;
  const start = $("start");
  start.textContent = "開始";
  start.disabled = false;
  start.addEventListener("click", async () => {
    start.disabled = true;
    try { await loadSet(select.value); startPreview(); }
    catch (e) { $("load-warning").textContent = String(e.message); $("load-warning").hidden = false; start.disabled = false; }
  });
  $("skip").addEventListener("click", () => state.onSkip?.());
  $("paper-form").addEventListener("submit", (e) => { e.preventDefault(); if (state.phase === "playing" || state.phase === "check") finish(); });
  $("again").addEventListener("click", () => { setPhase("intro"); $("start").disabled = false; });
  window.__examReady = true;
}

init().catch((e) => { document.body.prepend(Object.assign(document.createElement("p"), { className: "warn", textContent: `載入失敗：${e.message}` })); });
