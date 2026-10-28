ALTER TABLE "exam_sets" ADD COLUMN "schema_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- 既有題組：有逐字稿的是 2.1，沒有的維持 2.0（預設 0）
UPDATE "exam_sets" SET "schema_minor" = 1 FROM "exam_set_privates" WHERE "exam_set_privates"."set_id" = "exam_sets"."set_id" AND "exam_set_privates"."transcript" IS NOT NULL;
