# Summer Ice — Documentation index

What each document is for, when to read it, and which one wins if two of them
seem to disagree.

| Doc | For | Read when | Wins on |
|---|---|---|---|
| **[STATE.md](STATE.md)** | Current factual state — what's built, what's deployed, what's proven | First, every session | Facts about *now*. If it disagrees with your assumption, trust it and go verify |
| **[CONTEXT.md](CONTEXT.md)** | The people, the league's actual operation, constraints, and the history of wrong turns | When a decision needs judgement rather than a spec lookup | Nothing structural — it's the *why* behind the other docs |
| **[DOMAIN-MODEL.md](DOMAIN-MODEL.md)** | What the system does — entities, state machines, rules | Before changing behaviour | **Behaviour.** If a route's shape and a data rule disagree, this wins |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | How it's built and deployed — stack, invariants, infrastructure | Before changing structure | **Structure.** Where code lives, what talks to what |
| **[SCREENS.md](SCREENS.md)** | The page inventory and build waves | When building or reordering UI | Nothing — it's a plan, not a spec; DOMAIN-MODEL and ARCHITECTURE both outrank it |
| **[DECISIONS.md](DECISIONS.md)** | Append-only log of decisions and rationale | When you need to know *why* something was chosen, or before reversing it | Nothing — it's a record, not a source of current truth. If DECISIONS.md and DOMAIN-MODEL.md disagree, DOMAIN-MODEL.md is current and DECISIONS.md just explains how it got there |
| **[ROADMAP.md](ROADMAP.md)** | Phases and sequencing | Loosely, for direction | **Currently STALE** — see below |
| WORKFLOW.md | Local environment setup: WSL, VS Code, terminal habits | Never, by an agent | **FOR THE HUMAN ONLY.** Agent sessions must not read it — it's wasted context, nothing in it is behaviour or structure |

## On ROADMAP.md being stale

It still describes a self-hosted infrastructure phase (Hetzner box, Docker
Compose, pg-boss) that no longer exists — see `DECISIONS.md` for when and why
that plan was reversed — and it says "Phase 3, we are here" for the
concurrency core when the actual state (`STATE.md`) shows schema, wave-1 UI,
the Next.js port, and Supabase/Vercel wiring all already done, with the
concurrency core and its load test still **not** built. Treat its phase
numbers and "we are here" marker as aspirational history, not current
sequencing — `STATE.md`'s "Not built yet" section is the current answer to
"what's next."

## Reading order for a fresh session

1. `STATE.md` — what's actually true right now
2. `CONTEXT.md` — why, if a decision needs judgement
3. `DOMAIN-MODEL.md` — behaviour
4. `ARCHITECTURE.md` — structure

Not `WORKFLOW.md`, not by an agent, ever. See `CLAUDE.md` for the full session
ritual this reading order belongs to.
