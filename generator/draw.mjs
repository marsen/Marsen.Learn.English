import { createRng } from "./lib/prng.mjs";
import { makeArtifactInfo } from "./artifact.mjs";
import { fieldOrder } from "./lib/template.mjs";

export const NAME_TYPES = new Set(["name_spelled", "place"]);

export class DrawError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const unitsOf = (fields) => {
  const byGroup = new Map();
  const units = [];
  for (const f of fields) {
    if (!f.group) { units.push([f]); continue; }
    if (!byGroup.has(f.group)) { const u = []; byGroup.set(f.group, u); units.push(u); }
    byGroup.get(f.group).push(f);
  }
  return units;
};

// 把配方的陷阱配到欄位上。每個欄位恰好一個陷阱，每個陷阱的數量符合配方。
function assignTraps(fields, counts, rng) {
  const remaining = { ...counts };
  const order = [...fields].sort((a, b) => a.allowed_traps.length - b.allowed_traps.length || a.field_id.localeCompare(b.field_id));
  const result = new Map();
  const go = (i) => {
    if (i === order.length) return Object.values(remaining).every((n) => n === 0);
    const f = order[i];
    for (const trap of rng.shuffle(f.allowed_traps)) {
      if (!remaining[trap]) continue;
      remaining[trap]--; result.set(f.field_id, trap);
      if (go(i + 1)) return true;
      remaining[trap]++; result.delete(f.field_id);
    }
    return false;
  };
  return go(0) ? result : null;
}

export function drawFromTopic({ seed, topic, recipes, profile, variantId, previousRecipe = null }) {
  const rng = createRng(seed);
  const total = profile.question_count.value;
  const maxAttempts = profile.max_draw_attempts.value;
  const variant = variantId ? topic.variants.find((v) => v.id === variantId) : rng.pick(topic.variants);
  if (!variant) throw new DrawError("UNKNOWN_VARIANT", `沒有這個情境變體：${variantId}`);

  const pool = topic.fields_pool.filter((f) => !f.only_variants || f.only_variants.includes(variant.id));
  const units = unitsOf(pool);
  const rowIndex = fieldOrder(topic);
  const candidates = rng.shuffle(recipes.filter((r) => r.id !== previousRecipe));
  const reasons = [];

  for (const recipe of candidates) {
    const sum = Object.values(recipe.traps).reduce((a, b) => a + b, 0);
    if (sum !== total) { reasons.push(`${recipe.id}: 陷阱數量加起來是 ${sum}，不是 ${total}`); continue; }
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const chosen = [];
      for (const unit of rng.shuffle(units)) {
        if (chosen.length + unit.length <= total) chosen.push(...unit);
        if (chosen.length === total) break;
      }
      if (chosen.length !== total) continue;
      const maxNames = profile.max_name_questions?.value ?? total;
      if (chosen.filter((f) => NAME_TYPES.has(f.type)).length > maxNames) continue;
      const traps = assignTraps(chosen, recipe.traps, rng);
      if (!traps) continue;
      const ordered = [...chosen].sort((a, b) => rowIndex.get(a.field_id) - rowIndex.get(b.field_id));
      const slots = ordered.map((f, i) => ({
        question_id: `q${String(i + 1).padStart(2, "0")}`,
        field_id: f.field_id,
        type: f.type,
        trap: traps.get(f.field_id),
        answer_policy: f.answer_policy,
        max_words: f.max_words,
        ...(f.group ? { group: f.group } : {}),
      }));
      return {
        seed, topic: topic.id, variant: variant.id, recipe: recipe.id, slots,
        artifact: makeArtifactInfo({ topic, recipes, profile }),
      };
    }
    reasons.push(`${recipe.id}: 試了 ${maxAttempts} 次，欄位池配不出這個配方`);
  }
  throw new DrawError("NO_ELIGIBLE_CANDIDATE", `排不出骨架。${reasons.join("；")}`);
}

// 從主題池抽一個主題（排除冷卻中的），再排骨架。
export function draw({ seed, topics, recipes, profile, history = [], now = new Date(), previousRecipe = null, variantId }) {
  const rng = createRng(seed);
  const cooldownMs = profile.topic_cooldown_days.value * 86400000;
  const cooling = new Set(history.filter((h) => now - new Date(h.drawn_at) < cooldownMs).map((h) => h.topic));
  const open = topics.filter((t) => !cooling.has(t.id));
  if (!open.length) throw new DrawError("NO_ELIGIBLE_TOPIC", "所有主題都在冷卻期內");
  const topic = rng.pick(open);
  const skeleton = drawFromTopic({ seed: rng.int(2 ** 31), topic, recipes, profile, variantId, previousRecipe });
  return { ...skeleton, seed };
}
