// 題組檢視頁的純邏輯：把 Question.Generator 打包出的 set.json 整理成畫面要用的資料。不碰 DOM，方便單元測試。
// set.json 內含標準答案，所以這一頁只在本機開、檔案只在瀏覽器裡讀，不上傳、不部署（scripts/build-public.mjs 不會複製 review/）。

export const SUPPORTED_SCHEMA = 1;

export const TRAP_LABEL = { self_correction: "自我更正", similar_numbers: "相近數字", distractor: "干擾項", paraphrase: "換句話說", spelling: "拼字", none: "無陷阱" };
export const POLICY_LABEL = { digits_only: "只比數字", exact_word: "同一個字（不分大小寫）", number_word: "數字或英文數字（6＝six）" };
export const TYPE_LABEL = { number: "數字", word: "單字", place: "地點", phone: "電話", name_spelled: "拼出的名字" };
export const EVENT_LABEL = { announce: "旁白", turn: "對話", pause: "作答停頓" };
export const VERDICT = {
  pass: { label: "通過", tone: "ok", hint: "驗證、盲答、AI 審稿都沒有疑慮。" },
  needs_human: { label: "有疑慮", tone: "warn", hint: "AI 審稿有疑慮或示警未全部排除；是否採用由你決定。" },
  none: { label: "沒有審稿", tone: "none", hint: "這份打包檔沒有 AI 審稿紀錄。" },
};

export const qNumber = (id) => Number(String(id).replace(/\D/g, "")) || 0;

export function parseBundle(text) {
  let b;
  try { b = JSON.parse(text); } catch { throw new Error("這不是 JSON 檔"); }
  if (!b || typeof b !== "object" || !b.paper || !b.answers || !b.timing) throw new Error("不像 set.json：缺少 paper／answers／timing");
  if (b.schema_version !== SUPPORTED_SCHEMA) throw new Error(`不支援的 schema_version：${b.schema_version}（這一頁看得懂 ${SUPPORTED_SCHEMA}）`);
  return b;
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// 整理出畫面需要的所有資料。
export function buildModel(b) {
  const prov = b.provenance ?? {};
  const ai = prov.ai_review ?? null;
  const warnings = (prov.warnings ?? []).map((w) => ({ ...w, number: w.question_id ? qNumber(w.question_id) : null, ruling: w.ai_ruling ?? null }));
  const verdictKey = ai?.verdict === "pass" || ai?.verdict === "needs_human" ? ai.verdict : "none";

  // 題號 → 所在的列（標籤、分區）
  const rowOf = new Map();
  for (const row of b.paper.rows) for (const p of row.parts) if (p.blank) rowOf.set(p.blank, row);

  const questions = (b.answers.answers ?? []).map((a) => {
    const row = rowOf.get(a.question_id);
    return {
      id: a.question_id, number: qNumber(a.question_id), label: row?.label ?? a.field_id, section: row?.section ?? null,
      answer: a.answer, accepted: a.accepted ?? [], type: a.type, typeLabel: TYPE_LABEL[a.type] ?? a.type,
      trap: a.trap, trapLabel: TRAP_LABEL[a.trap] ?? a.trap, policy: a.answer_policy, policyLabel: POLICY_LABEL[a.answer_policy] ?? a.answer_policy,
      wrong: a.wrong_value ?? null, note: a.note ?? "",
      warnings: warnings.filter((w) => w.question_id === a.question_id),
    };
  });

  const total = b.timing.total_seconds || b.audio?.seconds || 1;
  const segments = b.timing.events.map((e) => ({
    ...e, label: EVENT_LABEL[e.type] ?? e.type, left: (e.start / total) * 100, width: Math.max(((e.end - e.start) / total) * 100, 0.15),
    questionsText: e.questions ? (e.questions[0] === e.questions[1] ? `第 ${e.questions[0]} 題` : `第 ${e.questions[0]}–${e.questions[1]} 題`) : null,
  }));

  const steps = ["plan", "script", "blind", "validate", "ai_review"].filter((k) => prov[k]).map((k) => ({ key: k, ...prov[k] }));
  const problems = warnings.filter((w) => w.ruling === "problem").length;
  const unresolved = warnings.filter((w) => !w.ruling).length;

  return {
    id: b.set_id, title: b.title, topic: b.topic, count: b.question_count ?? questions.length, seconds: b.audio?.seconds ?? total,
    verdict: { key: verdictKey, ...VERDICT[verdictKey] }, ai, legacyReview: prov.review ?? null, generator: prov.generator_version ?? null,
    warnings, problems, unresolved, okCount: warnings.length - problems - unresolved,
    questions, segments, total, steps, paper: b.paper, audio: b.audio ?? null,
    scenario: b.answers.scenario ?? null, variant: b.answers.variant ?? null, recipe: b.answers.recipe ?? null, seed: b.answers.seed ?? null,
    pauses: segments.filter((s) => s.type === "pause"),
  };
}

export async function sha256Hex(buffer, subtle = globalThis.crypto?.subtle) {
  if (!subtle) return null;
  const d = new Uint8Array(await subtle.digest("SHA-256", buffer));
  return [...d].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// 錄音檔和 set.json 記載的是否一致。
export async function checkAudio(audio, buffer, subtle) {
  if (!audio) return { ok: false, reason: "set.json 沒有錄音資訊" };
  if (buffer.byteLength !== audio.bytes) return { ok: false, reason: `大小不同（檔案 ${buffer.byteLength}，記載 ${audio.bytes}）` };
  const sha = await sha256Hex(buffer, subtle);
  if (sha === null) return { ok: null, reason: "這個瀏覽器環境無法計算雜湊（需要 localhost 或 https）" };
  return sha === audio.sha256 ? { ok: true, reason: "大小與 sha256 都對得上" } : { ok: false, reason: "sha256 不同，錄音可能被換過" };
}

// 把一批檔案分成「一套題一組」：同一個資料夾裡的 set.json 和 audio.mp3 是一組（每套的檔名都一樣，只能靠資料夾分）。
// items：[{ file, path }]，path 是相對路徑（拖資料夾或選資料夾時有；單獨選檔就只有檔名）。
export function groupFiles(items) {
  const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
  const nameOf = (p) => p.slice(p.lastIndexOf("/") + 1);
  const all = items.filter((i) => i.file && i.path);
  const jsons = all.filter((i) => /\.json$/i.test(i.path));
  const sets = jsons.filter((i) => nameOf(i.path).toLowerCase() === "set.json");
  const picked = sets.length ? sets : jsons;                       // 資料夾裡只認 set.json；單獨選檔才收任意 .json
  const mp3s = all.filter((i) => /\.mp3$/i.test(i.path));
  const loose = picked.length === 1 && picked[0].path.indexOf("/") < 0;
  return picked.map((j) => {
    const dir = dirOf(j.path);
    const audio = loose ? mp3s.length === 1 ? mp3s[0] : null : mp3s.find((m) => dirOf(m.path) === dir) ?? null;
    return { name: dir ? nameOf(dir) : nameOf(j.path), json: j.file, audio: audio?.file ?? null };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// 拖放：資料夾要用 webkitGetAsEntry 一層一層讀（dataTransfer.files 只會給資料夾本身）。
export async function collectDropped(dataTransfer) {
  const out = [];
  const entries = [...(dataTransfer.items ?? [])].map((it) => it.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [...(dataTransfer.files ?? [])].map((file) => ({ file, path: file.name }));
  const readAll = (reader) => new Promise((ok, fail) => { const acc = []; const next = () => reader.readEntries((b) => (b.length ? (acc.push(...b), next()) : ok(acc)), fail); next(); });
  const walk = async (entry, prefix) => {
    if (entry.isFile) { const file = await new Promise((ok, fail) => entry.file(ok, fail)); out.push({ file, path: `${prefix}${entry.name}` }); return; }
    for (const child of await readAll(entry.createReader())) await walk(child, `${prefix}${entry.name}/`);
  };
  for (const e of entries) await walk(e, "");
  return out;
}
