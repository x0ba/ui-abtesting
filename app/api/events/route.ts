import { inArray, sql } from "drizzle-orm";
import { events as eventsTable, sessions } from "@/db/schema.ts";
import { db } from "@/lib/server/db.ts";
import { eventBatchSchema } from "@/lib/study/events.ts";

// Accepts JSON batches from fetch and text/plain bodies from navigator.sendBeacon.
// Inserts are idempotent on (session_id, seq), so clients may resend freely.
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = JSON.parse(await request.text());
  } catch {
    return Response.json({ error: "Body is not JSON." }, { status: 400 });
  }
  const parsed = eventBatchSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: parsed.error.issues.slice(0, 5) }, { status: 400 });

  const { events } = parsed.data;
  const database = db();

  const sessionIds = [...new Set(events.map((e) => e.sessionId))];
  const owners = await database
    .select({ id: sessions.id, participantId: sessions.participantId })
    .from(sessions)
    .where(inArray(sessions.id, sessionIds));
  const ownerOf = new Map(owners.map((o) => [o.id, o.participantId]));
  if (events.some((e) => ownerOf.get(e.sessionId) !== e.participantId)) {
    return Response.json({ error: "Events reference an unknown session or the wrong participant." }, { status: 409 });
  }

  const rows = events.map((e) => ({
    sessionId: e.sessionId,
    seq: e.seq,
    participantId: e.participantId,
    t: e.t,
    condition: e.condition,
    taskId: e.context.taskId,
    subtaskId: e.context.subtaskId,
    objective: e.context.objective,
    objectiveSource: e.context.objectiveSource,
    specVersion: e.specVersion,
    type: e.type,
    payload: e.payload,
  }));

  await database.transaction(async (tx) => {
    await tx.insert(eventsTable).values(rows).onConflictDoNothing({ target: [eventsTable.sessionId, eventsTable.seq] });
    const ended = events.filter((e) => e.type === "session.end").map((e) => e.sessionId);
    if (ended.length > 0) {
      await tx
        .update(sessions)
        .set({ endedAt: sql`coalesce(${sessions.endedAt}, now())` })
        .where(inArray(sessions.id, ended));
    }
  });

  return Response.json({ stored: events.map((e) => [e.sessionId, e.seq]) });
}
