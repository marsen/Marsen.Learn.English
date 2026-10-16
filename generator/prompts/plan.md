# Task: fill in the answer values for an IELTS-style Section 1 listening set

You are helping build ORIGINAL practice material for an IELTS-style listening test (Section 1: a conversation between two people, form completion). The structure of the 10 questions has already been decided by a program. Your only job is to invent the concrete VALUES (the answers) that fit this structure.

## Scenario
- Topic: {{TOPIC_TITLE}}
- Situation: {{VARIANT_SETTING}}
- Speakers:
{{SPEAKERS}}

## The form the candidate will see (blanks are the 10 questions)
Title: {{FORM_TITLE}}
Instruction: {{FORM_INSTRUCTION}}
Printed rows (always on the form, NOT questions; do not reuse their text as an answer):
{{PRINTED_ROWS}}

## The 10 questions (fixed by the program: do not add, remove or change any of this)
{{SLOTS}}

## What you must produce
Reply with ONE JSON object and nothing else (no code fences, no commentary):

{
  "scenario": { "setting": "<one short English sentence: where and when the conversation happens>", "accent": "<en-GB | en-AU | en-US>" },
  "values": [
    {
      "question_id": "q01",
      "answer": "<the correct answer, exactly as the candidate should write it>",
      "accepted": ["<other spellings or formats that must also be marked correct; [] if none>"],
      "wrong_value": "<ONLY for self_correction and distractor questions; otherwise omit this key>",
      "note": "<one short sentence for the human reviewer: how the answer will appear in the talk>"
    }
  ]
}

`values` must contain exactly one entry per question, in the same order, using the question_id values above. Do not output field_id, type, trap or answer_policy: the program adds them.

## Rules
1. Everything is fictional. Phone numbers must start with {{PHONE_PREFIX}} (UK drama range, e.g. 07700 900 123). Email addresses must use {{EMAIL_DOMAIN}}. Never use real people, famous names or real businesses. Avoid these names: {{BLACKLIST}}.
2. Respect the word limit of each question (articles and prepositions count; a run of digits counts as ONE number). The answer must also obey the instruction printed on the form.
3. Follow the answer format of each question's answer_policy:
   - exact_word: the answer is compared word for word. Use the plainest spelling. Put real alternative spellings (British/American) in "accepted".
   - date_equivalence: write the answer as "<day> <Month>" with no year, for example "14 March". Put other formats in "accepted", for example "March 14", "14th March".
   - digits_only: digits only, for example "15" or "3417". For phone numbers write the digits with spaces, for example "07700 900 123".
   - number_word: write the numeral, for example "3"; put the word form in "accepted", for example "three".
4. Obey the trap requirement of each question (last column of the table). They are essential: the program will reject the set if a trap is missing.
5. Answers within the set must be different from each other, and plausible for the situation and speakers. Make them feel like a real person's details: not too round, not too exotic, no cliché names like "John Smith".
6. Do not choose answers that are only distinguishable by an obscure spelling unless the question is a spelling question.
7. If a question belongs to a group (same group name), the answers must be consistent with each other (for example a house number and a street in the same address).
8. Make the set different from a typical one: avoid the most common first-choice names and numbers.
