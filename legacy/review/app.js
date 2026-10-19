// 題組檢視頁：選或拖入 set.json（可同時帶 audio.mp3），在瀏覽器裡讀，不送出任何東西。
import { parseBundle, buildModel, checkAudio, fmtTime, groupFiles, collectDropped } from "./render.mjs";

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...kids.flat().filter((x) => x !== null && x !== undefined && x !== false));
  return n;
};
const chip = (text, tone = "") => el("span", { class: `chip ${tone}`.trim(), text });
const rulingChip = (r) => (r === "problem" ? chip("真問題", "bad") : r === "ok" ? chip("誤報（ok）", "ok") : chip("尚未裁決", "warn"));
const state = { sets: [], model: null, audioUrl: null, audioEl: null, answers: false };

function card(value, label, tone) { return el("div", { class: "card" }, el("b", { text: String(value), class: tone ?? "" }), el("span", { text: label })); }

function renderSummary(m) {
  const box = $("summary");
  box.textContent = "";
  const sub = [m.id, m.topic, m.variant && `情境 ${m.variant}`, m.recipe && `配方 ${m.recipe}`, m.seed != null && `seed ${m.seed}`].filter(Boolean).join(" · ");
  const ai = m.ai ? `AI 審稿：${m.ai.mode === "claude" ? `自動（${m.ai.model}）` : "手動"}，${new Date(m.ai.at).toLocaleString()}` : m.legacyReview ? "舊版：有人工審稿紀錄" : "沒有 AI 審稿紀錄";
  box.append(
    el("h2", { text: m.title, style: "border:0;margin-bottom:0" }),
    el("p", { class: "note", text: sub }),
    el("p", {}, el("span", { class: `badge ${m.verdict.tone}`, text: m.verdict.label }), " ", m.verdict.hint),
    el("p", { class: "note", text: ai }),
    el("div", { class: "cards" },
      card(m.count, "題數"), card(fmtTime(m.seconds), "錄音長度"),
      card(m.warnings.length, "程式示警"), card(m.problems, "AI 認定的真問題", m.problems ? "bad" : ""), card(m.unresolved, "尚未裁決", m.unresolved ? "bad" : "")),
  );
}

function renderWarnings(m) {
  const box = $("warnings");
  box.textContent = "";
  if (!m.warnings.length) { box.append(el("p", { class: "empty", text: "沒有示警。" })); }
  else {
    box.append(el("table", {},
      el("thead", {}, el("tr", {}, ...["編號", "來源", "規則", "題", "說明", "AI 裁決"].map((h) => el("th", { text: h })))),
      el("tbody", {}, ...m.warnings.map((w) => el("tr", {},
        el("td", { text: w.id }), el("td", { text: w.source === "blind" ? "盲答比對" : w.source === "validate" ? "驗證" : w.source }), el("td", { text: w.rule }),
        el("td", {}, w.number ? el("a", { href: "#", text: `第 ${w.number} 題`, onclick: (e) => { e.preventDefault(); focusQuestion(w.number); } }) : "—"),
        el("td", { text: w.message }), el("td", {}, rulingChip(w.ruling)))))));
  }
  box.append(el("p", { class: "note", text: "AI 審稿找到的其他問題（例如答案卡缺少可接受的寫法、前後矛盾）不在 set.json 裡，請看 results/sets/<id>/review-report.md。" }));
}

function focusQuestion(n) {
  for (const tr of document.querySelectorAll("#questions tr")) tr.classList.toggle("hl", tr.dataset.n === String(n));
  for (const s of document.querySelectorAll(".seg")) s.classList.toggle("mark", s.dataset.q && Number(s.dataset.q.split(",")[0]) <= n && n <= Number(s.dataset.q.split(",")[1]));
  document.querySelector(`#questions tr[data-n="${n}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function renderQuestions(m) {
  const box = $("questions");
  box.textContent = "";
  box.append(el("table", {},
    el("thead", {}, el("tr", {}, ...["題", "欄位", "標準答案", "也算對", "陷阱", "比對方式", "錄音裡的錯誤值", "出題備註", "示警"].map((h) => el("th", { text: h })))),
    el("tbody", {}, ...m.questions.map((q) => el("tr", { "data-n": q.number },
      el("td", { text: String(q.number) }),
      el("td", { text: q.label }),
      el("td", {}, el("b", { text: q.answer }), el("br"), el("span", { class: "note", text: q.typeLabel })),
      el("td", { text: q.accepted.join("、") || "—" }),
      el("td", {}, chip(q.trapLabel, q.trap === "none" ? "" : "warn")),
      el("td", { text: q.policyLabel }),
      el("td", { text: q.wrong ?? "—" }),
      el("td", { text: q.note || "—" }),
      el("td", {}, ...(q.warnings.length ? q.warnings.map((w) => el("div", {}, chip(w.id), rulingChip(w.ruling))) : ["—"])))))));
}

function renderPaper(m) {
  const box = $("paper");
  box.textContent = "";
  const { paper } = m;
  const answerOf = new Map(m.questions.map((q) => [q.id, q]));
  box.append(el("h3", { text: paper.title }), el("p", { class: "instruction", text: paper.instruction }));
  let section = null, group = box, n = 0;
  for (const row of paper.rows) {
    if (row.section && row.section !== section) {
      section = row.section;
      const para = paper.section_styles?.[section] === "paragraph";
      group = el("div", { class: para ? "group para" : "group" });
      box.append(el("h4", { class: "section", text: section }), group);
    }
    const line = el("div", { class: "line" });
    if (!row.inline) line.append(`${row.label}: `);
    for (const p of row.parts) {
      if (p.text !== undefined) { line.append(`${p.text} `); continue; }
      n++;
      const q = answerOf.get(p.blank);
      line.append(el("span", { class: "num", text: String(n), title: "點一下在上表標出這一題", onclick: () => focusQuestion(n) }),
        el("span", { class: state.answers ? "blank ans" : "blank", text: state.answers ? (q?.answer ?? "?") : "" }), " ");
    }
    group.append(line);
  }
}

function renderTimeline(m) {
  const box = $("timeline");
  box.textContent = "";
  const bar = el("div", { class: state.audioEl ? "timeline seek" : "timeline" });
  for (const s of m.segments) {
    bar.append(el("div", {
      class: `seg ${s.type}`, style: `left:${s.left}%;width:${s.width}%`, "data-q": s.questions ? s.questions.join(",") : null,
      title: `${s.label}${s.questionsText ? `（${s.questionsText}）` : ""}　${fmtTime(s.start)}–${fmtTime(s.end)}（${(s.end - s.start).toFixed(1)} 秒）`,
    }));
  }
  const head = el("div", { class: "playhead", style: "left:0%", hidden: true });
  bar.append(head);
  bar.addEventListener("click", (e) => {
    if (!state.audioEl) return;
    const r = bar.getBoundingClientRect();
    state.audioEl.currentTime = ((e.clientX - r.left) / r.width) * m.total;
    state.audioEl.play().catch(() => {});
  });
  state.head = head;
  const ticks = el("div", { class: "ticks" });
  for (let t = 0; t <= m.total; t += 60) ticks.append(el("span", { style: `left:${(t / m.total) * 100}%`, text: fmtTime(t) }));
  const legend = el("div", { class: "legend" }, el("i", { style: "background:var(--c-announce)" }), "旁白", el("i", { style: "background:var(--c-turn)" }), "對話", el("i", { style: "background:var(--c-pause)" }), "作答停頓（滑過去看題號與秒數）");
  const pauses = el("p", { class: "note", text: `作答停頓：${m.pauses.map((p) => `${p.questionsText ?? "最後檢查"} ${Math.round(p.end - p.start)} 秒`).join("、")}` });
  box.append(bar, ticks, legend, pauses);
}

async function renderAudio(m, file) {
  const box = $("audio-box");
  box.textContent = "";
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioEl = null;
  if (!file) { box.append(el("p", { class: "note", text: "還沒載入 audio.mp3：同時選 set.json 和 audio.mp3 就能播放，並可點時間軸跳到那一段。" })); return; }
  const buf = await file.arrayBuffer();
  const res = await checkAudio(m.audio, buf);
  state.audioUrl = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
  const audio = el("audio", { controls: true, src: state.audioUrl });
  audio.addEventListener("timeupdate", () => { state.head.hidden = false; state.head.style.left = `${(audio.currentTime / m.total) * 100}%`; });
  state.audioEl = audio;
  box.append(el("p", {}, chip(res.ok === true ? "錄音檔與 set.json 一致" : res.ok === false ? "錄音檔對不上" : "未驗證", res.ok === true ? "ok" : res.ok === false ? "bad" : "warn"), ` ${res.reason}`), audio);
  document.querySelector(".timeline")?.classList.add("seek");
}

function renderSteps(m) {
  const box = $("steps");
  const NAME = { plan: "plan（規劃）", script: "script（逐字稿）", blind: "blind（盲答）", validate: "validate（驗證）", ai_review: "ai_review（AI 審稿）" };
  box.textContent = "";
  box.append(el("table", {},
    el("thead", {}, el("tr", {}, ...["步驟", "誰做的", "方式", "時間", "備註"].map((h) => el("th", { text: h })))),
    el("tbody", {}, ...m.steps.map((s) => el("tr", {},
      el("td", { text: NAME[s.key] }), el("td", { text: s.model ?? "—" }), el("td", { text: s.mode ? (s.mode === "claude" ? "自動" : "手動") : "—" }), el("td", { text: s.at ? new Date(s.at).toLocaleString() : "—" }),
      el("td", { text: s.key === "validate" ? `${s.ok ? "通過" : "未通過"}，block ${s.block}／warn ${s.warn}` : s.key === "blind" ? `盲答警示 ${s.warnings ?? 0} 項` : s.verdict ? `結論 ${s.verdict}` : "" }))))));
  box.append(el("p", { class: "note", text: `產題工具版本 ${m.generator ?? "?"}` }));
}

function renderOverview() {
  const box = $("overview");
  box.textContent = "";
  box.hidden = state.sets.length < 2;
  if (box.hidden) return;
  const n = (k) => state.sets.filter((x) => x.model.verdict.key === k).length;
  box.append(el("h2", { text: `共 ${state.sets.length} 套` }),
    el("p", { text: `通過 ${n("pass")}、有疑慮 ${n("needs_human")}、沒有審稿 ${n("none")}。點一列看細節。` }),
    el("table", {},
      el("thead", {}, el("tr", {}, ...["題組", "標題", "結論", "示警", "真問題", "題數", "長度"].map((h) => el("th", { text: h })))),
      el("tbody", {}, ...state.sets.map((x, i) => el("tr", { "data-i": i, class: i === state.current ? "cur" : "", onclick: () => select(i) },
        el("td", { text: x.name }), el("td", { text: x.model.title }),
        el("td", {}, el("span", { class: `badge ${x.model.verdict.tone}`, text: x.model.verdict.label })),
        el("td", { text: String(x.model.warnings.length) }),
        el("td", { text: String(x.model.problems), class: x.model.problems ? "bad" : "" }),
        el("td", { text: String(x.model.count) }), el("td", { text: fmtTime(x.model.seconds) }))))));
}

async function select(i) {
  const cur = state.sets[i];
  state.audioEl?.pause();
  state.audioEl = null;
  state.current = i;
  state.model = cur.model;
  state.answers = $("show-answers").checked;
  for (const tr of document.querySelectorAll("#overview tbody tr")) tr.classList.toggle("cur", Number(tr.dataset.i) === i);
  const m = cur.model;
  renderSummary(m); renderWarnings(m); renderTimeline(m); await renderAudio(m, cur.audioFile); renderQuestions(m); renderPaper(m); renderSteps(m);
  $("raw").textContent = JSON.stringify(cur.bundle, null, 2);
  $("report").hidden = false;
  document.title = `${m.title}（題組檢視）`;
}

async function loadGroups(groups) {
  const err = $("error");
  err.hidden = true;
  const sets = [], problems = [];
  for (const g of groups) {
    try { const bundle = parseBundle(await g.json.text()); sets.push({ name: g.name, bundle, model: buildModel(bundle), audioFile: g.audio }); }
    catch (e) { problems.push(`${g.name}：${e.message}`); }
  }
  if (problems.length) { err.textContent = `${sets.length ? "有幾套讀不進來（其餘照常顯示）" : "讀不進來"}：${problems.join("；")}`; err.hidden = false; }
  if (!sets.length) return;
  state.sets = sets;
  renderOverview();
  await select(0);
}

function handleItems(items) {
  const groups = groupFiles(items);
  if (!groups.length) { $("error").textContent = "找不到 set.json：請拖題組資料夾，或選 set.json（可以再加 audio.mp3）"; $("error").hidden = false; return; }
  loadGroups(groups);
}

const fromInput = (files) => [...files].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
$("file").addEventListener("change", (e) => handleItems(fromInput(e.target.files)));
$("dir").addEventListener("change", (e) => handleItems(fromInput(e.target.files)));
const drop = $("drop");
for (const t of ["dragenter", "dragover"]) drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); });
for (const t of ["dragleave", "drop"]) drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); });
const onDrop = async (e) => { e.preventDefault(); drop.classList.remove("over"); handleItems(await collectDropped(e.dataTransfer)); };
drop.addEventListener("drop", onDrop);
// 拖到頁面其他地方也收，免得瀏覽器直接把檔案打開
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => { if (e.target !== drop && !drop.contains(e.target)) onDrop(e); else e.preventDefault(); });
$("show-answers").addEventListener("change", (e) => { state.answers = e.target.checked; if (state.model) renderPaper(state.model); });
