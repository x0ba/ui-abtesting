# UI A/B Testing

## Motivation

LLMs are good at generating user interfaces, but they're largely trained on static snapshots of sites. In order to make generative UI malleable interfaces that automatically change based on a user's needs without them ever having to ask, there needs to be some type of data out there that captures how an interface changes as a person works, and what interfaces people prefer in this type of environment. That doesn't exist yet.

This project builds on the pattern atlas, which is a design space of UI patterns where each pattern has dimensions and each dimension has variations. One variation in a dimension is one interface. The Atlas is essentially a spec that describes an interface. This study measures what individual people actually choose, and whether a system can learn those choices.

## Research Questions

1. In a workflow where user interfaces consistently change, what layer of them changing does the user's preferences stay the same across multiple sessions and tasks? Is the way data is displayed dependent on a particular user or on the task that a user is trying to accomplish? Do users even have individual preferences on the way data is displayed, or do they only have individual preferences on the level of control that they have over how the display of data changes?
2. Can you tell what someone wants from how they use the interface without asking them? Can behaviours like undoing a change, taking longer or shorter on a task, making mistakes and lingering on something match what people say when you ask them directly?
3. Is it faster to learn preferences by varying one singular element at a time, or by varying whole interfaces, and which one disrupts people's workflows less?
4. How much do preferences depend on the task, the person's objective, and the data rather than the person? And how long should a learned preference persist before it is no longer an accurate representation of the user?
5. Does an interface moving towards what a person chose actually help them do their tasks better, or do they only like doing tasks more?



## Design



### Unit of Preference

Preferences are tracked per set of (dimension, variation, context). Context includes:

- **Task**: the assigned or self-chosen task.
- **Sub-task**: the current phase within it, so a preference formed while comparing prices does not leak into a later, unrelated search.
- **Objective**: the person's in-the-moment goal (e.g. "compare these on price").
- **Data shape**: what is being shown (number of items, attribute types).

Each interface state at any moment is an Atlas spec, so every observation is linked to the exact spec they were using at the time.

## Repeated & comparable decisions

The same dimensions come up across different tasks within and across sections, so every participant chooses within comparable decisions many times.

### Scope

Learning a person's preference requires many observations per dimension, roughly 15 binary choices to detect a strong preference (80/20) and roughly 150 for a mild one (60/40). This study has users perform actions in one realistic app built on overview-detail and 3-6 dimensions in that design pattern.

### Conditions

This study uses three ways of changing the user's interface.

- *Adaptable (user-driven)* The chosen dimensions are left open and the person changes them whenever they want. This is the one that best shows what the user prefers in terms of interface, since they have to actively change it themselves.
- *Mixed-initiative (system proposes)* The app suggests one or more variations to the interface, and the user accepts, rejects, or adjusts.
- *Adtaptive (system-driven)* The system changes a variation without asking, and the user can either keep it or revert it to the previous one. This one is the least clean signal, since reverting it could most likely be a reaction to disruption rather than preferring one variation over another.

Changes to the interface are made at three granularities:

- A single component
- A whole interface
- A mix

Whole-interface changes use an L9 array so we can still estimate the contriobution of each individual change.

### Sessions & Tasks

The user completes 4 sessions; one for each of the ways the interface changes (see above). Each session is comprised of 3 tasks, each of which is divided into subtasks. The interface changes after the user marks each subtask as finished. 

Each task is an actual workflow that someone would complete in real life, since people just browsing around without a goal is hard to interpret. Tasks deliberately move between different kinds of subtasks, so we can see whether a preference carries over when the context changes. Spreading the study over multiple sessions lets us tell a lasting preference apart from something the user only liked because it was new, or disliked because it was a change. The order variations appear in is counterbalanced across participants.

## Measures


| Kind              | Examples                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit choice   | Changing an open dimension, accepting or rejecting a proposal or an automatic change                                                                      |
| Affect            | Whether the user was glad or annoyed that a proposal showed up, separate from whether they acted on it                                                    |
| Implicit behavior | Reverts, how long until a revert, lingering, scrolling, hovering, navigating                                                                              |
| Performance       | How long a task takes, mistakes, whether the task was done correctly, before and after a change                                                           |
| Subjective        | "Which interface was better for this?" against the default, a short questionnaire after each session (SUS, NASA-TLX), an interview and ranking at the end |


Preference and performance are recorded separately because they often disagree. People sometimes prefer the interface they're slower on.

## Preference Model

Each (dimension, variation, context) has a Beta distribution over how likely the user is to keep it. This tracks both the guess and how sure we are about it.

The model is hierarchical. An estimate across all participants is the starting point for each person, and their own choices move them away from it. This gives us both the overall dataset and the per-participant datasets from one model, and means a new participant starts with a reasonable guess instead of nothing. When the system is the one proposing or making changes, it picks the next variation with Thompson sampling, which balances trying new variations against showing what the user probably likes.

**Context and decay.** A choice only counts for the context it was made in, and older choices count for less over time. Evidence from one subtask only counts toward another as far as the model learns that the two are related. Without this, a preference picked up while comparing prices would bleed into an unrelated search.

**Two levels.** Above the per-dimension estimates sits a small set of plain-language statements about the user (e.g. "prefers dense layouts when comparing options"), each with a confidence. The statements set the starting point in a context the user hasn't seen yet, and the per-dimension estimates handle decisions within a context.

**Analysis.** For each family of dimensions, a mixed-effects model splits how much of the variation in choices comes from the person, the task and the objective. This is the direct answer to the first research question.

**What counts as success.** On choices the model hasn't seen, the per-person model predicts better (lower Brier score) than:

- the model across all participants,
- the plain-language statements alone,
- a fixed set of rules that persist across tasks.

Behaviors that line up with lingering or reverting but don't predict what people actually choose are reported as such.

## Data Capture

Everything meaningful the user does is recorded, so the data is still useful even if the model above doesn't work out. Every event carries the spec and context that were active at the time, so any session can be replayed. Proposals record every option the user was shown, not just the one they picked, so we can tell what the user prefers apart from what the system happened to offer.

```ts
type StudyEvent = {
  participantId: string;
  sessionId: string;
  seq: number; // per-session, gapless; used to detect lost events
  t: number; // performance.now(), anchored to a per-session wall-clock start
  condition: "adaptable" | "mixed-initiative" | "adaptive";
  context: {
    taskId: string | null;
    subtaskId: string | null;
    objective: string | null; // stated or inferred
    objectiveSource: "stated" | "inferred" | null;
  };
  specVersion: number; // increments on every spec change
  type: string; // e.g. "spec.change", "proposal.shown", "proposal.respond", "task.complete", "pointer.click"
  payload: Record<string, unknown>;
  // spec.change:      { before, after, initiator }
  // proposal.shown:   { proposalId, dimension, offered: variation[], order: number[], presentation }
  // proposal.respond: { proposalId, response: "accept" | "reject" | "adjust" | "ignore", chosen, affect: "glad" | "neutral" | "annoyed" | null }
};
```

How events get stored:

1. Events are queued in IndexedDB in the browser.
2. Batches are sent to a Next.js route on the same domain, so ad blockers are unlikely to get in the way. `sendBeacon` sends whatever is left when the page closes. Sending the same batch twice is harmless, since events are keyed by `(sessionId, seq)`.
3. Events are stored in Postgres and never changed or deleted. Analysis happens offline.

Sentry isn't used for study data. It's built for error monitoring and is allowed to sample and drop events, which a research dataset can't afford.

## The App

The app is a course planner for a made-up college (Halden College), built on overview-detail. Participants get short requests from students (e.g. "keep Mondays, Wednesdays and Fridays free"), split into steps, and work through them across sessions.

It uses five dimensions from four Atlas families:


| Dimension                                   | Family     | Variations                                            |
| ------------------------------------------- | ---------- | ----------------------------------------------------- |
| Course layout (`overviewType`)              | Layout     | List, Grid, Table                                     |
| Course details (`openIn`)                   | Layout     | Side-by-side, Pop-up, In-place                        |
| Ratings, workload and seats (`abstraction`) | Content    | Number, Graphic, Category                             |
| Opening a course (`openBy`/`openFrom`)      | Invocation | Click whole item, Click title, Hover                  |
| Suggestions (`proactivity`)                 | Initiative | Always-visible hint, Suggested when stuck, On request |


A few specifics:

- Each session has one task per subject area (humanities, sciences, social sciences). Each task has three to four steps of different kinds: narrowing down, comparing, inspecting and deciding. The step kind is what the preference model uses as context.
- The order of the three conditions is counterbalanced over six orders, based on when the participant enrolled.
- Whole-interface changes come from an L9 array over the four interface dimensions.
- Participants can optionally say what matters most to them at each step, which becomes the objective.
- Affect is asked after a proposal is answered, so it's recorded as its own `proposal.affect` event, and `proposal.respond` has `affect: null`.
- Every observation the model learns from is logged as `preference.observe`, so the learning can be checked and replayed.

Study settings (number of sessions, granularity mix, decay, how strong the starting estimate is) live in `lib/study/config.ts`. Tasks live in `lib/study/tasks.ts`, and `pnpm tasks:check` lists the correct answers for each one.

### Running It

You need Node 24 and Postgres. The database schema is in `db/schema.ts` (Drizzle).

```bash
pnpm install
echo 'DATABASE_URL=postgres://user@localhost:5432/study' > .env.local
pnpm db:migrate
pnpm dev
```

- `pnpm db:generate` writes a migration after you change the schema.
- `pnpm db:studio` opens Drizzle Studio against `DATABASE_URL`.

If the database already has these tables, they're left alone: the first migration is marked as applied and only newer ones run. Participants enter the code from their invitation, and a new code is enrolled the first time it's used, after consent. The `events` table can't be updated or deleted from (a trigger blocks it).

