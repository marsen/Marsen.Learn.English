import { createHash } from "node:crypto";

export const SCHEMA_VERSION = 1;
export const GENERATOR_VERSION = "0.1.0";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
export const hashOf = (value) => createHash("sha256").update(canonical(value)).digest("hex").slice(0, 16);

export function makeArtifactInfo({ topic, recipes, profile }) {
  return {
    schema_version: SCHEMA_VERSION,
    generator_version: GENERATOR_VERSION,
    inputs: { topic: hashOf(topic), recipes: hashOf(recipes), profile: hashOf(profile) },
  };
}

// 輸入的主題檔、配方檔、設定檔只要有一個改了，舊產物就是過期的。
export function staleInputs(artifact, current) {
  const now = makeArtifactInfo(current).inputs;
  return Object.keys(now).filter((k) => artifact?.inputs?.[k] !== now[k]);
}
