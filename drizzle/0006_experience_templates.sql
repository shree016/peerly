CREATE TABLE "experience_template" (
	"id" text PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"company_logo_url" text,
	"role" text NOT NULL,
	"batch" text NOT NULL,
	"ctc_lpa" real,
	"jd_url" text,
	"jd_file_name" text,
	"rounds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experience_template" ADD CONSTRAINT "experience_template_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_template" ADD CONSTRAINT "experience_template_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "experience_template_drive_active_unique" ON "experience_template" USING btree (lower("company_name"),lower("role"),lower("batch")) WHERE "experience_template"."status" = 'active';