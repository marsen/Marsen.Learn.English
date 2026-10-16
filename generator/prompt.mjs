import { readFileSync } from "node:fs";
import { fieldsOf, showTemplate } from "./lib/template.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const template = (name) => readFileSync(join(here, "prompts", `${name}.md`), "utf8");
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
  if (!(k in vars)) throw new Error(`prompt 範本有未填的變數：${k}`);
  return vars[k];
});

// 每種陷阱在「填值」階段的要求
const PLAN_TRAP = {
  spelling: "SPELLING: a name that will be spelled out letter by letter. Choose a plausible, uncommon-but-real-sounding word of 5 to 10 letters, with a letter pattern that is easy to mishear (double letters, silent letters). Not a famous name.",
  similar_numbers: "SIMILAR NUMBERS: the answer must contain a confusable chunk: a teen next to its 'ty' twin, i.e. 13 vs 30, 14 vs 40 ... 19 vs 90 (for example 15, or 3417 which contains 17/70). Pick a value that contains such a chunk.",
  self_correction: "SELF-CORRECTION: also give `wrong_value`, the first (wrong) value the speaker will say before correcting to the answer. Same type and format as the answer, but different.",
  distractor: "DISTRACTOR: also give `wrong_value`, another plausible value of the same kind that will be mentioned near the answer but is NOT the answer.",
  paraphrase: "PARAPHRASE: nothing extra to give here; in the talk this will be said in different words from the form label.",
  none: "PLAIN: a clear, plausible value; no extra requirement.",
};
// 每種陷阱在「寫逐字稿」階段的要求（已在 script.md 完整說明，這裡只放簡短提醒）
const SCRIPT_TRAP = {
  spelling: "spell it letter by letter, e.g. H-A-R-L-O-W",
  similar_numbers: "mention the confusable twin number within two turns",
  self_correction: "say the wrong_value first, then correct to the answer",
  distractor: "mention the wrong_value nearby, clearly rejected",
  paraphrase: "do not use the form label's words",
  none: "state it directly once",
};

// 學生在答題卷上看到的那一行字：句型列顯示整句（這題的空格是 ____，同句的別題空格是 (another blank)），一般列顯示標籤。
const rowOfField = (topic, fieldId) => topic.form.rows.find((r) => fieldsOf(r).includes(fieldId));
const labelOf = (topic, fieldId) => {
  const r = rowOfField(topic, fieldId);
  if (!r) return fieldId;
  return r.template ? showTemplate(r, (f) => (f === fieldId ? "____" : "(another blank)")) : r.label;
};
const speakersText = (topic) => topic.speakers.map((s) => `  - ${s.id}: ${s.role}`).join("\n");
const printedText = (topic) => topic.form.rows.filter((r) => r.printed !== undefined).map((r) => `  - ${r.label}: ${r.printed}`).join("\n") || "  (none)";

export function buildPlanPrompt({ topic, skeleton, profile }) {
  const variant = topic.variants.find((v) => v.id === skeleton.variant);
  const slots = [
    "| question_id | form label | type | answer_policy | max words | trap requirement |",
    "|---|---|---|---|---|---|",
    ...skeleton.slots.map((s) => `| ${s.question_id} | ${labelOf(topic, s.field_id)}${s.group ? ` (group: ${s.group})` : ""} | ${s.type} | ${s.answer_policy} | ${s.max_words} | ${PLAN_TRAP[s.trap]} |`),
  ].join("\n");
  return fill(template("plan"), {
    TOPIC_TITLE: `${topic.title} (${topic.id})`,
    VARIANT_SETTING: variant.setting,
    SPEAKERS: speakersText(topic),
    FORM_TITLE: topic.form.title,
    FORM_INSTRUCTION: topic.form.instruction,
    PRINTED_ROWS: printedText(topic),
    SLOTS: slots,
    PHONE_PREFIX: profile.fiction.phone_prefix.replace(/^(\d{5})(\d{3})$/, "$1 $2"),
    EMAIL_DOMAIN: profile.fiction.email_domain,
    BLACKLIST: profile.fiction.name_blacklist.join(", "),
  });
}

export function buildScriptPrompt({ topic, plan, profile }) {
  const variant = topic.variants.find((v) => v.id === plan.variant);
  const [lo, hi] = profile.target_words.value;
  const answers = [
    "| question_id | form label | answer | accepted | wrong_value | trap | what to do |",
    "|---|---|---|---|---|---|---|",
    ...plan.answers.map((a) => `| ${a.question_id} | ${labelOf(topic, a.field_id)} | ${a.answer} | ${(a.accepted ?? []).join(" / ") || "-"} | ${a.wrong_value ?? "-"} | ${a.trap} | ${SCRIPT_TRAP[a.trap]} |`),
  ].join("\n");
  const qidOf = (f) => plan.answers.find((a) => a.field_id === f)?.question_id;
  const rows = topic.form.rows
    .filter((r) => r.printed !== undefined || plan.answers.some((a) => a.field_id === r.field_id))
    .map((r) => {
      if (r.printed !== undefined) return `  - ${r.label}: ${r.printed}`;
      const section = r.section ? `[${r.section}] ` : "";
      if (!r.template) return `  - ${section}${r.label}: (question ${qidOf(r.field_id)})`;
      const must = r.says?.length ? `   <- the conversation MUST say: ${r.says.join(", ")}` : "";
      return `  - ${section}${showTemplate(r, (f) => `(question ${qidOf(f)})`)}${must}`;
    }).join("\n");
  return fill(template("script"), {
    TOPIC_TITLE: `${topic.title} (${topic.id})`,
    VARIANT_SETTING: variant.setting,
    SETTING: plan.scenario?.setting ?? "",
    ACCENT: plan.scenario?.accent ?? "en-GB",
    SPEAKERS: speakersText(topic),
    FORM_TITLE: topic.form.title,
    FORM_ROWS: rows,
    ANSWERS: answers,
    TARGET_WORDS: `${lo} to ${hi}`,
    WARMUP: String(profile.min_warmup_turns.value),
    MIN_GAP: String(profile.min_gap_words.value),
  });
}

// 盲答只拿到題目卷與逐字稿的 turns，不給 evidence、不給答案。
export function buildBlindPrompt({ paper, script }) {
  const form = [
    `Title: ${paper.title}`, `Instruction: ${paper.instruction}`,
    ...paper.rows.map((r) => { const line = r.parts.map((p) => (p.blank ? `[${p.blank}] ______` : p.text)).join(" "); return `- ${r.inline ? line : `${r.label}: ${line}`}${r.section ? `   (section: ${r.section})` : ""}`; }),
  ].join("\n");
  const transcript = script.turns.map((t) => `${t.speaker}: ${t.text}`).join("\n");
  return fill(template("blind"), { FORM: form, TRANSCRIPT: transcript });
}
