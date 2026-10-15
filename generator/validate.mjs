import { findInText, findSpelled } from "./answer.mjs";
import { normalize } from "./normalize.mjs";

const TRAPS = ["self_correction", "spelling", "similar_numbers", "paraphrase", "distractor", "none"];
const NUM_WORD_PAIRS = { thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90" };
const INSTRUCTION_LIMITS = { ONE: 1, TWO: 2, THREE: 3 };

const words = (s) => String(s).trim().split(/\s+/).filter(Boolean);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function validate({ skeleton, plan, script, paper, topic, recipes, profile }) {
  const issues = [];
  const add = (rule, level, message, question_id) => issues.push({ rule, level, message, ...(question_id ? { question_id } : {}) });
  const block = (rule, message, qid) => add(rule, "block", message, qid);
  const warn = (rule, message, qid) => add(rule, "warn", message, qid);
  const total = profile.question_count.value;

  // ---- V1 結構與 ID 一致 ----
  let structOk = true;
  const need = (obj, keys, where) => {
    for (const k of keys) if (obj?.[k] === undefined) { block("V1", `${where} 缺少欄位 ${k}`); structOk = false; }
  };
  need(plan, ["set_id", "answers"], "plan");
  need(script, ["turns", "evidence"], "script");
  need(paper, ["title", "instruction", "rows"], "paper");
  need(skeleton, ["slots", "recipe", "topic", "variant"], "skeleton");
  if (!structOk) return finish(issues);
  for (const a of plan.answers) need(a, ["question_id", "field_id", "answer", "type", "trap", "answer_policy"], `plan 題目 ${a.question_id ?? "?"}`);
  for (const t of script.turns) need(t, ["id", "speaker", "text"], `script 輪次 ${t.id ?? "?"}`);
  for (const e of script.evidence) need(e, ["question_id", "turn", "quote"], `evidence ${e.question_id ?? "?"}`);
  if (!structOk) return finish(issues);

  const blanks = paper.rows.flatMap((r) => r.parts.filter((p) => p.blank).map((p) => ({ qid: p.blank, field_id: r.field_id })));
  const planIds = plan.answers.map((a) => a.question_id);
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  if (!sameSet(planIds, script.evidence.map((e) => e.question_id))) block("V1", "plan 與 evidence 的 question_id 不一致");
  if (!sameSet(planIds, blanks.map((b) => b.qid))) block("V1", "plan 與 paper 的 question_id 不一致");
  for (const b of blanks) {
    const a = plan.answers.find((x) => x.question_id === b.qid);
    if (a && a.field_id !== b.field_id) block("V1", `paper 的 ${b.qid} 欄位是 ${b.field_id}，plan 是 ${a.field_id}`, b.qid);
  }

  // ---- V2 剛好 10 題、題號 q01..q10 ----
  const expectedIds = Array.from({ length: total }, (_, i) => `q${String(i + 1).padStart(2, "0")}`);
  if (plan.answers.length !== total) block("V2", `題數是 ${plan.answers.length}，應該是 ${total}`);
  if (new Set(planIds).size !== planIds.length) block("V2", "question_id 有重複");
  else if (plan.answers.length === total && !sameSet(planIds, expectedIds)) block("V2", `question_id 必須是 ${expectedIds[0]} 到 ${expectedIds.at(-1)}`);

  const turnIdx = new Map(script.turns.map((t, i) => [t.id, i]));
  const slotOf = new Map(skeleton.slots.map((s) => [s.question_id, s]));
  const evidenceOf = new Map(script.evidence.map((e) => [e.question_id, e]));
  const rowOfField = new Map(paper.rows.filter((r) => r.field_id).map((r) => [r.field_id, r]));

  // ---- V3a / V3b 證據 ----
  const evidenceSpan = new Map(); // qid -> {turn, start, end}（quote 在輪次文字中的位置）
  for (const a of plan.answers) {
    const e = evidenceOf.get(a.question_id);
    if (!e) continue;
    const ti = turnIdx.get(e.turn);
    if (ti === undefined) { block("V3a", `evidence 指到不存在的輪次 ${e.turn}`, a.question_id); continue; }
    const text = script.turns[ti].text;
    const at = text.indexOf(e.quote);
    if (at < 0) { block("V3a", `quote 不是 ${e.turn} 的原文子字串`, a.question_id); continue; }
    evidenceSpan.set(a.question_id, { ti, start: at, end: at + e.quote.length });
    const left = Math.max(0, ...[...text.slice(0, at).matchAll(/[.!?]\s/g)].map((m) => m.index + 2));
    const rightM = text.slice(at + e.quote.length - 1).match(/[.!?](\s|$)/);
    const right = rightM ? at + e.quote.length - 1 + rightM.index + 1 : text.length;
    const sentence = text.slice(Math.min(left, at), Math.max(right, at + e.quote.length));
    if (!findInText(a.answer_policy, a, sentence)) block("V3b", `答案「${a.answer}」沒有出現在證據句：${sentence.trim()}`, a.question_id);
  }

  // ---- V4 順序 ----
  const ordered = [...plan.answers].sort((x, y) => x.question_id.localeCompare(y.question_id));
  for (let i = 1; i < ordered.length; i++) {
    const p = evidenceSpan.get(ordered[i - 1].question_id), q = evidenceSpan.get(ordered[i].question_id);
    if (p && q && (q.ti < p.ti || (q.ti === p.ti && q.start < p.start))) block("V4", `${ordered[i].question_id} 的證據排在 ${ordered[i - 1].question_id} 前面`, ordered[i].question_id);
  }

  // ---- V5 字數 ----
  const limitWord = /NO MORE THAN (ONE|TWO|THREE) WORD/i.exec(paper.instruction)?.[1]?.toUpperCase();
  const instructionLimit = limitWord ? INSTRUCTION_LIMITS[limitWord] : Infinity;
  for (const a of plan.answers) {
    const toks = words(a.answer);
    const numeric = toks.filter((t) => /^\d+$/.test(t)).length > 0;
    const wordCount = toks.filter((t) => !/^\d+$/.test(t)).length;
    const slot = slotOf.get(a.question_id);
    const fieldMax = slot?.max_words ?? Infinity;
    if (wordCount > instructionLimit) block("V5", `答案「${a.answer}」超過說明的字數上限`, a.question_id);
    if (wordCount + (numeric ? 1 : 0) > fieldMax) block("V5", `答案「${a.answer}」超過欄位上限 ${fieldMax}`, a.question_id);
  }

  // ---- V6 洩漏：只看學生看得到的文字 ----
  for (const a of plan.answers) {
    const row = rowOfField.get(a.field_id);
    const visible = [paper.title, paper.instruction, row?.label, ...(row?.parts ?? []).map((p) => p.text)].filter(Boolean).join(" | ");
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(normalize(a.answer))}(?![\\p{L}\\p{N}])`, "iu");
    if (re.test(visible)) block("V6", `答案「${a.answer}」出現在題目卷：${visible}`, a.question_id);
  }

  // ---- V7 / V8 / V9 陷阱 ----
  const windowText = (ti, before, after) => script.turns.slice(Math.max(0, ti - before), ti + after + 1).map((t) => t.text).join(" ");
  for (const a of plan.answers) {
    const span = evidenceSpan.get(a.question_id);
    if (!span) continue;
    const qid = a.question_id;
    if (a.trap === "self_correction") {
      if (!a.wrong_value) { block("V7", "self_correction 需要 wrong_value", qid); continue; }
      const correct = findInText(a.answer_policy, a, script.turns[span.ti].text.slice(span.start, span.end));
      const correctPos = correct ? span.start + correct.index : span.start;
      let found = false;
      for (let ti = Math.max(0, span.ti - 2); ti <= span.ti; ti++) {
        const hit = findInText(a.answer_policy, { answer: a.wrong_value, accepted: [] }, script.turns[ti].text);
        if (hit && (ti < span.ti || hit.index < correctPos)) found = true;
      }
      if (!found) block("V7", `錯誤值「${a.wrong_value}」沒有出現在正確答案之前（證據當輪或前兩輪）`, qid);
    } else if (a.trap === "distractor") {
      if (!a.wrong_value) { block("V7", "distractor 需要 wrong_value", qid); continue; }
      let found = false;
      for (let ti = Math.max(0, span.ti - 2); ti <= Math.min(script.turns.length - 1, span.ti + 2); ti++) {
        if (findInText(a.answer_policy, { answer: a.wrong_value, accepted: [] }, script.turns[ti].text)) found = true;
      }
      if (!found) block("V7", `干擾值「${a.wrong_value}」沒有出現在證據前後各兩輪內`, qid);
    } else if (a.trap === "spelling") {
      const win = windowText(span.ti, 1, 1);
      const target = normalize(a.answer).replace(/[^a-z ]/g, "");
      const ok = findSpelled(win).some((sp) => sp.letters === target.replace(/ /g, "") || target.split(" ").includes(sp.letters));
      if (!ok) block("V8", `找不到拼出「${a.answer}」的逐字母格式`, qid);
    } else if (a.trap === "similar_numbers") {
      const digits = a.answer.replace(/\D/g, "");
      const counter = new Set();
      for (let i = 0; i < digits.length - 1; i++) {
        const [x, y] = [digits[i], digits[i + 1]];
        if (x === "1" && "3456789".includes(y)) counter.add(`${y}0`);
        if (y === "0" && "3456789".includes(x)) counter.add(`1${x}`);
      }
      if (!counter.size) { block("V9", `答案「${a.answer}」裡沒有可混淆的數字（如 13 與 30）`, qid); continue; }
      const win = windowText(span.ti, 2, 2);
      const runs = [...win.matchAll(/\d(?:[\d\s-]*\d)?/g)].map((m) => m[0].replace(/[\s-]/g, ""));
      for (const [w, n] of Object.entries(NUM_WORD_PAIRS)) if (new RegExp(`\\b${w}\\b`, "i").test(win)) runs.push(n);
      const ok = [...counter].some((c) => runs.some((r) => r.includes(c)));
      if (!ok) block("V9", `前後各兩輪內沒有出現容易混淆的對應數字（${[...counter].join("、")}）`, qid);
    }
  }

  // ---- V10 同一題語境的碰撞 ----
  for (let i = 0; i < plan.answers.length; i++) {
    for (let j = i + 1; j < plan.answers.length; j++) {
      const a = plan.answers[i], b = plan.answers[j];
      if (a.type !== b.type) continue;
      const norm = (x) => normalize(x).replace(/-/g, " ");
      const setA = [a.answer, ...(a.accepted ?? [])].map(norm), setB = [b.answer, ...(b.accepted ?? [])].map(norm);
      if (setA.some((x) => setB.includes(x))) block("V10", `${a.question_id} 與 ${b.question_id} 同類型且答案相同，容易混淆`, b.question_id);
    }
  }

  // ---- V11 長度、間距、暖身 ----
  const [lo, hi] = profile.target_words.value;
  const tol = profile.length_tolerance.value;
  const totalWords = script.turns.reduce((n, t) => n + words(t.text).length, 0);
  if (totalWords < lo * (1 - tol) || totalWords > hi * (1 + tol)) warn("V11", `全文 ${totalWords} 字，目標 ${lo} 到 ${hi}（±${tol * 100}%）`);
  const wordsBefore = (ti, ch) => script.turns.slice(0, ti).reduce((n, t) => n + words(t.text).length, 0) + words(script.turns[ti].text.slice(0, ch)).length;
  const pos = ordered.map((a) => evidenceSpan.get(a.question_id)).map((s) => s && ({ start: wordsBefore(s.ti, s.start), end: wordsBefore(s.ti, s.end) }));
  for (let i = 1; i < pos.length; i++) {
    if (pos[i - 1] && pos[i] && pos[i].start - pos[i - 1].end < profile.min_gap_words.value) {
      block("V11", `${ordered[i - 1].question_id} 與 ${ordered[i].question_id} 只隔 ${pos[i].start - pos[i - 1].end} 個字，至少要 ${profile.min_gap_words.value}`, ordered[i].question_id);
    }
  }
  const first = evidenceSpan.get(ordered[0]?.question_id);
  if (first && first.ti < profile.min_warmup_turns.value) block("V11", `第 1 題前只有 ${first.ti} 輪暖身，至少要 ${profile.min_warmup_turns.value}`);

  // ---- V12 虛構資料 ----
  const fiction = profile.fiction;
  const everything = [...script.turns.map((t) => t.text), ...plan.answers.map((a) => a.answer)].join("\n");
  for (const m of everything.matchAll(/(?:\+44|0)\d[\d\s-]{8,}\d/g)) {
    const d = m[0].replace(/[\s+-]/g, "");
    if (!d.startsWith(fiction.phone_prefix)) block("V12", `電話號碼不是虛構號段：${m[0]}`);
  }
  for (const m of everything.matchAll(/[\w.+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) {
    if (m[1].toLowerCase() !== fiction.email_domain) block("V12", `email 不是 ${fiction.email_domain}：${m[0]}`);
  }
  for (const name of fiction.name_blacklist) if (everything.toLowerCase().includes(name.toLowerCase())) block("V12", `使用了黑名單人名：${name}`);

  // ---- V13 骨架與 plan、配方、主題一致 ----
  const recipe = recipes.find((r) => r.id === skeleton.recipe);
  if (!recipe) block("V13", `找不到配方 ${skeleton.recipe}`);
  if (skeleton.slots.length !== total) block("V13", `骨架題數 ${skeleton.slots.length}，應該是 ${total}`);
  const counts = {};
  for (const s of skeleton.slots) counts[s.trap] = (counts[s.trap] ?? 0) + 1;
  if (recipe) for (const t of TRAPS) if ((counts[t] ?? 0) !== (recipe.traps[t] ?? 0)) block("V13", `陷阱 ${t} 有 ${counts[t] ?? 0} 題，配方 ${recipe.id} 要 ${recipe.traps[t] ?? 0}`);
  const rowIndex = new Map(topic.form.rows.map((r, i) => [r.field_id, i]));
  skeleton.slots.forEach((s, i) => {
    const f = topic.fields_pool.find((x) => x.field_id === s.field_id);
    if (!f) { block("V13", `骨架的欄位 ${s.field_id} 不在主題欄位池`, s.question_id); return; }
    if (!f.allowed_traps.includes(s.trap)) block("V13", `欄位 ${s.field_id} 不允許陷阱 ${s.trap}`, s.question_id);
    if (f.only_variants && !f.only_variants.includes(skeleton.variant)) block("V13", `欄位 ${s.field_id} 不屬於情境 ${skeleton.variant}`, s.question_id);
    for (const k of ["type", "answer_policy", "max_words"]) if (s[k] !== f[k]) block("V13", `骨架 ${s.question_id} 的 ${k} 與主題欄位不一致`, s.question_id);
    if (i > 0 && rowIndex.get(s.field_id) < rowIndex.get(skeleton.slots[i - 1].field_id)) block("V13", `骨架題號順序與表格列順序不一致（${s.question_id}）`, s.question_id);
  });
  const chosen = new Set(skeleton.slots.map((s) => s.field_id));
  for (const g of new Set(topic.fields_pool.filter((f) => f.group && (!f.only_variants || f.only_variants.includes(skeleton.variant))).map((f) => f.group))) {
    const members = topic.fields_pool.filter((f) => f.group === g && (!f.only_variants || f.only_variants.includes(skeleton.variant)));
    const n = members.filter((f) => chosen.has(f.field_id)).length;
    if (n !== 0 && n !== members.length) block("V13", `成組欄位 ${g} 被拆開`);
  }
  for (const a of plan.answers) {
    const s = slotOf.get(a.question_id);
    if (!s) { block("V13", `plan 的 ${a.question_id} 不在骨架裡`, a.question_id); continue; }
    for (const k of ["field_id", "type", "trap", "answer_policy"]) if (a[k] !== s[k]) block("V13", `${a.question_id} 的 ${k} 與骨架不一致（plan: ${a[k]}，骨架: ${s[k]}）`, a.question_id);
  }

  return finish(issues);
}

function finish(issues) {
  return { ok: !issues.some((i) => i.level === "block"), issues };
}
