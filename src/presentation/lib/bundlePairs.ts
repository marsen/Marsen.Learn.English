/**
 * 批次上傳：把選到的資料夾裡的檔案，依「所在資料夾」配成一套一套的題組。
 * 每套題組資料夾要有 set.json 和 audio.mp3（Question.Generator 的 results/out/<題組>/）。
 */
export type PickedFile = { path: string; file: File };

export type BundlePair =
  | { folder: string; ok: true; setJson: File; audio: File }
  | { folder: string; ok: false; missing: string };

const SET_JSON = "set.json";
const AUDIO = "audio.mp3";

export function pairBundles(files: readonly PickedFile[]): BundlePair[] {
  const byFolder = new Map<string, Map<string, File>>();
  for (const { path, file } of files) {
    const parts = path.split("/");
    const name = parts.pop() ?? "";
    if (name !== SET_JSON && name !== AUDIO) continue; // 其他檔案（.DS_Store 等）略過
    const folder = parts.join("/");
    if (!byFolder.has(folder)) byFolder.set(folder, new Map());
    byFolder.get(folder)?.set(name, file);
  }
  return [...byFolder.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, found]): BundlePair => {
      const setJson = found.get(SET_JSON);
      const audio = found.get(AUDIO);
      if (!setJson) return { folder, ok: false, missing: SET_JSON };
      if (!audio) return { folder, ok: false, missing: AUDIO };
      return { folder, ok: true, setJson, audio };
    });
}

/** 顯示用：只留最後一層資料夾名稱（通常就是題組編號）；最上層回傳 null（由畫面顯示「最上層」） */
export function folderLabel(folder: string): string | null {
  return folder.split("/").pop() || folder || null;
}
