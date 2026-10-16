// 題目卷：機械轉換，不用 AI。沒被抽到的欄位整列拿掉。
// 每列可帶 section（分段標題）；有 template 的列會拆成「前文 空格 後文」行內顯示（inline: true）。
const blankParts = (row, qid) => {
  if (!row.template) return [{ blank: qid }];
  const [before, after] = row.template.split("{}");
  return [before.trim() && { text: before.trim() }, { blank: qid }, after.trim() && { text: after.trim() }].filter(Boolean);
};

export function buildPaper({ topic, plan, skeleton }) {
  // 骨架階段還沒有答案，題目卷的空格只需要題號與欄位，所以 plan 或 skeleton 都能用。
  const items = plan ? plan.answers : skeleton.slots;
  const qidByField = new Map(items.map((a) => [a.field_id, a.question_id]));
  const rows = [];
  for (const row of topic.form.rows) {
    let out;
    if (row.printed !== undefined) out = { label: row.label, parts: [{ text: row.printed }] };
    else if (qidByField.has(row.field_id)) {
      out = { label: row.label, field_id: row.field_id, parts: blankParts(row, qidByField.get(row.field_id)) };
      if (row.template) out.inline = true;
    } else continue;
    if (row.section) out.section = row.section;
    rows.push(out);
  }
  return { set_id: plan?.set_id ?? skeleton.set_id ?? null, type: "form_table", title: topic.form.title, instruction: topic.form.instruction, rows };
}
