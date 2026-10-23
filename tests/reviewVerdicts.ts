/** 測試用：判定整套題。approved＝每一項都 OK；rejected＝第一題有問題、其他 OK（題號照 tests/fixtures/set.sample.json） */
export const SAMPLE_QUESTION_IDS = Array.from(
  { length: 10 },
  (_, i) => `q${String(i + 1).padStart(2, "0")}`,
);

export function verdictsFor(decision: "approved" | "rejected") {
  return [
    { target: null, ok: true },
    ...SAMPLE_QUESTION_IDS.map((q, i) => ({
      target: q,
      ok: decision === "approved" || i > 0,
    })),
  ];
}
