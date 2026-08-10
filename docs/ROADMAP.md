# Summer Ice — Roadmap

Plain-language status. What exists, what's next, and who does which part.

Last updated after the schema completion (`c65c193`).

---

## Part 1 — What we've actually done

### We worked out why the first two attempts failed

Both previous attempts produced long bug lists. Read together, they pointed at one thing: the application was talking to its database over HTTP, through a serverless platform, and almost every bug came from that boundary rather than from anything about ice hockey. Row limits that appeared silently. Joins that returned nothing without erroring. Headers stripped in transit. Scheduled jobs whose correctness depended on a cron firing.

The hockey logic — claiming a spot, tracking who's in, keeping a ledger — is not hard. So the new design removes the boundary rather than working around it: one server, one database on the same machine, direct SQL.

**Why this matters:** it's the reason the stack changed so dramatically. Not fashion, not new tools. Diagnosis.

### We wrote down what the system does

`docs/DOMAIN-MODEL.md`. Every entity, every state a registration or claim can be in, all the pricing, all the rules about capacity and money. Roughly twelve significant decisions settled that were previously assumptions, including several that overturned earlier plans:

- Unanswered attendance resolves to **out**, not in — with a mandatory reminder ladder that makes that fair
- Extras pay up front; goalie extras are free
- Family accounts, with no age data stored beyond a signup attestation
- Levels are self-reported and gate nothing; mismatches raise a passive flag
- Spot notifications fire when a session **changes** from full to having space, not per released spot
- Coach payables are in scope, sharing one ledger with player charges via signed amounts

One open question remains: Skills Training capacity, which needs Cas.

**Why this matters:** attempt 2 wrote eight documents about screens and components before anyone had written down what the system *does*. Four went stale within a week. This time the behaviour is settled first.

### We wrote down how it's built

`docs/ARCHITECTURE.md`. Stack, versions, repository layout, and ten invariants — rules that exist because a previous attempt broke them. Where locks go, how expiry is computed, why the webhook is the only authority on payment.

### We got your machine working

WSL2 with Ubuntu, Node 24, pnpm, git with working GitHub access, Claude Code updated from 107 versions behind, VS Code connected to Linux. Documented in `WORKFLOW.md`.

### We built the foundation

Four sessions, six commits:

| Commit | What |
|---|---|
| `53b4dbf` | Monorepo scaffold — React Router v8, worker skeleton, shared packages |
| `e3862d0` | TypeScript pinned to 6.x, ESLint with type-aware rules |
| `3ddd3e8` | Local Postgres via Docker, Drizzle wiring, first table |
| `bad3704` | Verified toolchain versions recorded |
| `6afff9f` | Identity and season structure — 13 tables |
| `c65c193` | Registration, money, attendance, notifications — 14 tables |

**What that means in plain terms:** there is a database that understands the league. It knows about people, families, roles, seasons, the ten real slots with their capacities and prices, registrations, waitlists, attendance, claims, a money ledger, payments, polls and notification preferences. Every constraint has been proven against a live database by deliberately trying to violate it.

**There is no application yet.** Nothing a person could log into. The foundations are poured; no walls.

---

## Part 2 — Where we're headed

### Phase 3 — Concurrency core ← we are here

**Plain terms:** the code that stops two people getting the same spot.

This is the single highest-risk thing in the project. In January a few hundred people will hit a quota-limited signup at once with real money. The database has to serialise them correctly or you oversell ice and Cas hears about it from forty people.

Two sessions: the core functions (hold, confirm, release, promote, claim) with tests against a real database, then a load harness firing several hundred concurrent multi-slot registrations at a twenty-capacity slot and asserting exactly twenty winners.

**Done looks like:** the load test passes. No UI, nothing to look at, but the hardest problem is behind you in August instead of January.

### Phase 4 — Accounts

Sign-in, family accounts, the three roles. **Done looks like:** you can create an account and log in.

### Phase 5 — Money and Mollie

Charges, credits, the ledger in motion, real payments, the webhook. **Done looks like:** a live test payment lands and shows up correctly in the ledger.

### Phase 6 — Registration, on the web

**The first phase with something to look at.** A player picks slots, gets held, pays, is registered. Waitlists when full.

This is also where design starts mattering — the palette and logo come off the shelf here.

**Done looks like:** you can complete a real signup start to finish.

### Phase 7 — Admin

Sessions, rosters, attendance, flags. Mobile-first, because Naomi does roster work on a phone. **Done looks like:** Cas can see who's in for Friday and act on it.

### Phase 8 — Notifications

Email and the reminder ladder. Postmark, DNS, the release deadline. **Done looks like:** a confirmation request arrives and one tap answers it.

### Phase 8.5 — Production infrastructure ⚠ currently unscheduled

The Hetzner box, Docker Compose, Caddy, WAL-archived backups with a tested restore. `ARCHITECTURE.md` had this as step 1; we deliberately deferred it because local Docker covers everything through the load test.

**It must happen before the soft launch, and it isn't scheduled.** Flagging it so it doesn't get discovered in November. Roughly a week of unglamorous work.

### Phase 9 — Soft launch, November

Web only. Real accounts, real registration, real admin. **Done looks like:** Cas and Naomi using it for something real.

### Phase 10 — Extras and claiming, before March

Drop-in claims, spot notifications, polls, cancellations and reschedules.

### Phase 11 — The app, February–March

Expo, native push. Aimed at the season, not at January signup — nobody needs an app to register once a year.

---

## Part 3 — When to stop using the chat

An honest answer, because it's a real question.

### What this chat is genuinely for

**Decisions where being wrong is expensive and hard to undo.** Whether unanswered attendance means in or out. Whether payments can reference a claim. Whether TypeScript 7 is safe. These shape everything downstream.

**Catching answers that are plausible but wrong.** This has been the recurring pattern, and it's worth being concrete. In the last five sessions:

- Claude Code invented a ten-slot schedule because the document never listed the real one
- It created a "Skills" level that no player would ever claim
- It installed TypeScript 7, which breaks linting
- It flagged that payments couldn't reference a claim — correctly, but the fix needed a decision it couldn't make

Every one of those was a gap in *my* documents, and none of them were visible from inside the codebase. That's the value: I hold the conversation history, the league's actual operation, and the reasoning behind each decision.

**Keeping the documents current.** Attempt 2 died of spec drift. Every gap Claude Code surfaces gets patched back into `DOMAIN-MODEL.md` or `ARCHITECTURE.md` the same day.

### What Claude Code is for

Everything that is writing code against a settled specification. It's better at this than any conversation can be, because it can read the actual files, run the tests, and check its own work against a real database.

### The test to apply

**If you know what should happen, go straight to Claude Code. If you'd have to decide something, come here first.**

### Realistic division by phase

| Phase | How much this chat matters |
|---|---|
| 3 — Concurrency core | **High.** Tests the domain model's hardest claims; failures may mean the model is wrong, not the code |
| 4 — Accounts | Medium. Mostly settled, but family accounts have edge cases |
| 5 — Money and Mollie | **High.** Irreversible, and Cas's real bank account |
| 6 — Registration and design | **High.** Every aesthetic decision, and the palette work hasn't started |
| 7 — Admin | Medium at first, low once the patterns are set |
| 8 — Notifications | **High** on policy — timing, escalation, what can't be switched off |
| 8.5 — Infrastructure | Low. Mechanical, and Claude Code is good at it |
| 9 — Launch | Medium. Judgement about readiness |
| 10 — Extras | Medium. Mostly specified |
| 11 — The app | Low to medium once the API is stable |

### The honest limitation

**I cannot see your repository.** Everything I know about the code comes from what you paste in. That works now because the codebase is small enough to summarise. It stops working when the code, rather than the documents, becomes the thing that needs understanding.

That's the real answer to when to leave: **when the questions stop being "what should this do?" and start being "why is this doing that?"** The first is mine. The second is Claude Code's, because it can read the file and I can't.

My guess: through Phase 6 you'll want both. After that, this chat becomes occasional — a place to bring decisions rather than a place you work.

---

## Immediate next actions

1. **Ask Cas the Skills Training capacity question** (D12) — split ice, so 20/2 doesn't apply, and at €450 a head these are the highest-value slots you sell
2. **Apply the payments fix** — the small session already written
3. **Phase 3, session one** — concurrency core functions and tests
4. **Schedule Phase 8.5** — production infrastructure has no slot in the plan and needs one

Not urgent but not forgotten: Apple Developer enrolment needs a D-U-N-S number and two to four weeks, and it belongs under Cas's KVK. Only blocks Phase 11.
