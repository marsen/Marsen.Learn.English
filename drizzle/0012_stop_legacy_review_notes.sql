ALTER TABLE "exam_set_reviews" ALTER COLUMN "question_notes" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
-- 舊審稿（還沒有 notes 的）：把錄音建議搬成整套的意見、每題建議搬成那一題的意見，之後程式只讀 notes
UPDATE "exam_set_reviews" SET "notes" =
  (CASE WHEN "audio_note" IS NOT NULL AND "audio_note" <> ''
        THEN jsonb_build_array(jsonb_build_object('target', NULL, 'text', "audio_note"))
        ELSE '[]'::jsonb END)
  || COALESCE(
       (SELECT jsonb_agg(jsonb_build_object('target', q->>'questionId', 'text', q->>'note'))
          FROM jsonb_array_elements("question_notes") AS q),
       '[]'::jsonb)
WHERE "notes" IS NULL;
