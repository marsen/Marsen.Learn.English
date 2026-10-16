# Task: write the conversation transcript for an IELTS-style Section 1 listening set

You are writing ORIGINAL practice material: a natural two-person conversation (Section 1 of an IELTS-style listening test) in which a speaker fills in a form. The answers have already been decided. Your job is to write a realistic conversation that contains each answer once, in the order of the form, with the required traps.

## Scenario
- Topic: {{TOPIC_TITLE}}
- Situation: {{VARIANT_SETTING}}
- Setting: {{SETTING}}
- Accent / variety of English: {{ACCENT}} (reflect it lightly through vocabulary and idiom; do not write phonetic spelling)
- Speakers:
{{SPEAKERS}}

## The form the candidate sees
Title: {{FORM_TITLE}}
{{FORM_ROWS}}

## The answers (FIXED: do not change, add or drop any)
{{ANSWERS}}

## What you must produce
Reply with ONE JSON object and nothing else (no code fences, no commentary):

{
  "turns": [
    { "id": "t1", "speaker": "A", "text": "..." },
    { "id": "t2", "speaker": "B", "text": "..." }
  ],
  "evidence": [
    { "question_id": "q01", "turn": "t6", "quote": "<exact text copied from that turn>" }
  ]
}

- Turn ids are t1, t2, t3 ... in order. Speakers alternate naturally (speaker ids as listed above).
- `evidence` has exactly one entry per question, in question order. The `quote` MUST be copied character for character from the `text` of the turn named in `turn` (a program checks that it is an exact substring). The quote must be a complete sentence (or sentences) that contains the answer, so it can be located later. Keep the quote short.

## Requirements (a program checks every one of these)
1. Length: about {{TARGET_WORDS}} English words in total. Fewer words is better than padding, but stay inside the range.
2. Warm-up: at least {{WARMUP}} turns of greeting and small talk BEFORE the first answer.
3. Spacing: at least {{MIN_GAP}} words between the end of one answer's quote and the start of the next answer's quote, so answers never crowd together.
4. Order: the answers must be spoken in question order (q01 first, q10 last), matching the order of the rows on the form.
5. Each answer appears in the talk in the form given. Write numbers and dates as digits ("15", "3417", "the 14th of March", "07700 900 123"). A date answer must appear as a full date with day and month.
6. Do NOT read the form out loud and do not use the form labels as the speakers' wording. People talk naturally: a clerk asks questions, the customer answers in ordinary sentences with some "um", "well", "actually", repetition, small digressions. Real speech is a little untidy; it must still be easy to follow.
7. Everything is fictional. Phone numbers only 07700 900 xxx; emails only example.com.
8. The answer must be the only reasonable answer. If the answer is a modifier plus a noun (for example "course books"), the talk must contrast it so the bare noun alone would be wrong or too vague (for example "Not novels or anything, mostly course books"). Do not mention a second candidate answer for the same question that a listener could reasonably write instead (for example a hobby and its sub-topic).
9. Confusable numbers must appear as digits or as the word, within two turns of the answer's turn. This also holds for dates: if the day is 17, someone must say "70th" or "seventy" nearby (for example the clerk asks "The 70th?" and the speaker corrects). Do not rely on an ordinal like "7th" alone.
10. A distractor (wrong_value) must be spoken literally, as that exact word, within two turns of the answer's turn, and rejected there. Do not place it earlier or later.
11. A mishearing must be plausible. The clerk may only mishear a number that the other speaker actually said, and the wrong number must be a real, sensible value for that kind of answer (a day of the month is 1 to 31; a phone number or ID is a similar-sounding digit string). Never have someone "mishear" a number that was never said or that cannot exist.

## Trap requirements (per question, listed with the answers above)
- spelling: the speaker says the word and then spells it out letter by letter in capitals with hyphens, for example "H-A-R-L-O-W". The quote you choose must include the spelled letters.
- similar_numbers: within two turns before or after the answer, a confusable number must be mentioned, for example the clerk mishears ("Was that 3470?") and the speaker corrects it ("No, it's 3417."). Teens against tens: 13/30, 14/40 ... 19/90.
- self_correction: the speaker first says the `wrong_value`, then corrects themselves to the answer, in the same turn or in a turn within the two before it. The quote contains the corrected answer.
- distractor: the `wrong_value` is mentioned within two turns before or after the answer, but it is clearly NOT the answer (it is rejected, or belongs to something else).
- paraphrase: the speaker never uses the wording of the form label; the idea is expressed with different words, so the candidate has to understand meaning, not match words.
- none: the answer is stated directly, once, with no tricks.
