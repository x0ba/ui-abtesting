import { and, eq, ne, sql } from "drizzle-orm";
import { events, participants, sessions } from "../../db/schema.ts";
import { STUDY } from "../study/config.ts";
import type { Observation } from "../study/events.ts";
import { conditionFor, tasksFor } from "../study/schedule.ts";
import type { StartResponse } from "../study/session.ts";
import { db } from "./db.ts";

export async function startSession(code: string, consent: boolean): Promise<StartResponse> {
  const database = db();

  const [existing] = await database
    .select({ ordinal: participants.ordinal, consentedAt: participants.consentedAt })
    .from(participants)
    .where(eq(participants.id, code))
    .limit(1);
  if (!existing?.consentedAt && !consent) return { status: "consent" };

  const [participant] = existing?.consentedAt
    ? [existing]
    : await database
        .insert(participants)
        .values({ id: code, consentedAt: sql`now()` })
        .onConflictDoUpdate({
          target: participants.id,
          set: { consentedAt: sql`coalesce(${participants.consentedAt}, now())` },
        })
        .returning({ ordinal: participants.ordinal, consentedAt: participants.consentedAt });
  if (!participant) throw new Error("Could not enroll participant.");

  const [{ completed, started }] = await database
    .select({
      completed: sql<number>`count(*) filter (where ${sessions.endedAt} is not null)::int`.mapWith(Number),
      started: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(sessions)
    .where(eq(sessions.participantId, code));
  if (completed >= STUDY.sessionsPerParticipant) return { status: "finished", totalSessions: STUDY.sessionsPerParticipant };

  // Abandoned sessions keep their rows, but the schedule only advances on completed ones,
  // so a participant who drops out mid-session repeats that slot's condition and tasks.
  const sessionNumber = completed + 1;
  const condition = conditionFor(participant.ordinal, sessionNumber);
  const taskIds = tasksFor(participant.ordinal, sessionNumber);
  const sessionId = crypto.randomUUID();

  await database.insert(sessions).values({
    id: sessionId,
    participantId: code,
    sessionNumber: started + 1,
    condition,
    taskIds,
  });

  const person = await database
    .select({ payload: events.payload })
    .from(events)
    .where(and(eq(events.participantId, code), eq(events.type, "preference.observe")))
    .orderBy(events.sessionId, events.seq);

  const dimension = sql<string>`${events.payload}->>'dimension'`;
  const variation = sql<string>`${events.payload}->>'variation'`;
  const contextKey = sql<string>`${events.payload}->>'contextKey'`;
  const population = await database
    .select({
      dimension,
      variation,
      contextKey,
      keeps: sql<number>`sum((${events.payload}->>'outcome')::int)::int`.mapWith(Number),
      total: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(events)
    .where(and(eq(events.type, "preference.observe"), ne(events.participantId, code)))
    .groupBy(dimension, variation, contextKey);

  return {
    status: "ready",
    session: {
      participantId: code,
      sessionId,
      sessionNumber,
      totalSessions: STUDY.sessionsPerParticipant,
      condition,
      taskIds,
      evidence: { person: person.map((row) => row.payload as Observation), population },
    },
  };
}
