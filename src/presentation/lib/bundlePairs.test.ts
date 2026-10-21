import { describe, it, expect } from "vitest";
import { folderLabel, pairBundles, type PickedFile } from "./bundlePairs";

const f = (path: string): PickedFile => ({
  path,
  file: new File(["x"], path.split("/").pop() ?? ""),
});

describe("pairBundles", () => {
  it("應該依資料夾把 set.json 和 audio.mp3 配成一套", () => {
    const pairs = pairBundles([
      f("out/s1-gym-0002/audio.mp3"),
      f("out/s1-car-0001/set.json"),
      f("out/s1-car-0001/audio.mp3"),
      f("out/s1-gym-0002/set.json"),
      f("out/.DS_Store"),
    ]);
    expect(pairs.map((p) => [folderLabel(p.folder), p.ok])).toEqual([
      ["s1-car-0001", true],
      ["s1-gym-0002", true],
    ]);
  });

  it("應該標出缺檔的資料夾", () => {
    const pairs = pairBundles([f("out/a/set.json"), f("out/b/audio.mp3")]);
    expect(pairs).toEqual([
      { folder: "out/a", ok: false, problem: "缺少 audio.mp3" },
      { folder: "out/b", ok: false, problem: "缺少 set.json" },
    ]);
  });

  it("應該在只選到一套題組資料夾時也能用", () => {
    const pairs = pairBundles([f("s1-gym-0002/set.json"), f("s1-gym-0002/audio.mp3")]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].ok).toBe(true);
  });
});
