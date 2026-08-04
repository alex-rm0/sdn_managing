CREATE TABLE IF NOT EXISTS "pending_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "text" text NOT NULL,
  "origin_meeting_id" integer NOT NULL,
  "status" text DEFAULT 'pendente' NOT NULL,
  "resolved_note" text,
  "resolved_at" timestamp with time zone,
  "resolved_in_meeting_id" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "action_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "text" text NOT NULL,
  "assigned_to_name" text NOT NULL,
  "origin_meeting_id" integer NOT NULL,
  "status" text DEFAULT 'pendente' NOT NULL,
  "resolved_note" text,
  "resolved_at" timestamp with time zone,
  "resolved_in_meeting_id" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "pending_items" ADD CONSTRAINT "pending_items_origin_meeting_id_meeting_minutes_id_fk"
    FOREIGN KEY ("origin_meeting_id") REFERENCES "meeting_minutes"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "pending_items" ADD CONSTRAINT "pending_items_resolved_in_meeting_id_meeting_minutes_id_fk"
    FOREIGN KEY ("resolved_in_meeting_id") REFERENCES "meeting_minutes"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "action_items" ADD CONSTRAINT "action_items_origin_meeting_id_meeting_minutes_id_fk"
    FOREIGN KEY ("origin_meeting_id") REFERENCES "meeting_minutes"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "action_items" ADD CONSTRAINT "action_items_resolved_in_meeting_id_meeting_minutes_id_fk"
    FOREIGN KEY ("resolved_in_meeting_id") REFERENCES "meeting_minutes"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
