# ui-abtesting

A study of how individual people want interfaces to change, and a dataset of those changes over time.

## Motivation

LLMs are good at generating interfaces, but they are trained on static snapshots of sites. Interaction traces exist (e.g. Rico), and there is a long line of adaptive-UI research, but there is no public dataset that ties what a person did to the specification of the interface they were looking at, as that specification changed. Without that, a model can generate an interface but has nothing to learn from about how that screen should evolve for the person using it.

This project builds on the [Pattern Atlas](./Pattern%20Atlas%20%281%29.html), which is a design space of UI patterns, where each pattern has dimensions and each dimension has variations. One variation per dimension is one interface, and any dimension left open becomes a customization the user can change. The Atlas describes what an interface *could* be. This study measures what individual people actually choose, and whether a system can learn those choices.

Recent generative-UI work suggests this is harder than it sounds. [Elicitive User Interfaces](https://arxiv.org/abs/2609.23642) looked for UI-level preferences that carried across sessions and found little evidence of them, partly because each session produced a different interface, so a participant almost never faced the same decision twice (85% of choices had no comparable counterpart). [Maru](https://arxiv.org/abs/2608.25565) found that preferences learned from interaction kept interfaces aligned within a session, but did not transfer across tasks. Both point to the same missing piece: a controlled study where the same, well-defined decisions recur across tasks and sessions. A fixed design space like the Atlas makes that possible.

## Research questions

1. **Where do stable preferences live?** At what level of the design space are individual preferences stable across sessions and tasks? Hypothesis: dimensions about *how a person wants to be involved* (the Atlas's Initiative, Feedback and Invocation families) are stable per person, while Content, Composition and Layout depend mostly on the task and the person's current objective. If a population default predicts choices as well as a per-person model for a family, personalization is not worth it there.
2. **Can implicit behavior stand in for explicit choice?** Which interaction signals (reverts, task time, errors, dwell) predict what people choose when asked directly? Acting on a proposal and being glad it appeared are treated as separate outcomes, since people value proposals they never act on.
3. **Granular vs. holistic adaptation.** Is it faster to learn preferences one dimension at a time or by varying whole interfaces, and which disrupts people less?
4. **Context and persistence.** How much do preferences depend on the task, the sub-task, the person's current objective, and the data, rather than the person? (A bar chart is better for comparing values, a pie chart arguably for part-to-whole, so "prefers bar charts" may really be "was comparing values".) And how long should a learned preference persist before it goes stale?
5. **Does adaptation help?** When an interface moves toward what a person chose, do they do their tasks better, or only like it more?



## Design



### Unit of preference

Preferences are tracked per **(dimension, variation, context)**, not per pattern. Context is:

- **Task**: the assigned or self-chosen task.
- **Sub-task**: the current phase within it, so a preference formed while comparing prices does not leak into a later, unrelated search.
- **Objective**: the person's in-the-moment goal (e.g. "compare these on price"), either stated or inferred from behavior as in [Just-In-Time Objectives](https://arxiv.org/abs/2510.14591).
- **Data shape**: what is being shown (number of items, attribute types).

The interface state at any moment is an Atlas spec, so every observation is attached to the exact spec the person was using.

### Repeated, comparable decisions

The central design constraint. The same dimensions come up again across different tasks and datasets, both within and across sessions, so every participant faces comparable decisions many times. This is what lets the study separate person, task and objective effects, and it is the gap the Elicitive UIs study could not close.

### Scope

The Atlas has ~600 dimensions and ~2,900 variations. Learning a preference per person needs many observations per dimension: roughly 15 binary choices to detect a strong preference (80/20) and roughly 150 for a mild one (60/40). So the study uses **one realistic app built on overview–detail** (the only fully coded pattern) and **3–6 dimensions**, chosen from the Atlas Findings where customization potential is high but real apps rarely offer it. The dimensions span at least two families, including one Initiative dimension (how the system proposes changes, e.g. a quiet hint vs. an explicit question), so the hypothesis in RQ1 can be tested.

### Conditions

How a change happens matters as much as what changes, so the study separates three ways of changing the interface:

- **Adaptable (user-driven).** The chosen dimensions are left open and the person changes them whenever they like. This is the cleanest signal and the one closest to the Atlas's idea of malleability.
- **Mixed-initiative (system proposes).** The system suggests one or more variations; the person accepts, rejects, or adjusts. Each response is a labeled example. People mostly pick from what they are shown (79% of preference actions in the Elicitive UIs study), so which alternatives are offered, and in what order, is randomized and logged.
- **Adaptive (system-driven).** The system swaps a variation without asking, and we observe whether the person keeps it or reverts. This is the noisiest signal, because reverting is often a reaction to the disruption rather than to the variation.

Changes are made at three granularities: a single dimension, a whole interface, and a mix. Whole-interface changes use a fractional factorial design (as in conjoint analysis), so the contribution of each dimension can still be estimated from holistic swaps.

### Tasks and sessions

Participants do realistic tasks with real goals in the app; free browsing produces behavior that is hard to interpret. Tasks include sub-task transitions on purpose, so persistence across context shifts can be measured. The study runs over **multiple sessions** (target: one week, several sessions) so it can measure test–retest stability and separate lasting preference from novelty and from the short-term cost of change. The order in which variations appear is counterbalanced across participants.

## Measures


| Kind              | Examples                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit choice   | Open-dimension changes, accept/reject of proposals, accept/reject after every interface change                                                            |
| Affect            | Whether the person was glad or annoyed that a proposal appeared, recorded separately from acting on it                                                    |
| Implicit behavior | Reverts, time to revert, dwell, scroll, hover, navigation                                                                                                 |
| Performance       | Task completion time, errors, task success, before and after adaptation                                                                                   |
| Subjective        | Pairwise "which interface was better for this?" against the default, short post-session questionnaire (SUS, NASA-TLX), end-of-study interview and ranking |


Preference and performance are recorded separately because they often disagree: people sometimes prefer the interface they are slower on.

## Preference model

Each (dimension, variation, context) has a Beta distribution over "how likely this person is to keep it", which tracks both the estimate and how certain we are about it. Pairwise comparisons can also be modeled with Bradley–Terry.

The model is **hierarchical**: a population-level estimate serves as the prior for each person, and their own observations move them away from it. This yields the "master" dataset and the per-participant datasets from one model, and gives new participants a sensible starting point. In the adaptive and mixed-initiative conditions, the next variation to show is chosen with Thompson sampling, which balances trying new variations against showing what the person likely prefers.

**Scoping and decay.** Evidence is weighted by recency and only applies within its context. In Maru, rules that leaked across sub-tasks or piled up without pruning made alignment worse. Older observations are down-weighted (e.g. by e^{-\alpha \cdot \text{age}}, as in [GUM](https://arxiv.org/abs/2505.10831)), and evidence from one sub-task is shared with another only as far as the model learns that they are related.

**Two levels.** Maru found that only general preferences survived across tasks ("a general sense of what the user cared about"). So above the per-dimension estimates sits a small set of natural-language statements about the person (e.g. "prefers dense layouts when comparing options"), each with a confidence, in the style of GUM. The statements set the priors for new contexts, and per-dimension estimates handle decisions within a context.

**Analysis.** Variance in choices is split between person, task and objective with a mixed-effects model (crossed random effects), per dimension family. This is the direct test of RQ1.

**Success criterion:** on held-out choices, the per-person model predicts better (lower Brier score) than:

- the population model (the comparison where Elicitive UIs found no difference for whether people acted on a proposal),
- GUM-style statements alone,
- Maru-style persistent rules.

Signals that only correlate with dwell or reverts but do not predict explicit choice are reported as such.

## Data capture

All meaningful interaction is captured, so the data stays useful if the model above does not pan out. Every event carries the spec and context that were active when it happened, so any trajectory can be replayed. Proposals record every alternative shown, not only the one chosen, so preferences can be separated from what the system happened to offer:

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

Pipeline:

1. Events are queued in IndexedDB in the browser.
2. Batches are POSTed to a first-party Next.js route handler (same domain, so ad blockers are unlikely to interfere), with `sendBeacon` on `pagehide`. Batches are idempotent by `(sessionId, seq)`.
3. Events are stored append-only in Postgres. Analysis happens offline in notebooks; a dashboard (e.g. Grafana) can sit on top for monitoring, but it is not the store.

Optional: `rrweb` session replay for qualitative review of selected sessions.

Sentry is not used for study data. It is built for error monitoring and is allowed to sample and drop events, which a research dataset cannot tolerate.

## Open questions

- Which 3–6 Atlas dimensions to study first, and which families they come from.
- Within- vs. between-subjects for the three conditions (within gives more data per person but risks carryover).
- Lab sessions vs. a field deployment for the multi-session phase.
- Whether to infer the objective (as in Just-In-Time Objectives) or ask for it, and how often.
- How strongly to decay old evidence, and how to detect a sub-task boundary.



## The app

A course planner for a made-up college (Halden College), built on overview–detail. Participants get short briefs from students ("keep Mondays, Wednesdays and Fridays free") split into steps, and work through them across sessions.

Five dimensions, from four Atlas families:


| Dimension                                   | Family     | Variations                                            |
| ------------------------------------------- | ---------- | ----------------------------------------------------- |
| Course layout (`overviewType`)              | Layout     | List, Grid, Table                                     |
| Course details (`openIn`)                   | Layout     | Side-by-side, Pop-up, In-place                        |
| Ratings, workload and seats (`abstraction`) | Content    | Number, Graphic, Category                             |
| Opening a course (`openBy`/`openFrom`)      | Invocation | Click whole item, Click title, Hover                  |
| Suggestions (`proactivity`)                 | Initiative | Always-visible hint, Suggested when stuck, On request |


How these choices are made:

- Each session has one task per dataset (humanities, sciences, social sciences), with three to four steps of different kinds (narrow, compare, inspect, decide). The step kind is the context key for the preference model.
- Conditions are within-subjects and counterbalanced over six orders by enrollment.
- Whole-interface changes come from an L9 orthogonal array over the four interface dimensions.
- The objective is stated: participants can pick what matters most at each step. It is optional.
- Affect is asked after a proposal is answered, so it is recorded as its own `proposal.affect` event, and `proposal.respond` carries `affect: null`.
- Every derived observation the model learns from is logged as `preference.observe`, so the learning signal can be audited and replayed.

Study parameters (sessions, granularity mix, decay, prior strength) live in `lib/study/config.ts`. Tasks live in `lib/study/tasks.ts`, and `pnpm tasks:check` lists the valid answers for each one.

### Running it

Needs Node 24 and Postgres. The schema is Drizzle, in `db/schema.ts`.

```bash
pnpm install
echo 'DATABASE_URL=postgres://user@localhost:5432/study' > .env.local
pnpm db:migrate
pnpm dev
```

`pnpm db:generate` writes a migration after a schema change. A database that already has these tables is left in place: the init migration is recorded as applied, and only later migrations run. Participants enter the code from their invitation; a new code is enrolled on first use after consent. The `events` table is append-only (a trigger blocks updates and deletes).

## Related work

Generative UI and user modeling:

- Kim, Min, Xia & Kim, *[Elicitive User Interfaces: Designing How Users Shape Generative Interfaces](https://arxiv.org/abs/2609.23642)* (2026). UI-level preferences did not carry across sessions; preferences about how to be asked were more consistent. Calls for controlled studies of UI preferences.
- Kim, Choi, Min, Yi, Jiang & Kim, *[Maru: Information Architecture as a Shared Language for Generating Aligned and Persistent User Interfaces](https://arxiv.org/abs/2608.25565)* (2026). Persisting structure learned from interaction kept interfaces aligned within a session; failed across sub-tasks and when rules accumulated; did not transfer across tasks.
- Shaikh et al., *[Creating General User Models from Computer Use](https://arxiv.org/abs/2505.10831)* (2025). Confidence-weighted natural-language statements about a user, learned from observation, with decay and revision.
- Lam et al., *[Just-In-Time Objectives: A General Approach for Specialized AI Interactions](https://doi.org/10.1145/3772318.3790713)* (CHI 2026). Infers a person's in-the-moment objective from behavior and optimizes generation for it.
- The CHI '25 overview–detail work and Meridian, which the Pattern Atlas builds on.

Adaptive interfaces and preference elicitation:

- Gajos & Weld, *Preference Elicitation for Interface Optimization* (UIST 2005): learning interface preferences from pairwise user choices.
- Findlater & McGrenere, *A Comparison of Static, Adaptive, and Adaptable Menus* (CHI 2004).
- Gajos et al., *Predictability and Accuracy in Adaptive User Interfaces* (CHI 2008).
- Lavie & Meyer, *Benefits and Costs of Adaptive User Interfaces* (IJHCS 2010).
- Todi et al., *Adapting User Interfaces with Model-based Reinforcement Learning* (CHI 2021).

Data and perception:

- Deka et al., *Rico: A Mobile App Dataset for Building Data-Driven Design Applications* (UIST 2017).
- Cleveland & McGill, *Graphical Perception* (JASA 1984).

