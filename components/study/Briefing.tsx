"use client";

import type { Condition } from "@/lib/study/events.ts";
import type { SessionConfig } from "@/lib/study/session.ts";

const HOW_IT_CHANGES: Record<Condition, { heading: string; body: string }> = {
  adaptable: {
    heading: "You decide how the planner looks",
    body: "Use Change view, above the courses, to switch the layout, where details open, how numbers are shown, and how you open a course. Change it whenever it helps, or not at all.",
  },
  "mixed-initiative": {
    heading: "The planner will suggest changes",
    body: "Now and then the planner will suggest a different look, marked in yellow. Take a suggestion, turn it down, or pick something else. After you answer, it will ask whether you were glad it came up.",
  },
  adaptive: {
    heading: "The planner will change on its own",
    body: "Now and then the planner will change how it looks without asking, and mark the change in yellow. Keep it if it helps. If it doesn't, undo it.",
  },
};

export function Briefing({ session, onStart }: { session: SessionConfig; onStart: () => void }) {
  const how = HOW_IT_CHANGES[session.condition];
  return (
    <main className="page">
      <div className="page-col prose">
        <h1 className="page-title">
          Session {session.sessionNumber} of {session.totalSessions}
        </h1>
        <p className="lede">
          You have {session.taskIds.length} tasks today. Each is a short brief from a student planning their term, split into a few steps.
        </p>

        <h2>{how.heading}</h2>
        <p>{how.body}</p>

        <h2>How to work through a task</h2>
        <ul>
          <li>The brief and its steps sit in the dark strip at the top of the screen.</li>
          <li>When you finish a step, click Done with this step. On the last step, add your courses to the plan and click Submit plan.</li>
          <li>If you like, tell us what matters most to you at each moment. You can skip it.</li>
          <li>There is no time limit. Work the way you normally would.</li>
        </ul>

        <button type="button" className="btn btn-primary" onClick={onStart}>
          Start the first task
        </button>
      </div>
    </main>
  );
}
