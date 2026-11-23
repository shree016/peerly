CREATE TABLE "voice_usage" (
	"key" text PRIMARY KEY NOT NULL,
	"seconds" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
