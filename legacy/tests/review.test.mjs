// 題組檢視頁（review/）：整理資料的純邏輯，加上在 jsdom 裡載入 set.json 的流程。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { startServer } from "../scripts/serve.mjs";
import { buildPublic } from "../scripts/build-public.mjs";
import * as render from "../review/render.mjs";

const fixtureText = await readFile(new URL("./fixtures/bundle-needs-human.json", import.meta.url), "utf8");
const bundle = () => JSON.parse(fixtureText);

test("parseBundle：不是 JSON、不像 set.json、不支援的版本都會說清楚", () => {
  assert.throws(() => render.parseBundle("{壞掉"), /不是 JSON/);
  assert.throws(() => render.parseBundle("{}"), /不像 set\.json/);
  assert.throws(() => render.parseBundle(JSON.stringify({ ...bundle(), schema_version: 9 })), /schema_version/);
  assert.equal(render.parseBundle(fixtureText).set_id, bundle().set_id);
});

test("buildModel：結論、示警與題目對得起來", () => {
  const m = render.buildModel(bundle());
  assert.equal(m.verdict.key, "needs_human");
  assert.equal(m.count, 10);
  assert.equal(m.questions.length, 10);
  assert.equal(m.warnings.length, 1);
  assert.equal(m.problems, 1);
  assert.equal(m.unresolved, 0);
  const q7 = m.questions[6];
  assert.equal(q7.number, 7);
  assert.equal(q7.label, "Preferred time");
  assert.equal(q7.trapLabel, "干擾項");
  assert.deepEqual(q7.warnings.map((w) => w.id), ["w01"]);
  assert.equal(m.questions[0].trapLabel, "自我更正");
  assert.equal(m.pauses.length, 4);
  assert.deepEqual(m.pauses[0].questions, [1, 4]);
  assert.equal(m.pauses[0].questionsText, "第 1–4 題");
  assert.ok(m.segments.every((s) => s.left >= 0 && s.left + s.width <= 100.2));
  assert.deepEqual(m.steps.map((s) => s.key), ["plan", "script", "blind", "validate", "ai_review"]);
});

test("buildModel：通過、沒有審稿、尚未裁決、舊版人工審稿", () => {
  const b = bundle();
  b.provenance.ai_review.verdict = "pass";
  b.provenance.warnings = [{ ...b.provenance.warnings[0], ai_ruling: "ok" }];
  const pass = render.buildModel(b);
  assert.equal(pass.verdict.key, "pass");
  assert.equal(pass.problems, 0);
  assert.equal(pass.okCount, 1);

  const none = bundle();
  none.provenance.ai_review = null;
  none.provenance.warnings = [{ id: "w01", source: "blind", rule: "B1", question_id: "q02", message: "x" }];
  none.provenance.review = { reviewer: "me" };
  const m = render.buildModel(none);
  assert.equal(m.verdict.key, "none");
  assert.equal(m.unresolved, 1);
  assert.ok(m.legacyReview);

  const bare = bundle();
  delete bare.provenance;
  assert.equal(render.buildModel(bare).verdict.key, "none");
});

test("checkAudio：大小、雜湊、被換掉都分得出來", async () => {
  const bytes = Buffer.from("fake mp3 bytes");
  const audio = { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
  assert.equal((await render.checkAudio(audio, buf, webcrypto.subtle)).ok, true);
  assert.equal((await render.checkAudio({ ...audio, sha256: "0".repeat(64) }, buf, webcrypto.subtle)).ok, false);
  assert.equal((await render.checkAudio({ ...audio, bytes: 3 }, buf, webcrypto.subtle)).ok, false);
  assert.equal((await render.checkAudio(audio, buf, null)).ok, null);
  assert.equal((await render.checkAudio(null, buf, webcrypto.subtle)).ok, false);
});

test("這一頁含標準答案，不能被部署：build-public 不複製 review/", async () => {
  const files = buildPublic({ out: new URL("../.tmp-review-build", import.meta.url).pathname });
  assert.ok(!files.some((f) => f.includes("review")));
  const { rmSync } = await import("node:fs");
  rmSync(new URL("../.tmp-review-build", import.meta.url), { recursive: true, force: true });
});

let server, base;
before(async () => { server = await startServer(0); base = `http://127.0.0.1:${server.address().port}`; });
after(() => server.close());
const until = async (fn, ms = 2000) => { for (let i = 0; i < ms / 20 && !fn(); i++) await new Promise((r) => setTimeout(r, 20)); };

async function openReview() {
  const url = `${base}/review/index.html`;
  const html = await (await fetch(url)).text();
  const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  const read = (blob, how) => new Promise((ok, fail) => { const r = new w.FileReader(); r.onload = () => ok(r.result); r.onerror = fail; r[how](blob); });
  w.Blob.prototype.text = function () { return read(this, "readAsText"); };
  w.Blob.prototype.arrayBuffer = function () { return read(this, "readAsArrayBuffer"); };
  w.URL.createObjectURL = () => "blob:fake";
  w.URL.revokeObjectURL = () => {};
  w.crypto = webcrypto;
  w.__mods = { render };
  w.eval((await readFile(new URL("../review/app.js", import.meta.url), "utf8")).replace(/import \{([^}]*)\} from "\.\/(\w+)\.(?:mjs|js)";/g, 'const {$1} = window.__mods["$2"];'));
  return w;
}
const pick = (w, files) => {
  const input = w.document.getElementById("file");
  Object.defineProperty(input, "files", { value: files, configurable: true });
  input.dispatchEvent(new w.Event("change"));
};

test("頁面：載入 set.json 後出現結論、示警、題目表、時間軸、題目卷", async () => {
  const w = await openReview();
  const d = w.document;
  assert.equal(d.getElementById("report").hidden, true);
  pick(w, [new w.File([fixtureText], "set.json", { type: "application/json" })]);
  await until(() => !d.getElementById("report").hidden);
  assert.match(d.getElementById("summary").textContent, /Fitness Club Registration/);
  assert.match(d.getElementById("summary").textContent, /有疑慮/);
  assert.match(d.getElementById("warnings").textContent, /lunch break/);
  assert.match(d.getElementById("warnings").textContent, /真問題/);
  assert.equal(d.querySelectorAll("#questions tbody tr").length, 10);
  assert.equal(d.querySelectorAll("#timeline .seg.pause").length, 4);
  assert.equal(d.querySelectorAll("#paper .num").length, 10);
  assert.equal(d.querySelectorAll("#paper .blank.ans").length, 0, "預設不顯示答案");
  d.getElementById("show-answers").click();
  assert.equal(d.querySelectorAll("#paper .blank.ans").length, 10);
  assert.match(d.getElementById("audio-box").textContent, /還沒載入 audio\.mp3/);
});

test("頁面：同時選 audio.mp3 會核對雜湊；對不上會標出來", async () => {
  const bytes = Buffer.from("x".repeat(20000));
  const b = bundle();
  b.audio = { ...b.audio, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  const w = await openReview();
  const d = w.document;
  pick(w, [new w.File([JSON.stringify(b)], "set.json"), new w.File([bytes], "audio.mp3", { type: "audio/mpeg" })]);
  await until(() => d.querySelector("#audio-box audio"));
  assert.match(d.getElementById("audio-box").textContent, /一致/);

  const w2 = await openReview();
  pick(w2, [new w2.File([JSON.stringify(b)], "set.json"), new w2.File([Buffer.from("y".repeat(20000))], "audio.mp3")]);
  await until(() => w2.document.querySelector("#audio-box .chip"));
  assert.match(w2.document.getElementById("audio-box").textContent, /對不上/);
});

test("頁面：選到壞檔或沒有 set.json 會顯示錯誤，不會留下半張報表", async () => {
  const w = await openReview();
  const d = w.document;
  pick(w, [new w.File(["{壞"], "set.json")]);
  await until(() => !d.getElementById("error").hidden);
  assert.match(d.getElementById("error").textContent, /不是 JSON/);
  assert.equal(d.getElementById("report").hidden, true);
  pick(w, [new w.File(["x"], "audio.mp3")]);
  assert.match(d.getElementById("error").textContent, /找不到 set\.json/);
});

test("頁面：程式裡沒有任何網路請求（檔案只在瀏覽器裡讀）", async () => {
  const src = await readFile(new URL("../review/app.js", import.meta.url), "utf8");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(src));
});

const mk = (w, id, title, verdict) => {
  const b = bundle();
  b.set_id = id; b.title = title; b.provenance.ai_review.verdict = verdict;
  return JSON.stringify(b);
};

test("groupFiles：每套的檔名一樣，靠資料夾分組；音檔跟同資料夾的 set.json 配對", () => {
  const f = (n) => ({ name: n });
  const g = render.groupFiles([
    { file: f("a-json"), path: "out/s1-b/set.json" }, { file: f("a-mp3"), path: "out/s1-b/audio.mp3" },
    { file: f("b-json"), path: "out/s1-a/set.json" },
    { file: f("x"), path: "out/s1-a/notes.json" }, { file: f("y"), path: "out/readme.txt" },
  ]);
  assert.deepEqual(g.map((x) => x.name), ["s1-a", "s1-b"]);
  assert.equal(g[0].audio, null);
  assert.equal(g[1].audio.name, "a-mp3");
  const loose = render.groupFiles([{ file: f("j"), path: "set.json" }, { file: f("m"), path: "audio.mp3" }]);
  assert.equal(loose.length, 1);
  assert.equal(loose[0].audio.name, "m");
  assert.deepEqual(render.groupFiles([{ file: f("m"), path: "audio.mp3" }]), []);
});

test("collectDropped：拖資料夾時一層一層讀進去，路徑帶資料夾名", async () => {
  const file = (name) => ({ isFile: true, name, file: (ok) => ok({ name }) });
  const dir = (name, kids) => ({ isFile: false, name, createReader: () => { let done = false; return { readEntries: (ok) => { const out = done ? [] : kids; done = true; ok(out); } }; } });
  const dt = { items: [{ webkitGetAsEntry: () => dir("out", [dir("s1-a", [file("set.json"), file("audio.mp3")]), file("x.txt")]) }] };
  const got = await render.collectDropped(dt);
  assert.deepEqual(got.map((x) => x.path).sort(), ["out/s1-a/audio.mp3", "out/s1-a/set.json", "out/x.txt"]);
  const plain = await render.collectDropped({ items: [], files: [{ name: "set.json" }] });
  assert.deepEqual(plain.map((x) => x.path), ["set.json"]);
});

test("頁面：選資料夾可以一次載入很多套；總表可點、切換時換內容；壞掉的那套不影響其他", async () => {
  const w = await openReview();
  const d = w.document;
  const withPath = (file, path) => { Object.defineProperty(file, "webkitRelativePath", { value: path }); return file; };
  const input = d.getElementById("dir");
  Object.defineProperty(input, "files", { value: [
    withPath(new w.File([mk(w, "s1-a", "題組甲", "pass")], "set.json"), "out/s1-a/set.json"),
    withPath(new w.File([mk(w, "s1-b", "題組乙", "needs_human")], "set.json"), "out/s1-b/set.json"),
    withPath(new w.File(["{壞"], "set.json"), "out/s1-c/set.json"),
  ], configurable: true });
  input.dispatchEvent(new w.Event("change"));
  await until(() => !d.getElementById("overview").hidden);
  assert.equal(d.querySelectorAll("#overview tbody tr").length, 2);
  assert.match(d.getElementById("overview").textContent, /共 2 套/);
  assert.match(d.getElementById("overview").textContent, /通過 1、有疑慮 1/);
  assert.match(d.getElementById("error").textContent, /s1-c/);
  assert.match(d.getElementById("summary").textContent, /題組甲/);
  d.querySelector('#overview tbody tr[data-i="1"]').click();
  await until(() => /題組乙/.test(d.getElementById("summary").textContent));
  assert.match(d.getElementById("summary").textContent, /有疑慮/);
  assert.ok(d.querySelector('#overview tbody tr[data-i="1"]').classList.contains("cur"));
});

test("頁面：只有一套時不顯示總表", async () => {
  const w = await openReview();
  pick(w, [new w.File([fixtureText], "set.json")]);
  await until(() => !w.document.getElementById("report").hidden);
  assert.equal(w.document.getElementById("overview").hidden, true);
});
