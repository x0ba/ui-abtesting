import type { Condition } from "./events.ts";
import type { Evidence } from "./model.ts";

export type SessionConfig = {
  participantId: string;
  sessionId: string;
  sessionNumber: number; // which scheduled session this is, starting at 1
  totalSessions: number;
  condition: Condition;
  taskIds: string[];
  evidence: Evidence;
};

export type StartResponse =
  | { status: "consent" }
  | { status: "finished"; totalSessions: number }
  | { status: "ready"; session: SessionConfig };

export const PARTICIPANT_CODE = /^[A-Z0-9-]{3,32}$/;

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}
