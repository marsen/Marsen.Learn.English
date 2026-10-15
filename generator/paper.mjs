// 題目卷：機械轉換，不用 AI。沒被抽到的欄位整列拿掉。
export function buildPaper({ topic, plan, skeleton }) {
  // 骨架階段還沒有答案，題目卷的空格只需要題號與欄位，所以 plan 或 skeleton 都能用。
  const items = plan ? plan.answers : skeleton.slots;
  const qidByField = new Map(items.map((a) => [a.field_id, a.question_id]));
  const rows = [];
  for (const row of topic.form.rows) {
    if (row.printed !== undefined) rows.push({ label: row.label, parts: [{ text: row.printed }] });
    else if (qidByField.has(row.field_id)) rows.push({ label: row.label, field_id: row.field_id, parts: [{ blank: qidByField.get(row.field_id) }] });
  }
  return { set_id: plan?.set_id ?? skeleton.set_id ?? null, type: "form_table", title: topic.form.title, instruction: topic.form.instruction, rows };
}
