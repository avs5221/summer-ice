# Summer Ice — Context

**What this document is for.** `DOMAIN-MODEL.md` says what the system does. `ARCHITECTURE.md` says how it's built. This says *why*, and describes the people and constraints that generated those decisions.

It exists so that design conversations can happen inside Claude Code with the repository as the only source of truth, rather than depending on a separate chat that holds context nobody else can see.

Read this when a decision needs judgement rather than a spec lookup.

---

## 1. The people

### Cas Neuman — owner and operator

Runs Summer Ice under his own registered KVK. This is a real business trading under his own name in a community of roughly 350 people who mostly know him personally. That matters for product decisions: reputational cost is high and personal, and anything that looks manipulative or careless costs more than it could earn.

**Checks the admin panel multiple times a day.** His priorities, in his own order:

1. Fill rates and league health overview
2. Who's in and out for upcoming sessions
3. Confirmation status
4. Reacting to drops
5. Sending announcements

He has a long-standing relationship with IJshal De Vliet in Leiden and handles rink compliance himself — treat rink rules as out of scope.

Wants a ledger of transactions he can hand to an accountant or import into his own software. Nothing more elaborate. Do not build accounting software.

He does not receive admin alert emails today; alerting has historically gone only to Michael, which is a single point of failure during the week that matters most.

### Naomi — scheduling helper

Does **heavy roster work, on a phone.** That's why the admin roster surface is mobile-first rather than desktop-first — it's not a nice-to-have.

Sees names, contact details, attendance, claims, waitlists, polls. Sees **nothing financial**, including coach rates and payables.

Historically she arbitrated extras disputes and manually decremented slot counts as WhatsApp poll replies came in. Her personal knowledge of who people are was the de facto filter on who turned up — which is why unknown claimers now raise a passive flag rather than being blocked.

### Michael — technical lead

Solo developer. Works through Claude Code in VS Code on WSL2. Not the account owner; the Apple Developer account and payment accounts belong under Cas's KVK.

Working conventions that exist for good reasons:

- **One task per Claude Code session, `/clear` between them.** Long sessions drift off-spec.
- **Specs before code.** Design decisions get settled and written down before any implementation prompt is written. Violating this caused repeated rework in previous attempts.
- **Plan mode for anything structural.** Reading a plan catches a wrong approach for free.
- Never run `tsc` on individual files; always project-wide.

### Coaches

Split into `paid` (trainers, who run sessions) and `free` (shooters, typically for goalie training). Coordinated by WhatsApp poll today. They confirm their own attendance — the one place attendance is recorded rather than presumed, because money depends on it.

---

## 2. What the platform replaces

Everything currently runs on WhatsApp and a Jotform.

- Season signup was a Jotform with a quota. The website was updated **manually**, so a player could see a slot as available and land on a locked form. That specific bug is the reason the project exists.
- Extras were coordinated in per-session WhatsApp channels. The claiming protocol was: copy the list, add your name, repost it. That's a hand-operated mutex — two simultaneous reposts silently lose a name.
- Naomi manually updated available counts from poll replies.
- Extras were invoiced by Tikkie *after* the skate, tracked in Excel.
- Reserves were notified 24 hours before a session.

**Public WhatsApp channels are being retired.** WhatsApp survives only as Cas's own announcement broadcast and DMs — not as a platform channel.

Something is lost in that: the extras chat was also where people saw *who else was skating*. That social visibility is why players can see rosters (first name plus surname initial), and why live fill counts are a product feature rather than an engineering nicety.

### The extras rules were well designed

They came from the community and should be preserved as mechanics rather than replaced:

- First hour after a spot opens: own name only, plus one partner or child
- After an hour: open claiming
- Late drop or no-show: still liable unless someone takes the spot
- *"Any case not covered here will be decided by Naomi or myself"* — **admin override is a first-class feature, not an escape hatch.** Every automated charge, release and claim must be manually reversible with a note.

---

## 3. Economics and incentives

| Fact | Value |
|---|---|
| Season, per slot | €300 skater, €150 goalie |
| Skills Training, per slot | €450 both positions |
| Extras, per skate | €15 skater, free goalie |
| Effective season rate | €13.64 per skate over 22 weeks |

**Early declines are revenue-positive.** A full-timer who declines isn't refunded, and an extra pays €15 for the freed spot. The league is paid twice for that ice. So making it easy and consequence-free to withdraw weeks ahead is the *profitable* path, not a concession — which is why withdrawal windows can be generous without argument.

**Goalie pricing is deliberately not cost-recovery.** Goalies are scarce and essential; the pricing exists to recruit and retain them. A session with one goalie is worse than one twelve skaters short.

**Demand exceeds supply.** Popular slots fill fast when signup opens, and players routinely register for several slots. Missing out means becoming an extra — so the season waitlist is the on-ramp to week-to-week claiming, not a dead end.

**There is no accountability for who actually showed up.** Nobody is at the rink recording attendance. It's an honour system. This is why there is no check-in flow, and why paying up front matters: it makes the no-show rule self-enforcing without anyone policing it.

---

## 4. Constraints

**Budget: ~€50/month was a guess, not a hard limit.** Current plan runs ~€40/month equivalent including Apple's €99/year. Michael raised the figure himself and it was never validated against anything. If a decision genuinely needs more, ask — don't contort the design around it.

Money is best spent on **email deliverability** (Postmark over a cheaper option) because the entire product mechanic is "email arrives, player taps, spot fills." A message in spam is an empty slot.

**Timeline:**

| When | What |
|---|---|
| November 2026 | Soft launch, web only, "as close to live as possible" |
| December | New ice times expected from the rink |
| ~January | Registration opens — the highest-risk event in the year |
| February–March | Native app ships |
| Late March | Season starts |

**The January rush is the thing to be afraid of.** A few hundred people, real money, quota-limited, in a few days. Everything about the concurrency design exists for that week.

**Nothing about the season is stable year to year.** Slot count, days, times, levels, capacities and prices all change with what the rink offers. It is all per-season data. No enums in code for levels, no hardcoded 20/2.

**A native app is a firm requirement**, not a preference. It's why the server's real product is a JSON API and why a shared TypeScript core exists. It also rules out otherwise-good options — SvelteKit and Rails were both seriously considered and rejected solely because they can't share a core with Expo.

---

## 5. History — two failed attempts

**Attempt 1** (Next.js + Supabase + Vercel) grew organically until Claude Code could no longer iterate on it. Its visual design was well liked — dark navy backgrounds, 4px coloured left-border status stripes on cards, traffic-light status colours. Worth referencing if the code is still reachable; the repo was renamed and archived rather than deleted.

**Attempt 2** was a rebuild on the same stack. It stalled in Phase 2 of 5. Its specific failure is instructive: **eight specification documents were written about screens and components before anyone wrote down what the system does.** Four of the eight went stale within a week, because they specified the surface of a system whose behaviour was still moving.

### Why the stack changed so radically

Both attempts produced long bug lists. Read together they pointed at one cause:

- PostgREST silently capping results at 1,000 rows regardless of the requested limit
- Queries failing silently because the join path didn't contain the column being filtered on
- The users table primary key diverging from the auth provider's UID
- Realtime failing on row-level security until replaced by a public broadcast channel
- The hosting platform stripping the `Authorization` header from database-initiated HTTP calls
- Build caching inlining stale environment variable values
- Six cron jobs split across two systems, with correctness depending on a sweeper firing

**Not one is about ice hockey.** Every one is an artifact of an HTTP boundary between the application and its database. The domain logic is genuinely simple. The current architecture removes the boundary rather than working around it.

Note that the result is *more* conservative than what it replaced. Dropped: PostgREST, RLS, hosted auth, hosted realtime, edge functions, two cron systems, a build pipeline, React Server Components. Added: a job queue. Component count went down.

### Correction — the stack changed a second time, back to Supabase and Vercel

Worth recording honestly, because it's a repeat of exactly the pattern §6 warns about: a confident wrong answer, corrected once the actual cause was separated from the platform it happened to run on.

The self-hosted rebuild above (Hetzner box, Docker Compose, pg-boss, hand-rolled auth, `LISTEN`/`NOTIFY` over SSE) was a **misreading of the bug list**. Every item in it was real, but the diagnosis — "an HTTP boundary between the application and its database" — was broader than the evidence supported. Re-read individually, the bugs are specific to two things: **PostgREST** (the row cap, the silent join failures, the users-table UID mismatch — all consequences of going through an auto-generated REST layer instead of a real query builder) and **RLS** (the Realtime authorization failure, and the general cost of writing and debugging policies for behaviour a server-side authorization check would have handled directly). Neither Supabase-the-platform nor Vercel-the-platform caused any of it. Dropping PostgREST and RLS would have fixed the bug list. Dropping the platform too was solving a problem that wasn't there, at the cost of a Linux box, Docker Compose, pgBackRest, WAL archiving and a job queue that a solo developer now had to operate personally, in addition to writing the actual application — over-engineering for someone on a deadline, dressed up as risk reduction.

The correction: **Supabase Postgres and Vercel, Drizzle instead of PostgREST for all data access, no RLS on application data — every access path is server-side and checks authorization in code.** Supabase Auth is used behind the existing `credentials` table design rather than replaced by hand-rolled auth, because that design already anticipated a pluggable auth provider (see §1, "any dependent may eventually want their own login" — promotion via `credentials` insert, never a migration). Realtime is used, but only ever the public-broadcast-from-trigger shape the first attempt eventually converged on anyway — never `postgres_changes`, never RLS-gated `realtime.messages`. See `ARCHITECTURE.md` for the resulting shape and its own "Rejected, with reasons" entry for the self-hosted plan.

The meta-lesson repeats §6's own: check a proposal against what actually happened before generalising from it. "The platform caused our bugs" and "PostgREST and RLS caused our bugs" are different claims, and only the second one was true.

---

## 6. Corrections worth not repeating

Recorded because each was a confident wrong answer, and the pattern matters more than the individual errors.

| Wrong belief | Reality |
|---|---|
| Extras should move to accrue-and-settle | They were *already* post-paid via Tikkie. The genuine need is a hold on **season registration**, which is quota-limited and paid up front |
| Pay-up-front deters flaking | Refund-if-in-time is incentive-identical to pay-later. What it actually buys is collection certainty — no Tikkie chasing |
| Store a birth date, or a birth year | Age is self-reported either way, so it buys no verification. Only the signup attestation is needed; nothing else in the model branches on age |
| Level should be admin-controlled to stop smurfing | Self-reported with passive flags. An under-declaring player succeeds until a human notices, and that is the accepted cost of not gating registration |
| Rank suggestions by available capacity | Sorting by capacity makes the list **shift while a player reads it** during the rush. Stable schedule order, nothing hidden |
| Notify per released spot, with banded fan-out | Notify per **availability transition**. Three simultaneous declines are one event, not three |
| Nothing in this app is cacheable | Exactly one thing is — the public schedule page. Its fill counts must never be baked into cached HTML |
| Defer goalies and coach data to simplify v1 | Both were shortcuts that caused headaches previously. Build position-awareness properly from the start |

**The meta-lesson:** the recurring error was optimising something before understanding how the league actually operates. When a proposal seems obviously right, check it against §2 and §3 first.

---

## 7. Still unresolved, outside the code

| Item | Owner | Notes |
|---|---|---|
| Skills Training capacity (D12) | Cas | Split ice, so 20/2 doesn't apply. €450/head makes these the highest-value slots sold |
| Apple Developer enrolment | Cas | Organisation account needs a D-U-N-S number; 2–4 weeks. Belongs under the KVK, not Michael's name. Blocks the app only |
| Existing DMARC record on summerice.nl | Michael | An unaligned `p=reject` at Postmark switchover means mail disappears rather than degrades |
| App Review and in-app purchase | Michael | Selling ice time should sit outside IAP as a real-world service, but review is inconsistent enough to confirm early |
| Production infrastructure scheduling | Michael | Deferred deliberately in favour of local Docker; must exist before the November launch and currently has no slot |
| Yellow versus amber status collision | design | Brand yellow `#FFDD05` is too close to the old amber status `#EF9F27`. Brand keeps yellow; the unconfirmed state moves |
| Old paid infrastructure | Michael | Vercel and Supabase from the retired attempts may still be billing |

---

## 8. Aesthetics

Brand is three colours, sampled from the logo: blue `#5CC8FF` (61% of the logo), yellow `#FFDD05` (18%), black `#000000` (17%).

**Neither brand colour is legible as text on white** — 1.88:1 and 1.35:1 respectively. Both pass comfortably on dark navy `#0E2235` at 8.59:1 and 12.01:1. So this is a dark-background palette by arithmetic, not by taste, and attempt 1's dark direction carries forward for that reason.

The yellow was **never used in attempt 1 at all**, despite being the logo's most distinctive element. Worth reclaiming.

The site the platform replaces uses the same blue as an accent on white with dark text. The new product should mirror the palette while going dark, per the contrast numbers above.

Michael's stated preference: light footprint, modern, adaptive, professional. Consistency between web and native is essential — achieved through shared design tokens and shared logic, not shared components.
