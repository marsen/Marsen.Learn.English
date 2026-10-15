import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadContent } from "../generator/cli.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
export const content = loadContent();
export const topic = content.topics.find((t) => t.id === "library-card");

export function fixture(name = "good-0001") {
  const dir = join(here, "fixtures", name);
  return {
    skeleton: read(join(dir, "skeleton.json")), plan: read(join(dir, "plan.json")),
    script: read(join(dir, "script.json")), paper: read(join(dir, "paper.json")),
    topic, recipes: content.recipes, profile: content.profile,
  };
}
export const rules = (result, level) => result.issues.filter((i) => !level || i.level === level).map((i) => i.rule);
