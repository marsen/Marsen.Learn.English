// AI 只填「值」。欄位、陷阱、比對規則一律由骨架決定，這裡把兩邊合起來。
export class AssembleError extends Error {}

export function assemblePlan({ skeleton, values, setId }) {
  const given = new Map();
  for (const v of values.values ?? []) {
    if (given.has(v.question_id)) throw new AssembleError(`values 裡 ${v.question_id} 重複`);
    given.set(v.question_id, v);
  }
  const known = new Set(skeleton.slots.map((s) => s.question_id));
  for (const id of given.keys()) if (!known.has(id)) throw new AssembleError(`values 有骨架沒有的題號：${id}`);
  const answers = skeleton.slots.map((s) => {
    const v = given.get(s.question_id);
    if (!v) throw new AssembleError(`values 缺少 ${s.question_id}`);
    if (typeof v.answer !== "string" || !v.answer.trim()) throw new AssembleError(`${s.question_id} 沒有 answer`);
    return {
      question_id: s.question_id, field_id: s.field_id, answer: v.answer.trim(), accepted: v.accepted ?? [],
      type: s.type, trap: s.trap, answer_policy: s.answer_policy,
      ...(v.wrong_value ? { wrong_value: v.wrong_value } : {}),
      ...(v.note ? { note: v.note } : {}),
    };
  });
  return {
    set_id: setId, topic: skeleton.topic, variant: skeleton.variant, recipe: skeleton.recipe, seed: skeleton.seed,
    scenario: values.scenario ?? {}, answers,
  };
}

export function assembleScript({ script, setId }) {
  if (!Array.isArray(script.turns) || !Array.isArray(script.evidence)) throw new AssembleError("script 需要 turns 與 evidence 兩個陣列");
  return { set_id: setId, turns: script.turns, evidence: script.evidence };
}
