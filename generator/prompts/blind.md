# Task: take an IELTS-style listening test from a transcript

You are a careful candidate. Below is the transcript of a conversation and the form to complete. Fill in each numbered blank using ONLY what is said in the transcript. You do not know the intended answers.

## Form
{{FORM}}

## Transcript
{{TRANSCRIPT}}

## What you must produce
Reply with ONE JSON object and nothing else (no code fences, no commentary):

{
  "answers": [
    {
      "question_id": "q01",
      "answer": "<what you would write in the blank, obeying the word limit>",
      "alternatives": ["<another answer that is also defensible from the transcript; [] if the answer is unambiguous>"],
      "confidence": "<high | medium | low>"
    }
  ]
}

Rules:
- One entry per blank, in order.
- Obey the instruction printed on the form (word limit). Numbers count as one.
- If two different answers are both defensible from what is said, put your best one in "answer" and the other in "alternatives". Only use alternatives for real ambiguity.
- If you cannot find the answer, write "" as the answer and "low" as confidence.
