CREATE TABLE "events" (
	"session_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"participant_id" text NOT NULL,
	"t" double precision NOT NULL,
	"condition" text NOT NULL,
	"task_id" text,
	"subtask_id" text,
	"objective" text,
	"objective_source" text,
	"spec_version" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_session_id_seq_pk" PRIMARY KEY("session_id","seq")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" text PRIMARY KEY NOT NULL,
	"ordinal" integer GENERATED ALWAYS AS IDENTITY (sequence name "participants_ordinal_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consented_at" timestamp with time zone,
	CONSTRAINT "participants_ordinal_unique" UNIQUE("ordinal")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"session_number" integer NOT NULL,
	"condition" text NOT NULL,
	"task_ids" text[] NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "sessions_participant_id_session_number_key" UNIQUE("participant_id","session_number")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_participant_type" ON "events" USING btree ("participant_id","type");--> statement-breakpoint
CREATE INDEX "events_type" ON "events" USING btree ("type");