// 測驗頁：說明 → 預覽（看題倒數）→ 播放錄音（只播一次）→ 檢查倒數 → 批改 → 顯示對錯與正解。
// 錄音旁有 timing.json 時，看題停頓與最後檢查都以錄音時間軸為準（不再用頁面自己的倒數）。
// 這一版不含任何語音合成。錄音檔（由伺服器簽發網址，不在公開檔案內）由 M4 產生；沒有檔案時只能先填答題卷。
// 標準答案與批改在伺服器端（/api/finish）；瀏覽器只拿得到題目卷、時間軸與錄音的簽名網址。
import { formatClock, eventAt, viewOf, questionLabel } from "./core.mjs";
import { config } from "./config.js";
import { createAuth } from "./auth.mjs";

const $ = (id) => document.getElementById(id);
const state = { audio: null, phase: "intro", data: null, timer: null, remaining: 0, onSkip: null, attemptId: null, lastAttemptId: null, submitting: false, previous: "intro" };
// 沒有時間軸的題組（只有開發時才會遇到）才用這兩個秒數；有時間軸的題組，看題與檢查時間都在錄音裡。
const PREVIEW_SECONDS = 30;
const CHECK_SECONDS = 30;
const auth = createAuth({ config, storage: window.localStorage, location: window.location });

// 呼叫伺服器函式；沒有登入或登入過期就回登入頁。
async function api(path, { method = "GET", body } = {}) {
  const token = await auth.token();
  if (!token) { showLogin("登入已過期，請重新登入。"); throw new Error("未登入"); }
  const res = await fetch(`/api/${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { auth.signOut(); showLogin("登入已過期，請重新登入。"); throw new Error("未登入"); }
  if (!res.ok) throw new Error(data.error ?? `發生錯誤（${res.status}）`);
  return data;
}

function setPhase(p) {
  state.phase = p;
  const show = ["login", "intro", "result", "feedback"].includes(p) ? p : "exam";
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
  countdown(PREVIEW_SECONDS, "先看題目。倒數結束後錄音開始播放，只播一次。", startPlayback);
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
  countdown(CHECK_SECONDS, "播放結束，檢查你的答案。", finish);
}

function collect() {
  const a = {};
  for (const i of inputs()) a[i.dataset.q] = i.value;
  return a;
}

async function finish() {
  if (state.phase === "result" || state.submitting) return;
  state.submitting = true;
  clearInterval(state.timer);
  state.timer = null;
  try { state.audio?.pause(); } catch { /* 沒有在播就算了 */ }
  $("status").textContent = "批改中…";
  $("submit").disabled = true;
  try {
    const result = await api("finish", { method: "POST", body: { attempt_id: state.attemptId, answers: collect() } });
    state.lastAttemptId = state.attemptId;
    showResult(result);
    offerNext();
  } catch (e) {
    // 送出失敗：留在答題卷，答案還在，讓使用者再按一次送出。
    if (state.phase !== "login") { $("status").textContent = `送出失敗：${e.message}。答案還在，請再按一次「送出」。`; $("submit").disabled = false; state.phase = "check"; }
  } finally { state.submitting = false; }
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

// 結果頁：還有沒做過的題組就給「做下一套」，沒有就說明。
async function offerNext() {
  const btn = $("next-set"), note = $("next-note");
  btn.hidden = true; note.hidden = true;
  try {
    const { sets } = await api("sets");
    const next = sets.find((s) => !s.best && s.set_id !== state.currentSet);
    if (state.phase !== "result") return;
    if (next) { btn.textContent = `做下一套：${next.title}`; btn.dataset.set = next.set_id; btn.hidden = false; }
    else { note.textContent = "目前的題組你都做完了。新題組會陸續加入。"; note.hidden = false; }
  } catch (e) { /* 取不到清單就只少一個按鈕，不影響結果 */ void e; }
}

async function loadSet(id) {
  const d = await api("start", { method: "POST", body: { set_id: id } });
  state.attemptId = d.attempt_id;
  state.currentSet = id;
  state.data = { paper: d.paper, audio: d.audio_url, timing: d.timing };
}

function showLogin(message) {
  setPhase("login");
  const msg = $("login-message");
  msg.hidden = !message;
  msg.textContent = message ?? "";
  $("dev-login").hidden = !auth.isLocalDev;
}

async function showHome() {
  setPhase("intro");
  $("who").textContent = auth.email() ?? "";
  const select = $("set-select");
  select.textContent = "";
  $("start").disabled = true;
  try {
    const { sets } = await api("sets");
    for (const s of sets) { const o = document.createElement("option"); o.value = s.set_id; o.textContent = s.best ? `${s.title}　✓ 已完成 ${s.best.score}/${s.best.total}` : s.title; select.append(o); }
    const wanted = state.deepLinkUsed ? null : new URLSearchParams(location.search).get("set");
    state.deepLinkUsed = true; // ?set= 只管第一次進清單；之後預設選沒做過的
    const firstNew = sets.find((s) => !s.best);
    if (wanted && sets.some((s) => s.set_id === wanted)) select.value = wanted;
    else if (firstNew) select.value = firstNew.set_id; // 預設選還沒做過的第一套
    $("start").disabled = sets.length === 0;
    $("load-warning").hidden = sets.length > 0;
    $("load-warning").textContent = sets.length ? "" : "目前沒有可做的題組。";
  } catch (e) {
    if (state.phase === "intro") { $("load-warning").textContent = e.message; $("load-warning").hidden = false; }
  }
}

function openFeedback(from, attemptId) {
  state.previous = from;
  state.feedbackAttempt = attemptId ?? null;
  $("feedback-form").reset();
  $("feedback-message-status").hidden = true;
  $("feedback-send").disabled = false;
  setPhase("feedback");
}

async function sendFeedback(e) {
  e.preventDefault();
  const form = $("feedback-form");
  const rating = form.elements.rating.value;
  const audio = form.elements.audio_ok.value;
  const message = $("feedback-message").value.trim();
  const status = $("feedback-message-status");
  status.hidden = false;
  if (!rating && !audio && !message) { status.textContent = "至少填一項再送出。"; return; }
  $("feedback-send").disabled = true;
  try {
    await api("feedback", { method: "POST", body: { ...(rating ? { rating: Number(rating) } : {}), ...(audio ? { audio_ok: audio === "yes" } : {}), ...(message ? { message } : {}), ...(state.feedbackAttempt ? { attempt_id: state.feedbackAttempt } : {}) } });
    status.textContent = "收到了，謝謝你的回饋！";
    $("feedback-cancel").textContent = "回去";
  } catch (err) {
    if (state.phase === "feedback") { status.textContent = `送出失敗：${err.message}`; $("feedback-send").disabled = false; }
  }
}

async function init() {
  if (config.contactEmail) { $("contact").textContent = `要求刪除你的資料，請寫信到 ${config.contactEmail}。`; $("contact").hidden = false; }
  const hash = auth.consumeHash();
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("login-send").disabled = true;
    try { await auth.signIn($("login-email").value.trim()); showLogin("已寄出登入連結，請到信箱點連結（沒看到的話看一下垃圾郵件）。"); }
    catch (err) { showLogin(err.message); }
    $("login-send").disabled = false;
  });
  $("dev-login").addEventListener("click", () => { auth.devLogin("dev-tester"); showHome(); });
  $("logout").addEventListener("click", () => { auth.signOut(); showLogin(); });
  $("start").addEventListener("click", async () => {
    $("start").disabled = true;
    try { await loadSet($("set-select").value); startPreview(); }
    catch (e) { if (state.phase === "intro") { $("load-warning").textContent = e.message; $("load-warning").hidden = false; $("start").disabled = false; } }
  });
  $("skip").addEventListener("click", () => state.onSkip?.());
  $("paper-form").addEventListener("submit", (e) => { e.preventDefault(); if (state.phase === "playing" || state.phase === "check") finish(); });
  $("again").addEventListener("click", () => showHome());
  $("next-set").addEventListener("click", async () => {
    const id = $("next-set").dataset.set;
    $("next-set").disabled = true;
    try { await loadSet(id); startPreview(); }
    catch (e) { $("next-note").textContent = `開不了：${e.message}`; $("next-note").hidden = false; }
    finally { $("next-set").disabled = false; }
  });
  $("to-feedback").addEventListener("click", () => openFeedback("intro", null));
  $("result-feedback").addEventListener("click", () => openFeedback("result", state.lastAttemptId));
  $("feedback-form").addEventListener("submit", sendFeedback);
  $("feedback-cancel").addEventListener("click", () => { $("feedback-cancel").textContent = "不用了，回去"; state.previous === "result" ? setPhase("result") : showHome(); });

  if (!auth.configured && !auth.isLocalDev) { showLogin("登入服務還沒設定好。"); }
  else if (await auth.token()) await showHome();
  else showLogin(hash?.error ? `登入失敗：${hash.error}` : undefined);
  window.__examReady = true;
}

init().catch((e) => { document.body.prepend(Object.assign(document.createElement("p"), { className: "warn", textContent: `載入失敗：${e.message}` })); });
