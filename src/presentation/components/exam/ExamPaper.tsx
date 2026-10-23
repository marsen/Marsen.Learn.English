import type { PaperView } from "@/application/exam/paperView";

type Props = {
  paper: PaperView;
  answers: Record<string, string>;
  onChange: (questionId: string, value: string) => void;
  disabled: boolean;
  /** 看題時間要看的題號範圍，這些空格會標黃 */
  highlight: [number, number] | null;
};

function nextIsPunctuation(
  part: PaperView["sections"][number]["rows"][number]["parts"][number] | undefined,
) {
  return part?.kind === "text" && /^[.,;:!?]/.test(part.text);
}

/** 說明文字裡的全大寫片語（NO MORE THAN TWO WORDS…）照雅思格式加粗 */
function Instruction({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/[A-Z][A-Z/]+(?: [A-Z/]+)*/g)) {
    out.push(text.slice(last, m.index));
    out.push(<b key={m.index}>{m[0]}</b>);
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return <p className="mb-4 italic">{out}</p>;
}

/** 雅思答題卷：分段標題；段內一行一行（list）或連成一小段（paragraph）；空格前有題號圓圈 */
export function ExamPaper({ paper, answers, onChange, disabled, highlight }: Props) {
  const lit = (n: number) => highlight !== null && n >= highlight[0] && n <= highlight[1];

  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4 leading-loose">
      <h2 className="my-3 text-center font-semibold">{paper.title}</h2>
      {paper.instruction && <Instruction text={paper.instruction} />}
      {paper.sections.map((section, si) => {
        const Group = section.style === "paragraph" ? "p" : "div";
        return (
          <section key={si}>
            {section.title && (
              <h3 className="mt-5 mb-1 font-semibold">{section.title}</h3>
            )}
            <Group>
              {section.rows.map((row, ri) => {
                const Line = section.style === "paragraph" ? "span" : "div";
                return (
                  <Line key={ri} className={section.style === "paragraph" ? "" : "my-2"}>
                    {section.style === "list" && "• "}
                    {!row.inline && row.label && `${row.label}: `}
                    {row.parts.map((part, pi) =>
                      part.kind === "text" ? (
                        <span key={pi}>{part.text} </span>
                      ) : (
                        <span key={pi} className="whitespace-nowrap">
                          <span className="mx-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {part.number}
                          </span>
                          <input
                            type="text"
                            aria-label={`Question ${part.number}`}
                            autoCapitalize="off"
                            autoComplete="off"
                            spellCheck={false}
                            disabled={disabled}
                            value={answers[part.questionId] ?? ""}
                            onChange={(e) => onChange(part.questionId, e.target.value)}
                            className={`w-40 max-w-[55%] border-0 border-b border-foreground bg-transparent px-1 focus:outline-2 focus:outline-primary disabled:bg-card ${lit(part.number) ? "bg-yellow-100" : ""}`}
                          />
                          {/* 下一段文字是標點（. , ;）就不空格 */}
                          {nextIsPunctuation(row.parts[pi + 1]) ? "" : " "}
                        </span>
                      ),
                    )}
                    {section.style === "paragraph" && " "}
                  </Line>
                );
              })}
            </Group>
          </section>
        );
      })}
    </div>
  );
}
