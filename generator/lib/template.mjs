// 答題卷「行」的共用小工具。一列（form.rows[] 的一項）可以是：
//   - 固定列：{ label, printed }
//   - 一般空格列：{ label, field_id }  → 顯示「label: ____」
//   - 句型列：{ label, field_id, also?, template, says? }
//       template 是一句完整的話，{} 代表 field_id 的空格，{別的欄位} 代表 also 裡的空格；
//       句子裡其他的字是「印出的事實」，逐字稿必須講到 says 列的關鍵字。
export const fieldsOf = (row) => (row.field_id ? [row.field_id, ...(row.also ?? [])] : []);

// 欄位在表格中的先後：列的順序，同一列內照 field_id、also 的順序。
export function fieldOrder(topic) {
  const order = new Map();
  topic.form.rows.forEach((row, i) => fieldsOf(row).forEach((f, k) => order.set(f, i * 10 + k)));
  return order;
}

// 把句型拆成片段：{ text } 或 { field }（field 是欄位 id）。
export function splitTemplate(row) {
  const out = [];
  let last = 0;
  for (const m of row.template.matchAll(/\{([a-z_]*)\}/g)) {
    const before = row.template.slice(last, m.index);
    if (before.trim()) out.push({ text: before.trim() });
    out.push({ field: m[1] || row.field_id });
    last = m.index + m[0].length;
  }
  const rest = row.template.slice(last);
  if (rest.trim()) out.push({ text: rest.trim() });
  return out;
}

// 給 AI 看的版本：句型裡的空格換成 ____ 或指定文字。
export const showTemplate = (row, mark = () => "____") =>
  splitTemplate(row).map((p) => (p.text !== undefined ? p.text : mark(p.field))).join(" ");
