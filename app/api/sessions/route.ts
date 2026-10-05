import { z } from "zod";
import { startSession } from "@/lib/server/sessions.ts";
import { PARTICIPANT_CODE, normalizeCode } from "@/lib/study/session.ts";

const body = z.object({
  code: z.string().transform(normalizeCode).pipe(z.string().regex(PARTICIPANT_CODE)),
  consent: z.boolean().default(false),
});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Enter the participant code from your invitation: letters, numbers or dashes." }, { status: 400 });
  }
  return Response.json(await startSession(parsed.data.code, parsed.data.consent));
}
