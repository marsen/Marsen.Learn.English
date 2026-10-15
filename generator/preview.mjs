// 給人看的預覽：題目卷、答案與陷阱、逐字稿（證據句標色）。純函式，回傳 HTML 字串。
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const TRAP_LABEL = { self_correction: "先講錯再更正", spelling: "拼字", similar_numbers: "相近數字", paraphrase: "同義改寫", distractor: "干擾選項", none: "無陷阱" };

export function renderPreview({ paper, skeleton, plan, script }) {
  const slotOf = new Map(skeleton.slots.map((s) => [s.question_id, s]));
  const ansOf = new Map((plan?.answers ?? []).map((a) => [a.question_id, a]));
  const rows = paper.rows.map((r) => {
    const cell = r.parts.map((p) => {
      if (!p.blank) return esc(p.text);
      const a = ansOf.get(p.blank);
      return `<span class="blank">${esc(p.blank.replace("q0", "").replace("q", ""))} ${a ? `<b class="ans">${esc(a.answer)}</b>` : "__________"}</span>`;
    }).join(" ");
    return `<tr><th>${esc(r.label)}</th><td>${cell}</td></tr>`;
  }).join("");

  const qtable = skeleton.slots.map((s) => {
    const a = ansOf.get(s.question_id);
    return `<tr><td>${esc(s.question_id)}</td><td>${esc(s.field_id)}</td><td>${esc(s.type)}</td><td class="trap t-${s.trap}">${esc(TRAP_LABEL[s.trap])}</td><td>${esc(s.answer_policy)}</td><td>${a ? esc(a.answer) + (a.wrong_value ? ` <i>（錯誤值：${esc(a.wrong_value)}）</i>` : "") : ""}</td></tr>`;
  }).join("");

  let transcript = "";
  if (script) {
    const evOf = new Map();
    for (const e of script.evidence) { if (!evOf.has(e.turn)) evOf.set(e.turn, []); evOf.get(e.turn).push(e); }
    transcript = script.turns.map((t) => {
      let html = esc(t.text);
      for (const e of evOf.get(t.id) ?? []) {
        const trap = slotOf.get(e.question_id)?.trap ?? "none";
        html = html.replace(esc(e.quote), `<mark class="t-${trap}" title="${esc(e.question_id)} ${esc(TRAP_LABEL[trap])}"><sup>${esc(e.question_id)}</sup>${esc(e.quote)}</mark>`);
      }
      return `<p><span class="spk">${esc(t.speaker)}</span> ${html}</p>`;
    }).join("");
    transcript = `<h2>逐字稿（${script.turns.reduce((n, t) => n + t.text.split(/\s+/).length, 0)} 字）</h2><div class="script">${transcript}</div>`;
  }

  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>題目預覽 ${esc(skeleton.topic)}</title>
<style>
body{font:16px/1.6 system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#2b1d26}
h1{font-size:1.4rem}h2{font-size:1.1rem;margin-top:2rem;color:#8f3354}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #e0d4da;padding:.4rem .6rem;text-align:left;vertical-align:top}th{background:#f7f2f4;width:34%}
.meta{color:#6e5c66}td.trap{white-space:nowrap}.blank{font-weight:600}.ans{color:#b4476a}
.script p{margin:.4rem 0}.spk{display:inline-block;width:1.6rem;font-weight:700;color:#b4476a}
mark{padding:0 .2rem;border-radius:3px}sup{font-size:.65em;margin-right:.2rem;font-weight:700}
.t-self_correction{background:#ffe0b2}.t-spelling{background:#c8e6c9}.t-similar_numbers{background:#bbdefb}.t-paraphrase{background:#e1bee7}.t-distractor{background:#ffcdd2}.t-none{background:#eee}
</style></head><body>
<h1>${esc(paper.title)}</h1>
<p class="meta">主題 ${esc(skeleton.topic)} ・情境 ${esc(skeleton.variant)} ・配方 ${esc(skeleton.recipe)} ・種子 ${esc(skeleton.seed)}</p>
<p><i>${esc(paper.instruction)}</i></p>
<h2>題目卷（學生看到的）</h2><table>${rows}</table>
<h2>10 題骨架</h2><table><tr><th>題號</th><th>欄位</th><th>類型</th><th>陷阱</th><th>比對規則</th><th>答案</th></tr>${qtable}</table>
${transcript}
</body></html>`;
}
