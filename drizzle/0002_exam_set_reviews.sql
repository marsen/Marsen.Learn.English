CREATE TABLE "exam_set_reviews" (
	"set_id" text PRIMARY KEY NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"comment" text,
	"audio_note" text,
	"question_notes" jsonb NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_set_reviews" ADD CONSTRAINT "exam_set_reviews_set_id_exam_sets_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."exam_sets"("set_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_set_reviews" ADD CONSTRAINT "exam_set_reviews_reviewer_id_accounts_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;