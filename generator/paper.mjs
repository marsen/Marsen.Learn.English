// 題目卷：機械轉換，不用 AI。沒被抽到的欄位整列拿掉。
// 每列可帶 section（分段標題）；有 template 的列是行內句子（inline: true），句子裡印出的事實原樣保留。
// 整份的 section_styles 指定每段是 list（每列一行，前面有圓點）還是 paragraph（連成一小段文字）。
import { fieldsOf, splitTemplate } from "./lib/template.mjs";

export function buildPaper({ topic, plan, skeleton }) {
  // 骨架階段還沒有答案，題目卷的空格只需要題號與欄位，所以 plan 或 skeleton 都能用。
  const items = plan ? plan.answers : skeleton.slots;
  const qidByField = new Map(items.map((a) => [a.field_id, a.question_id]));
  const rows = [];
  for (const row of topic.form.rows) {
    let out;
    if (row.printed !== undefined) out = { label: row.label, parts: [{ text: row.printed }], ...(row.says ? { says: row.says } : {}) };
    else if (qidByField.has(row.field_id)) {
      const missing = fieldsOf(row).filter((f) => !qidByField.has(f));
      if (missing.length) throw new Error(`句型列 ${row.label} 需要的欄位沒被抽到：${missing.join("、")}（它們必須放在同一個 group）`);
      const parts = row.template
        ? splitTemplate(row).map((p) => (p.text !== undefined ? p : { blank: qidByField.get(p.field), field_id: p.field }))
        : [{ blank: qidByField.get(row.field_id), field_id: row.field_id }];
      out = { label: row.label, field_id: row.field_id, parts };
      if (row.template) out.inline = true;
      if (row.says) out.says = row.says;
    } else continue;
    if (row.section) out.section = row.section;
    rows.push(out);
  }
  const paper = { set_id: plan?.set_id ?? skeleton.set_id ?? null, type: "form_table", title: topic.form.title, instruction: topic.form.instruction, rows };
  if (topic.form.section_styles) paper.section_styles = topic.form.section_styles;
  return paper;
}
