import { doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

// Enrollment order (`ordinal`) drives condition counterbalancing.
export const participants = pgTable("participants", {
  id: text("id").primaryKey(),
  ordinal: integer("ordinal").generatedAlwaysAsIdentity().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  consentedAt: timestamp("consented_at", { withTimezone: true, mode: "date" }),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id),
    sessionNumber: integer("session_number").notNull(),
    condition: text("condition").notNull(),
    taskIds: text("task_ids").array().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [unique("sessions_participant_id_session_number_key").on(table.participantId, table.sessionNumber)],
);

// Append-only. drizzle/0001_events-append-only.sql installs a trigger that rejects updates, deletes, and truncates.
export const events = pgTable(
  "events",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    seq: integer("seq").notNull(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id),
    t: doublePrecision("t").notNull(),
    condition: text("condition").notNull(),
    taskId: text("task_id"),
    subtaskId: text("subtask_id"),
    objective: text("objective"),
    objectiveSource: text("objective_source"),
    specVersion: integer("spec_version").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.seq] }),
    index("events_participant_type").on(table.participantId, table.type),
    index("events_type").on(table.type),
  ],
);
