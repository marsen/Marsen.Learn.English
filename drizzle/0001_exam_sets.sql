CREATE TABLE "exam_set_privates" (
	"set_id" text PRIMARY KEY NOT NULL,
	"answers" jsonb NOT NULL,
	"provenance" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_sets" (
	"set_id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"topic" text NOT NULL,
	"question_count" integer NOT NULL,
	"paper" jsonb NOT NULL,
	"timing" jsonb NOT NULL,
	"audio_key" text NOT NULL,
	"ai_verdict" text NOT NULL,
	"status" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_set_privates" ADD CONSTRAINT "exam_set_privates_set_id_exam_sets_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."exam_sets"("set_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sets" ADD CONSTRAINT "exam_sets_uploaded_by_accounts_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;