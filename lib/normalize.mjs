// 只做字串層級的正規化。其他規則一律交給 answer_policy。
export function normalize(input) {
  return String(input ?? "")
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}
