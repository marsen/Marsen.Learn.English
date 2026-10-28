// 從一套題組（Question.Generator 的 set.json + audio.mp3）剪一段，當首頁「先試做一題」的有聲示意題。
// 用法：
//   pnpm demo:make <題組資料夾> --from t21 --to t22 [--questions q08] [--paper scripts/landing-demo.paper.json]
//   --questions：用題組答案卡裡的哪幾題（題目卷沿用題組的，同一列裡沒選到的空格會拿掉）
//   --paper：首頁專用的題目卷（覆蓋題組原本的）；可以另外挖題組答案卡沒有的空格，答案與出處寫在同一個檔
// 產出：
//   public/landing-demo/audio.mp3              剪好的錄音（只含 from～to 這幾句對話）
//   src/presentation/content/landingDemo.json  題目卷、答案、逐字稿、答案出處
// 需要：ffmpeg；題組要是 set.json 2.1 以上（有 transcript）。換題組時重跑一次即可。
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_AUDIO = "public/landing-demo/audio.mp3";
const OUT_JSON = "src/presentation/content/landingDemo.json";
/** 剪下來的頭尾淡入淡出秒數，避免一開頭就是半個字 */
const FADE = 0.3;

function fail(message) {
  console.error(`[demo] ${message}`);
  process.exit(1);
}

const [dir, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const questionIds = opt("questions")?.split(",") ?? [];
const fromId = opt("from");
const toId = opt("to");
const paperFile = opt("paper");
if (!dir || !fromId || !toId || (questionIds.length === 0 && !paperFile)) {
  fail(
    "用法：pnpm demo:make <題組資料夾> --from t21 --to t22 [--questions q08] [--paper <檔案>]",
  );
}
const custom = paperFile ? JSON.parse(readFileSync(paperFile, "utf8")) : null;

const set = JSON.parse(readFileSync(join(dir, "set.json"), "utf8"));
if (!set.transcript) fail("這套題沒有逐字稿（transcript），要 set.json 2.1 以上");

const events = new Map(
  set.timing.events.filter((e) => e.type === "turn").map((e) => [e.id, e]),
);
const from = events.get(fromId);
const to = events.get(toId);
if (!from || !to) fail(`時間軸找不到 ${!from ? fromId : toId}`);
const start = Math.max(0, from.start - FADE);
const end = to.end + FADE;
const duration = end - start;

// 題目卷：有 --paper 就用它；不然只留題組裡有這幾題空格的列，同一列裡沒選到的空格拿掉。題號會從 1 重新排
const rows = custom
  ? custom.rows
  : set.paper.rows
      .filter((r) => r.parts.some((p) => p.blank && questionIds.includes(p.blank)))
      .map((r) => ({
        ...r,
        parts: r.parts.filter((p) => !p.blank || questionIds.includes(p.blank)),
      }));

const fromSet = questionIds.map((id) => {
  const a = set.answers.answers.find((x) => x.question_id === id);
  if (!a) fail(`答案卡找不到 ${id}`);
  return {
    questionId: id,
    answer: String(a.answer),
    accepted: (a.accepted ?? []).map(String),
    policy: a.answer_policy,
    trap: a.trap ?? "none",
  };
});
const allAnswers = [...fromSet, ...(custom?.answers ?? [])];

// 答案依題目卷上的順序排；每個空格都要有答案，每個答案都要有空格
const blanks = rows.flatMap((r) => r.parts.filter((p) => p.blank).map((p) => p.blank));
const answers = blanks.map((id) => {
  const a = allAnswers.find((x) => x.questionId === id);
  if (!a) fail(`題目卷上的 ${id} 沒有答案（--questions 或 --paper 的 answers 漏了）`);
  return a;
});
const unused = allAnswers.filter((a) => !blanks.includes(a.questionId));
if (unused.length > 0) {
  fail(`有答案沒出現在題目卷上：${unused.map((a) => a.questionId).join()}`);
}

// 逐字稿：只留剪到的句子，時間改成從剪下來的音檔開頭算
const turnIds = set.transcript.turns.map((t) => t.id);
const kept = turnIds.slice(turnIds.indexOf(fromId), turnIds.indexOf(toId) + 1);
const transcript = set.transcript.turns
  .filter((t) => kept.includes(t.id))
  .map((t) => ({
    id: t.id,
    speaker: t.speaker,
    text: t.text,
    start: +(events.get(t.id).start - start).toFixed(2),
  }));
const evidence = [
  ...set.transcript.evidence
    .filter((e) => questionIds.includes(e.question_id))
    .map((e) => ({ questionId: e.question_id, turn: e.turn, quote: e.quote })),
  ...(custom?.evidence ?? []),
];
for (const a of answers) {
  const e = evidence.find((x) => x.questionId === a.questionId);
  if (!e) fail(`${a.questionId} 沒有出處（evidence）`);
  if (!kept.includes(e.turn))
    fail(`${a.questionId} 的答案在 ${e.turn}，不在剪下來的範圍`);
  const line = transcript.find((t) => t.id === e.turn).text;
  if (!line.includes(e.quote))
    fail(`${a.questionId} 的出處「${e.quote}」不在 ${e.turn} 這句裡`);
}

mkdirSync("public/landing-demo", { recursive: true });
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-ss",
  start.toFixed(2),
  "-t",
  duration.toFixed(2),
  "-i",
  join(dir, "audio.mp3"),
  "-af",
  `afade=t=in:d=${FADE},afade=t=out:st=${(duration - FADE).toFixed(2)}:d=${FADE}`,
  "-ac",
  "1",
  "-b:a",
  "96k",
  OUT_AUDIO,
]);

const demo = {
  source: { setId: set.set_id, from: fromId, to: toId, paper: paperFile ?? null },
  duration: +duration.toFixed(2),
  paper: {
    title: set.paper.title,
    instruction: set.paper.instruction,
    section_styles: custom ? undefined : set.paper.section_styles,
    rows,
  },
  answers,
  transcript,
  evidence,
};
writeFileSync(OUT_JSON, JSON.stringify(demo, null, 2) + "\n");
// 跟專案其他檔案一樣用 Prettier 排版，免得 format:check 失敗
execFileSync("npx", ["prettier", "--write", "--log-level", "warn", OUT_JSON], {
  stdio: "inherit",
});
console.log(
  `[demo] ${set.set_id} ${fromId}～${toId}（${duration.toFixed(1)} 秒）→ ${OUT_AUDIO}、${OUT_JSON}`,
);
